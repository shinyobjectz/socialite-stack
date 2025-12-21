# Socialite Refactor TODO List

This TODO list tracks the implementation of the Enterprise Agent System with Affine Integration, as outlined in the `.refactor` guides.

## Phase 1: Foundation (Infrastructure & Database)

### 1.1 Convex Setup
- [ ] Initialize `packages/db` with Convex.
- [ ] Implement Cloud Convex Schema (`packages/db/convex/schema.ts`):
    - [ ] `workspaces` table
    - [ ] `users` table
    - [ ] `apiCredentials` table
    - [ ] `toolRegistry` table
    - [ ] `sessions` table
    - [ ] `artifacts` table
    - [ ] `toolExecutionLogs` table
    - [ ] `costLogs` table
- [ ] Implement Local Convex Schema (for Session Blackboard):
    - [ ] `blackboardEntries` table
    - [ ] `executionPlans` table
    - [ ] `agentTasks` table
    - [ ] `toolExecutions` table
    - [ ] `artifacts` (ephemeral) table

### 1.2 Cloud Convex Mutations & Queries
- [ ] `sessions.ts`:
    - [ ] `createSession` mutation
    - [ ] `updateSessionStatus` mutation
    - [ ] `syncSessionResults` mutation
    - [ ] `getSessionState` query
    - [ ] `listSessions` query
- [ ] `workspaces.ts`:
    - [ ] `initializeWorkspace` mutation
    - [ ] `getWorkspaceSettings` query
- [ ] `toolRegistry.ts`:
    - [ ] `registerTool` mutation
    - [ ] `getTools` query

### 1.3 Local Convex Mutations & Queries
- [ ] `blackboard.ts`:
    - [ ] `write` mutation
    - [ ] `search` query
- [ ] `tasks.ts`:
    - [ ] `createTask` mutation
    - [ ] `updateTaskStatus` mutation

## Phase 2: Execution (ToolBus & Agents)

### 2.1 ToolBus Implementation
- [ ] Create `ToolBus` class in `packages/sandbox/src/toolBus/ToolBus.ts`.
- [ ] Implement Tool Factory for:
    - [ ] `APITool` (External REST APIs)
    - [ ] `MCPTool` (Model Context Protocol)
    - [ ] `BuiltinTool` (Internal functions)
    - [ ] `TypeScriptExecutor` (E2B sandbox execution)
    - [ ] `DocumentGenerator` (Affine integration)
- [ ] Implement execution pipeline (retries, timeouts, rate limiting).
- [ ] Integrate ToolBus with Local Convex for logging.

### 2.2 Agent SDK & Implementation
- [ ] Implement `Agent` base class using VoltAgent.
- [ ] Implement `MetaAgent` (Orchestrator):
    - [ ] Planning logic
    - [ ] Delegation tools (`createDelegateTaskTool`)
    - [ ] Blackboard query tools (`createBlackboardQueryTool`)
- [ ] Implement `OmegaAgent` (Specialists):
    - [ ] Research Agent
    - [ ] Content Agent
    - [ ] Analysis Agent
- [ ] Implement VoltAgent adapter for automatic Zod deserialization.

## Phase 3: Coordination (Session Lifecycle)

### 3.1 Session Management
- [ ] Implement `SessionManager` in `packages/sandbox/src/session/SessionManager.ts`.
- [ ] Implement State Machine:
    - [ ] `initializing` -> `loading_tools` -> `running` -> `completing` -> `completed`
- [ ] Implement Phase 1 (Initialize): Config validation, ToolBus start.
- [ ] Implement Phase 2 (Execute): Orchestrator run, monitoring.
- [ ] Implement Phase 3 (Finalize): Result collection, Cloud sync.
- [ ] Implement Cleanup: Graceful resource shutdown.

### 3.2 Affine Integration
- [ ] Implement `AffineIntegration` bridge.
- [ ] `createDocumentFromMarkdown` (Markdown -> BlockSuite).
- [ ] `createCanvasFromStructure` (Structure -> Surface elements).
- [ ] `extractMetadata` from generated documents.

## Phase 4: User Experience (Frontend)

### 4.1 Session UI
- [ ] Create Session Creation Page (`/sessions/new`).
- [ ] Create Real-time Session Detail Page (`/sessions/[sessionId]`).
- [ ] Implement Components:
    - [ ] `MetricsPanel` (Live uptime, tokens, cost)
    - [ ] `ExecutionTimeline` (Agent event stream)
    - [ ] `ArtifactList` (Generated outputs)
    - [ ] `SessionStatusBadge`

### 4.2 Real-time Updates
- [ ] Implement `SessionSocket` for WebSocket management.
- [ ] Connect Frontend to Convex queries/subscriptions.
- [ ] Implement event-driven UI updates.

## Phase 5: Integration & Testing

### 5.1 End-to-End Integration
- [ ] Connect E2B Sandbox to Cloud Convex.
- [ ] Verify ToolBus can execute tools in Sandbox.
- [ ] Verify MetaAgent can delegate to OmegaAgents.
- [ ] Verify results sync from Local Convex to Cloud Convex.

### 5.2 Testing
- [ ] Unit tests for ToolBus and Agent logic.
- [ ] Integration tests for Session Lifecycle.
- [ ] E2E tests for full "Research -> Content" workflow.
- [ ] Security audit (API keys, workspace isolation).

## Completed Items
- [x] Initial Architecture Design (`ARCHITECTURE.md`)
- [x] Convex Schema Definition (`convex-schema-guide.md`)
- [x] Implementation Guide Index (`implementation-guide-index.md`)
- [x] Agent SDK Unified Interface (`agent-sdk-unified.md`)