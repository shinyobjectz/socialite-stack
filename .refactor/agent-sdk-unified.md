# Socialite Agent SDK: Unified Interface

## Overview

Single TypeScript SDK that combines Stately (state machine) + VoltAgent (execution) + Convex (persistence) into one developer-friendly interface.

**One import. One interface. Three powerful systems working together.**

```typescript
import { Agent } from '@socialite/agent-sdk';

// That's it. Everything else is configuration.
const agent = new Agent(config);
await agent.run(userRequest);
```

---

## Architecture

```
┌──────────────────────────────────────────┐
│  @socialite/agent-sdk                    │
│                                          │
│  Single unified interface:               │
│  • Define states                         │
│  • Define tools per state                │
│  • Define prompts per state              │
│  • Run agent                             │
└────────┬─────────────────────────────────┘
         │
    ┌────┴───────┬─────────────┬──────────┐
    ↓            ↓             ↓          ↓
┌────────┐  ┌─────────┐  ┌────────┐  ┌───────┐
│Stately │  │VoltAgent│  │ Convex │  │ToolBus│
│ Exec   │  │ Exec    │  │ Exec   │  │ Exec  │
│        │  │         │  │        │  │       │
│ State  │  │ Agent   │  │ Persist│  │ Tools │
│ Mach   │  │Instance │  │        │  │       │
└────────┘  └─────────┘  └────────┘  └───────┘
```

---

## API: Define Your Agent

```typescript
// packages/sdk/src/Agent.ts

import { Agent, createTool, z } from '@socialite/agent-sdk';

export const myAgent = new Agent({
  // Identity
  name: 'Socialite',
  model: 'gpt-4o',
  
  // State machine definition (replaces Stately manually)
  states: {
    gathering: {
      // State-specific configuration
      description: 'Research and gather information',
      
      // Tools available ONLY in this state
      tools: ['search_web', 'fetch_content', 'execute_typescript'],
      
      // System prompt for this state
      instructions: `You are in the gathering phase.
      Search for information, cite sources, store findings in blackboard.`,
      
      // Cost limits for this state
      costLimit: 10,
      
      // Next states this can transition to
      transitions: {
        success: 'analyzing',
        error: 'error'
      }
    },
    
    analyzing: {
      description: 'Analyze gathered information',
      tools: ['execute_typescript', 'analyze_code'],
      instructions: `You are in the analyzing phase.
      Review blackboard findings, extract patterns, store insights.`,
      costLimit: 5,
      transitions: {
        success: 'synthesizing',
        error: 'error'
      }
    },
    
    synthesizing: {
      description: 'Create final output',
      tools: ['generate_document', 'generate_canvas'],
      instructions: `You are in the synthesizing phase.
      Create polished output combining research and analysis.`,
      costLimit: 15,
      transitions: {
        success: 'complete',
        error: 'error'
      }
    },
    
    complete: {
      type: 'final',
      description: 'Session complete'
    },
    
    error: {
      type: 'final',
      description: 'Session failed'
    }
  },
  
  // Initial state
  initialState: 'gathering',
  
  // Convex configuration (auto-managed)
  convex: {
    url: 'http://localhost:3210',
    sessionId: sessionId, // Provided at runtime
  },
  
  // Blackboard configuration (auto-managed)
  blackboard: {
    namespaces: ['gathering', 'analyzing', 'synthesis'],
  },
  
  // Tool configuration
  toolBus: {
    tools: [
      {
        id: 'search_web',
        name: 'Search Web',
        type: 'api',
        category: 'research',
        endpoint: 'https://api.serpapi.com',
        schema: z.object({
          query: z.string(),
          limit: z.number().optional(),
        }),
      },
      {
        id: 'fetch_content',
        name: 'Fetch Content',
        type: 'api',
        category: 'research',
        endpoint: 'https://api.exa.ai',
        schema: z.object({
          url: z.string(),
          format: z.enum(['markdown', 'html']),
        }),
      },
      {
        id: 'generate_document',
        name: 'Generate Document',
        type: 'builtin',
        category: 'content',
        schema: z.object({
          title: z.string(),
          content: z.string(),
          format: z.enum(['markdown', 'html', 'pdf']),
        }),
      },
      {
        id: 'generate_canvas',
        name: 'Generate Canvas',
        type: 'builtin',
        category: 'content',
        schema: z.object({
          title: z.string(),
          elements: z.array(z.object({
            type: z.string(),
            content: z.string(),
          })),
        }),
      },
      // More tools...
    ],
  },
  
  // Hook into state transitions
  hooks: {
    onStateChange: async (from, to) => {
      console.log(`Transitioning: ${from} → ${to}`);
    },
    
    onToolExecute: async (toolId, args) => {
      console.log(`Executing tool: ${toolId}`, args);
    },
    
    onBlackboardWrite: async (namespace, key, value) => {
      console.log(`Blackboard write: ${namespace}/${key}`);
    },
  },
});

// Run the agent
const result = await myAgent.run('Research AI trends and create a pitch deck');
```

---

## Agent Class: The SDK

```typescript
// packages/sdk/src/Agent.ts

import { createActor, setup } from 'xstate';
import { ConvexClient } from 'convex/client';
import VoltAgent from 'voltagent';

export interface AgentConfig {
  name: string;
  model: string;
  states: Record<string, StateDefinition>;
  initialState: string;
  convex: {
    url: string;
    sessionId: string;
  };
  blackboard: {
    namespaces: string[];
  };
  toolBus: {
    tools: ToolDefinition[];
  };
  hooks?: {
    onStateChange?: (from: string, to: string) => Promise<void>;
    onToolExecute?: (toolId: string, args: unknown) => Promise<void>;
    onBlackboardWrite?: (namespace: string, key: string, value: unknown) => Promise<void>;
  };
}

export interface StateDefinition {
  description: string;
  tools?: string[];
  instructions?: string;
  costLimit?: number;
  transitions?: Record<string, string>;
  type?: 'final';
}

export class Agent {
  private name: string;
  private model: string;
  private config: AgentConfig;
  private voltAgent: VoltAgent;
  private convex: ConvexClient;
  private machine: any;
  private actor: any;
  private currentState: string;
  private toolBus: ToolBusSDK;
  private sessionId: string;

  constructor(config: AgentConfig) {
    this.config = config;
    this.name = config.name;
    this.model = config.model;
    this.sessionId = config.convex.sessionId;
    this.currentState = config.initialState;

    // Initialize Convex
    this.convex = new ConvexClient(config.convex.url);

    // Initialize ToolBus
    this.toolBus = new ToolBusSDK(config.toolBus.tools);

    // Create state machine (replaces Stately setup)
    this.machine = this.createStateMachine(config);

    // Create actor from machine
    this.actor = createActor(this.machine);

    // Initialize VoltAgent (empty, will be configured per state)
    this.voltAgent = new VoltAgent({
      name: config.name,
      model: config.model,
      tools: [], // Will be set per state
      instructions: '', // Will be set per state
    });

    // Subscribe to state changes
    this.actor.subscribe((snapshot) => {
      this.onActorStateChange(snapshot);
    });
  }

  /**
   * Create Stately machine from config
   */
  private createStateMachine(config: AgentConfig) {
    const states: Record<string, any> = {};

    // Build XState machine from config
    for (const [stateName, stateDef] of Object.entries(config.states)) {
      if (stateDef.type === 'final') {
        states[stateName] = { type: 'final' };
      } else {
        states[stateName] = {
          invoke: {
            src: `run${stateName}`,
            onDone: {
              target: stateDef.transitions?.success || 'complete',
            },
            onError: {
              target: stateDef.transitions?.error || 'error',
            },
          },
        };
      }
    }

    return setup({
      actors: {
        // Create an actor for each state
        ...Object.keys(config.states).reduce((acc, stateName) => {
          acc[`run${stateName}`] = async () => {
            return this.runStateAgent(stateName);
          };
          return acc;
        }, {} as Record<string, any>),
      },
    }).createMachine({
      id: config.name.toLowerCase(),
      initial: config.initialState,
      states,
    });
  }

  /**
   * Run agent for a specific state
   */
  private async runStateAgent(stateName: string): Promise<void> {
    const stateDef = this.config.states[stateName];

    // Notify hook
    await this.config.hooks?.onStateChange?.(this.currentState, stateName);

    this.currentState = stateName;

    // Get tools for this state
    const toolIds = stateDef.tools || [];
    const tools = await this.toolBus.getTools(toolIds);

    // Convert tools to VoltAgent format
    const voltTools = tools.map((tool) =>
      this.createVoltAgentTool(tool)
    );

    // Update VoltAgent with state-specific config
    this.voltAgent.updateConfig({
      tools: voltTools,
      instructions: stateDef.instructions || '',
    });

    // Get context from blackboard (previous state outputs)
    const context = await this.getBlackboardContext();

    // Construct prompt with context
    const prompt = `${stateDef.instructions}\n\n${context}`;

    // Run VoltAgent
    const result = await this.voltAgent.run(prompt);

    // Store result in blackboard
    await this.writeBlackboard(stateName, 'output', result);
  }

  /**
   * Create a VoltAgent tool from ToolBus tool
   */
  private createVoltAgentTool(tool: any) {
    return createTool({
      name: tool.name,
      description: tool.schema.description || tool.name,
      parameters: tool.schema,
      execute: async (args: unknown) => {
        // Notify hook
        await this.config.hooks?.onToolExecute?.(tool.id, args);

        // Execute tool via ToolBus
        const result = await this.toolBus.executeTool(tool.id, args);

        // Store execution record
        await this.convex.mutation('api.toolResults.record', {
          sessionId: this.sessionId,
          toolId: tool.id,
          args,
          result,
          timestamp: Date.now(),
        });

        return result;
      },
    });
  }

  /**
   * Get context from blackboard for current state
   */
  private async getBlackboardContext(): Promise<string> {
    const entries = await this.convex.query('api.blackboard.search', {
      sessionId: this.sessionId,
      namespace: `${this.currentState}:*`,
    });

    if (entries.length === 0) return '';

    return (
      'Previous results:\n' +
      entries
        .map((e: any) => `${e.key}: ${JSON.stringify(e.value)}`)
        .join('\n')
    );
  }

  /**
   * Write to blackboard
   */
  private async writeBlackboard(
    namespace: string,
    key: string,
    value: unknown
  ): Promise<void> {
    // Notify hook
    await this.config.hooks?.onBlackboardWrite?.(namespace, key, value);

    // Write to Convex
    await this.convex.mutation('api.blackboard.write', {
      sessionId: this.sessionId,
      namespace,
      key,
      value,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle actor state changes
   */
  private async onActorStateChange(snapshot: any): Promise<void> {
    const state = snapshot.value;

    if (state === 'complete') {
      console.log(`[${this.name}] Agent complete`);
    } else if (state === 'error') {
      console.error(`[${this.name}] Agent error`);
    }
  }

  /**
   * Main entry point: run agent with request
   */
  async run(userRequest: string): Promise<AgentResult> {
    // Start actor
    this.actor.start();

    // Wait for completion
    return new Promise((resolve, reject) => {
      this.actor.subscribe((snapshot: any) => {
        if (snapshot.status === 'done') {
          resolve({
            status: 'success',
            artifacts: this.collectArtifacts(),
          });
        } else if (snapshot.value === 'error') {
          reject(new Error('Agent failed'));
        }
      });
    });
  }

  /**
   * Collect all artifacts from blackboard
   */
  private async collectArtifacts() {
    return this.convex.query('api.artifacts.list', {
      sessionId: this.sessionId,
    });
  }
}

export interface AgentResult {
  status: 'success' | 'error';
  artifacts: any[];
}
```

---

## ToolBus SDK: Tool Execution

```typescript
// packages/sdk/src/ToolBusSDK.ts

import fetch from 'node-fetch';

export interface ToolDefinition {
  id: string;
  name: string;
  type: 'api' | 'builtin' | 'mcp';
  category: string;
  endpoint?: string;
  schema: any;
}

export class ToolBusSDK {
  private tools: Map<string, ToolDefinition> = new Map();
  private executing: Map<string, any> = new Map();

  constructor(tools: ToolDefinition[]) {
    for (const tool of tools) {
      this.tools.set(tool.id, tool);
    }
  }

  /**
   * Get tools by ID
   */
  async getTools(toolIds: string[]): Promise<ToolDefinition[]> {
    return toolIds
      .map((id) => this.tools.get(id))
      .filter((t) => t !== undefined) as ToolDefinition[];
  }

  /**
   * Get tools by category
   */
  async getToolsByCategory(category: string): Promise<ToolDefinition[]> {
    return Array.from(this.tools.values()).filter(
      (t) => t.category === category
    );
  }

  /**
   * Execute a tool
   */
  async executeTool(toolId: string, args: unknown): Promise<unknown> {
    const tool = this.tools.get(toolId);
    if (!tool) throw new Error(`Tool not found: ${toolId}`);

    const execution = {
      id: generateId(),
      toolId,
      status: 'executing',
      startTime: Date.now(),
      args,
    };

    this.executing.set(execution.id, execution);

    try {
      let result: unknown;

      if (tool.type === 'api') {
        result = await this.executeApiTool(tool, args);
      } else if (tool.type === 'builtin') {
        result = await this.executeBuiltinTool(tool, args);
      } else if (tool.type === 'mcp') {
        result = await this.executeMcpTool(tool, args);
      }

      execution.status = 'completed';
      return result;
    } catch (error) {
      execution.status = 'failed';
      throw error;
    } finally {
      execution.endTime = Date.now();
    }
  }

  /**
   * Execute API tool (e.g., SerpAPI, Exa)
   */
  private async executeApiTool(
    tool: ToolDefinition,
    args: unknown
  ): Promise<unknown> {
    const response = await fetch(tool.endpoint!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Execute builtin tool (e.g., generate_document, generate_canvas)
   */
  private async executeBuiltinTool(
    tool: ToolDefinition,
    args: unknown
  ): Promise<unknown> {
    // Tools like generate_document, generate_canvas
    // These call Affine or other internal services
    switch (tool.id) {
      case 'generate_document':
        return this.affineGenerateDocument(args);
      case 'generate_canvas':
        return this.affineGenerateCanvas(args);
      case 'execute_typescript':
        return this.executeTypeScript(args);
      default:
        throw new Error(`Unknown builtin tool: ${tool.id}`);
    }
  }

  /**
   * Execute MCP tool
   */
  private async executeMcpTool(
    tool: ToolDefinition,
    args: unknown
  ): Promise<unknown> {
    // MCP (Model Context Protocol) tools
    // Integration with various servers
    throw new Error('MCP tools not yet implemented');
  }

  // Builtin tool implementations
  private async affineGenerateDocument(args: any): Promise<unknown> {
    // Call Affine API
    return {
      documentId: 'doc_123',
      url: 'https://affine.com/docs/doc_123',
    };
  }

  private async affineGenerateCanvas(args: any): Promise<unknown> {
    return {
      canvasId: 'canvas_456',
      url: 'https://affine.com/canvas/canvas_456',
    };
  }

  private async executeTypeScript(args: any): Promise<unknown> {
    // Execute code in E2B sandbox
    return { output: 'execution result' };
  }
}

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}
```

---

## Usage in SessionManager

```typescript
// packages/sandbox/src/session/SessionManager.ts

import { Agent } from '@socialite/agent-sdk';

export class SessionManager {
  async initialize(sessionConfig: SessionConfig) {
    try {
      this.emit('initialized');

      // Create agent with SDK
      const agent = new Agent({
        name: 'Socialite',
        model: sessionConfig.agentConfig.model,
        states: {
          gathering: {
            description: 'Research phase',
            tools: ['search_web', 'fetch_content', 'execute_typescript'],
            instructions: `Research the user's request thoroughly.
Store findings in the blackboard.`,
            costLimit: 10,
            transitions: {
              success: 'analyzing',
            },
          },
          analyzing: {
            description: 'Analysis phase',
            tools: ['execute_typescript'],
            instructions: `Analyze the gathered information.
Store insights in the blackboard.`,
            costLimit: 5,
            transitions: {
              success: 'synthesizing',
            },
          },
          synthesizing: {
            description: 'Synthesis phase',
            tools: ['generate_document', 'generate_canvas'],
            instructions: `Create the final output.
Use all blackboard data to create something great.`,
            costLimit: 15,
            transitions: {
              success: 'complete',
            },
          },
          complete: {
            type: 'final',
            description: 'Done',
          },
          error: {
            type: 'final',
            description: 'Error',
          },
        },
        initialState: 'gathering',
        convex: {
          url: sessionConfig.localConvexUrl,
          sessionId: sessionConfig.sessionId,
        },
        blackboard: {
          namespaces: ['gathering', 'analyzing', 'synthesis'],
        },
        toolBus: {
          tools: sessionConfig.toolManifests.map((m) => ({
            id: m.id,
            name: m.name,
            type: m.type,
            category: m.metadata.category,
            endpoint: m.metadata.endpoint,
            schema: m.schema,
          })),
        },
        hooks: {
          onStateChange: async (from, to) => {
            this.emit('progress', {
              stage: to,
              metrics: this.getMetrics(),
            });
          },
          onToolExecute: async (toolId) => {
            console.log(`Executing: ${toolId}`);
          },
        },
      });

      this.emit('tools_loaded');

      // Run agent
      const result = await agent.run(sessionConfig.metadata.userRequest);

      this.emit('progress', {
        stage: 'collecting_artifacts',
        metrics: this.getMetrics(),
      });

      // Sync to cloud
      await this.cloudConvex.mutation('api.sessions.syncResults', {
        sessionId: sessionConfig.sessionId,
        artifacts: result.artifacts,
      });

      this.emit('completed', result);
    } catch (error) {
      this.emit('error', error);
    } finally {
      await this.cleanup();
    }
  }
}
```

---

## Helper Functions

```typescript
// packages/sdk/src/index.ts

export { Agent } from './Agent';
export { ToolBusSDK } from './ToolBusSDK';

/**
 * Create a tool definition
 */
export function createTool(config: {
  name: string;
  description?: string;
  parameters: any;
  execute: (args: any) => Promise<any>;
}) {
  return config;
}

/**
 * Common tool definitions (pre-configured)
 */
export const tools = {
  // Research tools
  search_web: {
    id: 'search_web',
    name: 'Search Web',
    type: 'api' as const,
    category: 'research',
    endpoint: 'https://api.serpapi.com/search',
    schema: z.object({
      query: z.string().describe('Search query'),
      limit: z.number().optional().describe('Number of results'),
    }),
  },

  fetch_content: {
    id: 'fetch_content',
    name: 'Fetch Content',
    type: 'api' as const,
    category: 'research',
    endpoint: 'https://api.exa.ai/search',
    schema: z.object({
      query: z.string().describe('What to search for'),
      format: z.enum(['markdown', 'html']).default('markdown'),
    }),
  },

  // Content tools
  generate_document: {
    id: 'generate_document',
    name: 'Generate Document',
    type: 'builtin' as const,
    category: 'content',
    schema: z.object({
      title: z.string(),
      content: z.string(),
      format: z.enum(['markdown', 'html', 'pdf']).default('markdown'),
    }),
  },

  generate_canvas: {
    id: 'generate_canvas',
    name: 'Generate Canvas',
    type: 'builtin' as const,
    category: 'content',
    schema: z.object({
      title: z.string(),
      elements: z.array(
        z.object({
          type: z.string(),
          content: z.string(),
          x: z.number().optional(),
          y: z.number().optional(),
        })
      ),
    }),
  },

  // Code tools
  execute_typescript: {
    id: 'execute_typescript',
    name: 'Execute TypeScript',
    type: 'builtin' as const,
    category: 'analytics',
    schema: z.object({
      code: z.string().describe('TypeScript code to execute'),
      dependencies: z.array(z.string()).optional().describe('npm packages'),
    }),
  },
};
```

---

## Package Structure

```
packages/
├── sdk/
│   ├── src/
│   │   ├── Agent.ts          # Main agent class
│   │   ├── ToolBusSDK.ts     # Tool execution
│   │   ├── types.ts          # Type definitions
│   │   └── index.ts          # Exports
│   ├── package.json
│   └── tsconfig.json
│
├── db/
│   └── convex/               # Unchanged
│
└── frontend/
    └── pages/                # Unchanged
```

---

## Usage Examples

### Example 1: Simple Research Agent

```typescript
import { Agent, tools } from '@socialite/agent-sdk';

const researchAgent = new Agent({
  name: 'Researcher',
  model: 'gpt-4o',
  states: {
    researching: {
      tools: ['search_web', 'fetch_content'],
      instructions: 'Research the topic thoroughly.',
      transitions: { success: 'complete' },
    },
    complete: { type: 'final' },
  },
  initialState: 'researching',
  convex: { url: process.env.CONVEX_URL!, sessionId: 'session_1' },
  blackboard: { namespaces: ['research'] },
  toolBus: { tools: [tools.search_web, tools.fetch_content] },
});

const result = await researchAgent.run('Research AI trends');
```

### Example 2: Full Research + Content Pipeline

```typescript
const fullAgent = new Agent({
  name: 'ContentCreator',
  model: 'gpt-4o',
  states: {
    research: {
      tools: ['search_web', 'fetch_content', 'execute_typescript'],
      instructions: 'Gather research.',
      transitions: { success: 'analyze' },
    },
    analyze: {
      tools: ['execute_typescript'],
      instructions: 'Analyze findings.',
      transitions: { success: 'create' },
    },
    create: {
      tools: ['generate_document', 'generate_canvas'],
      instructions: 'Create final output.',
      transitions: { success: 'complete' },
    },
    complete: { type: 'final' },
  },
  initialState: 'research',
  convex: { url: process.env.CONVEX_URL!, sessionId: 'session_2' },
  blackboard: { namespaces: ['research', 'analysis', 'content'] },
  toolBus: {
    tools: [
      tools.search_web,
      tools.fetch_content,
      tools.execute_typescript,
      tools.generate_document,
      tools.generate_canvas,
    ],
  },
  hooks: {
    onStateChange: (from, to) => {
      console.log(`→ ${to}`);
    },
  },
});

const result = await fullAgent.run(
  'Research AI trends and create a pitch deck'
);
```

---

## Benefits

✅ **One interface**: Developers import `Agent`, not three separate systems
✅ **Declarative**: States + tools + prompts are config, not code
✅ **Type-safe**: Full TypeScript support
✅ **Composable**: Mix/match tools, states, transitions
✅ **Observable**: Hooks into every phase
✅ **Testable**: Unit test individual states
✅ **Extensible**: Add new states without touching core
✅ **Standard**: Uses XState, VoltAgent, Convex under hood

---

## Comparison

### Before (Three Separate Systems)

```typescript
// Import from three places
const machine = setup({...}).createMachine({...});
const actor = createActor(machine);
const agent = new Agent({...});
const convex = new ConvexClient(...);

// Manage them separately
actor.subscribe(...);
agent.updateConfig(...);
convex.mutation(...);

// Wire them together manually
```

### After (One SDK)

```typescript
// Import from one place
import { Agent } from '@socialite/agent-sdk';

// Create one thing
const agent = new Agent(config);

// Use it
await agent.run(request);
```

That's genuinely elegant. One SDK. Three powerful systems. All working together seamlessly.
