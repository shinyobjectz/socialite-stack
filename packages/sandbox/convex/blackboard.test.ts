import { expect, test, vi } from 'vitest';
import { write, search, getNamespace } from './blackboard';

// Mocking the Convex context
const mockDb = () => ({
  insert: vi.fn().mockResolvedValue('mock_id'),
  patch: vi.fn().mockResolvedValue(undefined),
  get: vi.fn(),
  query: vi.fn().mockReturnValue({
    withIndex: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    collect: vi.fn().mockResolvedValue([]),
    take: vi.fn().mockResolvedValue([]),
    first: vi.fn().mockResolvedValue(null),
  }),
});

const mockCtx = () => ({
  db: mockDb() as any,
});

test('blackboard write handler - new entry', async () => {
  const ctx = mockCtx();
  const args = {
    sessionId: 'session_123',
    namespace: 'research',
    key: 'findings',
    value: 'Found some interesting data',
    agentId: 'agent_1',
  };

  const result = await (write as any).handler(ctx, args);

  expect(result).toBe('mock_id');
  expect(ctx.db.insert).toHaveBeenCalledWith(
    'blackboardEntries',
    expect.objectContaining({
      key: 'findings',
      value: 'Found some interesting data',
    })
  );
});

test('blackboard write handler - update existing', async () => {
  const ctx = mockCtx();
  const existingId = 'existing_id' as any;

  // Mock existing entry
  ctx.db.query().filter().first.mockResolvedValue({
    _id: existingId,
    value: 'old value',
    metadata: { version: 1 },
  });

  const args = {
    sessionId: 'session_123',
    namespace: 'research',
    key: 'findings',
    value: 'new value',
    metadata: { version: 2 },
  };

  await (write as any).handler(ctx, args);

  expect(ctx.db.patch).toHaveBeenCalledWith(
    existingId,
    expect.objectContaining({
      value: 'new value',
      metadata: { version: 2 },
    })
  );
});

test('blackboard search handler', async () => {
  const ctx = mockCtx();
  const mockEntries = [
    { key: 'finding_1', value: 'data about AI', namespace: 'research' },
    { key: 'finding_2', value: 'data about ML', namespace: 'research' },
    { key: 'other', value: 'something else', namespace: 'other' },
  ];

  ctx.db.query().collect.mockResolvedValue(mockEntries);

  const args = {
    sessionId: 'session_123',
    pattern: 'AI',
  };

  const results = await (search as any).handler(ctx, args);

  expect(results.length).toBe(1);
  expect(results[0].key).toBe('finding_1');
});

test('blackboard getNamespace handler', async () => {
  const ctx = mockCtx();
  const mockEntries = [
    { key: 'finding_1', value: 'data 1', namespace: 'research' },
    { key: 'finding_2', value: 'data 2', namespace: 'research' },
  ];

  ctx.db.query().collect.mockResolvedValue(mockEntries);

  const args = {
    sessionId: 'session_123',
    namespace: 'research',
  };

  const results = await (getNamespace as any).handler(ctx, args);

  expect(results.length).toBe(2);
  expect(ctx.db.query).toHaveBeenCalled();
});
