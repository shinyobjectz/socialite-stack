import React, { useEffect, useState, useMemo } from 'react';
import { SessionStatusBadge, SessionStatus } from './SessionStatusBadge';
import { MetricsPanel } from './MetricsPanel';
import { ExecutionTimeline, TimelineEvent } from './ExecutionTimeline';
import { ArtifactList, Artifact } from './ArtifactList';
import { SessionSocket, AgentEvent } from '../../modules/agent/SessionSocket';

interface SessionDetailProps {
  sessionId: string;
  cloudConvexUrl: string;
}

export const SessionDetail: React.FC<SessionDetailProps> = ({
  sessionId,
  cloudConvexUrl,
}) => {
  const [status, setStatus] = useState<SessionStatus>('initializing');
  const [startedAt, setStartedAt] = useState<number | undefined>();
  const [completedAt, setCompletedAt] = useState<number | undefined>();
  const [tokensUsed, setTokensUsed] = useState(0);
  const [cost, setCost] = useState(0);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [title, setTitle] = useState('Agent Session');

  const socket = useMemo(
    () => new SessionSocket(sessionId, cloudConvexUrl),
    [sessionId, cloudConvexUrl]
  );

  useEffect(() => {
    socket.connect();

    const unsubscribe = socket.onEvent((event: AgentEvent) => {
      switch (event.type) {
        case 'status_change':
          setStatus(event.payload.status);
          if (event.payload.status === 'running' && !startedAt) {
            setStartedAt(Date.now());
          }
          if (
            event.payload.status === 'completed' ||
            event.payload.status === 'failed'
          ) {
            setCompletedAt(Date.now());
          }
          break;

        case 'artifact_created':
          const newArtifact: Artifact = {
            id: event.payload._id,
            type: event.payload.type,
            title: event.payload.title,
            description: event.payload.description,
            timestamp: event.payload.createdAt,
            url: event.payload.url,
            metadata: event.payload.contentMetadata,
          };
          setArtifacts(prev => {
            if (prev.some(a => a.id === newArtifact.id)) return prev;
            return [newArtifact, ...prev];
          });

          // Also add to timeline
          setEvents(prev => [
            {
              id: `evt-${newArtifact.id}`,
              type: 'status',
              label: 'Artifact Generated',
              description: `New ${newArtifact.type}: ${newArtifact.title}`,
              status: 'success',
              timestamp: newArtifact.timestamp,
            },
            ...prev,
          ]);
          break;

        case 'tool_start':
          setEvents(prev => [
            {
              id: event.id,
              type: 'tool',
              label: `Executing ${event.payload.toolName}`,
              description: JSON.stringify(event.payload.input),
              status: 'running',
              timestamp: event.timestamp,
              metadata: { toolId: event.payload.toolId },
            },
            ...prev,
          ]);
          break;

        case 'tool_end':
          setEvents(prev =>
            prev.map(e =>
              e.id === event.payload.startEventId
                ? {
                    ...e,
                    status: 'success',
                    metadata: {
                      ...e.metadata,
                      duration: event.timestamp - e.timestamp,
                    },
                  }
                : e
            )
          );
          break;
      }
    });

    return () => {
      unsubscribe();
      socket.disconnect();
    };
  }, [socket, startedAt]);

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex flex-col">
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-bold text-gray-900">{title}</h1>
            <SessionStatusBadge status={status} />
          </div>
          <p className="text-xs text-gray-500 mt-1 font-mono">
            ID: {sessionId}
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <button className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
            Stop Session
          </button>
          <button className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors shadow-sm">
            Share Results
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden p-6 gap-6">
        {/* Left Column: Timeline & Metrics */}
        <div className="flex-1 flex flex-col space-y-6 overflow-hidden">
          <MetricsPanel
            startedAt={startedAt}
            completedAt={completedAt}
            tokensUsed={tokensUsed}
            cost={cost}
          />

          <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                Live Execution
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <ExecutionTimeline events={events} />
            </div>
          </div>
        </div>

        {/* Right Column: Artifacts */}
        <div className="w-96 flex flex-col overflow-hidden">
          <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                Output Gallery
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <ArtifactList
                artifacts={artifacts}
                onArtifactClick={a => window.open(a.url, '_blank')}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
