import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  workspaces: defineTable({
    userId: v.string(),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    settings: v.object({
      defaultModel: v.string(),
      defaultTemperature: v.number(),
      maxTokensPerSession: v.number(),
      costLimitPerMonth: v.number(),
    }),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index('by_userId', ['userId'])
    .index('by_slug', ['slug']),

  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_email', ['email']),

  apiCredentials: defineTable({
    workspaceId: v.id('workspaces'),
    provider: v.string(), // e.g., 'openai', 'anthropic', 'openrouter'
    encryptedValue: v.string(),
    isActive: v.boolean(),
    lastValidated: v.optional(v.number()),
    createdAt: v.number(),
  }).index('by_workspaceId', ['workspaceId']),

  toolRegistry: defineTable({
    workspaceId: v.id('workspaces'),
    toolId: v.string(),
    name: v.string(),
    version: v.string(),
    type: v.union(v.literal('api'), v.literal('mcp'), v.literal('builtin')),
    category: v.union(
      v.literal('research'),
      v.literal('content'),
      v.literal('analysis'),
      v.literal('utility')
    ),
    schema: v.object({
      description: v.string(),
      parameters: v.any(), // JSON Schema
      returns: v.optional(v.any()),
      examples: v.optional(v.array(v.any())),
    }),
    metadata: v.object({
      description: v.optional(v.string()),
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
          currency: v.string(),
        })
      ),
    }),
    isEnabled: v.boolean(),
    isPublic: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_workspaceId', ['workspaceId'])
    .index('by_toolId', ['toolId']),

  sessions: defineTable({
    workspaceId: v.id('workspaces'),
    userId: v.string(),
    sessionId: v.string(), // UUID for external ref
    mode: v.union(
      v.literal('research'),
      v.literal('content'),
      v.literal('analysis'),
      v.literal('custom')
    ),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal('initializing'),
      v.literal('loading_tools'),
      v.literal('running'),
      v.literal('completing'),
      v.literal('completed'),
      v.literal('failed')
    ),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    expiresAt: v.number(),
    sandboxId: v.optional(v.string()),
    localConvexUrl: v.optional(v.string()),
    agentConfig: v.object({
      agentType: v.string(),
      model: v.string(),
      temperature: v.number(),
      maxTokens: v.number(),
      systemPrompt: v.optional(v.string()),
      tools: v.array(v.string()),
      subAgents: v.optional(v.array(v.string())),
    }),
    toolManifests: v.array(v.any()),
    executionLimits: v.object({
      maxDuration: v.number(),
      maxTokensPerRequest: v.number(),
      maxConcurrentTools: v.number(),
      maxAPICallsPerMinute: v.number(),
      costLimit: v.number(),
    }),
    outputDocumentIds: v.array(v.string()),
    canvasArtifactIds: v.array(v.string()),
    metadata: v.object({
      userRequest: v.optional(v.string()),
      totalTokensUsed: v.number(),
      totalCost: v.number(),
      errorDetails: v.optional(v.string()),
    }),
  })
    .index('by_workspaceId', ['workspaceId'])
    .index('by_sessionId', ['sessionId'])
    .index('by_status', ['status']),

  artifacts: defineTable({
    sessionId: v.id('sessions'),
    workspaceId: v.id('workspaces'),
    artifactId: v.string(),
    type: v.union(
      v.literal('document'),
      v.literal('canvas'),
      v.literal('analysis'),
      v.literal('transcript')
    ),
    affineDocId: v.optional(v.string()),
    affineCanvasId: v.optional(v.string()),
    title: v.string(),
    description: v.optional(v.string()),
    tags: v.array(v.string()),
    content: v.string(),
    contentMetadata: v.object({
      wordCount: v.optional(v.number()),
      sections: v.optional(
        v.array(
          v.object({
            id: v.string(),
            title: v.string(),
            level: v.number(),
            startOffset: v.number(),
            endOffset: v.number(),
          })
        )
      ),
      links: v.optional(
        v.array(
          v.object({
            text: v.string(),
            url: v.string(),
          })
        )
      ),
      codeBlocks: v.optional(
        v.array(
          v.object({
            id: v.string(),
            language: v.string(),
            code: v.string(),
          })
        )
      ),
      citations: v.optional(
        v.array(
          v.object({
            id: v.string(),
            text: v.string(),
            source: v.string(),
            url: v.optional(v.string()),
            accessedAt: v.number(),
          })
        )
      ),
    }),
    generatedBy: v.string(), // Agent ID
    generationPrompt: v.optional(v.string()),
    sourceData: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_sessionId', ['sessionId'])
    .index('by_workspaceId', ['workspaceId'])
    .index('by_type', ['type']),

  toolExecutionLogs: defineTable({
    sessionId: v.id('sessions'),
    workspaceId: v.id('workspaces'),
    executionId: v.string(),
    toolId: v.string(),
    toolName: v.string(),
    status: v.union(
      v.literal('success'),
      v.literal('error'),
      v.literal('running')
    ),
    startTime: v.number(),
    endTime: v.optional(v.number()),
    duration: v.optional(v.number()),
    input: v.any(),
    output: v.optional(v.any()),
    error: v.optional(
      v.object({
        message: v.string(),
        code: v.optional(v.string()),
      })
    ),
    tokensUsed: v.optional(v.number()),
    costUsd: v.optional(v.number()),
    agentId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  })
    .index('by_sessionId', ['sessionId'])
    .index('by_toolId', ['toolId']),

  costLogs: defineTable({
    workspaceId: v.id('workspaces'),
    year: v.number(),
    month: v.number(),
    totalTokensUsed: v.number(),
    totalCostUsd: v.number(),
    costByTool: v.any(), // Map<toolId, cost>
    costByModel: v.any(), // Map<model, cost>
    isFinalized: v.boolean(),
    createdAt: v.number(),
  }).index('by_workspace_date', ['workspaceId', 'year', 'month']),
});
