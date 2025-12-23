# @socialite/agent-sandbox

This package contains the runtime environment for Socialite AI Agents. It is designed to run within an E2B sandbox and provides a secure, isolated execution space for agent tasks.

## Features

- **Multi-Agent Orchestration**: Uses a MetaAgent to plan and delegate tasks to specialized OmegaAgents.
- **ToolBus**: A unified interface for executing API, MCP, and Built-in tools.
- **Local Blackboard**: A local Convex instance for real-time state sharing and coordination between agents.
- **Backend Integration**: Proxies model calls to the Socialite backend for secure provider management and cost tracking.

## Structure

- `src/main.ts`: The entry point for the sandbox.
- `src/agents/`: Agent logic and hierarchy.
- `src/toolBus/`: Tool execution engine.
- `src/session/`: Session lifecycle management.
- `convex/`: Local Convex schema and functions for the session blackboard.

## Development

To start the local Convex instance for the sandbox:

```bash
bun run convex:dev
```

To run the sandbox locally for testing:

```bash
bun run dev
```

## Integration

The sandbox expects the following environment variables:

- `SESSION_ID`: The unique ID of the current agent session.
- `WORKSPACE_ID`: The ID of the workspace the session belongs to.
- `CONVEX_URL`: The URL of the Cloud Convex instance.
- `LOCAL_CONVEX_URL`: The URL of the local Convex instance (defaults to http://localhost:3210).
- `USER_REQUEST`: The initial request from the user.
- `BACKEND_URL`: The URL of the Socialite backend.
- `AUTH_TOKEN`: A valid authentication token for the backend.