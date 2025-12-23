import React from 'react';

export interface Artifact {
  id: string;
  type: 'document' | 'canvas' | 'analysis' | 'transcript';
  title: string;
  description?: string;
  timestamp: number;
  url?: string;
  metadata?: {
    wordCount?: number;
    tags?: string[];
    [key: string]: any;
  };
}

interface ArtifactListProps {
  artifacts: Artifact[];
  onArtifactClick?: (artifact: Artifact) => void;
  className?: string;
}

const ArtifactIcon: React.FC<{ type: Artifact['type'] }> = ({ type }) => {
  switch (type) {
    case 'document':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case 'canvas':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      );
    case 'analysis':
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    default:
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      );
  }
};

export const ArtifactList: React.FC<ArtifactListProps> = ({
  artifacts,
  onArtifactClick,
  className = '',
}) => {
  return (
    <div className={`flex flex-col space-y-3 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-900 px-1">Generated Artifacts</h3>
      <div className="space-y-2">
        {artifacts.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed border-gray-100 rounded-lg">
            <p className="text-xs text-gray-400">No artifacts generated yet.</p>
          </div>
        ) : (
          artifacts.map((artifact) => (
            <div
              key={artifact.id}
              onClick={() => onArtifactClick?.(artifact)}
              className="group flex items-start p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
            >
              <div className="flex-shrink-0 p-2 bg-gray-50 rounded text-gray-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                <ArtifactIcon type={artifact.type} />
              </div>

              <div className="ml-3 flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-900 truncate">
                    {artifact.title}
                  </h4>
                  <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                    {new Date(artifact.timestamp).toLocaleDateString()}
                  </span>
                </div>

                {artifact.description && (
                  <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">
                    {artifact.description}
                  </p>
                )}

                <div className="mt-2 flex items-center space-x-3">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">
                    {artifact.type}
                  </span>
                  {artifact.metadata?.wordCount && (
                    <span className="text-[10px] text-gray-400">
                      {artifact.metadata.wordCount} words
                    </span>
                  )}
                  {artifact.metadata?.tags?.map((tag) => (
                    <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="ml-2 self-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
