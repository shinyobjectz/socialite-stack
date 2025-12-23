# Socialite Refactor TODO List

This TODO list tracks the implementation of the Enterprise Agent System with Affine Integration, as outlined in the `.refactor` guides.

## Phase 1: Foundation (Infrastructure & Database)

### 1.1 Convex Setup
- [x] Initialize `packages/db` with Convex.
- [x] Implement Cloud Convex Schema (`packages/db/convex/schema.ts`):
    - [x] `workspaces` table
    - [x] `users` table
    - [x] `apiCredentials` table
    - [x] `toolRegistry` table
    - [x] `sessions` table
    - [x] `artifacts` table
    - [x] `toolExecutionLogs` table
    - [x] `costLogs` table
- [x] Implement Local Convex Schema (for Session Blackboard):
    - [x] `blackboardEntries` table
    - [x] `executionPlans` table
    - [x] `agentTasks` table
    - [x] `toolExecutions` table
    - [x] `artifacts` (ephemeral) table

### 1.2 Cloud Convex Mutations & Queries
- [x] `sessions.ts`:
    - [x] `createSession` mutation
    - [x] `updateSessionStatus` mutation
    - [x] `syncSessionResults` mutation
    - [x] `getSessionState` query
    - [x] `listSessions` query
- [x] `workspaces.ts`:
    - [x] `initializeWorkspace` mutation
    - [x] `getWorkspaceSettings` query
- [x] `toolRegistry.ts`:
    - [x] `registerTool` mutation
    - [x] `getTools` query

### 1.3 Local Convex Mutations & Queries
- [x] `blackboard.ts`:
    - [x] `write` mutation
    - [x] `search` query
- [x] `tasks.ts`:
    - [x] `createTask` mutation
    - [x] `updateTaskStatus` mutation

## Phase 2: Execution (ToolBus & Agents)

### 2.1 ToolBus Implementation
- [x] Create `ToolBus` class in `packages/sandbox/src/toolBus/ToolBus.ts`.
- [x] Implement Tool Factory for:
    - [x] `APITool` (External REST APIs)
    - [x] `MCPTool` (Model Context Protocol)
    - [x] `BuiltinTool` (Internal functions)
    - [x] `TypeScriptExecutor` (E2B sandbox execution)
    - [x] `DocumentGenerator` (Affine integration)
- [x] Implement execution pipeline (retries, timeouts, rate limiting).
- [x] Integrate ToolBus with Local Convex for logging.

### 2.2 Agent SDK & Implementation
- [x] Implement `Agent` base class using VoltAgent.
- [x] Implement `MetaAgent` (Orchestrator):
    - [x] Planning logic
    - [x] Delegation tools (`createDelegateTaskTool`)
    - [x] Blackboard query tools (`createBlackboardQueryTool`)
- [x] Implement `OmegaAgent` (Specialists):
    - [x] Research Agent
    - [x] Content Agent
    - [x] Analysis Agent
- [x] Implement VoltAgent adapter for automatic Zod deserialization.

## Phase 3: Coordination (Session Lifecycle)

### 3.1 Session Management
- [x] Implement `SessionManager` in `packages/sandbox/src/session/SessionManager.ts`.
- [x] Implement State Machine:
    - [x] `initializing` -> `loading_tools` -> `running` -> `completing` -> `completed`
- [x] Implement Phase 1 (Initialize): Config validation, ToolBus start.
- [x] Implement Phase 2 (Execute): Orchestrator run, monitoring.
- [x] Implement Phase 3 (Finalize): Result collection, Cloud sync.
- [x] Implement Cleanup: Graceful resource shutdown.

### 3.2 Affine Integration
- [x] Implement `AffineIntegration` bridge.
- [x] `createDocumentFromMarkdown` (Markdown -> BlockSuite).
- [x] `createCanvasFromStructure` (Structure -> Surface elements).
- [x] `extractMetadata` from generated documents.

## Phase 4: User Experience (Frontend)

### 4.1 Session UI
- [x] Create Session Creation Page (`/sessions/new`).
- [x] Create Real-time Session Detail Page (`/sessions/[sessionId]`).
- [x] Implement Components:
    - [x] `MetricsPanel` (Live uptime, tokens, cost)
    - [x] `ExecutionTimeline` (Agent event stream)
    - [x] `ArtifactList` (Generated outputs)
    - [x] `SessionStatusBadge`

### 4.2 Real-time Updates
- [x] Implement `SessionSocket` for WebSocket management.
- [x] Connect Frontend to Convex queries/subscriptions.
- [x] Implement event-driven UI updates.

## Phase 5: Integration & Testing

### 5.1 End-to-End Integration
- [x] Connect E2B Sandbox to Cloud Convex.
- [x] Verify ToolBus can execute tools in Sandbox.
- [x] Verify MetaAgent can delegate to OmegaAgents.
- [x] Verify results sync from Local Convex to Cloud Convex.

### 5.2 Testing
- [x] Unit tests for ToolBus and Agent logic.
- [x] Integration tests for Session Lifecycle.
- [x] E2E tests for full "Research -> Content" workflow.
- [x] Security audit (API keys, workspace isolation).

## Completed Items
- [x] Initial Architecture Design (`ARCHITECTURE.md`)
- [x] Convex Schema Definition (`convex-schema-guide.md`)
- [x] Implementation Guide Index (`implementation-guide-index.md`)
- [x] Agent SDK Unified Interface (`agent-sdk-unified.md`)
- [x] Phase 1: Foundation (Infrastructure & Database)
- [x] Phase 2: Execution (ToolBus & Agents)
- [x] Phase 3: Coordination (Session Lifecycle)
- [x] Phase 4: User Experience (Frontend)
- [x] Phase 5: Integration & Testing