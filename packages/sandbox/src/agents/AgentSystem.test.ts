import { expect, test, vi, beforeEach, describe } from 'vitest';
import { MetaAgent, OmegaAgent } from './AgentSystem';
import { ToolBus } from '../toolBus/ToolBus';

// Mock ai package
vi.mock('ai', () => {
  return {
    generateText: vi.fn().mockResolvedValue({ text: 'Mocked AI Response' }),
  };
});

// Mock BackendModel
vi.mock('./BackendModel', () => {
  return {
    BackendModel: vi.fn().mockImplementation(modelId => ({
      modelId,
      specificationVersion: 'v1',
      provider: 'socialite-backend',
    })),
  };
});

// Mock ConvexClient
vi.mock('convex/browser', () => {
  return {
    ConvexClient: vi.fn().mockImplementation(() => ({
      mutation: vi.fn().mockResolvedValue('mock_mutation_id'),
      query: vi.fn().mockResolvedValue([]),
    })),
  };
});

// Mock ToolBus
vi.mock('../toolBus/ToolBus', () => {
  return {
    ToolBus: vi.fn().mockImplementation(() => ({
      getRegisteredTools: vi.fn().mockReturnValue({}),
      initialize: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

describe('AgentSystem', () => {
  let toolBus: ToolBus;
  const config = {
    sessionId: 'test-session-123',
    localConvexUrl: 'http://localhost:3210',
    backendUrl: 'https://backend.test.com',
    authToken: 'mock-token',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    toolBus = new ToolBus(config as any);
  });

  test('OmegaAgent should run tasks', async () => {
    const agent = new OmegaAgent(
      {
        name: 'researcher',
        model: 'gpt-4o',
        instructions: 'Be a researcher',
      },
      config.backendUrl,
      config.authToken
    );

    const result = await agent.run('Find info about AI');
    expect(result).toBe('Mocked AI Response');
  });

  test('MetaAgent should initialize and run', async () => {
    const metaAgent = new MetaAgent({
      name: 'orchestrator',
      model: 'gpt-4o',
      instructions: 'Orchestrate tasks',
      sessionId: config.sessionId,
      localConvexUrl: config.localConvexUrl,
      toolBus,
      backendUrl: config.backendUrl,
      authToken: config.authToken,
    });

    const result = await metaAgent.run('Help me with research');
    expect(result).toBe('Mocked AI Response');
  });

  test('MetaAgent should register sub-agents', async () => {
    const metaAgent = new MetaAgent({
      name: 'orchestrator',
      model: 'gpt-4o',
      instructions: 'Orchestrate tasks',
      sessionId: config.sessionId,
      localConvexUrl: config.localConvexUrl,
      toolBus,
      backendUrl: config.backendUrl,
      authToken: config.authToken,
    });

    const researcher = new OmegaAgent(
      {
        name: 'researcher',
        model: 'gpt-4o',
        instructions: 'Research stuff',
      },
      config.backendUrl,
      config.authToken
    );

    metaAgent.registerSubAgent(researcher);
    expect((metaAgent as any).subAgents.has('researcher')).toBe(true);
  });
});
