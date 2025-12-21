# Frontend UX Implementation Guide
**Files**: `packages/web/app/(workspace)/sessions/` + components

## Overview

Frontend provides real-time session monitoring, artifact display, and interaction.

**Architecture**:
- Real-time WebSocket connection to SessionManager
- React hooks for session state management
- Affine document/canvas viewer integration
- Live progress updates with metrics

---

## Session Creation Page

```tsx
// app/(workspace)/sessions/new/page.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { SessionConfig } from '@/lib/types';

export default function NewSessionPage() {
  const router = useRouter();
  const createSession = useMutation(api.sessions.createSession);
  
  const [formData, setFormData] = useState({
    title: '',
    mode: 'research' as const,
    description: '',
    tools: [] as string[],
    model: 'gpt-4o',
    temperature: 0.7,
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const sessionId = await createSession({
        workspaceId: '...', // Get from context
        mode: formData.mode,
        title: formData.title,
        toolIds: formData.tools,
        agentConfig: {
          agentType: formData.mode,
          model: formData.model,
          temperature: formData.temperature,
          maxTokens: 4000,
          tools: formData.tools,
        },
      });

      // Redirect to session detail page
      router.push(`/sessions/${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className='max-w-2xl mx-auto'>
      <h1 className='text-3xl font-bold mb-6'>New Session</h1>

      <form onSubmit={handleSubmit} className='space-y-6'>
        {/* Title */}
        <div>
          <label className='block text-sm font-medium mb-2'>
            Session Title
          </label>
          <input
            type='text'
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
            className='w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
            placeholder='e.g., AI Market Analysis 2024'
            required
          />
        </div>

        {/* Mode Selection */}
        <div>
          <label className='block text-sm font-medium mb-2'>Mode</label>
          <div className='grid grid-cols-3 gap-4'>
            {(['research', 'content', 'analysis'] as const).map((mode) => (
              <button
                key={mode}
                type='button'
                onClick={() => setFormData({ ...formData, mode })}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  formData.mode === mode
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className='font-medium capitalize'>{mode}</div>
                <div className='text-sm text-gray-600'>
                  {mode === 'research' && 'Find & analyze information'}
                  {mode === 'content' && 'Create documents & content'}
                  {mode === 'analysis' && 'Statistical analysis'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Model Selection */}
        <div>
          <label className='block text-sm font-medium mb-2'>Model</label>
          <select
            value={formData.model}
            onChange={(e) =>
              setFormData({ ...formData, model: e.target.value })
            }
            className='w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          >
            <option value='gpt-4o'>GPT-4 Omni (Recommended)</option>
            <option value='gpt-4-turbo'>GPT-4 Turbo</option>
            <option value='claude-3-opus'>Claude 3 Opus</option>
          </select>
        </div>

        {/* Temperature */}
        <div>
          <label className='block text-sm font-medium mb-2'>
            Temperature: {formData.temperature.toFixed(1)}
          </label>
          <input
            type='range'
            min='0'
            max='1'
            step='0.1'
            value={formData.temperature}
            onChange={(e) =>
              setFormData({
                ...formData,
                temperature: parseFloat(e.target.value),
              })
            }
            className='w-full'
          />
          <p className='text-sm text-gray-600 mt-2'>
            {formData.temperature < 0.3 && 'More deterministic'}
            {formData.temperature >= 0.3 && formData.temperature < 0.7 && 'Balanced'}
            {formData.temperature >= 0.7 && 'More creative'}
          </p>
        </div>

        {/* Description */}
        <div>
          <label className='block text-sm font-medium mb-2'>
            Description (Optional)
          </label>
          <textarea
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            className='w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
            rows={3}
            placeholder='What would you like the agent to do?'
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className='p-4 bg-red-50 border border-red-200 rounded-lg text-red-700'>
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          type='submit'
          disabled={isLoading || !formData.title}
          className='w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors'
        >
          {isLoading ? 'Creating Session...' : 'Create Session'}
        </button>
      </form>
    </div>
  );
}
```

---

## Session Detail Page with Real-Time Monitoring

```tsx
// app/(workspace)/sessions/[sessionId]/page.tsx

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { SessionMetrics, SessionState, SessionEvent } from '@/lib/types';
import { SessionStatusBadge } from '@/components/SessionStatusBadge';
import { MetricsPanel } from '@/components/MetricsPanel';
import { ArtifactList } from '@/components/ArtifactList';
import { ExecutionTimeline } from '@/components/ExecutionTimeline';

interface PageProps {
  params: { sessionId: string };
}

export default function SessionDetailPage({ params }: PageProps) {
  const session = useQuery(api.sessions.getSessionState, {
    sessionId: params.sessionId,
  });

  const artifacts = useQuery(api.artifacts.listBySession, {
    sessionId: params.sessionId,
  });

  const cancelSession = useMutation(api.sessions.cancelSession);

  // WebSocket connection for real-time updates
  const [metrics, setMetrics] = useState<SessionMetrics | null>(null);
  const [state, setState] = useState<SessionState>('initializing');
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [isConnecting, setIsConnecting] = useState(true);

  // Connect to WebSocket for real-time updates
  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(
        `${process.env.NEXT_PUBLIC_WS_URL}/sessions/${params.sessionId}`
      );

      ws.onopen = () => {
        console.log('[WS] Connected to session');
        setIsConnecting(false);
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);

        if (message.type === 'state_change') {
          setState(message.state);
        } else if (message.type === 'metrics_update') {
          setMetrics(message.metrics);
        } else if (message.type === 'event') {
          setEvents((prev) => [message.event, ...prev].slice(0, 100)); // Keep last 100
        }
      };

      ws.onerror = (error) => {
        console.error('[WS] Error:', error);
        setIsConnecting(true);
      };

      ws.onclose = () => {
        console.log('[WS] Disconnected');
        // Reconnect after 3 seconds
        setTimeout(connect, 3000);
      };

      return () => ws.close();
    };

    const cleanup = connect();
    return cleanup;
  }, [params.sessionId]);

  const handleCancel = useCallback(async () => {
    if (!confirm('Cancel this session? Progress will be saved.')) return;

    try {
      await cancelSession({ sessionId: params.sessionId });
    } catch (error) {
      alert('Failed to cancel session');
    }
  }, [cancelSession, params.sessionId]);

  if (!session) {
    return (
      <div className='flex items-center justify-center h-screen'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
      </div>
    );
  }

  return (
    <div className='space-y-8'>
      {/* Header */}
      <div className='flex items-start justify-between'>
        <div>
          <h1 className='text-3xl font-bold'>{session.session.title}</h1>
          <p className='text-gray-600 mt-1'>
            {new Date(session.session.createdAt).toLocaleString()}
          </p>
        </div>

        <div className='flex items-center gap-4'>
          <SessionStatusBadge
            status={state}
            isConnecting={isConnecting}
          />

          {state === 'running' && (
            <button
              onClick={handleCancel}
              className='px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors'
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Metrics Panel */}
      {metrics && (
        <MetricsPanel
          metrics={metrics}
          state={state}
        />
      )}

      {/* Main Content Grid */}
      <div className='grid grid-cols-3 gap-8'>
        {/* Left: Execution Timeline */}
        <div className='col-span-2'>
          <ExecutionTimeline
            events={events}
            state={state}
          />
        </div>

        {/* Right: Quick Stats */}
        <div className='space-y-4'>
          <div className='bg-white rounded-lg border p-4'>
            <h3 className='font-semibold mb-3'>Mode</h3>
            <p className='text-sm text-gray-600 capitalize'>
              {session.session.mode}
            </p>
          </div>

          <div className='bg-white rounded-lg border p-4'>
            <h3 className='font-semibold mb-3'>Model</h3>
            <p className='text-sm text-gray-600'>
              {session.session.agentConfig.model}
            </p>
          </div>

          <div className='bg-white rounded-lg border p-4'>
            <h3 className='font-semibold mb-3'>Tools</h3>
            <div className='space-y-1'>
              {session.session.toolManifests.map((tool) => (
                <div
                  key={tool.id}
                  className='text-xs text-gray-600 truncate'
                  title={tool.name}
                >
                  {tool.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Artifacts Section */}
      {artifacts && artifacts.length > 0 && (
        <div>
          <h2 className='text-2xl font-bold mb-4'>Generated Artifacts</h2>
          <ArtifactList artifacts={artifacts} />
        </div>
      )}

      {/* Status Indicators */}
      {state === 'completed' && metrics && (
        <div className='bg-green-50 border border-green-200 rounded-lg p-6'>
          <h3 className='font-semibold text-green-900 mb-2'>
            ✓ Session Complete
          </h3>
          <p className='text-sm text-green-700'>
            Generated {artifacts?.length || 0} artifact(s) in{' '}
            {Math.round(metrics.uptime / 1000)}s
          </p>
        </div>
      )}

      {state === 'failed' && (
        <div className='bg-red-50 border border-red-200 rounded-lg p-6'>
          <h3 className='font-semibold text-red-900 mb-2'>
            ✗ Session Failed
          </h3>
          <p className='text-sm text-red-700'>
            {session.session.metadata?.errorDetails || 'An error occurred'}
          </p>
        </div>
      )}
    </div>
  );
}
```

---

## Components

### MetricsPanel Component

```tsx
// components/MetricsPanel.tsx

import type { SessionMetrics, SessionState } from '@/lib/types';

interface MetricsPanelProps {
  metrics: SessionMetrics;
  state: SessionState;
}

export function MetricsPanel({ metrics, state }: MetricsPanelProps) {
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(3)}`;
  };

  return (
    <div className='grid grid-cols-4 gap-4'>
      <MetricCard
        label='Uptime'
        value={formatTime(metrics.uptime)}
        icon='⏱️'
      />

      <MetricCard
        label='Tokens Used'
        value={metrics.tokensUsed.toLocaleString()}
        icon='📊'
      />

      <MetricCard
        label='Tools Executed'
        value={metrics.toolExecutions}
        icon='🔧'
        error={metrics.toolErrors}
      />

      <MetricCard
        label='Estimated Cost'
        value={formatCost(metrics.costEstimate)}
        icon='💰'
      />

      <MetricCard
        label='Tasks Completed'
        value={metrics.tasksCompleted}
        icon='✓'
        error={metrics.tasksFailed}
      />

      {state === 'running' && (
        <div className='col-span-4 bg-blue-50 border border-blue-200 rounded-lg p-4'>
          <div className='flex items-center gap-2'>
            <div className='animate-pulse w-2 h-2 bg-blue-600 rounded-full'></div>
            <span className='text-sm text-blue-700'>Session running...</span>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  error,
}: {
  label: string;
  value: string | number;
  icon: string;
  error?: number;
}) {
  return (
    <div className='bg-white rounded-lg border p-4'>
      <div className='text-2xl mb-2'>{icon}</div>
      <div className='text-sm text-gray-600'>{label}</div>
      <div className='text-xl font-bold mt-1'>{value}</div>
      {error !== undefined && error > 0 && (
        <div className='text-xs text-red-600 mt-1'>
          {error} error{error > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
```

### ExecutionTimeline Component

```tsx
// components/ExecutionTimeline.tsx

import type { SessionEvent, SessionState } from '@/lib/types';
import { format } from 'date-fns';

interface ExecutionTimelineProps {
  events: SessionEvent[];
  state: SessionState;
}

export function ExecutionTimeline({ events, state }: ExecutionTimelineProps) {
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'initialized':
        return '🚀';
      case 'tools_loaded':
        return '🔧';
      case 'started':
        return '▶️';
      case 'progress':
        return '⚙️';
      case 'completed':
        return '✓';
      case 'error':
        return '✗';
      default:
        return '•';
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'text-red-600';
      case 'completed':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className='bg-white rounded-lg border'>
      <div className='p-4 border-b'>
        <h3 className='font-semibold'>Execution Timeline</h3>
      </div>

      <div className='max-h-96 overflow-y-auto'>
        {events.length === 0 ? (
          <div className='p-4 text-sm text-gray-500 text-center'>
            No events yet
          </div>
        ) : (
          <div className='space-y-0 divide-y'>
            {events.map((event, index) => (
              <div
                key={index}
                className='p-4 hover:bg-gray-50 transition-colors'
              >
                <div className='flex items-start gap-3'>
                  <span className='text-xl mt-1'>
                    {getEventIcon(event.type)}
                  </span>
                  <div className='flex-1'>
                    <div
                      className={`font-medium capitalize ${getEventColor(
                        event.type
                      )}`}
                    >
                      {event.type.replace(/_/g, ' ')}
                    </div>
                    <div className='text-xs text-gray-500 mt-1'>
                      {format(
                        new Date(event.timestamp),
                        'HH:mm:ss'
                      )}
                    </div>
                    {event.data && (
                      <div className='mt-2 text-sm text-gray-700 max-h-20 overflow-y-auto'>
                        <pre className='whitespace-pre-wrap break-words'>
                          {JSON.stringify(event.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

### ArtifactList Component

```tsx
// components/ArtifactList.tsx

import type { Artifact } from '@/lib/types';
import Link from 'next/link';

interface ArtifactListProps {
  artifacts: Artifact[];
}

export function ArtifactList({ artifacts }: ArtifactListProps) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'document':
        return '📄';
      case 'canvas':
        return '🎨';
      case 'analysis':
        return '📊';
      default:
        return '📎';
    }
  };

  return (
    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
      {artifacts.map((artifact) => (
        <div
          key={artifact._id}
          className='bg-white rounded-lg border p-6 hover:shadow-lg transition-shadow'
        >
          <div className='flex items-start justify-between'>
            <div className='flex-1'>
              <h4 className='font-semibold text-lg'>
                <span className='mr-2'>{getTypeIcon(artifact.type)}</span>
                {artifact.title}
              </h4>
              {artifact.description && (
                <p className='text-sm text-gray-600 mt-1'>
                  {artifact.description}
                </p>
              )}
              <div className='flex gap-2 mt-3'>
                {artifact.tags.map((tag) => (
                  <span
                    key={tag}
                    className='inline-block px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded'
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {artifact.affineDocId && (
            <div className='mt-4'>
              <Link
                href={`/documents/${artifact.affineDocId}`}
                className='text-blue-600 hover:underline text-sm font-medium'
              >
                View in Affine →
              </Link>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

## WebSocket Integration

```typescript
// lib/sessionSocket.ts

import { EventEmitter } from 'eventemitter3';
import type { SessionEvent, SessionState, SessionMetrics } from './types';

export class SessionSocket extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string;
  private sessionId: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(sessionId: string) {
    super();
    this.sessionId = sessionId;
    this.url = `${process.env.NEXT_PUBLIC_WS_URL}/sessions/${sessionId}`;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('[WS] Connected');
          this.reconnectAttempts = 0;
          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          const message = JSON.parse(event.data);
          
          if (message.type === 'state_change') {
            this.emit('state', message.state as SessionState);
          } else if (message.type === 'metrics') {
            this.emit('metrics', message.metrics as SessionMetrics);
          } else if (message.type === 'event') {
            this.emit('event', message.event as SessionEvent);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[WS] Error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('[WS] Closed');
          this.emit('disconnected');
          this.attemptReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000;
      console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      
      setTimeout(() => {
        this.connect().catch(console.error);
      }, delay);
    } else {
      this.emit('reconnect_failed');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
```

---

## Key UX Patterns

1. **Real-time status**: WebSocket updates on metrics, events, state
2. **Clear progress**: Timeline shows agent activities
3. **Quick actions**: Cancel, pause, resume buttons
4. **Artifact preview**: Inline view of generated documents
5. **Error transparency**: Clear error messages with details
6. **Mobile responsive**: Grid-based layout adapts to mobile

---

## DRY Principles

- Reusable metric card component
- Centralized SessionSocket class
- Shared types across frontend
- Event-driven architecture
