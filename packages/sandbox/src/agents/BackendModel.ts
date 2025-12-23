import { LanguageModel, LanguageModelV1, LanguageModelV1StreamPart } from 'ai';
import fetch from 'node-fetch';

/**
 * BackendModel implements the Vercel AI SDK LanguageModelV1 interface
 * by proxying calls to the Socialite backend's Copilot API.
 *
 * This ensures that all agent model calls are fully integrated with the
 * existing @models infrastructure, including cost tracking, provider
 * management, and credential security.
 */
export class BackendModel implements LanguageModelV1 {
  readonly specificationVersion = 'v1';
  readonly provider = 'socialite-backend';

  constructor(
    public readonly modelId: string,
    private readonly backendUrl: string,
    private readonly authToken: string
  ) {}

  async doGenerate(options: any): Promise<any> {
    console.log(`[BackendModel] Proxying generate request for ${this.modelId}`);

    const response = await fetch(`${this.backendUrl}/api/copilot/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`,
      },
      body: JSON.stringify({
        modelId: this.modelId,
        messages: options.prompt, // Simplified for now
        params: {
          temperature: options.temperature,
          maxTokens: options.maxTokens,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend model call failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      text: data.content,
      usage: data.usage || { promptTokens: 0, completionTokens: 0 },
      finishReason: 'stop',
      rawCall: { rawPrompt: options.prompt, rawResponse: data },
    };
  }

  async doStream(options: any): Promise<any> {
    console.log(`[BackendModel] Proxying stream request for ${this.modelId}`);

    // Implementation for streaming would use Server-Sent Events (SSE)
    // from the backend's chatStream endpoint.
    throw new Error('Streaming is not yet implemented in BackendModel proxy.');
  }
}
