import React, { useEffect, useState } from 'react';

interface MetricsPanelProps {
  startedAt?: number;
  completedAt?: number;
  tokensUsed: number;
  cost: number;
  className?: string;
}

export const MetricsPanel: React.FC<MetricsPanelProps> = ({
  startedAt,
  completedAt,
  tokensUsed,
  cost,
  className = '',
}) => {
  const [elapsed, setElapsed] = useState<string>('00:00');

  useEffect(() => {
    if (!startedAt) return;

    const interval = setInterval(() => {
      const end = completedAt || Date.now();
      const diff = Math.max(0, end - startedAt);

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      setElapsed(
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt, completedAt]);

  return (
    <div className={`grid grid-cols-3 gap-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
      <div className="flex flex-col">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Uptime</span>
        <span className="mt-1 text-lg font-semibold text-gray-900 font-mono">{elapsed}</span>
      </div>

      <div className="flex flex-col border-l border-gray-100 pl-4">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Tokens</span>
        <span className="mt-1 text-lg font-semibold text-gray-900">
          {tokensUsed.toLocaleString()}
        </span>
      </div>

      <div className="flex flex-col border-l border-gray-100 pl-4">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Est. Cost</span>
        <span className="mt-1 text-lg font-semibold text-gray-900">
          ${cost.toFixed(4)}
        </span>
      </div>
    </div>
  );
};
