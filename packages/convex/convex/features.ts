import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

/**
 * Feature Flags & Access Tokens (Phase G)
 */

export const toggleFeature = mutation({
  args: {
    feature: v.string(),
    isEnabled: v.boolean(),
    workspaceId: v.optional(v.id('workspaces')),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('featureFlags')
      .withIndex('by_feature', (q) => q.eq('feature', args.feature))
      .filter((q) => 
        q.and(
          q.eq(q.field('workspaceId'), args.workspaceId),
          q.eq(q.field('userId'), args.userId)
        )
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { isEnabled: args.isEnabled, updatedAt: Date.now() });
    } else {
      await ctx.db.insert('featureFlags', {
        ...args,
        updatedAt: Date.now(),
      });
    }
  },
});

export const checkFeature = query({
  args: {
    feature: v.string(),
    workspaceId: v.optional(v.id('workspaces')),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const flag = await ctx.db
      .query('featureFlags')
      .withIndex('by_feature', (q) => q.eq('feature', args.feature))
      .filter((q) => 
        q.and(
          q.eq(q.field('workspaceId'), args.workspaceId),
          q.eq(q.field('userId'), args.userId)
        )
      )
      .first();
    
    return flag?.isEnabled ?? false;
  },
});

// ========== Access Tokens ==========

export const createAccessToken = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    scopes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // In a real app, generate a secure random string and hash it
    const token = 'sk_' + Math.random().toString(36).substring(2); 
    await ctx.db.insert('userAccessTokens', {
      userId: args.userId,
      name: args.name,
      token: token, // Should be hashed in production
      scopes: args.scopes,
      createdAt: Date.now(),
    });
    return token;
  },
});
