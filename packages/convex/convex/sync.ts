import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { assertAccess } from './permissions';
import { getAuthUser } from './auth';

/**
 * Gated Yjs Document Sync & Blob Management
 */

export const pushUpdate = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    docId: v.string(),
    update: v.bytes(),
  },
  handler: async (ctx, args) => {
    // Gated: User must have at least 'member' role to push updates
    await assertAccess(ctx, args.workspaceId, 'member');

    await ctx.db.insert('docUpdates', {
      workspaceId: args.workspaceId,
      docId: args.docId,
      update: args.update,
      createdAt: Date.now(),
    });
  },
});

export const getDocState = query({
  args: {
    workspaceId: v.id('workspaces'),
    docId: v.string(),
  },
  handler: async (ctx, args) => {
    // Gated: User must have at least 'member' role to read state
    await assertAccess(ctx, args.workspaceId, 'member');

    return await ctx.db
      .query('docUpdates')
      .withIndex('by_workspace_doc', (q) =>
        q.eq('workspaceId', args.workspaceId).eq('docId', args.docId)
      )
      .collect();
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    // Gated: User must be authenticated to upload
    await getAuthUser(ctx);
    return await ctx.storage.generateUploadUrl();
  }
});

export const registerBlob = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    blobId: v.string(),
    storageId: v.id('_storage'),
    mimeType: v.string(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    // Gated: User must have write access to the workspace
    await assertAccess(ctx, args.workspaceId, 'member');

    const id = await ctx.db.insert('blobs', {
      workspaceId: args.workspaceId,
      blobId: args.blobId,
      storageId: args.storageId,
      mimeType: args.mimeType,
      size: args.size,
      createdAt: Date.now(),
    });

    const workspace = await ctx.db.get(args.workspaceId);
    if (workspace) {
      await ctx.db.patch(args.workspaceId, {
        usage: {
          ...workspace.usage,
          storage: (workspace.usage?.storage ?? 0) + args.size,
        }
      });
    }
    return id;
  },
});

export const getBlobUrl = query({
  args: {
    workspaceId: v.id('workspaces'),
    blobId: v.string(),
  },
  handler: async (ctx, args) => {
    // Gated: User must have read access
    await assertAccess(ctx, args.workspaceId, 'member');

    const blob = await ctx.db
      .query('blobs')
      .withIndex('by_workspace_blob', (q) =>
        q.eq('workspaceId', args.workspaceId).eq('blobId', args.blobId)
      )
      .first();

    if (!blob) return null;
    return await ctx.storage.getUrl(blob.storageId);
  },
});
