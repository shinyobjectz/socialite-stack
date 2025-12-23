import { action, mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { api } from './_generated/api';

/**
 * LLM Provider Migration (Phase B)
 *
 * This file implements the LLM gateway in Convex, replacing the NestJS Copilot logic.
 * It handles provider selection, API key retrieval, and external LLM calls.
 */

// ========== Types & Constants ==========

export const ModelInputType = v.union(
  v.literal('text'),
  v.literal('image'),
  v.literal('audio')
);

export const ModelOutputType = v.union(
  v.literal('text'),
  v.literal('object'),
  v.literal('embedding'),
  v.literal('image'),
  v.literal('structured')
);

export const ChatMessageRole = v.union(
  v.literal('system'),
  v.literal('assistant'),
  v.literal('user'),
  v.literal('tool')
);

// ========== Actions ==========

/**
 * Unified Chat Action
 * Proxies chat requests to the appropriate provider based on workspace settings and model ID.
 */
export const chat = action({
  args: {
    workspaceId: v.id('workspaces'),
    modelId: v.string(),
    messages: v.array(
      v.object({
        role: ChatMessageRole,
        content: v.string(),
        name: v.optional(v.string()),
        tool_call_id: v.optional(v.string()),
      })
    ),
    params: v.optional(
      v.object({
        temperature: v.optional(v.number()),
        maxTokens: v.optional(v.number()),
        topP: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    // 1. Resolve Provider
    const provider = resolveProvider(args.modelId);

    // 2. Get API Credentials for this workspace and provider
    const credentials = await ctx.runQuery(api.llm.getCredentials, {
      workspaceId: args.workspaceId,
      provider,
    });

    if (!credentials || !credentials.encryptedValue) {
      throw new Error(`No API credentials found for provider ${provider} in this workspace.`);
    }

    // 3. Execute call based on provider
    switch (provider) {
      case 'openai':
        return await callOpenAI(credentials.encryptedValue, args);
      case 'anthropic':
        return await callAnthropic(credentials.encryptedValue, args);
      default:
        throw new Error(`Provider ${provider} not supported in Convex yet.`);
    }
  },
});

// ========== Queries ==========

/**
 * Internal query to fetch credentials.
 * In a real implementation, 'encryptedValue' would be decrypted here or in the action.
 */
export const getCredentials = query({
  args: {
    workspaceId: v.id('workspaces'),
    provider: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('apiCredentials')
      .withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
      .filter((q) => q.and(
        q.eq(q.field('provider'), args.provider),
        q.eq(q.field('isActive'), true)
      ))
      .first();
  },
});

// ========== Helper Functions ==========

function resolveProvider(modelId: string): string {
  if (modelId.startsWith('gpt') || modelId.startsWith('o1')) return 'openai';
  if (modelId.startsWith('claude')) return 'anthropic';
  if (modelId.startsWith('gemini')) return 'google';
  return 'openai'; // Default
}

async function callOpenAI(apiKey: string, args: any) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: args.modelId,
      messages: args.messages,
      temperature: args.params?.temperature ?? 0.7,
      max_tokens: args.params?.maxTokens,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  const choice = data.choices[0];

  return {
    content: choice.message.content,
    role: choice.message.role,
    usage: {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    },
  };
}

async function callAnthropic(apiKey: string, args: any) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: args.modelId,
      system: args.messages.find((m: any) => m.role === 'system')?.content,
      messages: args.messages.filter((m: any) => m.role !== 'system'),
      max_tokens: args.params?.maxTokens ?? 4096,
      temperature: args.params?.temperature ?? 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${error}`);
  }

  const data = await response.json();

  return {
    content: data.content[0].text,
    role: 'assistant',
    usage: {
      promptTokens: data.usage.input_tokens,
      completionTokens: data.usage.output_tokens,
      totalTokens: data.usage.input_tokens + data.usage.output_tokens,
    },
  };
}

/**
 * Internal mutation for cron cost finalization.
 */
export const finalizeMonthlyCosts = mutation({
  args: {},
  handler: async (ctx) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const logs = await ctx.db
      .query('costLogs')
      .withIndex('by_workspace_date', (q) => 
        q.eq('year', year).eq('month', month)
      )
      .collect();

    for (const log of logs) {
      await ctx.db.patch(log._id, { isFinalized: true });
    }
  },
});
