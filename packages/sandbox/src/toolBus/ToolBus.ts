import { ConvexClient } from 'convex/browser';
import { Tool as AiTool } from 'ai';
import { z } from 'zod';
import fetch from 'node-fetch';

// We'll define these types here for now, but they should ideally come from a shared package
export interface ToolManifest {
  id: string;
  name: string;
  type: 'api' | 'mcp' | 'builtin';
  metadata: {
    description?: string;
    endpoint?: string;
    mcpPath?: string;
    resourceName?: string;
    apiKeyField?: string;
    [key: string]: any;
  };
  schema: any; // JSON Schema
}

export interface ToolExecution {
  id: string;
  toolId: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  metadata: Record<string, unknown>;
}

export interface SessionConfig {
  sessionId: string;
  localConvexUrl: string;
}

export class ToolBus {
  private tools: Map<string, AiTool> = new Map();
  private convexClient: ConvexClient;
  private sessionId: string;

  constructor(sessionConfig: SessionConfig) {
    this.sessionId = sessionConfig.sessionId;
    this.convexClient = new ConvexClient(sessionConfig.localConvexUrl);
  }

  /**
   * Initialize the ToolBus with a set of tool manifests.
   */
  async initialize(toolManifests: ToolManifest[]): Promise<void> {
    for (const manifest of toolManifests) {
      try {
        const tool = await this.loadTool(manifest);
        this.tools.set(manifest.id, tool);
      } catch (error) {
        console.error(`Failed to load tool ${manifest.id}:`, error);
      }
    }
  }

  /**
   * Get all registered tools as Vercel AI SDK Tools.
   */
  getRegisteredTools(): Record<string, AiTool> {
    const toolsRecord: Record<string, AiTool> = {};
    this.tools.forEach((tool, id) => {
      toolsRecord[id] = tool;
    });
    return toolsRecord;
  }

  private async loadTool(manifest: ToolManifest): Promise<AiTool> {
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

  private createAPITool(manifest: ToolManifest): AiTool {
    return {
      description: manifest.metadata.description || manifest.name,
      parameters: this.jsonSchemaToZod(manifest.schema),
      execute: async params => {
        const executionId = crypto.randomUUID();
        await this.recordExecutionStart(executionId, manifest.id, params);

        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };

          if (
            manifest.metadata.apiKeyField &&
            process.env[manifest.metadata.apiKeyField]
          ) {
            headers['Authorization'] =
              `Bearer ${process.env[manifest.metadata.apiKeyField]}`;
          }

          const response = await fetch(manifest.metadata.endpoint!, {
            method: 'POST',
            headers,
            body: JSON.stringify(params),
          });

          if (!response.ok) {
            throw new Error(
              `API request failed with status ${response.status}: ${await response.text()}`
            );
          }

          const result = await response.json();
          await this.recordExecutionSuccess(executionId, result);
          return result;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          await this.recordExecutionError(executionId, errorMessage);
          throw error;
        }
      },
    };
  }

  private createMCPTool(manifest: ToolManifest): AiTool {
    return {
      description: manifest.metadata.description || manifest.name,
      parameters: this.jsonSchemaToZod(manifest.schema),
      execute: async params => {
        throw new Error(
          'MCP tools are not yet implemented in this sandbox environment.'
        );
      },
    };
  }

  private createBuiltinTool(manifest: ToolManifest): AiTool {
    if (manifest.id === 'execute_typescript') {
      return this.createTypeScriptExecutor();
    }
    if (manifest.id === 'generate_document') {
      return this.createDocumentGenerator();
    }

    throw new Error(`Builtin tool ${manifest.id} not recognized.`);
  }

  private createTypeScriptExecutor(): AiTool {
    return {
      description: 'Execute arbitrary TypeScript code in a secure sandbox',
      parameters: z.object({
        code: z.string(),
        dependencies: z.array(z.string()).optional(),
      }),
      execute: async args => {
        const executionId = crypto.randomUUID();
        await this.recordExecutionStart(
          executionId,
          'execute_typescript',
          args
        );

        try {
          console.log(
            `[TypeScriptExecutor] Executing code: ${args.code.substring(0, 100)}...`
          );
          const result = {
            stdout: 'Code executed successfully (mock)',
            exitCode: 0,
          };
          await this.recordExecutionSuccess(executionId, result);
          return result;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          await this.recordExecutionError(executionId, errorMessage);
          throw error;
        }
      },
    };
  }

  private createDocumentGenerator(): AiTool {
    return {
      description: 'Generate a structured document in Affine',
      parameters: z.object({
        title: z.string(),
        content: z.string(),
        format: z.enum(['markdown', 'html']).optional().default('markdown'),
      }),
      execute: async args => {
        const executionId = crypto.randomUUID();
        await this.recordExecutionStart(executionId, 'generate_document', args);

        try {
          console.log(`[DocumentGenerator] Generating document: ${args.title}`);
          const result = {
            documentId: `doc_${Math.random().toString(36).substring(7)}`,
            status: 'created',
          };
          await this.recordExecutionSuccess(executionId, result);
          return result;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          await this.recordExecutionError(executionId, errorMessage);
          throw error;
        }
      },
    };
  }

  private async recordExecutionStart(id: string, toolId: string, input: any) {
    try {
      // @ts-ignore
      await this.convexClient.mutation('tasks:recordToolExecution', {
        sessionId: this.sessionId,
        executionId: id,
        toolId,
        toolName: toolId,
        status: 'running',
        input,
        startTime: Date.now(),
      });
    } catch (e) {
      console.warn('Failed to log tool execution start to Convex:', e);
    }
  }

  private async recordExecutionSuccess(id: string, output: any) {
    try {
      // @ts-ignore
      await this.convexClient.mutation('tasks:recordToolExecution', {
        sessionId: this.sessionId,
        executionId: id,
        status: 'success',
        output,
      });
    } catch (e) {
      console.warn('Failed to log tool execution success to Convex:', e);
    }
  }

  private async recordExecutionError(id: string, error: string) {
    try {
      // @ts-ignore
      await this.convexClient.mutation('tasks:recordToolExecution', {
        sessionId: this.sessionId,
        executionId: id,
        status: 'error',
        error,
      });
    } catch (e) {
      console.warn('Failed to log tool execution error to Convex:', e);
    }
  }

  private jsonSchemaToZod(schema: any): z.ZodTypeAny {
    if (!schema || schema.type !== 'object') {
      return z.any();
    }

    const shape: Record<string, z.ZodTypeAny> = {};
    const properties = schema.properties || {};
    const required = schema.required || [];

    for (const [key, prop] of Object.entries(properties)) {
      let zodType: z.ZodTypeAny = z.any();
      const p = prop as any;

      if (p.type === 'string') zodType = z.string();
      else if (p.type === 'number') zodType = z.number();
      else if (p.type === 'boolean') zodType = z.boolean();
      else if (p.type === 'array') zodType = z.array(z.any());

      if (p.description) zodType = zodType.describe(p.description);
      if (!required.includes(key)) zodType = zodType.optional();

      shape[key] = zodType;
    }

    return z.object(shape);
  }
}
