# Configuration Layer & Workspace Management
**Files**: `packages/db/convex/workspace.ts` + `packages/web/app/(workspace)/settings/`

## Overview

Configuration layer manages:
- Workspace settings (model defaults, cost limits, API keys)
- Tool registry (enable/disable tools, API credentials)
- Cost limits and tracking
- Workspace-level agent specializations
- Integration setup

---

## Workspace Configuration Types

```typescript
// lib/workspace.ts

export interface WorkspaceSettings {
  // Model Configuration
  defaultModel: 'gpt-4o' | 'gpt-4-turbo' | 'claude-3-opus';
  defaultTemperature: number; // 0-1
  
  // Limits
  maxTokensPerSession: number;
  maxSessionDuration: number; // ms
  maxConcurrentSessions: number;
  
  // Cost Management
  costLimitPerMonth: number; // USD
  costAlertThreshold: number; // % of limit
  costReportingEmail: string;
  
  // Features
  enabledFeatures: {
    research: boolean;
    content: boolean;
    analytics: boolean;
    customAgents: boolean;
  };
}

export interface ToolConfiguration {
  toolId: string;
  isEnabled: boolean;
  
  // Credentials
  credentials?: {
    apiKey?: string;
    bearerToken?: string;
    oauth?: {
      clientId: string;
      clientSecret: string;
    };
  };
  
  // Limits
  maxCallsPerMinute?: number;
  dailyQuotaRequests?: number;
  
  // Cost
  estimatedCostPerRequest?: number;
  
  // Availability
  restrictToModes?: ('research' | 'content' | 'analysis')[];
}

export interface WorkspaceIntegrations {
  affine?: {
    apiKey: string;
    enabled: boolean;
  };
  openrouter?: {
    apiKey: string;
    enabled: boolean;
  };
  e2b?: {
    apiKey: string;
    enabled: boolean;
  };
  dataseo?: {
    apiKey: string;
    enabled: boolean;
  };
  serpapi?: {
    apiKey: string;
    enabled: boolean;
  };
  exa?: {
    apiKey: string;
    enabled: boolean;
  };
  elevenLabs?: {
    apiKey: string;
    enabled: boolean;
  };
  suno?: {
    apiKey: string;
    enabled: boolean;
  };
}
```

---

## Workspace Mutations & Queries

```typescript
// packages/db/convex/workspace.ts

import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

// ============= WORKSPACE SETTINGS =============

export const updateWorkspaceSettings = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    settings: v.object({
      defaultModel: v.optional(v.string()),
      defaultTemperature: v.optional(v.number()),
      maxTokensPerSession: v.optional(v.number()),
      costLimitPerMonth: v.optional(v.number()),
    }),
  },

  async handler(ctx, args) {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error('Workspace not found');

    // Validate settings
    if (args.settings.defaultTemperature) {
      if (args.settings.defaultTemperature < 0 || args.settings.defaultTemperature > 1) {
        throw new Error('Temperature must be between 0 and 1');
      }
    }

    if (args.settings.costLimitPerMonth) {
      if (args.settings.costLimitPerMonth < 1) {
        throw new Error('Cost limit must be at least $1');
      }
    }

    // Update workspace
    await ctx.db.patch(args.workspaceId, {
      settings: {
        ...workspace.settings,
        ...args.settings,
      },
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const getWorkspaceSettings = query({
  args: { workspaceId: v.id('workspaces') },

  async handler(ctx, args) {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error('Workspace not found');

    return workspace.settings;
  },
});

// ============= API CREDENTIALS =============

export const addApiCredential = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    provider: v.string(),
    value: v.string(),
  },

  async handler(ctx, args) {
    // Encrypt credential before storage
    const encrypted = await encryptCredential(args.value);

    // Check if credential already exists
    const existing = await ctx.db
      .query('apiCredentials')
      .filter(
        (q) =>
          q.and(
            q.eq(q.field('workspaceId'), args.workspaceId),
            q.eq(q.field('provider'), args.provider)
          )
      )
      .first();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        encryptedValue: encrypted,
        lastValidated: null,
      });
    } else {
      // Create new
      await ctx.db.insert('apiCredentials', {
        workspaceId: args.workspaceId,
        provider: args.provider,
        encryptedValue: encrypted,
        isActive: true,
        createdAt: Date.now(),
      });
    }

    return { success: true };
  },
});

export const validateApiCredential = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    provider: v.string(),
  },

  async handler(ctx, args) {
    const cred = await ctx.db
      .query('apiCredentials')
      .filter(
        (q) =>
          q.and(
            q.eq(q.field('workspaceId'), args.workspaceId),
            q.eq(q.field('provider'), args.provider)
          )
      )
      .first();

    if (!cred) {
      return { success: false, error: 'Credential not found' };
    }

    // Decrypt and validate
    const decrypted = await decryptCredential(cred.encryptedValue);

    const isValid = await validateCredentialWithProvider(args.provider, decrypted);

    if (isValid) {
      await ctx.db.patch(cred._id, {
        isActive: true,
        lastValidated: Date.now(),
      });
    }

    return {
      success: isValid,
      error: isValid ? null : 'Invalid credential',
    };
  },
});

export const listApiCredentials = query({
  args: { workspaceId: v.id('workspaces') },

  async handler(ctx, args) {
    const credentials = await ctx.db
      .query('apiCredentials')
      .filter((q) => q.eq(q.field('workspaceId'), args.workspaceId))
      .collect();

    // Return only metadata (not actual values)
    return credentials.map((cred) => ({
      id: cred._id,
      provider: cred.provider,
      isActive: cred.isActive,
      lastValidated: cred.lastValidated,
      createdAt: cred.createdAt,
    }));
  },
});

export const deleteApiCredential = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    provider: v.string(),
  },

  async handler(ctx, args) {
    const cred = await ctx.db
      .query('apiCredentials')
      .filter(
        (q) =>
          q.and(
            q.eq(q.field('workspaceId'), args.workspaceId),
            q.eq(q.field('provider'), args.provider)
          )
      )
      .first();

    if (!cred) throw new Error('Credential not found');

    await ctx.db.delete(cred._id);

    return { success: true };
  },
});

// ============= TOOL CONFIGURATION =============

export const configureToolForWorkspace = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    toolId: v.string(),
    configuration: v.object({
      isEnabled: v.optional(v.boolean()),
      maxCallsPerMinute: v.optional(v.number()),
      restrictToModes: v.optional(v.array(v.string())),
    }),
  },

  async handler(ctx, args) {
    // Update tool registry entry for this workspace
    const tool = await ctx.db
      .query('toolRegistry')
      .filter(
        (q) =>
          q.and(
            q.eq(q.field('workspaceId'), args.workspaceId),
            q.eq(q.field('toolId'), args.toolId)
          )
      )
      .first();

    if (!tool) {
      throw new Error(`Tool ${args.toolId} not configured for workspace`);
    }

    await ctx.db.patch(tool._id, {
      isEnabled: args.configuration.isEnabled ?? tool.isEnabled,
      metadata: {
        ...tool.metadata,
        rateLimit: args.configuration.maxCallsPerMinute
          ? {
              requestsPerMinute: args.configuration.maxCallsPerMinute,
              burst: args.configuration.maxCallsPerMinute * 2,
            }
          : tool.metadata.rateLimit,
      },
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const listWorkspaceTools = query({
  args: { workspaceId: v.id('workspaces') },

  async handler(ctx, args) {
    return await ctx.db
      .query('toolRegistry')
      .filter((q) => q.eq(q.field('workspaceId'), args.workspaceId))
      .collect();
  },
});

// ============= COST TRACKING =============

export const getCurrentMonthCosts = query({
  args: { workspaceId: v.id('workspaces') },

  async handler(ctx, args) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const costLog = await ctx.db
      .query('costLogs')
      .filter(
        (q) =>
          q.and(
            q.eq(q.field('workspaceId'), args.workspaceId),
            q.eq(q.field('year'), year),
            q.eq(q.field('month'), month)
          )
      )
      .first();

    if (!costLog) {
      return {
        totalCostUsd: 0,
        totalTokensUsed: 0,
        costByTool: {},
        costByModel: {},
      };
    }

    return costLog;
  },
});

export const getCostForecast = query({
  args: { workspaceId: v.id('workspaces') },

  async handler(ctx, args) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const currentLog = await ctx.db
      .query('costLogs')
      .filter(
        (q) =>
          q.and(
            q.eq(q.field('workspaceId'), args.workspaceId),
            q.eq(q.field('year'), year),
            q.eq(q.field('month'), month)
          )
      )
      .first();

    if (!currentLog) {
      return { projectedCost: 0, daysInMonth: 30, currentDay: now.getDate() };
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    const currentDay = now.getDate();

    // Linear projection
    const projectedCost = (currentLog.totalCostUsd / currentDay) * daysInMonth;

    return {
      projectedCost,
      currentCost: currentLog.totalCostUsd,
      daysInMonth,
      currentDay,
    };
  },
});

// ============= WORKSPACE INITIALIZATION =============

export const initializeWorkspace = mutation({
  args: { workspaceId: v.id('workspaces') },

  async handler(ctx, args) {
    // Register default tools
    const defaultTools = [
      {
        name: 'search_web',
        type: 'api',
        category: 'research',
        endpoint: 'https://api.serpapi.com/search',
        description: 'Search the web for information',
      },
      {
        name: 'fetch_content',
        type: 'api',
        category: 'research',
        endpoint: 'https://api.exa.ai/search',
        description: 'Fetch and parse web content',
      },
      {
        name: 'generate_document',
        type: 'builtin',
        category: 'content',
        description: 'Generate structured documents',
      },
      {
        name: 'generate_canvas',
        type: 'builtin',
        category: 'content',
        description: 'Create visual canvas elements',
      },
      {
        name: 'execute_typescript',
        type: 'builtin',
        category: 'execution',
        description: 'Execute TypeScript code',
      },
    ];

    for (const tool of defaultTools) {
      const existing = await ctx.db
        .query('toolRegistry')
        .filter(
          (q) =>
            q.and(
              q.eq(q.field('workspaceId'), args.workspaceId),
              q.eq(q.field('name'), tool.name)
            )
        )
        .first();

      if (!existing) {
        await ctx.db.insert('toolRegistry', {
          workspaceId: args.workspaceId,
          toolId: tool.name,
          name: tool.name,
          version: '1.0.0',
          type: tool.type as any,
          category: tool.category as any,
          schema: {
            description: tool.description,
            parameters: {},
            returns: {},
          },
          metadata: {
            description: tool.description,
            endpoint: tool.endpoint,
          },
          isEnabled: true,
          isPublic: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }

    return { success: true };
  },
});
```

---

## Frontend Settings Pages

```tsx
// app/(workspace)/settings/page.tsx

'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { SettingsTab } from '@/components/SettingsTab';
import { ToolManager } from '@/components/ToolManager';
import { ApiCredentialsManager } from '@/components/ApiCredentialsManager';
import { CostLimits } from '@/components/CostLimits';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'tools' | 'api' | 'costs'>('general');
  
  const workspaceId = '...'; // From context
  const settings = useQuery(api.workspace.getSettings, { workspaceId });
  const updateSettings = useMutation(api.workspace.updateSettings);

  if (!settings) {
    return <div>Loading...</div>;
  }

  return (
    <div className='space-y-8'>
      <h1 className='text-3xl font-bold'>Workspace Settings</h1>

      {/* Tabs */}
      <div className='flex gap-4 border-b'>
        {(['general', 'tools', 'api', 'costs'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'general' && (
          <GeneralSettings
            settings={settings}
            onUpdate={updateSettings}
            workspaceId={workspaceId}
          />
        )}

        {activeTab === 'tools' && <ToolManager workspaceId={workspaceId} />}

        {activeTab === 'api' && (
          <ApiCredentialsManager workspaceId={workspaceId} />
        )}

        {activeTab === 'costs' && (
          <CostLimits
            settings={settings}
            onUpdate={updateSettings}
            workspaceId={workspaceId}
          />
        )}
      </div>
    </div>
  );
}

function GeneralSettings({
  settings,
  onUpdate,
  workspaceId,
}: any) {
  const [formData, setFormData] = useState({
    defaultModel: settings.defaultModel,
    defaultTemperature: settings.defaultTemperature,
    maxTokensPerSession: settings.maxTokensPerSession,
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await onUpdate({
        workspaceId,
        settings: formData,
      });
      alert('Settings updated');
    } catch (error) {
      alert('Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className='space-y-6 max-w-2xl'>
      {/* Model Selection */}
      <div>
        <label className='block text-sm font-medium mb-2'>Default Model</label>
        <select
          value={formData.defaultModel}
          onChange={(e) =>
            setFormData({ ...formData, defaultModel: e.target.value })
          }
          className='w-full px-4 py-2 border rounded-lg'
        >
          <option value='gpt-4o'>GPT-4 Omni</option>
          <option value='gpt-4-turbo'>GPT-4 Turbo</option>
          <option value='claude-3-opus'>Claude 3 Opus</option>
        </select>
      </div>

      {/* Temperature */}
      <div>
        <label className='block text-sm font-medium mb-2'>
          Default Temperature: {formData.defaultTemperature.toFixed(1)}
        </label>
        <input
          type='range'
          min='0'
          max='1'
          step='0.1'
          value={formData.defaultTemperature}
          onChange={(e) =>
            setFormData({
              ...formData,
              defaultTemperature: parseFloat(e.target.value),
            })
          }
          className='w-full'
        />
        <p className='text-sm text-gray-600 mt-2'>
          Higher values = more creative
        </p>
      </div>

      {/* Max Tokens */}
      <div>
        <label className='block text-sm font-medium mb-2'>
          Max Tokens Per Session
        </label>
        <input
          type='number'
          value={formData.maxTokensPerSession}
          onChange={(e) =>
            setFormData({
              ...formData,
              maxTokensPerSession: parseInt(e.target.value),
            })
          }
          className='w-full px-4 py-2 border rounded-lg'
        />
      </div>

      <button
        type='submit'
        disabled={isSaving}
        className='px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50'
      >
        {isSaving ? 'Saving...' : 'Save Settings'}
      </button>
    </form>
  );
}
```

```tsx
// components/ApiCredentialsManager.tsx

'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

const PROVIDERS = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'LLM API routing',
    docsUrl: 'https://openrouter.ai',
  },
  {
    id: 'dataseo',
    name: 'DataForSEO',
    description: 'SEO and analytics data',
    docsUrl: 'https://dataseoapi.com',
  },
  {
    id: 'serpapi',
    name: 'SerpAPI',
    description: 'Search engine API',
    docsUrl: 'https://serpapi.com',
  },
  {
    id: 'exa',
    name: 'Exa',
    description: 'Neural search',
    docsUrl: 'https://exa.ai',
  },
  {
    id: 'eleven_labs',
    name: 'Eleven Labs',
    description: 'Voice synthesis',
    docsUrl: 'https://elevenlabs.io',
  },
  {
    id: 'suno',
    name: 'Suno',
    description: 'Music generation',
    docsUrl: 'https://suno.ai',
  },
  {
    id: 'affine',
    name: 'Affine',
    description: 'Document collaboration',
    docsUrl: 'https://affine.pro',
  },
];

interface ApiCredentialsManagerProps {
  workspaceId: string;
}

export function ApiCredentialsManager({
  workspaceId,
}: ApiCredentialsManagerProps) {
  const credentials = useQuery(api.workspace.listApiCredentials, {
    workspaceId,
  });

  const addCredential = useMutation(api.workspace.addApiCredential);
  const validateCredential = useMutation(api.workspace.validateApiCredential);
  const deleteCredential = useMutation(api.workspace.deleteApiCredential);

  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleAddCredential = async () => {
    if (!selectedProvider || !apiKey) return;

    setIsSaving(true);
    try {
      await addCredential({
        workspaceId,
        provider: selectedProvider,
        value: apiKey,
      });

      // Validate immediately
      await validateCredential({
        workspaceId,
        provider: selectedProvider,
      });

      setSelectedProvider(null);
      setApiKey('');
      alert('Credential added and validated');
    } catch (error) {
      alert('Failed to add credential');
    } finally {
      setIsSaving(false);
    }
  };

  if (!credentials) return <div>Loading...</div>;

  return (
    <div className='space-y-6'>
      {/* Add New Credential */}
      <div className='bg-white rounded-lg border p-6'>
        <h3 className='font-semibold text-lg mb-4'>Add API Credential</h3>

        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium mb-2'>Provider</label>
            <select
              value={selectedProvider || ''}
              onChange={(e) => setSelectedProvider(e.target.value || null)}
              className='w-full px-4 py-2 border rounded-lg'
            >
              <option value=''>Select a provider...</option>
              {PROVIDERS.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name} - {provider.description}
                </option>
              ))}
            </select>
          </div>

          {selectedProvider && (
            <>
              <div>
                <label className='block text-sm font-medium mb-2'>API Key</label>
                <input
                  type='password'
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder='Paste your API key here'
                  className='w-full px-4 py-2 border rounded-lg'
                />
              </div>

              <div className='flex gap-2'>
                <button
                  onClick={handleAddCredential}
                  disabled={isSaving || !apiKey}
                  className='px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50'
                >
                  {isSaving ? 'Adding...' : 'Add Credential'}
                </button>

                {selectedProvider && (
                  <a
                    href={
                      PROVIDERS.find((p) => p.id === selectedProvider)?.docsUrl
                    }
                    target='_blank'
                    rel='noopener noreferrer'
                    className='px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50'
                  >
                    Get API Key →
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Existing Credentials */}
      <div className='space-y-3'>
        <h3 className='font-semibold text-lg'>Configured Credentials</h3>

        {credentials.length === 0 ? (
          <p className='text-gray-600'>No credentials added yet</p>
        ) : (
          <div className='space-y-3'>
            {credentials.map((cred: any) => {
              const provider = PROVIDERS.find((p) => p.id === cred.provider);
              return (
                <div
                  key={cred.id}
                  className='bg-white rounded-lg border p-4 flex items-center justify-between'
                >
                  <div>
                    <h4 className='font-medium'>{provider?.name}</h4>
                    <div className='text-sm text-gray-600 mt-1'>
                      {cred.isActive ? (
                        <span className='text-green-600'>✓ Valid</span>
                      ) : (
                        <span className='text-yellow-600'>⚠️ Needs validation</span>
                      )}
                      {cred.lastValidated && (
                        <span className='ml-2 text-gray-500'>
                          Last validated:{' '}
                          {new Date(cred.lastValidated).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => deleteCredential({ workspaceId, provider: cred.provider })}
                    className='px-3 py-1 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50'
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## DRY Principles

- Single PROVIDERS array for API provider list
- Reusable credential manager component
- Centralized workspace settings mutations
- Shared types across config layer
- Factory pattern for default tool initialization

---

## Security Considerations

1. **API Keys**: Encrypted in database, never exposed to frontend
2. **Validation**: Test credentials before saving
3. **Rotation**: Prompt users to update expired credentials
4. **Audit Logs**: Track credential usage
5. **Rate Limiting**: Enforce per-tool limits

---

## Cost Management

- Real-time cost tracking per workspace
- Monthly projections based on usage
- Cost alerts when approaching limits
- Cost breakdown by tool/model
- Historical cost reports
