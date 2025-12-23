import React from 'react';

export type SessionStatus =
  | 'initializing'
  | 'loading_tools'
  | 'running'
  | 'completing'
  | 'completed'
  | 'failed';

interface SessionStatusBadgeProps {
  status: SessionStatus;
  className?: string;
}

const statusConfig: Record<
  SessionStatus,
  { label: string; color: string; bgColor: string; pulse?: boolean }
> = {
  initializing: {
    label: 'Initializing',
    color: '#6b7280',
    bgColor: '#f3f4f6',
    pulse: true,
  },
  loading_tools: {
    label: 'Loading Tools',
    color: '#8b5cf6',
    bgColor: '#f5f3ff',
    pulse: true,
  },
  running: {
    label: 'Agent Running',
    color: '#10b981',
    bgColor: '#ecfdf5',
    pulse: true,
  },
  completing: {
    label: 'Finalizing',
    color: '#3b82f6',
    bgColor: '#eff6ff',
    pulse: true,
  },
  completed: {
    label: 'Completed',
    color: '#059669',
    bgColor: '#d1fae5',
  },
  failed: {
    label: 'Failed',
    color: '#dc2626',
    bgColor: '#fee2e2',
  },
};

export const SessionStatusBadge: React.FC<SessionStatusBadgeProps> = ({
  status,
  className = '',
}) => {
  const config = statusConfig[status] || statusConfig.initializing;

  return (
    <div
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}
      style={{
        color: config.color,
        backgroundColor: config.bgColor,
        border: `1px solid ${config.color}33`,
      }}
    >
      {config.pulse && (
        <span className="relative flex h-2 w-2 mr-1.5">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: config.color }}
          ></span>
          <span
            className="relative inline-flex rounded-full h-2 w-2"
            style={{ backgroundColor: config.color }}
          ></span>
        </span>
      )}
      {config.label}
    </div>
  );
};
