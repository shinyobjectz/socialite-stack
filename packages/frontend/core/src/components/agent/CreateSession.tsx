import React, { useState } from 'react';

interface CreateSessionProps {
  workspaceId: string;
  onSessionCreated: (sessionId: string) => void;
  onCancel: () => void;
}

type SessionMode = 'research' | 'content' | 'analysis' | 'custom';

export const CreateSession: React.FC<CreateSessionProps> = ({
  workspaceId,
  onSessionCreated,
  onCancel,
}) => {
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<SessionMode>('research');
  const [userRequest, setUserRequest] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTools, setSelectedTools] = useState<string[]>([
    'search_web',
    'generate_document',
  ]);

  const modes: {
    id: SessionMode;
    label: string;
    description: string;
    icon: string;
  }[] = [
    {
      id: 'research',
      label: 'Deep Research',
      description: 'Find facts, verify sources, and synthesize information.',
      icon: '🔍',
    },
    {
      id: 'content',
      label: 'Content Creation',
      description: 'Generate high-quality documents, reports, and articles.',
      icon: '✍️',
    },
    {
      id: 'analysis',
      label: 'Data Analysis',
      description: 'Process structured data and extract meaningful insights.',
      icon: '📊',
    },
    {
      id: 'custom',
      label: 'Custom Agent',
      description: 'Configure a specialized agent for your specific needs.',
      icon: '⚙️',
    },
  ];

  const availableTools = [
    { id: 'search_web', name: 'Web Search', category: 'Research' },
    { id: 'fetch_content', name: 'Content Fetcher', category: 'Research' },
    { id: 'generate_document', name: 'Doc Generator', category: 'Content' },
    { id: 'generate_canvas', name: 'Canvas Designer', category: 'Content' },
    { id: 'execute_typescript', name: 'TS Executor', category: 'Utility' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !userRequest) return;

    setIsSubmitting(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      const mockSessionId = `sess_${Math.random().toString(36).substring(7)}`;

      onSessionCreated(mockSessionId);
    } catch (error) {
      console.error('Failed to create session:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTool = (toolId: string) => {
    setSelectedTools(prev =>
      prev.includes(toolId)
        ? prev.filter(id => id !== toolId)
        : [...prev, toolId]
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Start New Agent Session
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure your agent and provide a goal to begin.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Basic Info */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Session Title
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Market Research for AI Productivity Tools"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Agent Mode
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {modes.map(m => (
                <div
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`flex items-start p-4 border rounded-lg cursor-pointer transition-all ${
                    mode === m.id
                      ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <span className="text-2xl mr-3">{m.icon}</span>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">
                      {m.label}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {m.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Section 2: The Request */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <div>
            <label
              htmlFor="request"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              What should the agent do?
            </label>
            <textarea
              id="request"
              value={userRequest}
              onChange={e => setUserRequest(e.target.value)}
              rows={5}
              placeholder="Describe your goal in detail. For example: 'Research the top 5 competitors in the AI note-taking space. Compare their pricing, key features, and user reviews. Synthesize the findings into a markdown report.'"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
              required
            />
          </div>
        </div>

        {/* Section 3: Tool Selection */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              Tool Registry
            </label>
            <span className="text-[10px] text-gray-400 uppercase font-bold">
              {selectedTools.length} Tools Selected
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {availableTools.map(tool => (
              <div
                key={tool.id}
                onClick={() => toggleTool(tool.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all border ${
                  selectedTools.includes(tool.id)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {tool.name}
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end space-x-4 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !title || !userRequest}
            className={`px-8 py-2 rounded-md text-sm font-bold text-white shadow-lg transition-all ${
              isSubmitting || !title || !userRequest
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:transform active:scale-95'
            }`}
          >
            {isSubmitting ? (
              <div className="flex items-center">
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Initializing...
              </div>
            ) : (
              'Launch Agent'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
