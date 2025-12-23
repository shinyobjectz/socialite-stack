import { expect, test, vi } from 'vitest';
import { initializeWorkspace } from './convex/workspaces';
import {
  createSession,
  getSessionState,
  updateSessionStatus,
  syncSessionResults,
} from './convex/sessions';

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
  runMutation: vi.fn().mockResolvedValue('mock_sandbox_id'),
});

test('initializeWorkspace handler', async () => {
  const ctx = mockCtx();
  const args = {
    userId: 'user_123',
    name: 'Test Workspace',
    slug: 'test-workspace',
  };

  const result = await (initializeWorkspace as any).handler(ctx, args);

  expect(result).toBe('mock_id');
  expect(ctx.db.insert).toHaveBeenCalledWith(
    'workspaces',
    expect.objectContaining({
      userId: 'user_123',
      name: 'Test Workspace',
    })
  );
  // Verify default tools are registered
  expect(ctx.db.insert).toHaveBeenCalledWith(
    'toolRegistry',
    expect.objectContaining({
      toolId: 'search_web',
    })
  );
});

test('createSession handler', async () => {
  const ctx = mockCtx();
  const workspaceId = 'workspace_123' as any;

  // Mock workspace settings
  ctx.db.get.mockResolvedValue({
    _id: workspaceId,
    settings: {
      defaultModel: 'gpt-4o',
      defaultTemperature: 0.7,
      maxTokensPerSession: 4000,
      costLimitPerMonth: 50,
    },
  });

  const args = {
    workspaceId,
    userId: 'user_123',
    mode: 'research' as const,
    title: 'Researching AI Agents',
    toolIds: ['search_web'],
  };

  const result = await (createSession as any).handler(ctx, args);

  expect(result.status).toBe('initializing');
  expect(result.sandboxId).toBe('mock_sandbox_id');
  expect(ctx.db.insert).toHaveBeenCalledWith(
    'sessions',
    expect.objectContaining({
      title: 'Researching AI Agents',
      mode: 'research',
    })
  );
});

test('updateSessionStatus handler', async () => {
  const ctx = mockCtx();
  const sessionId = 'session_123' as any;

  ctx.db.get.mockResolvedValue({
    _id: sessionId,
    status: 'initializing',
    metadata: {},
  });

  const args = {
    sessionId,
    status: 'running' as const,
  };

  await (updateSessionStatus as any).handler(ctx, args);

  expect(ctx.db.patch).toHaveBeenCalledWith(
    sessionId,
    expect.objectContaining({
      status: 'running',
      startedAt: expect.any(Number),
    })
  );
});

test('syncSessionResults handler', async () => {
  const ctx = mockCtx();
  const sessionId = 'session_123' as any;
  const workspaceId = 'workspace_123' as any;

  ctx.db.get.mockResolvedValue({
    _id: sessionId,
    workspaceId,
    metadata: {},
  });

  const args = {
    sessionId,
    artifacts: [
      {
        type: 'document' as const,
        title: 'Research Report',
        content: '# AI Agents',
        metadata: { wordCount: 10 },
      },
    ],
    finalMetadata: {
      totalTokensUsed: 1000,
      totalCost: 0.02,
    },
  };

  await (syncSessionResults as any).handler(ctx, args);

  // Verify artifact creation
  expect(ctx.db.insert).toHaveBeenCalledWith(
    'artifacts',
    expect.objectContaining({
      title: 'Research Report',
      type: 'document',
    })
  );

  // Verify session update
  expect(ctx.db.patch).toHaveBeenCalledWith(
    sessionId,
    expect.objectContaining({
      status: 'completed',
      metadata: expect.objectContaining({
        totalTokensUsed: 1000,
      }),
    })
  );
});
