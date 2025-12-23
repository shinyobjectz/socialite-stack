import { mutation, query, QueryCtx } from './_generated/server';
import { v } from 'convex/values';
import { Id } from './_generated/dataModel';
import { getAuthUser } from './auth';

/**
 * Permissions & Access Control (Authenticated)
 */

/**
 * Internal helper to assert that the current authenticated user has access.
 */
export async function assertAccess(
  ctx: QueryCtx,
  workspaceId: Id<'workspaces'>,
  minRole: 'owner' | 'admin' | 'member' = 'member'
) {
  const { identity } = await getAuthUser(ctx);
  
  const permission = await ctx.db
    .query('permissions')
    .withIndex('by_workspace_user', (q) =>
      q.eq('workspaceId', workspaceId).eq('userId', identity.tokenIdentifier)
    )
    .first();

  if (!permission) throw new Error("Access Denied: You do not have permission for this workspace.");

  const roles = ['member', 'admin', 'owner'];
  if (roles.indexOf(permission.role) < roles.indexOf(minRole)) {
    throw new Error(`Access Denied: Required role ${minRole}, but you are a ${permission.role}.`);
  }
  
  return { identity, permission };
}

export const grantWorkspaceAccess = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    targetTokenIdentifier: v.string(),
    role: v.union(v.literal('owner'), v.literal('admin'), v.literal('member')),
  },
  handler: async (ctx, args) => {
    // 1. Verify caller is an admin or owner (gated by auth)
    await assertAccess(ctx, args.workspaceId, 'admin');

    // 2. Update or insert permission
    const existing = await ctx.db
      .query('permissions')
      .withIndex('by_workspace_user', (q) =>
        q.eq('workspaceId', args.workspaceId).eq('userId', args.targetTokenIdentifier)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { role: args.role, updatedAt: Date.now() });
    } else {
      await ctx.db.insert('permissions', {
        workspaceId: args.workspaceId,
        userId: args.targetTokenIdentifier,
        role: args.role,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

export const getMyWorkspaces = query({
  args: {},
  handler: async (ctx) => {
    const { identity } = await getAuthUser(ctx);

    const permissions = await ctx.db
      .query('permissions')
      .withIndex('by_user', (q) => q.eq('userId', identity.tokenIdentifier))
      .collect();

    const workspaces = [];
    for (const p of permissions) {
      const w = await ctx.db.get(p.workspaceId);
      if (w) workspaces.push({ ...w, role: p.role });
    }
    return workspaces;
  },
});
