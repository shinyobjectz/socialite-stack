import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const registerTool = mutation({
  args: {
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
    isEnabled: v.optional(v.boolean()),
    isPublic: v.optional(v.boolean()),
  },
  async handler(ctx, args) {
    const existing = await ctx.db
      .query('toolRegistry')
      .withIndex('by_toolId', q => q.eq('toolId', args.toolId))
      .filter(q => q.eq(q.field('workspaceId'), args.workspaceId))
      .first();

    if (existing) {
      const { isEnabled, isPublic, ...rest } = args;
      await ctx.db.patch(existing._id, {
        ...rest,
        isEnabled: isEnabled ?? existing.isEnabled,
        isPublic: isPublic ?? existing.isPublic,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert('toolRegistry', {
      ...args,
      isEnabled: args.isEnabled ?? true,
      isPublic: args.isPublic ?? false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const getTools = query({
  args: {
    workspaceId: v.id('workspaces'),
    category: v.optional(
      v.union(
        v.literal('research'),
        v.literal('content'),
        v.literal('analysis'),
        v.literal('utility')
      )
    ),
    includeDisabled: v.optional(v.boolean()),
  },
  async handler(ctx, args) {
    let query = ctx.db
      .query('toolRegistry')
      .withIndex('by_workspaceId', q => q.eq('workspaceId', args.workspaceId));

    const tools = await query.collect();

    return tools.filter(tool => {
      const categoryMatch = !args.category || tool.category === args.category;
      const enabledMatch = args.includeDisabled || tool.isEnabled;
      return categoryMatch && enabledMatch;
    });
  },
});

export const getToolById = query({
  args: {
    workspaceId: v.id('workspaces'),
    toolId: v.string(),
  },
  async handler(ctx, args) {
    return await ctx.db
      .query('toolRegistry')
      .withIndex('by_toolId', q => q.eq('toolId', args.toolId))
      .filter(q => q.eq(q.field('workspaceId'), args.workspaceId))
      .first();
  },
});
