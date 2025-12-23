import {
  SessionManager,
  SessionManagerConfig,
} from './session/SessionManager.js';

/**
 * Sandbox Main Entry Point
 *
 * This is the script that runs inside the E2B sandbox.
 * It expects environment variables to be set by the Cloud Convex action
 * that created the sandbox instance.
 */
async function main() {
  console.log('[Sandbox] Starting Socialite Agent Sandbox...');

  // 1. Extract configuration from environment
  const sessionId = process.env.SESSION_ID;
  const workspaceId = process.env.WORKSPACE_ID;
  const userId = process.env.USER_ID;
  const cloudConvexUrl = process.env.CONVEX_URL;
  const localConvexUrl =
    process.env.LOCAL_CONVEX_URL || 'http://localhost:3210';
  const userRequest = process.env.USER_REQUEST;
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3010';
  const authToken = process.env.AUTH_TOKEN;

  if (
    !sessionId ||
    !workspaceId ||
    !cloudConvexUrl ||
    !userRequest ||
    !authToken
  ) {
    console.error('[Sandbox] Missing required environment variables:');
    console.error({
      sessionId,
      workspaceId,
      cloudConvexUrl,
      userRequest,
      hasAuthToken: !!authToken,
    });
    process.exit(1);
  }

  // 2. Configure the Session Manager
  const config: SessionManagerConfig = {
    sessionId,
    workspaceId,
    userId: userId || 'anonymous',
    cloudConvexUrl,
    localConvexUrl,
    backendUrl,
    authToken,
    agentConfig: {
      model: process.env.AGENT_MODEL || 'gpt-4o',
      instructions:
        process.env.AGENT_INSTRUCTIONS || 'You are a helpful AI assistant.',
      subAgents: process.env.SUB_AGENTS
        ? JSON.parse(process.env.SUB_AGENTS)
        : [
            {
              name: 'researcher',
              model: 'gpt-4o',
              instructions:
                'You are a research specialist. Find facts and verify information.',
            },
            {
              name: 'writer',
              model: 'gpt-4o',
              instructions:
                'You are a content creation specialist. Write clear and engaging reports.',
            },
          ],
    },
  };

  const manager = new SessionManager(config);

  // 3. Start the agent session
  console.log(
    `[Sandbox] Initializing session ${sessionId} for user request: "${userRequest}"`
  );

  try {
    await manager.start(userRequest);
    console.log('[Sandbox] Session completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('[Sandbox] Session failed with error:', error);
    process.exit(1);
  }
}

// Execute main
main().catch(err => {
  console.error('[Sandbox] Unhandled error in main loop:', err);
  process.exit(1);
});
