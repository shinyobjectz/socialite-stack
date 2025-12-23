import { query } from './_generated/server';
import { v } from 'convex/values';

/**
 * Quota & Usage Tracking (Optimized)
 */

export const checkQuota = query({
  args: { 
    workspaceId: v.id('workspaces'), 
    type: v.union(v.literal('storage'), v.literal('aiTokens')) 
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) return false;

    // Plan limits (could be moved to a separate table later)
    const limits = {
      storage: 10 * 1024 * 1024 * 1024, // 10GB
      aiTokens: 1000000,
    };

    const currentUsage = workspace.usage?.[args.type] ?? 0;
    return currentUsage < limits[args.type];
  },
});

export const getWorkspaceUsage = query({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    return workspace?.usage ?? { storage: 0, aiTokens: 0 };
  },
});
