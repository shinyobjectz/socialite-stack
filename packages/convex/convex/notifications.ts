import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

/**
 * Notification System (Phase F)
 */

export const sendNotification = mutation({
  args: {
    userId: v.string(),
    workspaceId: v.optional(v.id('workspaces')),
    type: v.string(),
    title: v.string(),
    content: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('notifications', {
      ...args,
      isRead: false,
      createdAt: Date.now(),
    });
  },
});

export const getMyNotifications = query({
  args: { userId: v.string(), onlyUnread: v.boolean() },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query('notifications')
      .withIndex('by_user_read', (q) => q.eq('userId', args.userId));
    
    if (args.onlyUnread) {
      q = q.filter((f) => f.eq(f.field('isRead'), false));
    }

    return await q.order('desc').collect();
  },
});

export const markAsRead = mutation({
  args: { notificationId: v.id('notifications') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.notificationId, { isRead: true });
  },
});
