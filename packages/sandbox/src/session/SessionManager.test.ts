import { expect, test, vi, describe } from 'vitest';
import { SessionManager } from './SessionManager';

// Mock ConvexClient
vi.mock('convex/browser', () => {
  return {
    ConvexClient: vi.fn().mockImplementation(() => ({
      mutation: vi.fn().mockResolvedValue('mock_mutation_id'),
      query: vi.fn().mockImplementation(name => {
        if (name === 'sessions:getSessionState') {
          return Promise.resolve({
            session: {
              toolManifests: [
                {
                  id: 'search_web',
                  name: 'Search',
                  type: 'api',
                  metadata: {},
                  schema: {},
                },
              ],
            },
          });
        }
        return Promise.resolve([]);
      }),
    })),
  };
});

// Mock ToolBus
vi.mock('../toolBus/ToolBus', () => {
  return {
    ToolBus: vi.fn().mockImplementation(() => ({
      initialize: vi.fn().mockResolvedValue(undefined),
      getRegisteredTools: vi.fn().mockReturnValue({}),
    })),
  };
});

// Mock AgentSystem
vi.mock('../agents/AgentSystem', () => {
  return {
    MetaAgent: vi.fn().mockImplementation(() => ({
      run: vi.fn().mockResolvedValue('Final agent result'),
      registerSubAgent: vi.fn(),
    })),
    OmegaAgent: vi.fn().mockImplementation(config => ({
      id: config.name,
      run: vi.fn().mockResolvedValue(`Result from ${config.name}`),
    })),
  };
});

describe('SessionManager', () => {
  const config = {
    sessionId: 'session_123',
    workspaceId: 'workspace_123',
    userId: 'user_123',
    cloudConvexUrl: 'https://cloud.convex.dev',
    localConvexUrl: 'http://localhost:3210',
    agentConfig: {
      model: 'gpt-4o',
      instructions: 'Be helpful',
      subAgents: [
        { name: 'researcher', model: 'gpt-4o', instructions: 'Research' },
      ],
    },
  };

  test('SessionManager should run through lifecycle', async () => {
    const manager = new SessionManager(config as any);

    await manager.start('Help me research AI');

    expect(manager.getStatus()).toBe('completed');
  });

  test('SessionManager should handle failures gracefully', async () => {
    const manager = new SessionManager(config as any);

    // Force a failure by making initializeTools throw
    vi.spyOn(manager as any, 'initializeTools').mockRejectedValueOnce(
      new Error('Init failed')
    );

    await manager.start('Help me research AI');

    expect(manager.getStatus()).toBe('failed');
  });
});
