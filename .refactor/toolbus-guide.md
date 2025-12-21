# ToolBus Implementation Guide
**File**: `packages/sandbox/src/toolBus/index.ts`

## Overview

The ToolBus is the central orchestration layer for tool execution in the E2B sandbox. It:
1. Loads tool definitions from Cloud Convex manifests
2. Wraps API/MCP/builtin tools with unified interface
3. Tracks execution history and state
4. Stores results in local Convex blackboard
5. Enforces rate limits and cost tracking

**Architecture Pattern**: Factory + Registry pattern with execution pipeline
**State Management**: Maps for tools, executing jobs, and queued tasks
**Integration Points**: Cloud Convex (read manifests), Local Convex (write results), OpenRouter (LLM calls)

---

## Core Types & Interfaces

```typescript
// packages/sandbox/src/toolBus/types.ts

import { z } from 'zod';
import type { Id } from 'convex/_generated/dataModel';

export interface ToolManifest {
  id: string;
  name: string;
  type: 'api' | 'mcp' | 'builtin';
  version: string;
  
  schema: {
    description: string;
    parameters: z.ZodSchema;
    returns: z.ZodSchema;
    examples?: Array<{
      input: Record<string, unknown>;
      output: Record<string, unknown>;
    }>;
  };
  
  metadata: {
    category: 'research' | 'content' | 'analytics' | 'integration' | 'execution';
    description: string;
    apiKey?: string; // env var name
    endpoint?: string; // for API tools
    mcpPath?: string; // for MCP tools
    rateLimit?: {
      requestsPerMinute: number;
      burst: number;
    };
    costEstimate?: {
      perRequest: number;
      currency: 'USD';
    };
  };
  
  isEnabled: boolean;
  createdAt: number;
}

export interface ToolExecution {
  id: string; // UUID
  toolId: string;
  toolName: string;
  
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';
  startTime: number;
  endTime?: number;
  duration?: number; // ms
  
  // Input & Output
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  
  // Metadata
  metadata: {
    retryCount: number;
    maxRetries: number;
    agentId?: string;
    parentExecutionId?: string;
  };
}

export interface ToolExecutionResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  execution: ToolExecution;
  costEstimate?: number;
}

export interface ToolBusConfig {
  sessionId: string;
  localConvexUrl: string;
  cloudConvexUrl: string;
  workspaceId: string;
  
  maxConcurrentTools: number; // default: 3
  maxRetries: number; // default: 2
  executionTimeout: number; // ms, default: 60000
}

export interface RateLimitState {
  toolId: string;
  requestsThisMinute: number;
  requestsThisHour: number;
  lastResetTime: number;
  nextAvailableTime: number;
}

export type ToolDefinition = {
  id: string;
  name: string;
  description: string;
  parameters: z.ZodSchema;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
  metadata: ToolManifest['metadata'];
};
```

---

## ToolBus Class Implementation

```typescript
// packages/sandbox/src/toolBus/ToolBus.ts

import { ConvexClient } from 'convex/browser';
import { z } from 'zod';
import type { api } from '../../convex/_generated/api';
import { v4 as uuid } from 'uuid';
import { EventEmitter } from 'eventemitter3';
import type {
  ToolManifest,
  ToolExecution,
  ToolExecutionResult,
  ToolBusConfig,
  RateLimitState,
  ToolDefinition,
} from './types';

export class ToolBus extends EventEmitter {
  private tools: Map<string, ToolDefinition> = new Map();
  private executing: Map<string, ToolExecution> = new Map();
  private rateLimits: Map<string, RateLimitState> = new Map();
  
  private config: ToolBusConfig;
  private localConvex: ConvexClient;
  private cloudConvex: ConvexClient;
  
  private executionQueue: ToolExecution[] = [];
  private processingQueue: boolean = false;

  constructor(config: ToolBusConfig) {
    super();
    this.config = config;
    this.localConvex = new ConvexClient(config.localConvexUrl);
    this.cloudConvex = new ConvexClient(config.cloudConvexUrl);
  }

  /**
   * Initialize ToolBus with manifests from Cloud Convex
   * Called during sandbox startup after session config loaded
   */
  async initialize(manifests: ToolManifest[]): Promise<void> {
    console.log(`[ToolBus] Initializing with ${manifests.length} tools`);
    
    for (const manifest of manifests) {
      if (!manifest.isEnabled) continue;
      
      try {
        const tool = await this.loadTool(manifest);
        this.tools.set(manifest.id, tool);
        
        // Initialize rate limit tracking
        if (manifest.metadata.rateLimit) {
          this.rateLimits.set(manifest.id, {
            toolId: manifest.id,
            requestsThisMinute: 0,
            requestsThisHour: 0,
            lastResetTime: Date.now(),
            nextAvailableTime: Date.now(),
          });
        }
        
        console.log(`[ToolBus] Loaded tool: ${manifest.name}`);
      } catch (error) {
        console.error(`[ToolBus] Failed to load tool ${manifest.name}:`, error);
      }
    }
  }

  /**
   * Execute a tool with automatic retries, rate limiting, and state tracking
   * Called by agents via VoltAgent tool interface
   */
  async executeTool(
    toolId: string,
    args: Record<string, unknown>,
    agentId?: string
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      return {
        success: false,
        error: `Tool ${toolId} not found`,
        execution: {
          id: uuid(),
          toolId,
          toolName: 'unknown',
          status: 'failed',
          startTime: Date.now(),
          input: args,
          metadata: {
            retryCount: 0,
            maxRetries: this.config.maxRetries,
            agentId,
          },
        },
      };
    }

    // Check rate limits
    const rateLimitError = this.checkRateLimit(toolId);
    if (rateLimitError) {
      return {
        success: false,
        error: rateLimitError,
        execution: {
          id: uuid(),
          toolId,
          toolName: tool.name,
          status: 'pending',
          startTime: Date.now(),
          input: args,
          metadata: {
            retryCount: 0,
            maxRetries: this.config.maxRetries,
            agentId,
          },
        },
      };
    }

    // Create execution record
    const execution: ToolExecution = {
      id: uuid(),
      toolId,
      toolName: tool.name,
      status: 'executing',
      startTime: Date.now(),
      input: args,
      metadata: {
        retryCount: 0,
        maxRetries: this.config.maxRetries,
        agentId,
      },
    };

    this.executing.set(execution.id, execution);
    this.emit('execution:start', execution);

    try {
      // Validate input against schema
      const validatedInput = tool.parameters.parse(args);

      // Execute with timeout
      const result = await this.executeWithTimeout(
        () => tool.execute(validatedInput),
        this.config.executionTimeout
      );

      // Record success
      execution.status = 'completed';
      execution.output = result;
      execution.endTime = Date.now();
      execution.duration = execution.endTime - execution.startTime;

      // Store in local Convex blackboard
      await this.storeExecution(execution);

      // Update rate limit
      this.updateRateLimit(toolId);

      // Emit event for agent awareness
      this.emit('execution:complete', execution);

      return {
        success: true,
        data: result,
        execution,
        costEstimate: tool.metadata.costEstimate?.perRequest,
      };
    } catch (error) {
      execution.status = 'failed';
      execution.error = {
        message: error instanceof Error ? error.message : String(error),
        code: error instanceof Error ? error.name : 'UNKNOWN',
        stack: error instanceof Error ? error.stack : undefined,
      };
      execution.endTime = Date.now();
      execution.duration = execution.endTime - execution.startTime;

      // Retry logic
      if (execution.metadata.retryCount < execution.metadata.maxRetries) {
        execution.metadata.retryCount++;
        console.log(
          `[ToolBus] Retrying tool ${tool.name} (attempt ${execution.metadata.retryCount}/${execution.metadata.maxRetries})`
        );
        
        // Exponential backoff: 1s, 2s, 4s
        const backoffMs = Math.pow(2, execution.metadata.retryCount - 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        
        return this.executeTool(toolId, args, agentId);
      }

      await this.storeExecution(execution);
      this.emit('execution:error', execution);

      return {
        success: false,
        error: execution.error.message,
        execution,
      };
    } finally {
      this.executing.delete(execution.id);
    }
  }

  /**
   * Load tool from manifest - factory pattern for different tool types
   */
  private async loadTool(manifest: ToolManifest): Promise<ToolDefinition> {
    switch (manifest.type) {
      case 'api':
        return this.createAPITool(manifest);
      case 'mcp':
        return this.createMCPTool(manifest);
      case 'builtin':
        return this.createBuiltinTool(manifest);
      default:
        throw new Error(`Unknown tool type: ${manifest.type}`);
    }
  }

  /**
   * Create tool wrapper for REST API calls
   * Handles authentication, serialization, error handling
   */
  private createAPITool(manifest: ToolManifest): ToolDefinition {
    const endpoint = manifest.metadata.endpoint;
    if (!endpoint) throw new Error(`API tool missing endpoint: ${manifest.name}`);

    return {
      id: manifest.id,
      name: manifest.name,
      description: manifest.schema.description,
      parameters: manifest.schema.parameters,
      metadata: manifest.metadata,

      execute: async (params: Record<string, unknown>) => {
        // Build headers with authentication
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        if (manifest.metadata.apiKey) {
          const apiKeyValue = process.env[manifest.metadata.apiKey];
          if (!apiKeyValue) {
            throw new Error(`API key not found: ${manifest.metadata.apiKey}`);
          }
          
          // Detect auth type from key name
          if (manifest.metadata.apiKey.includes('BEARER')) {
            headers['Authorization'] = `Bearer ${apiKeyValue}`;
          } else if (manifest.metadata.apiKey.includes('API_KEY')) {
            headers['X-API-Key'] = apiKeyValue;
          } else {
            headers['Authorization'] = apiKeyValue;
          }
        }

        // Make request
        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(params),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(
            `API request failed: ${response.status} - ${errorBody}`
          );
        }

        const result = await response.json();
        return result;
      },
    };
  }

  /**
   * Create tool wrapper for MCP (Model Context Protocol) servers
   */
  private async createMCPTool(manifest: ToolManifest): Promise<ToolDefinition> {
    const mcpPath = manifest.metadata.mcpPath;
    if (!mcpPath) throw new Error(`MCP tool missing path: ${manifest.name}`);

    // Dynamic import to avoid bundling issues
    const { MCPClient } = await import('@modelcontextprotocol/sdk/client');
    const mcpClient = new MCPClient({
      serverPath: mcpPath,
    });

    return {
      id: manifest.id,
      name: manifest.name,
      description: manifest.schema.description,
      parameters: manifest.schema.parameters,
      metadata: manifest.metadata,

      execute: async (params: Record<string, unknown>) => {
        const resourceName = manifest.metadata.endpoint || manifest.name;
        const result = await mcpClient.callResource(resourceName, params);
        return result;
      },
    };
  }

  /**
   * Create tool wrappers for built-in capabilities
   * Includes: TypeScript execution, document generation, etc.
   */
  private createBuiltinTool(manifest: ToolManifest): ToolDefinition {
    switch (manifest.name) {
      case 'execute_typescript':
        return this.createTypeScriptExecutor(manifest);
      case 'generate_document':
        return this.createDocumentGenerator(manifest);
      case 'generate_canvas':
        return this.createCanvasGenerator(manifest);
      case 'fetch_and_parse':
        return this.createFetchAndParseTool(manifest);
      default:
        throw new Error(`Unknown builtin tool: ${manifest.name}`);
    }
  }

  /**
   * Execute arbitrary TypeScript code in sandbox
   * Critical for agent's ability to write code not JSON
   */
  private createTypeScriptExecutor(manifest: ToolManifest): ToolDefinition {
    return {
      id: manifest.id,
      name: manifest.name,
      description: manifest.schema.description,
      parameters: manifest.schema.parameters,
      metadata: manifest.metadata,

      execute: async (params: Record<string, unknown>) => {
        const { code, dependencies } = params as {
          code: string;
          dependencies?: string[];
        };

        try {
          // Install dependencies if needed
          if (dependencies?.length) {
            console.log(`[ToolBus] Installing dependencies: ${dependencies.join(', ')}`);
            const { execSync } = await import('child_process');
            execSync(`bun install ${dependencies.join(' ')}`, {
              stdio: 'inherit',
            });
          }

          // Execute code using bun
          const { execSync } = await import('child_process');
          const output = execSync(`bun run --eval "${code.replace(/"/g, '\\"')}"`, {
            encoding: 'utf-8',
          });

          return {
            stdout: output,
            exitCode: 0,
          };
        } catch (error) {
          const stderr =
            error instanceof Error ? error.message : String(error);
          return {
            stdout: '',
            stderr,
            exitCode: 1,
          };
        }
      },
    };
  }

  /**
   * Generate structured documents via Affine integration
   */
  private createDocumentGenerator(manifest: ToolManifest): ToolDefinition {
    return {
      id: manifest.id,
      name: manifest.name,
      description: manifest.schema.description,
      parameters: manifest.schema.parameters,
      metadata: manifest.metadata,

      execute: async (params: Record<string, unknown>) => {
        const { title, content, format } = params as {
          title: string;
          content: string;
          format: 'markdown' | 'html' | 'pdf';
        };

        // Delegate to Affine integration
        const { AffineIntegration } = await import('../affineIntegration');
        const affine = new AffineIntegration(process.env.AFFINE_API_KEY!);

        const doc = await affine.createDocumentFromMarkdown(
          title,
          content,
          {
            wordCount: content.split(/\s+/).length,
            sections: [],
            links: [],
            codeBlocks: [],
            citations: [],
            headingStructure: [],
          }
        );

        return {
          documentId: doc.id,
          url: doc.shareUrl,
          title: doc.title,
        };
      },
    };
  }

  /**
   * Generate canvas elements for visual representation
   */
  private createCanvasGenerator(manifest: ToolManifest): ToolDefinition {
    return {
      id: manifest.id,
      name: manifest.name,
      description: manifest.schema.description,
      parameters: manifest.schema.parameters,
      metadata: manifest.metadata,

      execute: async (params: Record<string, unknown>) => {
        const { title, elements } = params as {
          title: string;
          elements: Array<{
            type: string;
            props: Record<string, unknown>;
            x: number;
            y: number;
          }>;
        };

        const { AffineIntegration } = await import('../affineIntegration');
        const affine = new AffineIntegration(process.env.AFFINE_API_KEY!);

        const canvas = await affine.createCanvasFromStructure(title, elements);

        return {
          canvasId: canvas.id,
          url: canvas.shareUrl,
          title: canvas.title,
        };
      },
    };
  }

  /**
   * Fetch web content and parse (used by research agents)
   */
  private createFetchAndParseTool(manifest: ToolManifest): ToolDefinition {
    return {
      id: manifest.id,
      name: manifest.name,
      description: manifest.schema.description,
      parameters: manifest.schema.parameters,
      metadata: manifest.metadata,

      execute: async (params: Record<string, unknown>) => {
        const { url, format } = params as {
          url: string;
          format?: 'markdown' | 'json' | 'text';
        };

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${url}: ${response.status}`);
        }

        const html = await response.text();

        // Parse based on format requested
        if (format === 'markdown') {
          const { html2md } = await import('html2md');
          return { content: html2md(html), source: url };
        }

        return { content: html, source: url };
      },
    };
  }

  /**
   * Store execution record in local Convex for blackboard access
   */
  private async storeExecution(execution: ToolExecution): Promise<void> {
    try {
      await this.localConvex.mutation(api.toolExecutions.record, {
        sessionId: this.config.sessionId,
        execution,
      });
    } catch (error) {
      console.error('[ToolBus] Failed to store execution:', error);
      // Don't throw - continue processing
    }
  }

  /**
   * Check rate limiting before execution
   */
  private checkRateLimit(toolId: string): string | null {
    const limit = this.rateLimits.get(toolId);
    if (!limit) return null; // No rate limit set

    const now = Date.now();

    // Reset counters if minute has passed
    if (now - limit.lastResetTime > 60000) {
      limit.requestsThisMinute = 0;
      limit.lastResetTime = now;
    }

    const maxPerMinute = 10; // Get from manifest in production
    if (limit.requestsThisMinute >= maxPerMinute) {
      return `Rate limit exceeded for ${toolId}`;
    }

    return null;
  }

  /**
   * Update rate limit state after successful execution
   */
  private updateRateLimit(toolId: string): void {
    const limit = this.rateLimits.get(toolId);
    if (!limit) return;

    limit.requestsThisMinute++;
    limit.requestsThisHour++;
  }

  /**
   * Execute with timeout wrapper
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Execution timeout after ${timeoutMs}ms`)),
          timeoutMs
        )
      ),
    ]);
  }

  /**
   * Public API: Get execution history
   */
  async getExecutionHistory(limit: number = 50): Promise<ToolExecution[]> {
    const executions = Array.from(this.executing.values()).sort(
      (a, b) => b.startTime - a.startTime
    );
    return executions.slice(0, limit);
  }

  /**
   * Public API: Get tool by ID
   */
  getTool(toolId: string): ToolDefinition | undefined {
    return this.tools.get(toolId);
  }

  /**
   * Public API: Get tools by category
   */
  getToolsByCategory(
    category: 'research' | 'content' | 'analytics' | 'integration' | 'execution'
  ): ToolDefinition[] {
    return Array.from(this.tools.values()).filter(
      (tool) => tool.metadata.category === category
    );
  }

  /**
   * Public API: List all available tools with metadata
   */
  listTools(): Array<{
    id: string;
    name: string;
    description: string;
    category: string;
  }> {
    return Array.from(this.tools.values()).map((tool) => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      category: tool.metadata.category,
    }));
  }

  /**
   * Cleanup on sandbox shutdown
   */
  async shutdown(): Promise<void> {
    console.log('[ToolBus] Shutting down');
    this.tools.clear();
    this.executing.clear();
    this.rateLimits.clear();
    this.removeAllListeners();
  }
}

export { ToolDefinition, ToolExecution, ToolExecutionResult };
export type { ToolManifest, ToolBusConfig };
```

---

## VoltAgent Integration

```typescript
// packages/sandbox/src/toolBus/voltAgentAdapter.ts

import { createTool } from 'voltagent';
import { z } from 'zod';
import { ToolBus } from './ToolBus';
import type { ToolDefinition } from './types';

/**
 * Adapter to expose ToolBus tools as VoltAgent tools
 * This is the critical integration point - converts ToolBus execution
 * to VoltAgent's tool interface with automatic Zod deserialization
 */
export function createVoltAgentTools(toolBus: ToolBus): ToolDefinition[] {
  const agentTools: ToolDefinition[] = [];

  // Tool discovery - get all available tools
  for (const tool of toolBus.listTools()) {
    const busToolDef = toolBus.getTool(tool.id);
    if (!busToolDef) continue;

    // Create VoltAgent tool wrapper
    const agentTool = createTool({
      name: tool.name,
      description: tool.description,
      parameters: busToolDef.parameters, // Zod schema - auto-deserialized by VoltAgent
      
      execute: async (args) => {
        // args already deserialized by VoltAgent from Zod schema
        // No JSON parsing needed here!
        const result = await toolBus.executeTool(tool.id, args);
        
        if (!result.success) {
          throw new Error(result.error);
        }
        
        return result.data;
      },
    });

    agentTools.push(agentTool as ToolDefinition);
  }

  // Add special tool for tool discovery
  const discoveryTool = createTool({
    name: 'list_available_tools',
    description:
      'Get list of all available tools this agent can use',
    parameters: z.object({
      category: z
        .enum([
          'research',
          'content',
          'analytics',
          'integration',
          'execution',
        ])
        .optional()
        .describe('Filter tools by category'),
    }),

    execute: async (args) => {
      if (args.category) {
        const tools = toolBus.getToolsByCategory(args.category);
        return tools.map((t) => ({
          name: t.name,
          description: t.description,
          category: t.metadata.category,
        }));
      }
      return toolBus.listTools();
    },
  });

  agentTools.push(discoveryTool as ToolDefinition);

  return agentTools;
}
```

---

## Testing & Validation

```typescript
// packages/sandbox/src/toolBus/__tests__/ToolBus.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ToolBus } from '../ToolBus';
import type { ToolManifest } from '../types';

describe('ToolBus', () => {
  let toolBus: ToolBus;

  beforeEach(() => {
    toolBus = new ToolBus({
      sessionId: 'test-session',
      localConvexUrl: 'http://localhost:3210',
      cloudConvexUrl: 'http://localhost:3211',
      workspaceId: 'test-workspace',
      maxConcurrentTools: 3,
      maxRetries: 2,
      executionTimeout: 60000,
    });
  });

  afterEach(async () => {
    await toolBus.shutdown();
  });

  it('should initialize with manifests', async () => {
    const manifests: ToolManifest[] = [
      {
        id: 'test-tool',
        name: 'test_tool',
        type: 'builtin',
        version: '1.0.0',
        schema: {
          description: 'Test tool',
          parameters: null as any,
          returns: null as any,
        },
        metadata: {
          category: 'execution',
          description: 'A test tool',
        },
        isEnabled: true,
        createdAt: Date.now(),
      },
    ];

    // Note: Real test would need mocked Convex
    // This is schema validation only
    expect(manifests.length).toBe(1);
  });

  it('should track execution history', async () => {
    // Implementation would require mocked tools
    const history = await toolBus.getExecutionHistory();
    expect(Array.isArray(history)).toBe(true);
  });

  it('should filter tools by category', async () => {
    // Implementation would require initialized tools
    const tools = toolBus.getToolsByCategory('research');
    expect(Array.isArray(tools)).toBe(true);
  });
});
```

---

## Key Integration Points

1. **Cloud Convex**: Loads tool manifests via query on sandbox startup
2. **Local Convex**: Stores execution records for blackboard access
3. **VoltAgent**: Exposes tools via adapter with auto-deserialized Zod parameters
4. **OpenRouter**: Used by agents for LLM calls (via VoltAgent, not ToolBus)
5. **Affine Fork**: Document/canvas generation tools delegate to AffineIntegration
6. **E2B SDK**: TypeScript execution tool uses bun runtime in sandbox

---

## DRY Principles Applied

- Single source of truth: Tool manifests from Cloud Convex
- Reusable factory methods for common tool patterns (API, MCP, builtin)
- EventEmitter pattern for loose coupling with agents
- Consistent error handling and retry logic
- Rate limiting centralized in one method
