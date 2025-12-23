import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

// ============= CREATE SESSION =============

export const createSession = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    userId: v.string(),
    mode: v.union(
      v.literal('research'),
      v.literal('content'),
      v.literal('analysis'),
      v.literal('custom')
    ),
    title: v.string(),
    toolIds: v.array(v.string()),
    agentConfig: v.optional(v.any()),
  },

  async handler(ctx, args) {
    const db = ctx.db;

    // Load tool manifests from registry
    const tools = await db
      .query('toolRegistry')
      .withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
      .collect();

    const filteredTools = args.toolIds.length > 0
      ? tools.filter(t => args.toolIds.includes(t.toolId) && t.isEnabled)
      : tools.filter(t => t.isEnabled);

    // Load workspace settings
    const workspace = await db.get(args.workspaceId);
    if (!workspace) throw new Error('Workspace not found');

    // Create E2B sandbox (call stub mutation)
    const sandboxId = await ctx.runMutation('sandbox:createE2BInstance', {
      workspaceId: args.workspaceId,
      sessionId: args.title,
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
        tools: filteredTools.map((t) => t.toolId),
      },

      toolManifests: filteredTools.map((t) => ({
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
      metadata: {
        totalTokensUsed: 0,
        totalCost: 0,
      },
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
      v.literal('loading_tools'),
      v.literal('running'),
      v.literal('completing'),
      v.literal('completed'),
      v.literal('failed')
    ),
    metadata: v.optional(v.any()),
  },

  async handler(ctx, args) {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error('Session not found');

    const updateData: any = {
      status: args.status,
    };

    if (args.status === 'running' && !session.startedAt) {
      updateData.startedAt = Date.now();
    } else if (args.status === 'completed' || args.status === 'failed') {
      updateData.completedAt = Date.now();
    }

    if (args.metadata) {
      updateData.metadata = {
        ...session.metadata,
        ...args.metadata,
      };
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
        type: v.union(
          v.literal('document'),
          v.literal('canvas'),
          v.literal('analysis'),
          v.literal('transcript')
        ),
        title: v.string(),
        content: v.string(),
        affineDocId: v.optional(v.string()),
        metadata: v.any(),
      })
    ),
    finalMetadata: v.object({
      totalTokensUsed: v.number(),
      totalCost: v.number(),
      errorDetails: v.optional(v.string()),
    }),
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
        type: artifact.type,
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
      outputDocumentIds: artifactIds
        .filter((_, i) => args.artifacts[i].type === 'document')
        .map(id => id.toString()),
      canvasArtifactIds: artifactIds
        .filter((_, i) => args.artifacts[i].type === 'canvas')
        .map(id => id.toString()),
      metadata: {
        ...session.metadata,
        ...args.finalMetadata,
      },
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
    if (!session) return null;

    const artifacts = await ctx.db
      .query('artifacts')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', args.sessionId))
      .order('desc')
      .collect();

    return {
      session,
      artifacts,
      isActive: session.status === 'running' || session.status === 'initializing' || session.status === 'loading_tools',
    };
  },
});

// ============= LIST SESSIONS =============

export const listSessions = query({
  args: {
    workspaceId: v.id('workspaces'),
    limit: v.optional(v.number()),
  },

  async handler(ctx, args) {
    return await ctx.db
      .query('sessions')
      .withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
      .order('desc')
      .take(args.limit ?? 50);
  },
});
