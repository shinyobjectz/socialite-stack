import { expect, test, vi, beforeEach, describe } from 'vitest';
import { MetaAgent, OmegaAgent } from './AgentSystem';
import { ToolBus } from '../toolBus/ToolBus';

// Mock ai package
vi.mock('ai', () => {
  return {
    generateText: vi.fn().mockResolvedValue({ text: 'Mocked AI Response' }),
  };
});

// Mock ConvexModel
vi.mock('./ConvexModel', () => {
  return {
    ConvexModel: vi.fn().mockImplementation(modelId => ({
      modelId,
      specificationVersion: 'v1',
      provider: 'convex-llm-gateway',
    })),
  };
});

// Mock ConvexClient
vi.mock('convex/browser', () => {
  return {
    ConvexClient: vi.fn().mockImplementation(() => ({
      mutation: vi.fn().mockResolvedValue('mock_mutation_id'),
      query: vi.fn().mockResolvedValue([]),
      action: vi
        .fn()
        .mockResolvedValue({
          content: 'Mocked Action Response',
          usage: { promptTokens: 0, completionTokens: 0 },
        }),
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
    workspaceId: 'workspace-123' as any,
    cloudConvexUrl: 'https://cloud.convex.dev',
    localConvexUrl: 'http://localhost:3210',
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
      config.workspaceId,
      config.cloudConvexUrl
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
      workspaceId: config.workspaceId,
      cloudConvexUrl: config.cloudConvexUrl,
      localConvexUrl: config.localConvexUrl,
      toolBus,
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
      workspaceId: config.workspaceId,
      cloudConvexUrl: config.cloudConvexUrl,
      localConvexUrl: config.localConvexUrl,
      toolBus,
    });

    const researcher = new OmegaAgent(
      {
        name: 'researcher',
        model: 'gpt-4o',
        instructions: 'Research stuff',
      },
      config.workspaceId,
      config.cloudConvexUrl
    );

    metaAgent.registerSubAgent(researcher);
    expect((metaAgent as any).subAgents.has('researcher')).toBe(true);
  });
});
