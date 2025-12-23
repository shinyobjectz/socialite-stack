import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getAuthUser } from './auth';

/**
 * Gated Workspace Management
 */

export const initializeWorkspace = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
  },
  async handler(ctx, args) {
    // 1. Gated: Must be authenticated
    const { identity } = await getAuthUser(ctx);

    // 2. Create Workspace
    const workspaceId = await ctx.db.insert('workspaces', {
      userId: identity.tokenIdentifier, // Owner is the authenticated user
      name: args.name,
      slug: args.slug,
      settings: {
        defaultModel: 'gpt-4o',
        defaultTemperature: 0.7,
        maxTokensPerSession: 4000,
        costLimitPerMonth: 50,
      },
      usage: {
        storage: 0,
        aiTokens: 0,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // 3. Automatically grant 'owner' permission to the creator
    await ctx.db.insert('permissions', {
      workspaceId,
      userId: identity.tokenIdentifier,
      role: 'owner',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // 4. Register default tools
    const defaultTools = [
      {
        toolId: 'search_web',
        name: 'Web Search',
        version: '1.0.0',
        type: 'api' as const,
        category: 'research' as const,
        schema: {
          description: 'Search the web for information',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string' },
            },
            required: ['query'],
          },
        },
        metadata: {
          endpoint: 'https://api.serpapi.com/search',
        },
      },
      {
        toolId: 'generate_document',
        name: 'Generate Document',
        version: '1.0.0',
        type: 'builtin' as const,
        category: 'content' as const,
        schema: {
          description: 'Generate a structured document in Affine',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              content: { type: 'string' },
            },
            required: ['title', 'content'],
          },
        },
        metadata: {},
      },
    ];

    for (const tool of defaultTools) {
      await ctx.db.insert('toolRegistry', {
        workspaceId,
        ...tool,
        isEnabled: true,
        isPublic: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return workspaceId;
  },
});

export const getWorkspaceSettings = query({
  args: {
    workspaceId: v.id('workspaces'),
  },
  async handler(ctx, args) {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error('Workspace not found');
    return workspace.settings;
  },
});

export const getWorkspaceBySlug = query({
  args: {
    slug: v.string(),
  },
  async handler(ctx, args) {
    return await ctx.db
      .query('workspaces')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .first();
  },
});
