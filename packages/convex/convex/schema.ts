import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  workspaces: defineTable({
    userId: v.string(), // Clerk user ID or similar
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
    avatarUrl: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
    usage: v.object({
      storage: v.number(),
      aiTokens: v.number(),
    }),
  })
    .index('by_userId', ['userId'])
    .index('by_slug', ['slug']),

  users: defineTable({
    tokenIdentifier: v.string(), // From Convex auth (e.g. Clerk subject)
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    createdAt: v.number(),
    lastLoginAt: v.number(),
  }).index('by_tokenIdentifier', ['tokenIdentifier'])
    .index('by_email', ['email']),

  apiCredentials: defineTable({
    workspaceId: v.id('workspaces'),
    provider: v.string(),
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
      parameters: v.any(),
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
    sessionId: v.string(),
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
    generatedBy: v.string(),
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
    costByTool: v.any(),
    costByModel: v.any(),
    isFinalized: v.boolean(),
    createdAt: v.number(),
  }).index('by_workspace_date', ['workspaceId', 'year', 'month']),

  docUpdates: defineTable({
    workspaceId: v.id('workspaces'),
    docId: v.string(),
    update: v.bytes(),
    createdAt: v.number(),
  })
    .index('by_workspace_doc', ['workspaceId', 'docId'])
    .index('by_doc', ['docId']),

  blobs: defineTable({
    workspaceId: v.id('workspaces'),
    blobId: v.string(),
    storageId: v.id('_storage'),
    mimeType: v.string(),
    size: v.number(),
    createdAt: v.number(),
  })
    .index('by_workspace_blob', ['workspaceId', 'blobId'])
    .index('by_storageId', ['storageId']),

  comments: defineTable({
    workspaceId: v.id('workspaces'),
    docId: v.string(),
    userId: v.string(),
    content: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_workspace_doc', ['workspaceId', 'docId']),

  replies: defineTable({
    commentId: v.id('comments'),
    userId: v.string(),
    content: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_commentId', ['commentId']),

  commentAttachments: defineTable({
    workspaceId: v.id('workspaces'),
    docId: v.string(),
    key: v.string(),
    storageId: v.id('_storage'),
    name: v.string(),
    mimeType: v.string(),
    size: v.number(),
    createdBy: v.string(),
    createdAt: v.number(),
  })
    .index('by_workspace_doc', ['workspaceId', 'docId'])
    .index('by_storageId', ['storageId']),

  subscriptions: defineTable({
    workspaceId: v.id('workspaces'),
    plan: v.string(),
    status: v.string(),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_workspaceId', ['workspaceId']),

  permissions: defineTable({
    workspaceId: v.id('workspaces'),
    userId: v.string(), // tokenIdentifier
    role: v.union(v.literal('owner'), v.literal('admin'), v.literal('member')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_workspace_user', ['workspaceId', 'userId'])
    .index('by_user', ['userId']),

  docPermissions: defineTable({
    workspaceId: v.id('workspaces'),
    docId: v.string(),
    userId: v.string(),
    level: v.union(v.literal('read'), v.literal('write'), v.literal('admin')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_workspace_doc_user', ['workspaceId', 'docId', 'userId']),

  notifications: defineTable({
    userId: v.string(),
    workspaceId: v.optional(v.id('workspaces')),
    type: v.string(),
    title: v.string(),
    content: v.string(),
    isRead: v.boolean(),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  }).index('by_user_read', ['userId', 'isRead']),

  userAccessTokens: defineTable({
    userId: v.string(),
    token: v.string(),
    name: v.string(),
    scopes: v.array(v.string()),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
  }).index('by_token', ['token']).index('by_user', ['userId']),

  featureFlags: defineTable({
    workspaceId: v.optional(v.id('workspaces')),
    userId: v.optional(v.string()),
    feature: v.string(),
    isEnabled: v.boolean(),
    metadata: v.optional(v.any()),
    updatedAt: v.number(),
  }).index('by_feature', ['feature']),
});
