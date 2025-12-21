# Convex Schema & Database Definitions
**Files**: `packages/db/convex/schema.ts` + mutation/query files

## Overview

This defines both **Cloud Convex** (persistent data) and **Local Convex** (session blackboard).

**Cloud Convex**: Workspaces, sessions, tool registry, artifacts, cost tracking
**Local Convex**: Ephemeral session state, blackboard, task tracking, execution logs

Pattern: Schema-first design with clear separation of concerns.

---

## Cloud Convex Schema

```typescript
// packages/db/convex/schema.ts

import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // ============= WORKSPACE MANAGEMENT =============
  
  workspaces: defineTable({
    userId: v.id('users'),
    name: v.string(),
    slug: v.string(), // URL-friendly identifier
    description: v.optional(v.string()),
    
    // Settings
    settings: v.object({
      defaultModel: v.string(), // gpt-4o, gpt-4-turbo, etc.
      defaultTemperature: v.number(),
      maxTokensPerSession: v.number(),
      costLimitPerMonth: v.number(),
    }),
    
    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index('by_user', ['userId'])
    .index('by_slug', ['slug']),

  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_email', ['email']),

  // ============= API CREDENTIALS & INTEGRATION =============

  apiCredentials: defineTable({
    workspaceId: v.id('workspaces'),
    provider: v.union(
      v.literal('openrouter'),
      v.literal('dataseo'),
      v.literal('moz'),
      v.literal('serpapi'),
      v.literal('exa'),
      v.literal('eleven_labs'),
      v.literal('suno'),
      v.literal('affine')
    ),
    
    // Encrypted credential storage
    encryptedValue: v.string(),
    
    // Metadata
    isActive: v.boolean(),
    lastValidated: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_workspace', ['workspaceId'])
    .index('by_provider', ['provider']),

  // ============= TOOL REGISTRY =============

  toolRegistry: defineTable({
    workspaceId: v.id('workspaces'),
    
    // Identity
    toolId: v.string(),
    name: v.string(),
    version: v.string(),
    
    // Type & Category
    type: v.union(v.literal('api'), v.literal('mcp'), v.literal('builtin')),
    category: v.union(
      v.literal('research'),
      v.literal('content'),
      v.literal('analytics'),
      v.literal('integration'),
      v.literal('execution')
    ),
    
    // Schema
    schema: v.object({
      description: v.string(),
      parameters: v.any(), // Zod schema as JSON
      returns: v.any(),
      examples: v.optional(v.array(v.any())),
    }),
    
    // Configuration
    metadata: v.object({
      description: v.string(),
      endpoint: v.optional(v.string()),
      mcpPath: v.optional(v.string()),
      apiKeyField: v.optional(v.string()),
      rateLimit: v.optional(
        v.object({
          requestsPerMinute: v.number(),
          burst: v.number(),
        })
      ),
      costEstimate: v.optional(
        v.object({
          perRequest: v.number(),
          currency: v.literal('USD'),
        })
      ),
    }),
    
    // Status
    isEnabled: v.boolean(),
    isPublic: v.boolean(),
    
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_workspace', ['workspaceId'])
    .index('by_type', ['type'])
    .index('by_category', ['category']),

  // ============= SESSION MANAGEMENT =============

  sessions: defineTable({
    workspaceId: v.id('workspaces'),
    userId: v.id('users'),
    
    // Identity
    sessionId: v.string(), // UUID
    mode: v.union(
      v.literal('research'),
      v.literal('content'),
      v.literal('analysis'),
      v.literal('custom')
    ),
    title: v.string(),
    description: v.optional(v.string()),
    
    // Lifecycle
    status: v.union(
      v.literal('initializing'),
      v.literal('running'),
      v.literal('paused'),
      v.literal('completed'),
      v.literal('failed')
    ),
    
    // Timestamps
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    expiresAt: v.number(),
    
    // Infrastructure
    sandboxId: v.string(), // E2B sandbox ID
    localConvexUrl: v.string(),
    
    // Configuration
    agentConfig: v.object({
      agentType: v.union(v.literal('research'), v.literal('content'), v.literal('analyzer')),
      model: v.string(),
      temperature: v.number(),
      maxTokens: v.number(),
      systemPrompt: v.optional(v.string()),
      tools: v.array(v.string()), // Tool IDs
      subAgents: v.optional(v.array(v.any())),
    }),
    
    toolManifests: v.array(v.any()), // Cached manifests for session
    
    executionLimits: v.object({
      maxDuration: v.number(),
      maxTokensPerRequest: v.number(),
      maxConcurrentTools: v.number(),
      maxAPICallsPerMinute: v.number(),
      costLimit: v.optional(v.number()),
    }),
    
    // Results
    outputDocumentIds: v.array(v.id('artifacts')),
    canvasArtifactIds: v.array(v.id('artifacts')),
    
    // Metadata
    metadata: v.object({
      userRequest: v.optional(v.string()),
      totalTokensUsed: v.optional(v.number()),
      totalCost: v.optional(v.number()),
      errorDetails: v.optional(v.string()),
    }),
  })
    .index('by_workspace', ['workspaceId'])
    .index('by_user', ['userId'])
    .index('by_status', ['status'])
    .index('by_created', ['createdAt']),

  // ============= ARTIFACTS & OUTPUTS =============

  artifacts: defineTable({
    sessionId: v.id('sessions'),
    workspaceId: v.id('workspaces'),
    
    // Identity
    artifactId: v.string(),
    type: v.union(
      v.literal('document'),
      v.literal('canvas'),
      v.literal('analysis'),
      v.literal('transcript')
    ),
    
    // Content Reference
    affineDocId: v.optional(v.string()),
    affineCanvasId: v.optional(v.string()),
    
    // Metadata
    title: v.string(),
    description: v.optional(v.string()),
    tags: v.array(v.string()),
    
    // Content
    content: v.optional(v.string()),
    contentMetadata: v.object({
      wordCount: v.number(),
      sections: v.array(
        v.object({
          id: v.string(),
          title: v.string(),
          level: v.number(),
          startOffset: v.number(),
          endOffset: v.number(),
        })
      ),
      links: v.array(
        v.object({
          text: v.string(),
          url: v.string(),
        })
      ),
      codeBlocks: v.array(
        v.object({
          id: v.string(),
          language: v.string(),
          code: v.string(),
        })
      ),
      citations: v.array(
        v.object({
          id: v.string(),
          text: v.string(),
          source: v.string(),
          url: v.optional(v.string()),
          accessedAt: v.number(),
        })
      ),
    }),
    
    // Generation Info
    generatedBy: v.union(v.literal('agent'), v.literal('manual')),
    generationPrompt: v.optional(v.string()),
    sourceData: v.optional(v.object({})),
    
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_session', ['sessionId'])
    .index('by_workspace', ['workspaceId'])
    .index('by_type', ['type']),

  // ============= COST & USAGE TRACKING =============

  toolExecutionLogs: defineTable({
    sessionId: v.id('sessions'),
    workspaceId: v.id('workspaceId'),
    
    // Identity
    executionId: v.string(),
    toolId: v.string(),
    toolName: v.string(),
    
    // Execution Details
    status: v.union(
      v.literal('pending'),
      v.literal('executing'),
      v.literal('completed'),
      v.literal('failed')
    ),
    
    startTime: v.number(),
    endTime: v.optional(v.number()),
    duration: v.optional(v.number()),
    
    // Input/Output
    input: v.object({}),
    output: v.optional(v.object({})),
    error: v.optional(
      v.object({
        message: v.string(),
        code: v.optional(v.string()),
      })
    ),
    
    // Cost
    tokensUsed: v.optional(v.number()),
    costUsd: v.optional(v.number()),
    
    // Metadata
    agentId: v.optional(v.string()),
    metadata: v.optional(v.object({})),
  })
    .index('by_session', ['sessionId'])
    .index('by_workspace', ['workspaceId'])
    .index('by_tool', ['toolId']),

  costLogs: defineTable({
    workspaceId: v.id('workspaces'),
    
    // Period
    year: v.number(),
    month: v.number(),
    
    // Costs
    totalTokensUsed: v.number(),
    totalCostUsd: v.number(),
    costByTool: v.object({}), // { [toolId]: cost }
    costByModel: v.object({}), // { [model]: cost }
    
    // Status
    isFinalized: v.boolean(),
    
    createdAt: v.number(),
  })
    .index('by_workspace_period', ['workspaceId', 'year', 'month']),
});
```

---

## Cloud Convex Mutations & Queries

```typescript
// packages/db/convex/sessions.ts

import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

// ============= CREATE SESSION =============

export const createSession = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    userId: v.id('users'),
    mode: v.union(v.literal('research'), v.literal('content'), v.literal('analysis')),
    title: v.string(),
    toolIds: v.array(v.string()),
    agentConfig: v.optional(v.any()),
  },

  async handler(ctx, args) {
    const db = ctx.db;
    
    // Load tool manifests from registry
    const tools = await db
      .query('toolRegistry')
      .filter((q) =>
        q.and(
          q.eq(q.field('workspaceId'), args.workspaceId),
          q.eq(q.field('isEnabled'), true),
          // Filter to only requested tools or all if not specified
          args.toolIds.length > 0
            ? q.or(...args.toolIds.map((id) => q.eq(q.field('toolId'), id)))
            : true
        )
      )
      .collect();

    // Load workspace settings
    const workspace = await db.get(args.workspaceId);
    if (!workspace) throw new Error('Workspace not found');

    // Create E2B sandbox (call external service)
    const sandboxId = await ctx.runMutation('sandbox.createE2BInstance', {
      workspaceId: args.workspaceId,
      sessionId: args.title, // Use title for debugging
    });

    // Create session record
    const sessionId = await db.insert('sessions', {
      workspaceId: args.workspaceId,
      userId: args.userId,
      sessionId: crypto.randomUUID(),
      mode: args.mode,
      title: args.title,
      status: 'initializing',
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24h expiry
      sandboxId,
      localConvexUrl: 'http://localhost:3210',
      
      agentConfig: args.agentConfig || {
        agentType: args.mode,
        model: workspace.settings.defaultModel,
        temperature: workspace.settings.defaultTemperature,
        maxTokens: 4000,
        tools: tools.map((t) => t.toolId),
      },
      
      toolManifests: tools.map((t) => ({
        id: t.toolId,
        name: t.name,
        type: t.type,
        metadata: t.metadata,
        schema: t.schema,
      })),
      
      executionLimits: {
        maxDuration: 30 * 60 * 1000, // 30 minutes
        maxTokensPerRequest: workspace.settings.maxTokensPerSession,
        maxConcurrentTools: 3,
        maxAPICallsPerMinute: 10,
        costLimit: workspace.settings.costLimitPerMonth,
      },
      
      outputDocumentIds: [],
      canvasArtifactIds: [],
      metadata: {},
    });

    return {
      sessionId,
      sandboxId,
      status: 'initializing',
    };
  },
});

// ============= UPDATE SESSION STATUS =============

export const updateSessionStatus = mutation({
  args: {
    sessionId: v.id('sessions'),
    status: v.union(
      v.literal('initializing'),
      v.literal('running'),
      v.literal('completed'),
      v.literal('failed')
    ),
    metadata: v.optional(v.object({})),
  },

  async handler(ctx, args) {
    const updateData: any = {
      status: args.status,
      updatedAt: Date.now(),
    };

    if (args.status === 'running') {
      updateData.startedAt = Date.now();
    } else if (args.status === 'completed' || args.status === 'failed') {
      updateData.completedAt = Date.now();
    }

    if (args.metadata) {
      updateData.metadata = args.metadata;
    }

    await ctx.db.patch(args.sessionId, updateData);
  },
});

// ============= SYNC SESSION RESULTS =============

export const syncSessionResults = mutation({
  args: {
    sessionId: v.id('sessions'),
    artifacts: v.array(
      v.object({
        type: v.string(),
        title: v.string(),
        content: v.string(),
        affineDocId: v.optional(v.string()),
        metadata: v.any(),
      })
    ),
    finalMetadata: v.object({}),
  },

  async handler(ctx, args) {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error('Session not found');

    // Create artifact records
    const artifactIds = [];
    for (const artifact of args.artifacts) {
      const artifactId = await ctx.db.insert('artifacts', {
        sessionId: args.sessionId,
        workspaceId: session.workspaceId,
        artifactId: crypto.randomUUID(),
        type: artifact.type as any,
        title: artifact.title,
        content: artifact.content,
        affineDocId: artifact.affineDocId,
        contentMetadata: artifact.metadata,
        generatedBy: 'agent',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: [],
      });
      artifactIds.push(artifactId);
    }

    // Update session with artifact references
    await ctx.db.patch(args.sessionId, {
      status: 'completed',
      completedAt: Date.now(),
      outputDocumentIds: artifactIds.filter(
        (_, i) => args.artifacts[i].type === 'document'
      ),
      canvasArtifactIds: artifactIds.filter(
        (_, i) => args.artifacts[i].type === 'canvas'
      ),
      metadata: args.finalMetadata,
    });

    return { artifactIds };
  },
});

// ============= GET SESSION WITH STATE =============

export const getSessionState = query({
  args: {
    sessionId: v.id('sessions'),
  },

  async handler(ctx, args) {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error('Session not found');

    const artifacts = await ctx.db
      .query('artifacts')
      .filter((q) => q.eq(q.field('sessionId'), args.sessionId))
      .order('desc')
      .collect();

    return {
      session,
      artifacts,
      isActive: session.status === 'running',
    };
  },
});

// ============= LIST SESSIONS =============

export const listSessions = query({
  args: {
    workspaceId: v.id('workspaces'),
    limit: v.number(),
  },

  async handler(ctx, args) {
    return await ctx.db
      .query('sessions')
      .filter((q) => q.eq(q.field('workspaceId'), args.workspaceId))
      .order('desc')
      .take(args.limit);
  },
});
```

---

## Local Convex Schema (Session Blackboard)

```typescript
// packages/sandbox/convex/schema.ts (Local instance)

import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // ============= BLACKBOARD STATE =============
  
  blackboardEntries: defineTable({
    sessionId: v.string(),
    namespace: v.string(), // research:keywords, analysis:trends, etc
    key: v.string(),
    value: v.any(),
    
    agentId: v.string(), // Which agent wrote this
    metadata: v.optional(v.object({})),
    
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_session', ['sessionId'])
    .index('by_namespace', ['namespace'])
    .index('by_session_namespace', ['sessionId', 'namespace']),

  // ============= EXECUTION PLANS =============

  executionPlans: defineTable({
    sessionId: v.string(),
    
    planId: v.string(),
    description: v.string(),
    
    steps: v.array(
      v.object({
        id: v.string(),
        description: v.string(),
        agentId: v.string(),
        task: v.string(),
        dependencies: v.array(v.string()),
        status: v.string(), // pending, executing, completed, failed
        result: v.optional(v.any()),
        error: v.optional(v.string()),
      })
    ),
    
    status: v.string(), // pending, executing, completed, failed
    createdAt: v.number(),
  })
    .index('by_session', ['sessionId']),

  // ============= AGENT TASKS =============

  agentTasks: defineTable({
    sessionId: v.string(),
    
    taskId: v.string(),
    delegatedFrom: v.string(),
    delegatedTo: v.string(),
    
    task: v.string(),
    context: v.optional(v.object({})),
    
    status: v.string(),
    result: v.optional(v.any()),
    error: v.optional(v.string()),
    
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index('by_session', ['sessionId'])
    .index('by_delegated_to', ['delegatedTo']),

  // ============= TOOL EXECUTION RECORDS =============

  toolExecutions: defineTable({
    sessionId: v.string(),
    
    executionId: v.string(),
    toolId: v.string(),
    toolName: v.string(),
    
    status: v.string(),
    input: v.object({}),
    output: v.optional(v.object({})),
    error: v.optional(v.string()),
    
    startTime: v.number(),
    endTime: v.optional(v.number()),
    duration: v.optional(v.number()),
    
    agentId: v.optional(v.string()),
  })
    .index('by_session', ['sessionId']),

  // ============= ARTIFACTS GENERATED IN SESSION =============

  artifacts: defineTable({
    sessionId: v.string(),
    
    artifactId: v.string(),
    type: v.string(), // document, canvas, analysis
    
    title: v.string(),
    content: v.string(),
    metadata: v.optional(v.object({})),
    
    generatedBy: v.string(), // Agent ID
    createdAt: v.number(),
  })
    .index('by_session', ['sessionId']),
});
```

---

## Local Convex Mutations & Queries

```typescript
// packages/sandbox/convex/blackboard.ts

import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const write = mutation({
  args: {
    sessionId: v.string(),
    namespace: v.string(),
    key: v.string(),
    value: v.any(),
    agentId: v.string(),
    metadata: v.optional(v.object({})),
  },

  async handler(ctx, args) {
    // Check if entry exists
    const existing = await ctx.db
      .query('blackboardEntries')
      .filter(
        (q) =>
          q.and(
            q.eq(q.field('sessionId'), args.sessionId),
            q.eq(q.field('namespace'), args.namespace),
            q.eq(q.field('key'), args.key)
          )
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        metadata: args.metadata,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert('blackboardEntries', {
        sessionId: args.sessionId,
        namespace: args.namespace,
        key: args.key,
        value: args.value,
        agentId: args.agentId,
        metadata: args.metadata,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

export const search = query({
  args: {
    sessionId: v.string(),
    namespace: v.string(),
    key: v.optional(v.string()),
    pattern: v.optional(v.string()),
  },

  async handler(ctx, args) {
    let query = ctx.db
      .query('blackboardEntries')
      .filter(
        (q) =>
          q.and(
            q.eq(q.field('sessionId'), args.sessionId),
            q.eq(q.field('namespace'), args.namespace)
          )
      );

    const results = await query.collect();

    // Filter by key if specified
    if (args.key) {
      return results.filter((r) => r.key === args.key);
    }

    // Filter by pattern if specified
    if (args.pattern) {
      const regex = new RegExp(args.pattern);
      return results.filter((r) => regex.test(r.key));
    }

    return results;
  },
});
```

---

## Key Integration Points

1. **Cloud Convex** ← Persistent workspace, sessions, artifacts, cost tracking
2. **Local Convex** ← Ephemeral session state, blackboard, task tracking
3. **Affine Integration** → Document/canvas storage via affineDocId reference
4. **E2B SDK** → Sandbox lifecycle tied to session
5. **OpenRouter** → Model selection via workspace settings

---

## Cost & Usage Tracking

Cost logs aggregate by month/workspace/tool:
- Track tokens used per tool execution
- Estimate costs based on model + tool rates
- Enforce monthly budgets via mutation guards
- Archive old logs for analytics

---

## DRY Principles

- Single schema definition (no duplication)
- Indexed queries for efficient filtering
- Consistent timestamp patterns (createdAt, updatedAt)
- Separated cloud/local schemas (clear responsibilities)
- Mutation guards prevent invalid state transitions
