import { expect, test, vi, beforeEach } from 'vitest';
import { registerBlob, pushUpdate, getDocState } from './convex/sync';
import { assertAccess, grantWorkspaceAccess } from './convex/permissions';
import { checkQuota } from './convex/quota';
import { sendNotification, markAsRead } from './convex/notifications';

// ========== Mocks ==========

const mockDb = () => {
  const mock = {
    insert: vi.fn().mockResolvedValue('mock_id'),
    patch: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    get: vi.fn(),
    query: vi.fn().mockReturnValue({
      withIndex: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue([]),
      first: vi.fn().mockResolvedValue(null),
    }),
  };
  return mock;
};

const mockCtx = () => ({
  db: mockDb() as any,
  storage: {
    getUrl: vi.fn().mockResolvedValue('http://mock-url.com'),
    generateUploadUrl: vi.fn().mockResolvedValue('http://upload-url.com'),
  } as any,
});

// ========== Blob & Sync Tests ==========

test('registerBlob updates workspace usage', async () => {
  const ctx = mockCtx();
  const workspaceId = 'workspace_123' as any;
  
  ctx.db.get.mockResolvedValue({
    _id: workspaceId,
    usage: { storage: 100, aiTokens: 0 }
  });

  const args = {
    workspaceId,
    blobId: 'blob_abc',
    storageId: 'storage_xyz' as any,
    mimeType: 'image/png',
    size: 500,
  };

  await (registerBlob as any).handler(ctx, args);

  expect(ctx.db.insert).toHaveBeenCalledWith('blobs', expect.objectContaining({
    size: 500,
    blobId: 'blob_abc'
  }));

  expect(ctx.db.patch).toHaveBeenCalledWith(workspaceId, {
    usage: { storage: 600, aiTokens: 0 }
  });
});

test('pushUpdate inserts doc update', async () => {
  const ctx = mockCtx();
  const args = {
    workspaceId: 'w1' as any,
    docId: 'd1',
    update: new Uint8Array([1, 2, 3]).buffer as any,
  };

  await (pushUpdate as any).handler(ctx, args);

  expect(ctx.db.insert).toHaveBeenCalledWith('docUpdates', expect.objectContaining({
    docId: 'd1',
    update: args.update
  }));
});

// ========== Permissions Tests ==========

test('assertAccess throws on no permission', async () => {
  const ctx = mockCtx();
  ctx.db.query().withIndex().first.mockResolvedValue(null);

  await expect(assertAccess(ctx as any, 'w1' as any, 'u1')).rejects.toThrow('No access to workspace');
});

test('assertAccess throws on insufficient role', async () => {
  const ctx = mockCtx();
  ctx.db.query().withIndex().first.mockResolvedValue({ role: 'member' });

  await expect(assertAccess(ctx as any, 'w1' as any, 'u1', 'admin')).rejects.toThrow('Insufficient permissions');
});

test('grantWorkspaceAccess verifies admin role', async () => {
  const ctx = mockCtx();
  // Mock caller as admin
  ctx.db.query().withIndex().first.mockResolvedValueOnce({ role: 'admin' });
  // Mock target as not existing
  ctx.db.query().withIndex().first.mockResolvedValueOnce(null);

  const args = {
    workspaceId: 'w1' as any,
    adminUserId: 'admin_u',
    targetUserId: 'target_u',
    role: 'member' as const,
  };

  await (grantWorkspaceAccess as any).handler(ctx, args);

  expect(ctx.db.insert).toHaveBeenCalledWith('permissions', expect.objectContaining({
    userId: 'target_u',
    role: 'member'
  }));
});

// ========== Quota Tests ==========

test('checkQuota returns false when over limit', async () => {
  const ctx = mockCtx();
  ctx.db.get.mockResolvedValue({
    usage: { storage: 11 * 1024 * 1024 * 1024, aiTokens: 0 } // 11GB
  });

  const result = await (checkQuota as any).handler(ctx, { 
    workspaceId: 'w1' as any, 
    type: 'storage' 
  });

  expect(result).toBe(false);
});

// ========== Notifications Tests ==========

test('sendNotification inserts record', async () => {
  const ctx = mockCtx();
  const args = {
    userId: 'u1',
    type: 'mention',
    title: 'New Mention',
    content: 'User mentioned you',
  };

  await (sendNotification as any).handler(ctx, args);

  expect(ctx.db.insert).toHaveBeenCalledWith('notifications', expect.objectContaining({
    userId: 'u1',
    isRead: false
  }));
});

test('markAsRead patches record', async () => {
  const ctx = mockCtx();
  const notificationId = 'n1' as any;

  await (markAsRead as any).handler(ctx, { notificationId });

  expect(ctx.db.patch).toHaveBeenCalledWith(notificationId, { isRead: true });
});
