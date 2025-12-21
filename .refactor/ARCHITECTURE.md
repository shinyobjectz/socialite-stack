# Socialite Architecture: Enterprise Agent System with Affine Integration

## Executive Overview

Socialite is a sophisticated, multi-layered agent orchestration platform that extends Affine's document/canvas paradigm with:
- **Ephemeral Agent Sessions** (E2B sandboxes with VoltAgent)
- **Layered State Management** (Local Convex blackboards + Cloud Convex persistence)
- **Dynamic Tool Ecosystem** (API/MCP orchestration)
- **Content Generation** (Affine document/canvas output)

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                    Socialite Application Layer                   │
│                   (Next.js/Convex Frontend)                      │
│              Workspace, Sessions, Results Display                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Cloud Convex (Persistent)                     │
│                                                                   │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐ │
│  │  User Workspaces     │  │  Session History & Artifacts     │ │
│  │  - Settings          │  │  - Session records               │ │
│  │  - API Credentials   │  │  - Document/Canvas references   │ │
│  │  - Tool Configs      │  │  - Execution logs                │ │
│  │  - Integration Refs  │  │  - Metadata & timestamps         │ │
│  └──────────────────────┘  └──────────────────────────────────┘ │
│                                                                   │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐ │
│  │  Tool Manifests      │  │  Content Generation Cache        │ │
│  │  - API schemas       │  │  - Generated documents           │ │
│  │  - MCP registrations │  │  - Canvas snapshots              │ │
│  │  - Tool definitions  │  │  - Metadata extraction           │ │
│  └──────────────────────┘  └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                         ↑
                         │
              (Sync, Query, Persist)
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                      E2B Sandbox Session                         │
│                   (Ephemeral, Isolated)                          │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         VoltAgent Orchestration Layer                    │   │
│  │                                                           │   │
│  │  ┌────────────────┐  ┌─────────────────────────────────┐ │   │
│  │  │ Agent Registry │  │  Tool Router & Execution Engine  │ │   │
│  │  │ - MetaOmega    │  │  - Dynamic tool loading          │ │   │
│  │  │ - Omega (N)    │  │  - Tool orchestration            │ │   │
│  │  │ - SubAgent (N) │  │  - State management               │ │   │
│  │  └────────────────┘  └─────────────────────────────────┘ │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                         │                                        │
│  ┌──────────────────────┼──────────────────────────────────┐   │
│  │                      ↓                                   │   │
│  │  ┌──────────────────────────────┐  ┌──────────────────┐ │   │
│  │  │  Local Convex Instance       │  │  Tool Bus        │ │   │
│  │  │  (Session Blackboard)        │  │  (Event Loop)    │ │   │
│  │  │  - Analysis state            │  │                  │ │   │
│  │  │  - Real-time queries         │  │  Coordinates:    │ │   │
│  │  │  - Execution metadata        │  │  - APIs          │ │   │
│  │  │  - Tool results              │  │  - MCPs          │ │   │
│  │  │  - Intermediate artifacts    │  │  - Code exec     │ │   │
│  │  │  - Dependency tracking       │  │  - Content gen   │ │   │
│  │  └──────────────────────────────┘  └──────────────────┘ │   │
│  │                                                           │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │                                                           │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │ TypeScript   │  │ Affine Fork  │  │ External     │  │   │
│  │  │ Execution    │  │ (Doc/Canvas) │  │ Integrations │  │   │
│  │  │              │  │              │  │              │  │   │
│  │  │ • E2B SDK    │  │ • Document   │  │ • DataForSEO │  │   │
│  │  │ • Sandbox    │  │   generation │  │ • Moz        │  │   │
│  │  │ • Runtime    │  │ • Canvas     │  │ • SerpAPI    │  │   │
│  │  │ • Native TS  │  │   elements   │  │ • Exa        │  │   │
│  │  │   code exec  │  │ • Markdown   │  │ • Eleven Labs│  │   │
│  │  │              │  │ • PDF export │  │ • Suno       │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Node 20 + Bun Runtime + Convex Dev Server                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Models & Entities

### 1. Session Model (Cloud Convex)

```typescript
// packages/db/convex/sessions.ts

export interface Session {
  _id: Id<'sessions'>;
  workspaceId: Id<'workspaces'>;
  userId: Id<'users'>;
  
  // Identity
  sessionId: string; // UUID
  mode: 'research' | 'content' | 'analysis' | 'custom';
  title: string;
  description?: string;
  
  // Lifecycle
  status: 'initializing' | 'running' | 'paused' | 'completed' | 'failed';
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  expiresAt: number;
  
  // State
  sandboxId: string; // E2B sandbox identifier
  localConvexUrl: string; // Local Convex instance URL
  
  // Configuration
  agentConfig: AgentConfig;
  toolManifests: ToolManifest[]; // Loaded tools for this session
  executionLimits: ExecutionLimits;
  
  // Results
  outputDocuments: DocumentReference[];
  canvasArtifacts: CanvasReference[];
  metadata: Record<string, unknown>;
}

export interface AgentConfig {
  agentType: 'research' | 'content' | 'analyzer';
  model: string; // 'gpt-4o' etc
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
  tools: string[]; // Tool IDs to enable
  subAgents?: SubAgentConfig[];
}

export interface ExecutionLimits {
  maxDuration: number; // ms
  maxTokensPerRequest: number;
  maxConcurrentTools: number;
  maxAPICallsPerMinute: number;
  costLimit?: number;
}

export interface ToolManifest {
  id: string;
  name: string;
  type: 'api' | 'mcp' | 'builtin';
  schema: z.ZodSchema;
  handler: string; // Path to handler in sandbox
  metadata: {
    category: string;
    description: string;
    apiKey?: boolean;
    rateLimit?: number;
  };
}
```

### 2. Artifact Model (Cloud Convex)

```typescript
// packages/db/convex/artifacts.ts

export interface Artifact {
  _id: Id<'artifacts'>;
  sessionId: Id<'sessions'>;
  workspaceId: Id<'workspaces'>;
  
  // Identity
  artifactId: string;
  type: 'document' | 'canvas' | 'analysis' | 'transcript';
  
  // Content Reference
  affineDocId?: string; // Link to Affine document
  affineCanvasId?: string; // Link to Affine canvas
  
  // Metadata
  title: string;
  description?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  
  // Content
  content?: string; // Markdown/JSON
  metadata: DocumentMetadata;
  
  // Generation Info
  generatedBy: 'agent' | 'manual';
  generationPrompt?: string;
  sourceData?: Record<string, unknown>;
}

export interface DocumentMetadata {
  wordCount: number;
  sections: Section[];
  links: Link[];
  codeBlocks: CodeBlock[];
  citations: Citation[];
  headingStructure: HeadingNode[];
}

export interface Section {
  id: string;
  title: string;
  level: number;
  startOffset: number;
  endOffset: number;
}

export interface Citation {
  id: string;
  text: string;
  source: string;
  url?: string;
  accessedAt: number;
}
```

### 3. Tool Manifest Model (Cloud Convex)

```typescript
// packages/db/convex/toolManifests.ts

export interface ToolRegistry {
  _id: Id<'toolRegistry'>;
  workspaceId: Id<'workspaces'>;
  
  // Identity
  toolId: string;
  name: string;
  version: string;
  
  // Classification
  type: 'api' | 'mcp' | 'builtin' | 'custom';
  category: 'research' | 'content' | 'analytics' | 'integration';
  
  // Schema & Interface
  schema: {
    parameters: JsonSchema;
    returns: JsonSchema;
    description: string;
    examples: Example[];
  };
  
  // Configuration
  credentials: {
    type: 'bearer' | 'api-key' | 'oauth' | 'none';
    field?: string; // 'Authorization', 'X-API-Key', etc
  };
  
  // Metadata
  rateLimit?: {
    requestsPerMinute: number;
    burst: number;
  };
  costEstimate?: {
    perRequest: number;
    currency: string;
  };
  
  // Availability
  isEnabled: boolean;
  isPublic: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface MCPRegistration {
  mcpName: string;
  resources: MCPResource[];
  tools: MCPTool[];
  prompts: MCPPrompt[];
  metadata: {
    description: string;
    version: string;
  };
}
```

---

## Layer 1: Session Management (Cloud Convex)

### Convex Actions for Session Lifecycle

```typescript
// packages/db/convex/sessions.ts

export const createSession = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    mode: v.union('research', 'content', 'analysis'),
    title: v.string(),
    toolIds: v.array(v.string()),
    agentConfig: v.optional(v.any()),
  },
  async handler(ctx, args) {
    // Generate session ID
    const sessionId = generateUUID();
    
    // Load tool manifests from registry
    const tools = await ctx.db
      .query('toolRegistry')
      .filter((q) => q.eq(q.field('workspaceId'), args.workspaceId))
      .filter((q) => q.eq(q.field('isEnabled'), true))
      .collect();
    
    // Create E2B sandbox
    const sandbox = await e2bClient.create({
      template: 'socialite-voltagen',
      metadata: {
        sessionId,
        workspaceId: args.workspaceId,
      },
    });
    
    // Create session record
    const sessionId = await ctx.db.insert('sessions', {
      workspaceId: args.workspaceId,
      sessionId,
      mode: args.mode,
      title: args.title,
      status: 'initializing',
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      sandboxId: sandbox.sandboxId,
      localConvexUrl: `http://localhost:3210`,
      agentConfig: args.agentConfig || DEFAULT_AGENT_CONFIG[args.mode],
      toolManifests: tools.map(formatToolManifest),
      executionLimits: DEFAULT_LIMITS[args.mode],
      outputDocuments: [],
      canvasArtifacts: [],
      metadata: {},
    });
    
    return {
      sessionId,
      sandboxId: sandbox.sandboxId,
      sandboxAuth: sandbox.auth,
    };
  },
});

export const getSessionState = query({
  args: { sessionId: v.id('sessions') },
  async handler(ctx, args) {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error('Session not found');
    
    // Query local Convex for real-time state
    const localState = await fetch(`${session.localConvexUrl}/api/state`, {
      headers: {
        'Authorization': `Bearer ${session.auth}`,
      },
    }).then((r) => r.json());
    
    return {
      session,
      localState,
      recentArtifacts: await ctx.db
        .query('artifacts')
        .filter((q) => q.eq(q.field('sessionId'), args.sessionId))
        .order('desc')
        .take(10),
    };
  },
});

export const syncSessionResults = mutation({
  args: {
    sessionId: v.id('sessions'),
    artifacts: v.array(v.any()),
    finalState: v.any(),
  },
  async handler(ctx, args) {
    const session = await ctx.db.get(args.sessionId);
    
    // Create artifact records
    const artifactIds = await Promise.all(
      args.artifacts.map((artifact) =>
        ctx.db.insert('artifacts', {
          sessionId: args.sessionId,
          workspaceId: session.workspaceId,
          type: artifact.type,
          content: artifact.content,
          title: artifact.title,
          metadata: artifact.metadata,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          generatedBy: 'agent',
          generationPrompt: artifact.prompt,
        })
      )
    );
    
    // Update session
    await ctx.db.patch(args.sessionId, {
      status: 'completed',
      completedAt: Date.now(),
      outputDocuments: artifactIds,
      metadata: args.finalState,
    });
    
    return { artifactIds };
  },
});
```

---

## Layer 2: Tool Orchestration (E2B Sandbox)

### Tool Bus Architecture

```typescript
// packages/sandbox/src/toolBus.ts

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

export class ToolBus {
  private tools: Map<string, ToolDefinition> = new Map();
  private executing: Map<string, ToolExecution> = new Map();
  private queue: ToolExecution[] = [];
  private convexClient: ConvexClient;
  private sessionId: string;

  constructor(sessionConfig: SessionConfig) {
    this.sessionId = sessionConfig.sessionId;
    this.convexClient = new ConvexClient(process.env.CONVEX_URL);
  }

  async initialize(toolManifests: ToolManifest[]): Promise<void> {
    // Load tools from manifests
    for (const manifest of toolManifests) {
      const tool = await this.loadTool(manifest);
      this.tools.set(manifest.id, tool);
    }
  }

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

  private createAPITool(manifest: ToolManifest): ToolDefinition {
    return createTool({
      name: manifest.name,
      description: manifest.metadata.description,
      parameters: manifest.schema,
      execute: async (params) => {
        const execution = this.recordExecution(manifest.id, params);
        
        try {
          const response = await fetch(manifest.metadata.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(manifest.metadata.apiKey && {
                'Authorization': `Bearer ${process.env[manifest.metadata.apiKey]}`,
              }),
            },
            body: JSON.stringify(params),
          });
          
          const result = await response.json();
          
          // Store in local Convex blackboard
          await this.convexClient.mutation(api.toolResults.record, {
            sessionId: this.sessionId,
            toolId: manifest.id,
            result,
            execution,
          });
          
          return result;
        } catch (error) {
          execution.error = String(error);
          throw error;
        }
      },
    });
  }

  private createMCPTool(manifest: ToolManifest): ToolDefinition {
    // Wire MCP resource to tool
    const mcpClient = new MCPClient({ serverPath: manifest.metadata.mcpPath });
    
    return createTool({
      name: manifest.name,
      description: manifest.metadata.description,
      parameters: manifest.schema,
      execute: async (params) => {
        const execution = this.recordExecution(manifest.id, params);
        
        try {
          const result = await mcpClient.callResource(
            manifest.metadata.resourceName,
            params
          );
          
          await this.convexClient.mutation(api.toolResults.record, {
            sessionId: this.sessionId,
            toolId: manifest.id,
            result,
            execution,
          });
          
          return result;
        } catch (error) {
          execution.error = String(error);
          throw error;
        }
      },
    });
  }

  private createBuiltinTool(manifest: ToolManifest): ToolDefinition {
    // Builtin tools: TypeScript execution, document generation, etc.
    if (manifest.name === 'execute_typescript') {
      return this.createTypeScriptExecutor();
    }
    if (manifest.name === 'generate_document') {
      return this.createDocumentGenerator();
    }
    // ... more builtins
  }

  private createTypeScriptExecutor(): ToolDefinition {
    return createTool({
      name: 'execute_typescript',
      description: 'Execute arbitrary TypeScript code in E2B sandbox',
      parameters: z.object({
        code: z.string(),
        dependencies: z.array(z.string()).optional(),
      }),
      execute: async (args) => {
        const execution = this.recordExecution('execute_typescript', args);
        
        try {
          // Install dependencies if needed
          if (args.dependencies?.length) {
            await sandbox.exec(`bun install ${args.dependencies.join(' ')}`);
          }
          
          // Execute code
          const result = await sandbox.exec(`bun run --eval "${args.code}"`);
          
          await this.convexClient.mutation(api.toolResults.record, {
            sessionId: this.sessionId,
            toolId: 'execute_typescript',
            result,
            execution,
          });
          
          return result;
        } catch (error) {
          execution.error = String(error);
          throw error;
        }
      },
    });
  }

  private createDocumentGenerator(): ToolDefinition {
    return createTool({
      name: 'generate_document',
      description: 'Generate structured document with Affine',
      parameters: z.object({
        title: z.string(),
        content: z.string(),
        format: z.enum(['markdown', 'html', 'pdf']),
        sections: z.array(z.object({
          title: z.string(),
          content: z.string(),
        })).optional(),
      }),
      execute: async (args) => {
        const execution = this.recordExecution('generate_document', args);
        
        try {
          const affineClient = new AffineClient({
            apiUrl: process.env.AFFINE_API_URL,
          });
          
          const doc = await affineClient.createDocument({
            title: args.title,
            content: args.content,
            format: args.format,
          });
          
          await this.convexClient.mutation(api.artifacts.record, {
            sessionId: this.sessionId,
            artifactId: doc.id,
            type: 'document',
            title: args.title,
            content: args.content,
            metadata: doc.metadata,
          });
          
          return { documentId: doc.id, url: doc.shareUrl };
        } catch (error) {
          execution.error = String(error);
          throw error;
        }
      },
    });
  }

  private recordExecution(
    toolId: string,
    input: Record<string, unknown>
  ): ToolExecution {
    const execution: ToolExecution = {
      id: generateUUID(),
      toolId,
      status: 'executing',
      startTime: Date.now(),
      input,
      metadata: {},
    };
    
    this.executing.set(execution.id, execution);
    return execution;
  }

  async getExecutionHistory(): Promise<ToolExecution[]> {
    return Array.from(this.executing.values()).sort(
      (a, b) => b.startTime - a.startTime
    );
  }
}
```

---

## Layer 3: Agent Orchestration (VoltAgent)

### Meta-Agent Architecture

```typescript
// packages/sandbox/src/agents/orchestrator.ts

export interface AgentHierarchy {
  metaOmega: MetaAgent;
  omegas: Agent[];
  subAgents: Agent[];
}

export class MetaAgent {
  private voltAgent: Agent;
  private toolBus: ToolBus;
  private blackboard: ConvexClient;
  private subAgents: Map<string, Agent> = new Map();
  private executionPlan: ExecutionPlan;

  constructor(config: AgentOrchestratorConfig) {
    this.voltAgent = new Agent({
      name: 'MetaOmega',
      model: config.model,
      instructions: `You are MetaOmega, the master orchestrator of a multi-agent research system.
        
Your responsibilities:
1. Analyze the user's request and break it into sub-tasks
2. Delegate tasks to specialized Omega agents
3. Coordinate results and synthesis
4. Monitor progress and handle failures
5. Generate final outputs and artifacts

You have access to:
- blackboard: Real-time analysis state in Convex
- toolBus: Execute any registered tools or code
- subAgents: Specialized agents for specific domains
- domainRouter: Route queries to appropriate agents

Always:
- Think step-by-step before delegating
- Track dependencies between sub-tasks
- Store intermediate results to blackboard
- Provide clear reasoning for each decision`,
      
      tools: [
        this.createBlackboardQueryTool(),
        this.createDelegateTaskTool(),
        this.createToolExecutionTool(),
        this.createSynthesisTool(),
      ],
    });
  }

  private createDelegateTaskTool(): ToolDefinition {
    return createTool({
      name: 'delegate_task',
      description: 'Delegate a specific task to a sub-agent',
      parameters: z.object({
        agentId: z.string().describe('ID of the agent to delegate to'),
        task: z.string().describe('Task description'),
        context: z.record(z.unknown()).optional(),
      }),
      execute: async (args) => {
        const agent = this.subAgents.get(args.agentId);
        if (!agent) throw new Error(`Agent ${args.agentId} not found`);
        
        // Store task on blackboard
        await this.blackboard.mutation(api.tasks.create, {
          sessionId: this.sessionId,
          delegatedFrom: 'MetaOmega',
          delegatedTo: args.agentId,
          task: args.task,
          status: 'running',
          createdAt: Date.now(),
        });
        
        // Execute subtask
        const result = await agent.run(args.task);
        
        // Store result
        await this.blackboard.mutation(api.tasks.complete, {
          agentId: args.agentId,
          result,
        });
        
        return result;
      },
    });
  }

  private createBlackboardQueryTool(): ToolDefinition {
    return createTool({
      name: 'query_blackboard',
      description: 'Query the real-time analysis blackboard',
      parameters: z.object({
        query: z.string().describe('What to look for'),
        namespace: z.string().optional(),
      }),
      execute: async (args) => {
        return this.blackboard.query(api.blackboard.search, {
          sessionId: this.sessionId,
          query: args.query,
          namespace: args.namespace,
        });
      },
    });
  }

  private createToolExecutionTool(): ToolDefinition {
    return createTool({
      name: 'execute_tool',
      description: 'Execute any registered tool through the tool bus',
      parameters: z.object({
        toolId: z.string(),
        args: z.record(z.unknown()),
      }),
      execute: async (args) => {
        const tool = this.toolBus.getTool(args.toolId);
        if (!tool) throw new Error(`Tool ${args.toolId} not found`);
        return tool.execute(args.args);
      },
    });
  }

  private createSynthesisTool(): ToolDefinition {
    return createTool({
      name: 'synthesize_results',
      description: 'Synthesize results from multiple agents into a coherent output',
      parameters: z.object({
        agentResults: z.array(z.record(z.unknown())),
        outputFormat: z.enum(['document', 'canvas', 'analysis']),
        title: z.string(),
      }),
      execute: async (args) => {
        const affineClient = new AffineClient();
        
        if (args.outputFormat === 'document') {
          return affineClient.createDocument({
            title: args.title,
            content: this.synthesizeAsMarkdown(args.agentResults),
          });
        } else if (args.outputFormat === 'canvas') {
          return affineClient.createCanvas({
            title: args.title,
            elements: this.synthesizeAsCanvasElements(args.agentResults),
          });
        }
      },
    });
  }

  private synthesizeAsMarkdown(results: any[]): string {
    return results
      .map((r) => `## ${r.title}\n\n${r.content}\n`)
      .join('\n');
  }

  private synthesizeAsCanvasElements(results: any[]) {
    return results.map((r, idx) => ({
      type: 'frame',
      props: {
        title: r.title,
        content: r.content,
        x: idx * 500,
        y: 0,
        width: 480,
        height: 600,
      },
    }));
  }

  async run(userRequest: string): Promise<void> {
    console.log(`MetaOmega analyzing request: ${userRequest}`);
    
    // Analyze request and create execution plan
    const plan = await this.voltAgent.run(`
      Analyze this request and create an execution plan:
      ${userRequest}
      
      Store the plan in the blackboard and then execute it by delegating tasks.
    `);
  }
}

export class OmegaAgent {
  private voltAgent: Agent;
  private specialization: string;
  
  constructor(config: OmegaConfig) {
    this.specialization = config.specialization;
    
    this.voltAgent = new Agent({
      name: `Omega-${config.specialization}`,
      model: config.model,
      instructions: `You are an Omega agent specializing in ${config.specialization}.
        
Your role:
- Execute detailed subtasks in your domain
- Use available tools to gather and process data
- Generate high-quality outputs
- Report results back to MetaOmega

Always provide clear reasoning and store intermediate results.`,
      tools: config.tools,
    });
  }

  async executeTask(task: string): Promise<unknown> {
    return this.voltAgent.run(task);
  }
}
```

---

## Layer 4: Session Entry Point

### Sandbox Main Loop

```typescript
// packages/sandbox/src/index.ts

async function main() {
  // Environment setup
  const sessionId = process.env.SESSION_ID!;
  const workspaceId = process.env.WORKSPACE_ID!;
  const cloudConvexUrl = process.env.CONVEX_URL!;
  
  // Start local Convex dev server
  const localConvex = spawn('convex', ['dev'], {
    cwd: '/app',
    env: { ...process.env, CONVEX_DEPLOYMENT: 'dev' },
  });

  // Initialize clients
  const cloudClient = new ConvexClient(cloudConvexUrl);
  const localClient = new ConvexClient('http://localhost:3210');

  try {
    // Fetch session config from cloud
    const sessionConfig = await cloudClient.query(api.sessions.get, { sessionId });
    
    // Initialize tool bus
    const toolBus = new ToolBus(sessionConfig);
    await toolBus.initialize(sessionConfig.toolManifests);

    // Initialize agent hierarchy
    const orchestrator = new MetaAgent({
      sessionId,
      model: sessionConfig.agentConfig.model,
      toolBus,
      blackboard: localClient,
    });

    // Create sub-agents
    if (sessionConfig.agentConfig.subAgents) {
      for (const subAgentConfig of sessionConfig.agentConfig.subAgents) {
        const agent = new OmegaAgent({
          specialization: subAgentConfig.specialization,
          model: sessionConfig.agentConfig.model,
          tools: toolBus.getToolsForCategory(subAgentConfig.category),
        });
        
        orchestrator.registerSubAgent(subAgentConfig.id, agent);
      }
    }

    // Update session status
    await cloudClient.mutation(api.sessions.update, {
      sessionId,
      status: 'running',
      startedAt: Date.now(),
    });

    // Run orchestrator
    const userRequest = sessionConfig.metadata.userRequest;
    await orchestrator.run(userRequest);

    // Gather results from local blackboard
    const artifacts = await localClient.query(api.artifacts.list, {
      sessionId,
    });

    const finalState = await localClient.query(api.state.get, {
      sessionId,
    });

    // Sync back to cloud
    await cloudClient.mutation(api.sessions.syncResults, {
      sessionId,
      artifacts,
      finalState,
    });

    console.log(`Session ${sessionId} completed successfully`);
  } catch (error) {
    console.error(`Session ${sessionId} failed:`, error);
    
    await cloudClient.mutation(api.sessions.update, {
      sessionId,
      status: 'failed',
      metadata: {
        error: String(error),
      },
    });
  } finally {
    localConvex.kill();
  }
}

main();
```

---

## Integration Points

### 1. Affine Fork Integration

```typescript
// packages/sandbox/src/affineIntegration.ts

export class AffineIntegration {
  private client: AffineClient;
  private blockSuiteStore: Store;

  constructor(apiKey: string) {
    this.client = new AffineClient({ apiKey });
    this.blockSuiteStore = createStore({
      extensions: defaultExtensions,
    });
  }

  async createDocumentFromMarkdown(
    title: string,
    markdown: string,
    metadata: DocumentMetadata
  ): Promise<Document> {
    const doc = this.blockSuiteStore.createDoc();
    const rootId = doc.addBlock('affine:page', {});

    // Parse markdown and convert to blocks
    const parser = new MarkdownParser();
    const blocks = parser.parse(markdown);

    for (const block of blocks) {
      this.blockSuiteStore.addBlock(block.type, block.props, rootId);
    }

    // Sync to Affine
    return this.client.createDocument({
      title,
      content: this.blockSuiteStore.export('json'),
      metadata,
    });
  }

  async createCanvasFromStructure(
    title: string,
    structure: CanvasElement[]
  ): Promise<Canvas> {
    const canvas = this.blockSuiteStore.createDoc();
    const surfaceId = canvas.addBlock('affine:surface', {});

    for (const element of structure) {
      const gfxElement = {
        type: element.type,
        props: element.props,
        x: element.x,
        y: element.y,
      };
      
      this.blockSuiteStore.addGfx(surfaceId, gfxElement);
    }

    return this.client.createCanvas({
      title,
      content: this.blockSuiteStore.export('json'),
    });
  }

  async extractMetadata(documentId: string): Promise<DocumentMetadata> {
    const doc = await this.client.getDocument(documentId);
    const content = this.blockSuiteStore.parse(doc.content, 'json');

    return {
      wordCount: content.text.split(/\s+/).length,
      sections: this.extractSections(content.blocks),
      links: this.extractLinks(content.blocks),
      codeBlocks: this.extractCodeBlocks(content.blocks),
      headingStructure: this.buildHeadingTree(content.blocks),
      citations: [],
    };
  }

  private extractSections(blocks: Block[]): Section[] {
    return blocks
      .filter((b) => b.flavour.includes('heading'))
      .map((b) => ({
        id: b.id,
        title: b.text?.toString() || '',
        level: b.type?.replace(/[^0-9]/g, '') || '1',
        startOffset: 0,
        endOffset: 0,
      }));
  }

  private extractLinks(blocks: Block[]): Link[] {
    const links: Link[] = [];
    // Parse blocks for markdown links [text](url)
    // Implementation omitted for brevity
    return links;
  }

  private extractCodeBlocks(blocks: Block[]): CodeBlock[] {
    return blocks
      .filter((b) => b.flavour === 'affine:code')
      .map((b) => ({
        id: b.id,
        language: b.language || 'unknown',
        code: b.text?.toString() || '',
      }));
  }

  private buildHeadingTree(blocks: Block[]): HeadingNode[] {
    // Build hierarchical structure from headings
    // Implementation omitted for brevity
    return [];
  }
}
```

### 2. Cloud-to-Sandbox Communication

```typescript
// packages/db/convex/sync.ts

export const subscribeToSessionEvents = mutation({
  args: { sessionId: v.id('sessions') },
  async handler(ctx, args) {
    const session = await ctx.db.get(args.sessionId);
    
    // Subscribe to real-time updates from local Convex
    const eventSource = new EventSource(
      `${session.localConvexUrl}/api/events?sessionId=${session.sessionId}`
    );

    eventSource.addEventListener('tool_execution', (event) => {
      const execution = JSON.parse(event.data);
      
      // Store execution record in cloud
      ctx.db.insert('toolExecutions', {
        sessionId: args.sessionId,
        ...execution,
      });
    });

    eventSource.addEventListener('artifact_generated', (event) => {
      const artifact = JSON.parse(event.data);
      
      // Create artifact record in cloud
      ctx.db.insert('artifacts', {
        sessionId: args.sessionId,
        ...artifact,
      });
    });
  },
});
```

---

## Configuration & Deployment

### E2B Template Definition

```dockerfile
# Dockerfile.socialite
FROM node:20-slim

# Install Bun
RUN npm install -g bun

# Install TypeScript tools
RUN bun install -g tsx typescript

# Install Convex CLI
RUN bun install -g convex

# Install MCP tools
RUN mkdir -p /opt/mcp && \
    git clone https://github.com/modelcontextprotocol/server-node /opt/mcp

# Copy agent code
COPY . /app
WORKDIR /app

# Install dependencies
RUN bun install

# Expose Convex dev server
EXPOSE 3210

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3210/health || exit 1

CMD ["bun", "run", "src/index.ts"]
```

### Workspace Configuration

```typescript
// packages/db/convex/workspace.ts

export const initializeWorkspace = mutation({
  args: {
    workspaceId: v.id('workspaces'),
  },
  async handler(ctx, args) {
    // Register default tool manifests
    const defaultTools = [
      // Research tools
      {
        name: 'search_web',
        type: 'api',
        category: 'research',
        endpoint: 'https://api.serpapi.com/search',
      },
      {
        name: 'fetch_content',
        type: 'api',
        category: 'research',
        endpoint: 'https://api.exa.ai/search',
      },
      // Content tools
      {
        name: 'generate_document',
        type: 'builtin',
        category: 'content',
      },
      {
        name: 'generate_canvas',
        type: 'builtin',
        category: 'content',
      },
      // Execution
      {
        name: 'execute_typescript',
        type: 'builtin',
        category: 'execution',
      },
    ];

    for (const tool of defaultTools) {
      await ctx.db.insert('toolRegistry', {
        workspaceId: args.workspaceId,
        ...tool,
        isEnabled: true,
        isPublic: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});
```

---

## Data Flow Example

### Research Session Workflow

```
1. User initiates session in frontend
   ↓
2. Cloud Convex creates session + E2B sandbox
   ↓
3. Sandbox boots: starts local Convex + VoltAgent
   ↓
4. MetaOmega analyzes user request:
   - "Research marketing trends for AI SaaS startups"
   ↓
5. MetaOmega delegates to Omega-Research:
   - "Find top 10 AI SaaS companies and their growth metrics"
   ↓
6. Omega-Research uses tools:
   - DataForSEO API → Current rankings
   - Exa API → Recent articles
   - execute_typescript → Parse and aggregate data
   ↓
7. Results stored in local Convex blackboard
   ↓
8. MetaOmega delegates to Omega-Content:
   - "Create comprehensive market analysis document"
   ↓
9. Omega-Content uses:
   - generate_document → Create structured markdown
   - Affine integration → Generate final document
   ↓
10. Artifacts synced to cloud Convex
    ↓
11. Frontend displays results + Affine document link
```

---

## Key Advantages

### 1. **Modular Design**
- Clean separation: Cloud persistence, ephemeral execution, orchestration
- Easy to test each layer independently
- Extensible tool system

### 2. **Real-Time Collaboration**
- Local Convex blackboard for agent coordination
- Cloud Convex for persistent workspace state
- Event-driven sync architecture

### 3. **Cost Optimization**
- E2B sandboxes spin down after completion
- Tool execution tracking for cost analysis
- Rate limiting per workspace

### 4. **Sophisticated Orchestration**
- Hierarchical agents (MetaOmega → Omega → SubAgents)
- Multi-agent coordination via shared blackboard
- Tool router for category-specific agent specialization

### 5. **Rich Output Generation**
- Native Affine integration for documents/canvas
- Automatic metadata extraction
- Markdown → BlockSuite → Affine pipeline

---

## Next Steps for Implementation

1. **Phase 1**: Core session management + tool bus
2. **Phase 2**: Agent orchestration layer
3. **Phase 3**: Affine fork integration
4. **Phase 4**: Advanced tool discovery (MCP + dynamic API registration)
5. **Phase 5**: Multi-workspace cost tracking + analytics
