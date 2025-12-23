import { expect, test, vi, beforeEach, describe } from 'vitest';
import { ToolBus, ToolManifest } from './ToolBus';
import fetch from 'node-fetch';

// Mock node-fetch
vi.mock('node-fetch');
const mockedFetch = vi.mocked(fetch);

// Mock ConvexClient
vi.mock('convex/browser', () => {
  return {
    ConvexClient: vi.fn().mockImplementation(() => ({
      mutation: vi.fn().mockResolvedValue('mock_mutation_id'),
      query: vi.fn().mockResolvedValue([]),
    })),
  };
});

describe('ToolBus', () => {
  let toolBus: ToolBus;
  const sessionConfig = {
    sessionId: 'test-session-123',
    localConvexUrl: 'http://localhost:3210',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    toolBus = new ToolBus(sessionConfig);
  });

  test('initialize should load tools from manifests', async () => {
    const manifests: ToolManifest[] = [
      {
        id: 'search_web',
        name: 'Web Search',
        type: 'api',
        metadata: {
          endpoint: 'https://api.test.com/search',
          description: 'Search the web',
        },
        schema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
          },
          required: ['query'],
        },
      },
    ];

    await toolBus.initialize(manifests);
    const tools = toolBus.getRegisteredTools();

    expect(Object.keys(tools).length).toBe(1);
    expect(tools['search_web']).toBeDefined();
  });

  test('execute API tool should call fetch and record execution', async () => {
    const manifest: ToolManifest = {
      id: 'test_api',
      name: 'Test API',
      type: 'api',
      metadata: {
        endpoint: 'https://api.test.com/exec',
      },
      schema: {
        type: 'object',
        properties: {
          input: { type: 'string' },
        },
      },
    };

    await toolBus.initialize([manifest]);
    const tool = toolBus.getRegisteredTools()['test_api'];

    mockedFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: 'success' }),
    } as any);

    const result = await tool.execute!({ input: 'hello' }, {} as any);

    expect(result).toEqual({ result: 'success' });
    expect(mockedFetch).toHaveBeenCalledWith(
      'https://api.test.com/exec',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ input: 'hello' }),
      })
    );
  });

  test('execute builtin execute_typescript should run mock execution', async () => {
    const manifest: ToolManifest = {
      id: 'execute_typescript',
      name: 'TypeScript Executor',
      type: 'builtin',
      metadata: {},
      schema: {},
    };

    await toolBus.initialize([manifest]);
    const tool = toolBus.getRegisteredTools()['execute_typescript'];

    const result = await tool.execute!(
      { code: 'console.log("hi")' },
      {} as any
    );

    expect(result).toHaveProperty('stdout');
    expect(result.exitCode).toBe(0);
  });

  test('execute builtin generate_document should run mock generation', async () => {
    const manifest: ToolManifest = {
      id: 'generate_document',
      name: 'Doc Generator',
      type: 'builtin',
      metadata: {},
      schema: {},
    };

    await toolBus.initialize([manifest]);
    const tool = toolBus.getRegisteredTools()['generate_document'];

    const result = await tool.execute!(
      { title: 'Test Doc', content: '# Hello' },
      {} as any
    );

    expect(result).toHaveProperty('documentId');
    expect(result.status).toBe('created');
  });
});
