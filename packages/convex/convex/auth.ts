import { mutation, query, QueryCtx } from './_generated/server';
import { v } from 'convex/values';

/**
 * Authentication Gating & User Management (Phase K)
 * 
 * This file implements the logic for gating access based on Convex Auth
 * and managing user profiles.
 */

/**
 * Helper to get the currently authenticated user.
 * Throws if the user is not authenticated.
 */
export async function getAuthUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated: Access is gated.");
  }

  const user = await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', identity.tokenIdentifier))
    .unique();

  return { identity, user };
}

/**
 * Mutation to sync the authenticated user with our database.
 * Called on login/app start.
 */
export const storeUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Cannot store user: No identity found.");
    }

    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', identity.tokenIdentifier))
      .unique();

    if (existingUser !== null) {
      // Update existing user
      const patch: any = { lastLoginAt: Date.now() };
      if (identity.email && existingUser.email !== identity.email) patch.email = identity.email;
      if (identity.name && existingUser.name !== identity.name) patch.name = identity.name;
      if (identity.pictureUrl && existingUser.avatarUrl !== identity.pictureUrl) patch.avatarUrl = identity.pictureUrl;
      
      await ctx.db.patch(existingUser._id, patch);
      return existingUser._id;
    }

    // Create new user
    return await ctx.db.insert('users', {
      tokenIdentifier: identity.tokenIdentifier,
      email: identity.email ?? "unknown",
      name: identity.name,
      avatarUrl: identity.pictureUrl,
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
    });
  },
});

/**
 * Query to check if the current user is authenticated and registered.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', identity.tokenIdentifier))
      .unique();
  },
});
