import React from 'react';

export interface TimelineEvent {
  id: string;
  type: 'tool' | 'task' | 'plan' | 'status';
  label: string;
  description?: string;
  status: 'running' | 'success' | 'error' | 'pending';
  timestamp: number;
  metadata?: any;
}

interface ExecutionTimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export const ExecutionTimeline: React.FC<ExecutionTimelineProps> = ({
  events,
  className = '',
}) => {
  // Sort events by timestamp descending (newest first)
  const sortedEvents = [...events].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className={`flex flex-col space-y-4 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-900 px-1">Execution Timeline</h3>
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-200"></div>

        <div className="space-y-6">
          {sortedEvents.length === 0 ? (
            <div className="pl-10 py-4 text-sm text-gray-500 italic">
              Waiting for events...
            </div>
          ) : (
            sortedEvents.map((event) => (
              <div key={event.id} className="relative pl-10">
                {/* Event Dot */}
                <div
                  className={`absolute left-2.5 top-1.5 h-3.5 w-3.5 rounded-full border-2 bg-white z-10 ${
                    event.status === 'running' ? 'border-blue-500 animate-pulse' :
                    event.status === 'success' ? 'border-green-500' :
                    event.status === 'error' ? 'border-red-500' :
                    'border-gray-300'
                  }`}
                ></div>

                <div className="flex flex-col">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">
                      {event.label}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>

                  {event.description && (
                    <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                      {event.description}
                    </p>
                  )}

                  {event.type === 'tool' && event.metadata?.toolId && (
                    <div className="mt-2 flex items-center">
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 text-[10px] font-mono text-gray-600 border border-gray-200">
                        {event.metadata.toolId}
                      </span>
                      {event.metadata.duration && (
                        <span className="ml-2 text-[10px] text-gray-400">
                          {event.metadata.duration}ms
                        </span>
                      )}
                    </div>
                  )}

                  {event.status === 'error' && event.metadata?.error && (
                    <div className="mt-2 p-2 rounded bg-red-50 border border-red-100 text-[10px] text-red-700 font-mono overflow-x-auto">
                      {event.metadata.error}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
