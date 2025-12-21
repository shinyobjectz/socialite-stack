# Socialite SDK Reference: Complete Component Documentation

## Quick Navigation

- **Stately Machine SDK** - State orchestration engine
- **VoltAgent SDK** - LLM execution runtime
- **Convex SDK** - Persistence & blackboard layer
- **ToolBus SDK** - Tool execution & integration
- **Agent SDK** - Unified interface (meta-SDK that combines all)

---

## 1. Stately Machine SDK

### What It Is
**State machine orchestration engine** that defines the "policy" for how your agent behaves. It's your blueprint for execution flow.

### Core Responsibility
- Define valid states (gathering, analyzing, synthesizing, etc.)
- Define state transitions (success → next state, error → error state)
- Handle state machine lifecycle (start, run, complete, error)
- Emit state change events

### Key Concepts

```typescript
// A state machine is a graph
gathering → analyzing → synthesizing → complete
   ↓           ↓            ↓
[error] ←------+------------+
```

### Why Use It
- **Deterministic**: Clear, predictable execution paths
- **Observable**: Know exactly what state you're in
- **Testable**: Each state can be tested independently
- **Standard**: XState is industry-standard (used by Netflix, Microsoft, etc.)
- **Composable**: States can be reused, combined

### How It Works (Internally)

```typescript
import { setup } from 'xstate';

// 1. Define what each state does
const machine = setup({
  actors: {
    runGathering: async () => { /* fetch data */ },
    runAnalyzing: async () => { /* process data */ },
    runSynthesizing: async () => { /* create output */ }
  }
}).createMachine({
  id: 'socialite',
  initial: 'gathering',
  states: {
    gathering: {
      invoke: { src: 'runGathering', onDone: { target: 'analyzing' } }
    },
    analyzing: {
      invoke: { src: 'runAnalyzing', onDone: { target: 'synthesizing' } }
    },
    synthesizing: {
      invoke: { src: 'runSynthesizing', onDone: { target: 'complete' } }
    },
    complete: { type: 'final' }
  }
});

// 2. Run the machine
const actor = createActor(machine);
actor.start();
actor.subscribe(snapshot => {
  console.log('Current state:', snapshot.value);
});
```

### API

```typescript
// Create actor from machine
const actor = createActor(machine);

// Lifecycle
actor.start();           // Start execution
actor.send(event);       // Send event (trigger transition)
actor.stop();            // Stop execution

// Observation
actor.subscribe(snapshot => {
  // Called on every state change
  console.log(snapshot.value);    // Current state
  console.log(snapshot.status);   // 'running' | 'done'
  console.log(snapshot.context);  // State context/data
});

// Query
actor.getSnapshot();     // Get current snapshot
```

### Contribution to Whole System
- **IN Socialite**: Defines the phases (gathering → analyzing → synthesizing)
- **GIVES TO System**: Clear execution flow, state information, transitions
- **RECEIVES FROM System**: Tool definitions, context updates, completion signals
- **REPLACED BY Agent SDK**: You define states in agent config, SDK builds machine

### Integration Points
```
Stately Machine
    ↓
Emits: onStateChange → Agent updates VoltAgent tools/prompt
Emits: onDone → Agent collects results from blackboard
Receives: State definitions from Agent config
```

---

## 2. VoltAgent SDK

### What It Is
**LLM execution runtime** that runs a single intelligent agent. It's the "thinking" part of your system.

### Core Responsibility
- Run LLM with tools and instructions
- Handle tool calling (agent decides which tools to use)
- Manage conversation context
- Return structured results

### Key Concepts

```typescript
// VoltAgent pattern
User Request
    ↓
VoltAgent (with tools + system prompt)
    ├─ Thinks about request
    ├─ Decides which tool to use
    ├─ Calls tool (gets result)
    ├─ Thinks about result
    ├─ Repeats until done
    └─ Returns final response
```

### Why Use It
- **Smart tool calling**: Agent decides which tool to use, not you
- **Flexible**: Works with any LLM via OpenRouter
- **Context aware**: Maintains conversation history
- **Production ready**: Built for scaling

### How It Works (Internally)

```typescript
import { Agent } from 'voltagent';

const agent = new Agent({
  name: 'ResearchAgent',
  model: 'gpt-4o',
  instructions: `You are a research specialist.
    Search for information, cite sources, be thorough.`,
  
  tools: [
    {
      name: 'search_web',
      description: 'Search the web',
      parameters: z.object({ query: z.string() }),
      execute: async (args) => { /* call API */ }
    },
    {
      name: 'fetch_content',
      description: 'Fetch content from URL',
      parameters: z.object({ url: z.string() }),
      execute: async (args) => { /* call API */ }
    }
  ]
});

// Run agent (it decides which tools to call)
const result = await agent.run(
  'Research the latest AI trends'
);
// Agent might:
// 1. Call search_web('latest AI trends')
// 2. Call fetch_content(URL from results)
// 3. Think about findings
// 4. Return summary
```

### API

```typescript
const agent = new Agent(config);

// Run agent with request
const result = await agent.run(userRequest);

// Update configuration
agent.updateConfig({
  tools: [...],
  instructions: '...'
});

// Configuration options
{
  name: 'AgentName',
  model: 'gpt-4o',           // Via OpenRouter
  instructions: 'System prompt',
  tools: [...],              // Available tools
  temperature: 0.7,          // Creativity (0-1)
  maxTokens: 4000,           // Context window
  systemPrompt: '...'        // Alternative to instructions
}
```

### Contribution to Whole System
- **IN Socialite**: One instance per session, reconfigured per state
- **GIVES TO System**: Tool calling decisions, reasoning, final outputs
- **RECEIVES FROM System**: Tools (filtered by state), instructions (state-specific), context (from blackboard)
- **REPLACED BY Agent SDK**: SDK handles VoltAgent lifecycle, you define prompts/tools in config

### Integration Points
```
VoltAgent
    ↓
Receives: Tools (from ToolBus, filtered by state)
Receives: Instructions (from state definition)
Receives: Context (from blackboard via Agent)
    ↓
Calls: Tools (tool execution)
Stores: Results (to blackboard via Agent)
    ↓
Returns: Structured output
```

---

## 3. Convex SDK

### What It Is
**Persistent backend & real-time database** that stores everything. It's your "memory" system with both cloud (persistent) and local (ephemeral) instances.

### Core Responsibility
- **Cloud Convex**: Persistent workspace data (sessions, artifacts, costs, users)
- **Local Convex**: Ephemeral session blackboard (temporary working memory)
- Real-time queries (WebSocket subscriptions)
- Transactions & consistency

### Key Concepts

```typescript
// Two Convex instances

Cloud Convex (persistent)
├─ sessions: { id, status, createdAt, ... }
├─ artifacts: { id, type, content, ... }
├─ users: { id, email, ... }
├─ toolRegistry: { id, name, tools, ... }
└─ costs: { sessionId, amount, date, ... }

Local Convex (ephemeral, same-process)
├─ blackboardEntries: { namespace, key, value }
├─ executionPlans: { id, steps, status, ... }
├─ toolExecutions: { toolId, args, result, ... }
└─ artifacts: { type, content, ... }
```

### Why Use It
- **Real-time**: WebSocket subscriptions for live updates
- **Typed**: Full TypeScript schemas
- **Transactional**: ACID guarantees
- **Scalable**: Used by production apps
- **Developer friendly**: Simple API, great DX

### How It Works (Internally)

```typescript
import { ConvexClient } from 'convex/client';

// Cloud Convex (persistent)
const cloudConvex = new ConvexClient(process.env.CONVEX_URL);

// Local Convex (ephemeral, dev server)
const localConvex = new ConvexClient('http://localhost:3210');

// Query
const session = await cloudConvex.query('api.sessions.get', {
  sessionId: 'session_123'
});

// Mutation
await localConvex.mutation('api.blackboard.write', {
  sessionId: 'session_123',
  namespace: 'research:findings',
  key: 'top_articles',
  value: articles
});

// Subscribe (real-time)
const unsubscribe = cloudConvex.onUpdate(
  async () => {
    const updated = await cloudConvex.query('api.sessions.get', {
      sessionId
    });
  }
);

// Cleanup
unsubscribe();
```

### API

```typescript
// Create clients
const client = new ConvexClient(url);

// Queries (read-only)
const result = await client.query('api.functionName', args);

// Mutations (write)
const result = await client.mutation('api.functionName', args);

// Real-time subscriptions
client.onUpdate(async () => {
  // Re-run query whenever data changes
  const data = await client.query(...);
});

// Convex schema definition
export const schema = z.object({
  table: {
    _id: v.id('table'),
    field1: v.string(),
    field2: v.number(),
  }
});
```

### Cloud Convex Schema (Persistent)

```typescript
// Sessions: Track agent runs
sessions: {
  _id: Id<'sessions'>,
  workspaceId: Id<'workspaces'>,
  userId: Id<'users'>,
  status: 'initializing' | 'running' | 'completed' | 'failed',
  createdAt: number,
  completedAt?: number,
  metadata: Record<string, unknown>
}

// Artifacts: Store outputs
artifacts: {
  _id: Id<'artifacts'>,
  sessionId: Id<'sessions'>,
  type: 'document' | 'canvas' | 'analysis',
  title: string,
  content: string,
  affineDocId?: string,
  createdAt: number
}

// Tool Registry: Tool definitions
toolRegistry: {
  _id: Id<'toolRegistry'>,
  toolId: string,
  name: string,
  type: 'api' | 'builtin' | 'mcp',
  schema: JsonSchema,
  isEnabled: boolean,
  costPerCall?: number
}

// Costs: Track spending
costLogs: {
  _id: Id<'costLogs'>,
  sessionId: Id<'sessions'>,
  toolId: string,
  costAmount: number,
  timestamp: number
}
```

### Local Convex Schema (Ephemeral)

```typescript
// Blackboard: Shared state between agents
blackboardEntries: {
  _id: Id<'blackboardEntries'>,
  sessionId: string,
  namespace: string,        // 'gathering:findings', 'analysis:insights'
  key: string,             // 'top_10_items', 'summary'
  value: unknown,          // Any JSON
  agentId: string,         // Which agent wrote it
  timestamp: number
}

// Tool Execution Records
toolExecutions: {
  _id: Id<'toolExecutions'>,
  sessionId: string,
  toolId: string,
  args: unknown,
  result: unknown,
  duration: number,
  cost: number,
  timestamp: number
}

// Execution Plans
executionPlans: {
  _id: Id<'executionPlans'>,
  sessionId: string,
  steps: Step[],
  currentStep: number,
  status: 'pending' | 'running' | 'completed'
}
```

### Contribution to Whole System
- **IN Socialite**: Cloud stores persistent data, local stores session working memory
- **GIVES TO System**: Data persistence, real-time updates, blackboard coordination
- **RECEIVES FROM System**: Session data, artifacts, execution records
- **REPLACED BY Agent SDK**: SDK abstracts Convex usage, you don't manage it directly

### Integration Points
```
Convex
    ↓
Cloud Convex: Stores sessions, artifacts, user data
Local Convex: Stores blackboard (agent coordination)
    ↓
Agent writes: Execution records, artifacts, blackboard entries
Agent reads: Previous findings, session state
    ↓
Frontend queries: Session status, artifacts, metrics
Frontend subscribes: Real-time updates
```

---

## 4. ToolBus SDK

### What It Is
**Tool execution orchestrator** that manages how tools are loaded, filtered, and executed. It's the "interface" between agents and external APIs/systems.

### Core Responsibility
- Load tool definitions from manifests
- Filter tools by category/state
- Execute tools with retries, timeouts, rate limiting
- Track tool executions and costs
- Handle different tool types (API, builtin, MCP)

### Key Concepts

```typescript
// Tool types
API Tools: Call external APIs (SerpAPI, Exa, etc.)
  └─ HTTP POST to endpoint with credentials

Builtin Tools: Internal implementation (generate_document, execute_code)
  └─ Direct function calls

MCP Tools: Model Context Protocol servers
  └─ Call remote MCP servers
```

### Why Use It
- **Abstraction**: One interface for all tool types
- **Resilience**: Automatic retries, timeouts, circuit breaking
- **Observability**: Track every tool execution
- **Cost control**: Per-tool cost estimates and limits
- **Organization**: Categorize tools, filter by state

### How It Works (Internally)

```typescript
export class ToolBus {
  private tools: Map<string, ToolDefinition>;
  private executing: Map<string, Execution>;
  private costTracker: CostTracker;
  
  // Load tools
  async initialize(manifests: ToolManifest[]) {
    for (const manifest of manifests) {
      this.tools.set(manifest.id, manifest);
    }
  }
  
  // Filter by category (used by state machine)
  getToolsByCategory(category: string): Tool[] {
    return Array.from(this.tools.values())
      .filter(t => t.metadata.category === category);
  }
  
  // Execute with retry/timeout
  async executeTool(toolId: string, args: unknown): Tool[] {
    const tool = this.tools.get(toolId);
    
    // Retry logic
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        // Timeout wrapper
        return await Promise.race([
          this.executeToolByType(tool, args),
          this.timeout(10000)
        ]);
      } catch (error) {
        if (attempt === 2) throw error;
        await this.backoff(attempt);
      }
    }
  }
  
  // Different execution paths
  private async executeToolByType(tool: Tool, args: unknown) {
    if (tool.type === 'api') {
      return this.executeApiTool(tool, args);
    } else if (tool.type === 'builtin') {
      return this.executeBuiltinTool(tool, args);
    } else if (tool.type === 'mcp') {
      return this.executeMcpTool(tool, args);
    }
  }
  
  // API: HTTP call
  private async executeApiTool(tool: Tool, args: unknown) {
    const response = await fetch(tool.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getCredential(tool.id)}`
      },
      body: JSON.stringify(args)
    });
    return response.json();
  }
  
  // Builtin: Direct function
  private async executeBuiltinTool(tool: Tool, args: unknown) {
    switch (tool.id) {
      case 'generate_document':
        return affineClient.createDocument(args);
      case 'execute_typescript':
        return e2bClient.exec(args.code);
      // etc.
    }
  }
  
  // MCP: Remote call
  private async executeMcpTool(tool: Tool, args: unknown) {
    const client = new MCPClient(tool.serverPath);
    return client.callTool(tool.name, args);
  }
}
```

### API

```typescript
import { ToolBus } from '@socialite/toolbus-sdk';

// Create and initialize
const toolBus = new ToolBus();
await toolBus.initialize([
  { id: 'search_web', type: 'api', endpoint: '...', ... },
  { id: 'generate_document', type: 'builtin', ... }
]);

// Filter by category
const researchTools = toolBus.getToolsByCategory('research');
const contentTools = toolBus.getToolsByCategory('content');

// Execute tool
const result = await toolBus.executeTool('search_web', {
  query: 'AI trends'
});

// Get execution history
const executions = toolBus.getExecutionHistory();
// [
//   { toolId: 'search_web', status: 'completed', duration: 234, cost: 0.02 },
//   { toolId: 'fetch_content', status: 'completed', duration: 567, cost: 0.01 }
// ]

// Track costs
const totalCost = toolBus.getTotalCost();
```

### Tool Definition Structure

```typescript
{
  id: 'search_web',
  name: 'Search Web',
  type: 'api',
  category: 'research',
  
  // For API tools
  endpoint: 'https://api.serpapi.com/search',
  credentials: {
    type: 'api-key',
    field: 'X-API-Key'
  },
  
  // For all tools
  schema: z.object({
    query: z.string(),
    limit: z.number().optional()
  }),
  
  metadata: {
    description: 'Search the web',
    rateLimit: 100,  // per minute
    costEstimate: 0.02
  }
}
```

### Contribution to Whole System
- **IN Socialite**: Manages all tool execution, one per session
- **GIVES TO System**: Tool availability (filtered by state), tool results, cost tracking
- **RECEIVES FROM System**: Tool requests from VoltAgent, tool definitions from Cloud Convex
- **REPLACED BY Agent SDK**: SDK abstracts ToolBus, Agent passes tool list to SDK

### Integration Points
```
ToolBus
    ↓
Receives: Tool manifests (from Cloud Convex)
Receives: Tool requests (from VoltAgent)
    ↓
Filters: By category (research, content, analytics)
Filters: By state (gathering tools only when gathering)
    ↓
Executes: With retry/timeout/cost tracking
    ↓
Returns: Results to VoltAgent
Stores: Execution records to Local Convex
```

---

## 5. Agent SDK (Unified Interface)

### What It Is
**Meta-SDK that combines all four systems** into one developer-friendly interface. You define your agent once, it handles everything.

### Core Responsibility
- Combine state machine, VoltAgent, Convex, ToolBus
- Manage their lifecycle and interactions
- Provide single API to developers
- Abstract away complexity

### Architecture

```
Developer ← writes config for → Agent SDK

Agent SDK internally:
├─ Creates Stately machine (from state definitions)
├─ Initializes VoltAgent (one instance)
├─ Connects to Convex (local + cloud)
├─ Initializes ToolBus (with tool manifests)
├─ Wires everything together
└─ Provides simple run() interface
```

### API

```typescript
import { Agent } from '@socialite/agent-sdk';

// Define once
const agent = new Agent({
  name: 'Socialite',
  model: 'gpt-4o',
  
  states: {
    gathering: {
      description: 'Research phase',
      tools: ['search_web', 'fetch_content'],
      instructions: 'Research thoroughly...',
      costLimit: 10,
      transitions: { success: 'analyzing' }
    },
    analyzing: {
      description: 'Analysis phase',
      tools: ['execute_typescript'],
      instructions: 'Analyze findings...',
      transitions: { success: 'synthesizing' }
    },
    synthesizing: {
      description: 'Output phase',
      tools: ['generate_document', 'generate_canvas'],
      instructions: 'Create polished output...',
      transitions: { success: 'complete' }
    },
    complete: { type: 'final' }
  },
  
  initialState: 'gathering',
  
  convex: {
    url: 'http://localhost:3210',
    sessionId: 'session_123'
  },
  
  blackboard: {
    namespaces: ['gathering', 'analyzing', 'synthesis']
  },
  
  toolBus: {
    tools: [
      { id: 'search_web', ... },
      { id: 'fetch_content', ... },
      { id: 'generate_document', ... }
    ]
  },
  
  hooks: {
    onStateChange: (from, to) => console.log(`→ ${to}`),
    onToolExecute: (toolId) => console.log(`⚙️ ${toolId}`),
    onBlackboardWrite: (ns, key) => console.log(`📝 ${ns}/${key}`)
  }
});

// Run once
const result = await agent.run('Research AI trends and create a pitch deck');
console.log(result.artifacts);
```

### How It Orchestrates

```
User calls: agent.run(request)
    ↓
Agent SDK starts Stately machine
    ↓
Machine → 'gathering' state
    ├─ SDK filters tools (research only)
    ├─ SDK updates VoltAgent config
    ├─ SDK provides previous findings from blackboard
    ├─ VoltAgent runs with filtered tools
    └─ Results stored in blackboard
    ↓
Machine → 'analyzing' state
    ├─ SDK filters tools (analysis only)
    ├─ SDK provides research findings from blackboard
    ├─ VoltAgent runs with analysis tools
    └─ Results stored in blackboard
    ↓
Machine → 'synthesizing' state
    ├─ SDK filters tools (content only)
    ├─ SDK provides all previous findings
    ├─ VoltAgent runs with content tools
    └─ Results stored in blackboard
    ↓
Machine → 'complete' state
    ↓
SDK collects artifacts from blackboard
    ↓
Returns { status, artifacts }
```

### Contribution to Whole System
- **IN Socialite**: Single entry point for developers
- **GIVES TO System**: Simple, unified API
- **RECEIVES FROM System**: Configuration from developers
- **REPLACES**: Direct usage of Stately, VoltAgent, Convex, ToolBus

---

## How They Work Together: Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Developer                                                               │
│ const agent = new Agent({ states: {...}, toolBus: {...} })            │
│ const result = await agent.run('Research AI trends...')               │
└──────────────────────┬──────────────────────────────────────────────────┘
                       │
                       ↓
        ┌──────────────────────────────────┐
        │ Agent SDK (unified interface)     │
        │ • Parses config                  │
        │ • Creates state machine          │
        │ • Initializes components         │
        │ • Wires everything together      │
        └──┬──────────────────┬────────────┬────────────────┬────────────┘
           │                  │            │                │
    ┌──────▼──────┐  ┌────────▼─────┐  ┌──▼──────────┐  ┌─▼────────────┐
    │ Stately     │  │ VoltAgent    │  │ Convex     │  │ ToolBus     │
    │             │  │              │  │            │  │             │
    │ • Define    │  │ • Runs       │  │ • Stores   │  │ • Manages   │
    │   states    │  │   with tools │  │   state    │  │   tools     │
    │ • Handle    │  │ • Calls      │  │ • Real-    │  │ • Executes  │
    │   trans.    │  │   tools      │  │   time     │  │   with      │
    │ • Emit      │  │ • Returns    │  │   updates  │  │   retry     │
    │   events    │  │   results    │  │ • Persists │  │ • Tracks    │
    └─────┬───────┘  └──────┬───────┘  └────┬───────┘  └─┬───────────┘
          │                 │                │           │
          └─────────────────┼────────────────┼───────────┘
                            │                │
                    ┌───────▼────────────────▼───────┐
                    │                                │
                    │ Blackboard (Local Convex)      │
                    │                                │
                    │ gathering:findings             │
                    │ gathering:sources              │
                    │ analysis:insights              │
                    │ synthesis:output               │
                    │                                │
                    └────────────────────────────────┘
```

### Information Flow Per State

```
STATE: gathering

VoltAgent (searching)
    │
    ├─ Receives: research tools [search_web, fetch_content]
    ├─ Receives: instructions "Research thoroughly..."
    ├─ Receives: context "None yet" (first state)
    │
    └─→ Decides: "Call search_web('AI trends')"
         │
         ├─→ ToolBus.executeTool('search_web', ...)
         │    ├─ Validates args against schema
         │    ├─ Makes HTTP call to SerpAPI
         │    ├─ Stores execution record in Local Convex
         │    └─ Returns results
         │
         ├─→ VoltAgent thinks about results
         ├─→ Decides: "Call fetch_content(url)"
         │
         └─→ ToolBus.executeTool('fetch_content', ...)
              ├─ Makes HTTP call to Exa
              └─ Returns content
         
         ├─→ VoltAgent finishes, returns findings
         │
         └─→ Agent SDK: await blackboard.write({
              namespace: 'gathering:findings',
              value: vAgentResult
             })

STATE: analyzing

VoltAgent (analyzing)
    │
    ├─ Receives: analysis tools [execute_typescript]
    ├─ Receives: instructions "Analyze findings..."
    ├─ Receives: context from blackboard "gathering:findings"
    │
    └─→ Processes findings + blackboard data
         └─→ Returns analysis

STATE: synthesizing

VoltAgent (creating)
    │
    ├─ Receives: content tools [generate_document, generate_canvas]
    ├─ Receives: instructions "Create polished output..."
    ├─ Receives: context from blackboard
    │   ├─ gathering:findings
    │   ├─ analysis:insights
    │
    └─→ Creates polished output
         └─→ Calls generate_document or generate_canvas
              └─→ Stores in blackboard: synthesis:output

COMPLETION

Agent SDK:
    ├─ Queries blackboard for all artifacts
    ├─ Formats results
    └─ Returns to developer
```

---

## Quick Reference: What Each SDK Does

| SDK | What | Why | When |
|-----|------|-----|------|
| **Stately** | Define execution flow | Deterministic, observable | Used internally by Agent SDK |
| **VoltAgent** | Run LLM with tools | Intelligent tool calling | Used internally by Agent SDK |
| **Convex** | Store everything | Persistent + real-time | Used internally by Agent SDK |
| **ToolBus** | Manage tool execution | Resilience, filtering, costs | Used internally by Agent SDK |
| **Agent SDK** | Combine all four | Single dev interface | You use this directly |

---

## Using Them Directly vs Via Agent SDK

### Direct Usage (Advanced)

If you need fine-grained control, use them directly:

```typescript
// Manual orchestration
const machine = setup({...}).createMachine({...});
const actor = createActor(machine);
const voltAgent = new Agent({...});
const convex = new ConvexClient(...);
const toolBus = new ToolBus();

// Wire them yourself
actor.subscribe(snapshot => {
  if (snapshot.value === 'gathering') {
    const tools = toolBus.getToolsByCategory('research');
    voltAgent.updateConfig({ tools });
    const result = await voltAgent.run('...');
    await convex.mutation('write', { ... });
  }
});
```

### Via Agent SDK (Recommended)

For most cases, use Agent SDK:

```typescript
// Define config once
const agent = new Agent({
  states: { ... },
  toolBus: { ... }
});

// Run once
await agent.run(request);
```

---

## Key Integration Points

### 1. State Machine ↔ VoltAgent
- **State change event** → Update VoltAgent tools and instructions
- **VoltAgent completes** → Trigger state transition

### 2. VoltAgent ↔ ToolBus
- **Tool call** → ToolBus.executeTool()
- **Result** → VoltAgent receives and processes

### 3. VoltAgent ↔ Convex
- **Agent finishes** → Write to blackboard
- **Next state** → Agent SDK reads blackboard for context

### 4. ToolBus ↔ Convex
- **Tool executes** → Record execution to Local Convex
- **Cloud sync** → Copy records to Cloud Convex

### 5. Everything ↔ Agent SDK
- **Config** → Agent SDK creates/configures all
- **Lifecycle** → Agent SDK manages all
- **Results** → Agent SDK collects and returns

---

## Performance Characteristics

### Stately Machine
- **Time to state change**: ~1ms
- **Memory**: ~10KB per machine
- **Scalability**: Can handle 1000s of concurrent machines

### VoltAgent
- **Time per run**: 2-30 seconds (depends on LLM latency)
- **Memory**: ~50MB per instance
- **Tokens**: 4000 default context window

### Convex (Local)
- **Query**: <1ms (same process)
- **Mutation**: <10ms (in-memory)
- **Memory**: ~100MB for typical session

### Convex (Cloud)
- **Query**: 50-200ms (network latency)
- **Mutation**: 50-200ms (network latency)
- **Persistence**: Automatic, durable

### ToolBus
- **Tool execution**: 100ms - 30s (depends on tool)
- **Retry overhead**: 1-2 additional attempts on failure
- **Memory**: ~5MB + tool execution overhead

---

## Monitoring & Debugging

### Via Hooks (Agent SDK)

```typescript
const agent = new Agent({
  hooks: {
    onStateChange: (from, to) => {
      console.log(`State: ${from} → ${to}`);
      // Emit metrics to monitoring service
    },
    onToolExecute: (toolId, args) => {
      console.log(`Tool: ${toolId}`, args);
      // Track tool usage
    },
    onBlackboardWrite: (ns, key, value) => {
      console.log(`Blackboard: ${ns}/${key}`, value);
      // Track data flow
    }
  }
});
```

### Via Convex Queries

```typescript
// See all tool executions
const executions = await convex.query('api.toolExecutions.list', {
  sessionId
});

// See all blackboard entries
const entries = await convex.query('api.blackboard.search', {
  namespace: 'gathering:*'
});

// See session timeline
const session = await convex.query('api.sessions.get', { sessionId });
```

### Via Stately Inspector

```typescript
const actor = createActor(machine, {
  inspect: (event) => {
    console.log(event);
    // Send to Stately Inspector UI
  }
});
```

---

## When to Use Each Directly

### Use Stately Directly
- Building custom orchestration beyond linear states
- Complex conditional branching
- Parallel state execution
- Integration with XState ecosystem

### Use VoltAgent Directly
- Single-agent scenarios (no state changes)
- Custom tool management
- Fine-grained response processing
- Multi-turn conversations

### Use Convex Directly
- Custom queries beyond blackboard
- User account management
- Workspace configuration
- Historical analytics

### Use ToolBus Directly
- Custom tool types (beyond API/builtin/MCP)
- Advanced cost tracking
- Tool-specific optimizations
- Integration with external tool systems

### Use Agent SDK
- 95% of use cases
- Getting started
- Production applications
- Multi-user platforms

---

## Summary: The Whole Picture

**Agent SDK** = Stately + VoltAgent + Convex + ToolBus

- **Stately**: What state are we in?
- **VoltAgent**: What should we do?
- **Convex**: Where do we store it?
- **ToolBus**: How do we execute tools?

Together they create a **sophisticated, production-ready agent system** that's simple to use but powerful underneath.

Developer sees: One SDK, one config, one run() call.
System provides: State orchestration, intelligent execution, persistence, tool management, real-time updates, cost tracking.

That's the magic.
