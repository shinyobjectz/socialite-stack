import { expect, test, vi } from 'vitest';
import { storeUser, currentUser } from './convex/auth';
import { pushUpdate } from './convex/sync';

// ========== Mocks ==========

const mockDb = () => ({
  insert: vi.fn().mockResolvedValue('user_id'),
  patch: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockReturnValue({
    withIndex: vi.fn().mockReturnThis(),
    unique: vi.fn().mockResolvedValue(null),
    first: vi.fn().mockResolvedValue(null),
  }),
});

const mockAuth = (identity: any) => ({
  getUserIdentity: vi.fn().mockResolvedValue(identity),
});

const mockCtx = (identity: any) => ({
  db: mockDb() as any,
  auth: mockAuth(identity) as any,
});

// ========== Auth Gating Tests ==========

test('storeUser creates new user from identity', async () => {
  const identity = {
    tokenIdentifier: 'auth0|123',
    email: 'test@example.com',
    name: 'Test User',
  };
  const ctx = mockCtx(identity);

  const result = await (storeUser as any).handler(ctx, {});

  expect(result).toBe('user_id');
  expect(ctx.db.insert).toHaveBeenCalledWith('users', expect.objectContaining({
    tokenIdentifier: 'auth0|123',
    email: 'test@example.com'
  }));
});

test('pushUpdate throws if unauthenticated', async () => {
  const ctx = mockCtx(null); // No identity
  const args = {
    workspaceId: 'w1' as any,
    docId: 'd1',
    update: new Uint8Array([1]).buffer as any,
  };

  await expect((pushUpdate as any).handler(ctx, args)).rejects.toThrow('Unauthenticated');
});

test('pushUpdate throws if authenticated but no permission', async () => {
  const identity = { tokenIdentifier: 'auth0|123' };
  const ctx = mockCtx(identity);
  
  // Mock permission check to return null
  ctx.db.query().withIndex().first.mockResolvedValue(null);

  const args = {
    workspaceId: 'w1' as any,
    docId: 'd1',
    update: new Uint8Array([1]).buffer as any,
  };

  await expect((pushUpdate as any).handler(ctx, args)).rejects.toThrow('Access Denied');
});

test('currentUser returns null if not logged in', async () => {
  const ctx = mockCtx(null);
  const result = await (currentUser as any).handler(ctx, {});
  expect(result).toBe(null);
});
