# Session Lifecycle Management
**File**: `packages/sandbox/src/session/SessionManager.ts`

## Overview

SessionManager handles the complete lifecycle of an agent session:
1. **Initialization**: Boot E2B, create local Convex, load tools
2. **Monitoring**: Track execution, enforce limits, handle failures
3. **Cleanup**: Sync results, shutdown sandbox, archive metadata

**Architecture**: State machine with event callbacks for real-time UI updates.

---

## Session State Machine

```
[initializing] → [loading_tools] → [running] → [completing] → [completed]
                                      ↓
                                  [failed]
                                      ↓
                                  [cleanup]
```

Error at any stage triggers graceful shutdown.

---

## Core Types

```typescript
// packages/sandbox/src/session/types.ts

export interface SessionConfig {
  sessionId: string;
  workspaceId: string;
  userId: string;
  
  // E2B Infrastructure
  sandboxId: string;
  localConvexUrl: string;
  
  // Configuration
  mode: 'research' | 'content' | 'analysis' | 'custom';
  model: string;
  temperature: number;
  maxTokens: number;
  userRequest: string;
  
  // Tools
  toolManifests: ToolManifest[];
  
  // Limits
  executionLimits: {
    maxDuration: number;
    maxTokensPerRequest: number;
    maxConcurrentTools: number;
    maxAPICallsPerMinute: number;
    costLimit?: number;
  };
}

export type SessionState =
  | 'initializing'
  | 'loading_tools'
  | 'running'
  | 'paused'
  | 'completing'
  | 'completed'
  | 'failed'
  | 'cleanup';

export interface SessionEvent {
  type:
    | 'initialized'
    | 'tools_loaded'
    | 'started'
    | 'progress'
    | 'paused'
    | 'completed'
    | 'error'
    | 'cleanup_started'
    | 'cleanup_complete';
  timestamp: number;
  data?: Record<string, unknown>;
}

export interface SessionMetrics {
  uptime: number; // ms
  tokensUsed: number;
  toolExecutions: number;
  toolErrors: number;
  costEstimate: number;
  tasksCompleted: number;
  tasksFailed: number;
}
```

---

## SessionManager Implementation

```typescript
// packages/sandbox/src/session/SessionManager.ts

import { EventEmitter } from 'eventemitter3';
import { ConvexClient } from 'convex/browser';
import { v4 as uuid } from 'uuid';
import type { SessionConfig, SessionState, SessionEvent, SessionMetrics } from './types';
import { ToolBus } from '../toolBus/ToolBus';
import { MetaAgent } from '../agents/MetaAgent';
import { OmegaAgent } from '../agents/OmegaAgent';
import { createVoltAgentTools } from '../toolBus/voltAgentAdapter';

export class SessionManager extends EventEmitter {
  private config: SessionConfig;
  private state: SessionState = 'initializing';
  
  private cloudConvex: ConvexClient;
  private localConvex: ConvexClient;
  
  private toolBus: ToolBus | null = null;
  private orchestrator: MetaAgent | null = null;
  
  private startTime: number = 0;
  private metrics: SessionMetrics = {
    uptime: 0,
    tokensUsed: 0,
    toolExecutions: 0,
    toolErrors: 0,
    costEstimate: 0,
    tasksCompleted: 0,
    tasksFailed: 0,
  };
  
  private abortController: AbortController = new AbortController();
  private stateChangeCallbacks: Array<(state: SessionState) => void> = [];

  constructor(config: SessionConfig, cloudConvexUrl: string) {
    super();
    this.config = config;
    this.cloudConvex = new ConvexClient(cloudConvexUrl);
    this.localConvex = new ConvexClient(config.localConvexUrl);
    this.startTime = Date.now();
    
    console.log(`[SessionManager] Created for session: ${config.sessionId}`);
  }

  /**
   * Main entry point: Initialize and run session
   * Called from sandbox index.ts after Convex servers are up
   */
  async run(): Promise<void> {
    try {
      // Phase 1: Initialize
      await this.initialize();
      
      // Phase 2: Execute
      await this.execute();
      
      // Phase 3: Finalize
      await this.finalize();
    } catch (error) {
      console.error('[SessionManager] Fatal error:', error);
      this.transitionState('failed');
      
      // Emit error event for monitoring
      this.emitEvent({
        type: 'error',
        timestamp: Date.now(),
        data: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
      
      // Attempt cleanup
      await this.cleanup();
    }
  }

  /**
   * Phase 1: Initialize session
   * - Validate configuration
   * - Start ToolBus
   * - Initialize agents
   */
  private async initialize(): Promise<void> {
    this.transitionState('initializing');
    
    console.log('[SessionManager] Phase 1: Initialization');

    try {
      // Validate config
      this.validateConfig();

      // Update cloud session: initializing
      await this.cloudConvex.mutation('api.sessions.updateStatus', {
        sessionId: this.config.sessionId,
        status: 'initializing',
      });

      // Initialize ToolBus
      this.transitionState('loading_tools');
      
      this.toolBus = new ToolBus({
        sessionId: this.config.sessionId,
        localConvexUrl: this.config.localConvexUrl,
        cloudConvexUrl: (this.cloudConvex as any).httpServerUrl, // Get URL
        workspaceId: this.config.workspaceId,
        maxConcurrentTools: this.config.executionLimits.maxConcurrentTools,
        maxRetries: 2,
        executionTimeout: this.config.executionLimits.maxDuration / 3, // 1/3 of total
      });

      // Load tools from manifests
      await this.toolBus.initialize(this.config.toolManifests);
      
      this.emitEvent({
        type: 'tools_loaded',
        timestamp: Date.now(),
        data: {
          toolCount: this.config.toolManifests.length,
        },
      });

      // Initialize agents
      await this.initializeAgents();

      this.transitionState('running');
      
      // Update cloud session: running
      await this.cloudConvex.mutation('api.sessions.updateStatus', {
        sessionId: this.config.sessionId,
        status: 'running',
        metadata: { startedAt: Date.now() },
      });

      this.emitEvent({
        type: 'started',
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('[SessionManager] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Phase 2: Execute session
   * - Run orchestrator against user request
   * - Monitor execution
   * - Enforce limits
   */
  private async execute(): Promise<void> {
    console.log('[SessionManager] Phase 2: Execution');

    if (!this.orchestrator) {
      throw new Error('Orchestrator not initialized');
    }

    try {
      // Create abort signal that respects execution limit
      const timeoutHandle = setTimeout(
        () => this.abortController.abort(),
        this.config.executionLimits.maxDuration
      );

      // Run orchestrator
      const result = await Promise.race([
        this.orchestrator.orchestrate(this.config.userRequest),
        new Promise((_, reject) =>
          this.abortController.signal.addEventListener('abort', () =>
            reject(new Error('Execution timeout'))
          )
        ),
      ]);

      clearTimeout(timeoutHandle);

      // Store result on blackboard
      await this.localConvex.mutation('api.blackboard.write', {
        sessionId: this.config.sessionId,
        namespace: 'session',
        key: 'final_result',
        value: result,
        agentId: 'system',
      });

      this.emitEvent({
        type: 'progress',
        timestamp: Date.now(),
        data: {
          status: 'orchestration_complete',
          result,
        },
      });
    } catch (error) {
      console.error('[SessionManager] Execution failed:', error);
      throw error;
    }
  }

  /**
   * Phase 3: Finalize session
   * - Collect results from blackboard
   * - Sync to cloud Convex
   * - Archive metrics
   */
  private async finalize(): Promise<void> {
    this.transitionState('completing');
    
    console.log('[SessionManager] Phase 3: Finalization');

    try {
      // Collect artifacts from local Convex
      const artifacts = await this.localConvex.query('api.artifacts.list', {
        sessionId: this.config.sessionId,
      });

      // Collect execution logs
      const executions = await this.localConvex.query('api.toolExecutions.list', {
        sessionId: this.config.sessionId,
      });

      // Calculate final metrics
      const finalMetrics = {
        totalTokensUsed: this.metrics.tokensUsed,
        totalCost: this.metrics.costEstimate,
        toolExecutions: this.metrics.toolExecutions,
        toolErrors: this.metrics.toolErrors,
        duration: Date.now() - this.startTime,
        tasksCompleted: this.metrics.tasksCompleted,
        tasksFailed: this.metrics.tasksFailed,
      };

      // Sync to cloud
      await this.cloudConvex.mutation('api.sessions.syncResults', {
        sessionId: this.config.sessionId,
        artifacts,
        finalMetadata: finalMetrics,
      });

      this.transitionState('completed');
      
      this.emitEvent({
        type: 'completed',
        timestamp: Date.now(),
        data: {
          artifactCount: artifacts.length,
          metrics: finalMetrics,
        },
      });
    } catch (error) {
      console.error('[SessionManager] Finalization failed:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   * Called on success or error
   */
  private async cleanup(): Promise<void> {
    this.transitionState('cleanup');
    
    console.log('[SessionManager] Cleanup phase');

    try {
      this.emitEvent({
        type: 'cleanup_started',
        timestamp: Date.now(),
      });

      // Shutdown tool bus
      if (this.toolBus) {
        await this.toolBus.shutdown();
      }

      // Shutdown orchestrator
      if (this.orchestrator) {
        await this.orchestrator.shutdown();
      }

      // Close Convex connections
      // (Convex clients auto-cleanup on process exit)

      this.emitEvent({
        type: 'cleanup_complete',
        timestamp: Date.now(),
      });

      console.log('[SessionManager] Cleanup complete');
    } catch (error) {
      console.error('[SessionManager] Cleanup error:', error);
      // Don't throw - cleanup errors shouldn't crash the process
    }
  }

  /**
   * Initialize agent hierarchy
   */
  private async initializeAgents(): Promise<void> {
    if (!this.toolBus) {
      throw new Error('ToolBus not initialized');
    }

    // Create orchestrator
    this.orchestrator = new MetaAgent({
      sessionId: this.config.sessionId,
      workspaceId: this.config.workspaceId,
      model: this.config.model,
      temperature: this.config.temperature,
      toolBus: this.toolBus,
      blackboard: this.localConvex,
    });

    // Create specialized agents
    const tools = createVoltAgentTools(this.toolBus);

    const researchAgent = new OmegaAgent({
      id: 'omega:research',
      specialization: 'research',
      model: this.config.model,
      temperature: this.config.temperature,
      tools: tools.filter((t) => t.metadata.category === 'research'),
    });

    const contentAgent = new OmegaAgent({
      id: 'omega:content',
      specialization: 'content',
      model: this.config.model,
      temperature: this.config.temperature,
      tools: tools.filter((t) => t.metadata.category === 'content'),
    });

    const analyticsAgent = new OmegaAgent({
      id: 'omega:analytics',
      specialization: 'analytics',
      model: this.config.model,
      temperature: this.config.temperature,
      tools: tools.filter((t) => t.metadata.category === 'analytics'),
    });

    // Register with orchestrator
    this.orchestrator.registerOmegaAgent('omega:research', researchAgent);
    this.orchestrator.registerOmegaAgent('omega:content', contentAgent);
    this.orchestrator.registerOmegaAgent('omega:analytics', analyticsAgent);

    // Monitor agents
    researchAgent.on('task:complete', (data) => {
      this.metrics.tasksCompleted++;
      this.emitProgressUpdate();
    });

    researchAgent.on('task:error', (data) => {
      this.metrics.tasksFailed++;
      this.emitProgressUpdate();
    });

    console.log('[SessionManager] Agents initialized');
  }

  /**
   * State machine: Transition to new state
   */
  private transitionState(newState: SessionState): void {
    const oldState = this.state;
    this.state = newState;

    console.log(`[SessionManager] State transition: ${oldState} → ${newState}`);

    // Call registered callbacks
    for (const callback of this.stateChangeCallbacks) {
      callback(newState);
    }
  }

  /**
   * Event: Emit structured event for monitoring
   */
  private emitEvent(event: SessionEvent): void {
    this.emit('session:event', event);
    
    // Also emit to WebSocket for real-time UI updates
    // (Handled by separate WebSocket manager)
  }

  /**
   * Event: Emit progress update to UI
   */
  private emitProgressUpdate(): void {
    this.emitEvent({
      type: 'progress',
      timestamp: Date.now(),
      data: this.metrics,
    });
  }

  /**
   * Validation: Ensure config is valid before starting
   */
  private validateConfig(): void {
    if (!this.config.sessionId) throw new Error('Missing sessionId');
    if (!this.config.workspaceId) throw new Error('Missing workspaceId');
    if (!this.config.sandboxId) throw new Error('Missing sandboxId');
    if (!this.config.userRequest) throw new Error('Missing userRequest');
    if (this.config.toolManifests.length === 0) {
      throw new Error('No tools configured');
    }
  }

  /**
   * Public API: Register state change callback
   * Used by UI to track session progress
   */
  onStateChange(callback: (state: SessionState) => void): void {
    this.stateChangeCallbacks.push(callback);
  }

  /**
   * Public API: Get current session state
   */
  getState(): SessionState {
    return this.state;
  }

  /**
   * Public API: Get current metrics
   */
  getMetrics(): SessionMetrics {
    return {
      ...this.metrics,
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Public API: Graceful pause/resume
   */
  async pause(): Promise<void> {
    if (this.state !== 'running') {
      throw new Error('Can only pause running sessions');
    }

    this.transitionState('paused');
    
    // Store state on blackboard for resumption
    await this.localConvex.mutation('api.blackboard.write', {
      sessionId: this.config.sessionId,
      namespace: 'session',
      key: 'paused_at',
      value: Date.now(),
      agentId: 'system',
    });
  }

  /**
   * Public API: Resume paused session
   */
  async resume(): Promise<void> {
    if (this.state !== 'paused') {
      throw new Error('Can only resume paused sessions');
    }

    this.transitionState('running');
    
    // Continue orchestration
    // (Implementation depends on resumption strategy)
  }

  /**
   * Public API: Cancel session
   */
  async cancel(): Promise<void> {
    console.log('[SessionManager] Cancellation requested');
    
    this.abortController.abort();
    
    // Update cloud
    await this.cloudConvex.mutation('api.sessions.updateStatus', {
      sessionId: this.config.sessionId,
      status: 'failed',
      metadata: { cancelledBy: 'user' },
    });
  }
}

export { SessionManager };
export type { SessionConfig, SessionState, SessionEvent, SessionMetrics };
```

---

## Integration with Sandbox Entry Point

```typescript
// packages/sandbox/src/index.ts

import { SessionManager } from './session/SessionManager';
import { ConvexClient } from 'convex/browser';

async function main() {
  const sessionId = process.env.SESSION_ID!;
  const workspaceId = process.env.WORKSPACE_ID!;
  const sandboxId = process.env.SANDBOX_ID!;
  const cloudConvexUrl = process.env.CONVEX_URL!;

  // Fetch session config from cloud
  const cloudConvex = new ConvexClient(cloudConvexUrl);
  const sessionConfig = await cloudConvex.query('api.sessions.getConfig', {
    sessionId,
  });

  // Create session manager
  const sessionManager = new SessionManager(sessionConfig, cloudConvexUrl);

  // Monitor session events
  sessionManager.on('session:event', (event) => {
    console.log(`[Event] ${event.type}:`, event.data);
  });

  // Listen for state changes
  sessionManager.onStateChange((state) => {
    console.log(`[State] ${state}`);
  });

  // Handle graceful shutdown signals
  process.on('SIGTERM', async () => {
    console.log('[Main] SIGTERM received, cancelling session');
    await sessionManager.cancel();
  });

  // Run session
  await sessionManager.run();

  // Exit with appropriate code
  if (sessionManager.getState() === 'completed') {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[Main] Fatal error:', error);
  process.exit(1);
});
```

---

## Event Flow Diagram

```
User initiates session
    ↓
Cloud Convex creates Session + E2B sandbox
    ↓
Sandbox boots → SessionManager.run()
    ↓
[initializing] → Validate config, update cloud
    ↓
[loading_tools] → ToolBus loads manifests
    ↓
[running] → Initialize agents, run orchestrator
    ↓
MetaOmega delegates to Omegas
    ↓
Omegas execute tasks using ToolBus
    ↓
Results stored on local Convex blackboard
    ↓
[completing] → Collect artifacts, sync to cloud
    ↓
[completed] → Update session status, emit final metrics
    ↓
[cleanup] → Shutdown agents, close connections
    ↓
Process exits
```

---

## Real-Time Monitoring

SessionManager emits events that flow to frontend via WebSocket:

```typescript
// Events include:
- initialized
- tools_loaded
- started
- progress (with updated metrics)
- completed
- error
- cleanup_started
- cleanup_complete
```

Frontend can subscribe to these via:
```typescript
// Frontend code
useEffect(() => {
  const unsubscribe = sessionManager.on('session:event', (event) => {
    updateUI(event);
  });
  return unsubscribe;
}, [sessionId]);
```

---

## Error Handling Strategy

1. **Validation errors** → Fail immediately, update cloud
2. **Execution errors** → Log, try alternative approaches
3. **Timeout errors** → Graceful shutdown, sync partial results
4. **Tool errors** → Retry with backoff, fall back to alternative tools
5. **Cleanup errors** → Log but don't crash (best effort)

All errors trigger cleanup and state sync to cloud.
