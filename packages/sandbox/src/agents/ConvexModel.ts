import { LanguageModelV1, LanguageModelV1StreamPart } from 'ai';
import { ConvexClient } from 'convex/browser';

/**
 * ConvexModel implements the Vercel AI SDK LanguageModelV1 interface
 * by calling the Convex 'llm:chat' action.
 *
 * This replaces the BackendModel proxy and allows agents to communicate
 * directly with the new Convex-based LLM gateway.
 */
export class ConvexModel implements LanguageModelV1 {
  readonly specificationVersion = 'v1';
  readonly provider = 'convex-llm-gateway';
  private client: ConvexClient;

  constructor(
    public readonly modelId: string,
    private readonly workspaceId: string,
    convexUrl: string
  ) {
    this.client = new ConvexClient(convexUrl);
  }

  async doGenerate(options: any): Promise<any> {
    console.log(`[ConvexModel] Calling Convex LLM gateway for ${this.modelId}`);

    // Map Vercel AI SDK messages to our Convex gateway format
    const messages = options.prompt.map((m: any) => ({
      role: m.role,
      content: m.content[0].type === 'text' ? m.content[0].text : '',
    }));

    try {
      // @ts-ignore - Calling the action we just created
      const result = await this.client.action('llm:chat', {
        workspaceId: this.workspaceId,
        modelId: this.modelId,
        messages,
        params: {
          temperature: options.temperature,
          maxTokens: options.maxTokens,
          topP: options.topP,
        }
      });

      return {
        text: result.content,
        usage: {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
        },
        finishReason: 'stop',
        rawCall: { rawPrompt: options.prompt, rawResponse: result },
      };
    } catch (error) {
      console.error('[ConvexModel] Gateway call failed:', error);
      throw error;
    }
  }

  async doStream(options: any): Promise<any> {
    // Streaming implementation would use a Convex subscription or a streaming action
    throw new Error('Streaming is not yet implemented in ConvexModel.');
  }
}
