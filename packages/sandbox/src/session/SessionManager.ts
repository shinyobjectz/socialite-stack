import { ConvexClient } from 'convex/browser';
import { ToolBus, ToolManifest, SessionConfig } from '../toolBus/ToolBus.js';
import { MetaAgent, OmegaAgent } from '../agents/AgentSystem.js';

export type SessionStatus =
  | 'initializing'
  | 'loading_tools'
  | 'running'
  | 'completing'
  | 'completed'
  | 'failed';

export interface SessionManagerConfig {
  sessionId: string;
  workspaceId: string;
  userId: string;
  cloudConvexUrl: string;
  localConvexUrl: string;
  agentConfig: {
    model: string;
    instructions: string;
    subAgents?: Array<{
      name: string;
      model: string;
      instructions: string;
    }>;
  };
}

export class SessionManager {
  private status: SessionStatus = 'initializing';
  private cloudClient: ConvexClient;
  private localClient: ConvexClient;
  private toolBus: ToolBus;
  private orchestrator: MetaAgent | null = null;
  private config: SessionManagerConfig;

  constructor(config: SessionManagerConfig) {
    this.config = config;
    this.cloudClient = new ConvexClient(config.cloudConvexUrl);
    this.localClient = new ConvexClient(config.localConvexUrl);

    const sessionConfig: SessionConfig = {
      sessionId: config.sessionId,
      localConvexUrl: config.localConvexUrl,
    };
    this.toolBus = new ToolBus(sessionConfig);
  }

  /**
   * Main entry point to start the session lifecycle.
   */
  async start(userRequest: string): Promise<void> {
    try {
      await this.updateStatus('initializing');

      // Phase 1: Load Tool Manifests from Cloud
      await this.updateStatus('loading_tools');
      await this.initializeTools();

      // Phase 2: Initialize Agents
      await this.initializeAgents();

      // Phase 3: Run Orchestration
      await this.updateStatus('running');
      const result = await this.orchestrator!.run(userRequest);

      // Phase 4: Finalize and Sync
      await this.updateStatus('completing');
      await this.finalizeSession(result);

      await this.updateStatus('completed');
    } catch (error) {
      console.error('Session failed:', error);
      await this.updateStatus('failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async initializeTools(): Promise<void> {
    // Fetch session state from cloud to get tool manifests
    // @ts-ignore
    const sessionState = await this.cloudClient.query(
      'sessions:getSessionState',
      {
        sessionId: this.config.sessionId as any, // Assuming the cloud ID is passed
      }
    );

    if (!sessionState || !sessionState.session) {
      throw new Error('Could not find session configuration in cloud.');
    }

    const manifests: ToolManifest[] = sessionState.session.toolManifests;
    await this.toolBus.initialize(manifests);
  }

  private async initializeAgents(): Promise<void> {
    this.orchestrator = new MetaAgent({
      name: 'Orchestrator',
      model: this.config.agentConfig.model,
      instructions: this.config.agentConfig.instructions,
      sessionId: this.config.sessionId,
      workspaceId: this.config.workspaceId,
      cloudConvexUrl: this.config.cloudConvexUrl,
      localConvexUrl: this.config.localConvexUrl,
      toolBus: this.toolBus,
    });

    // Initialize specialized sub-agents
    if (this.config.agentConfig.subAgents) {
      for (const subConfig of this.config.agentConfig.subAgents) {
        const agent = new OmegaAgent(
          {
            name: subConfig.name,
            model: subConfig.model,
            instructions: subConfig.instructions,
          },
          this.config.workspaceId,
          this.config.cloudConvexUrl
        );
        this.orchestrator.registerSubAgent(agent);
      }
    }
  }

  private async finalizeSession(finalResult: string): Promise<void> {
    // 1. Collect artifacts from local blackboard
    // @ts-ignore
    const artifacts = await this.localClient.query('blackboard:getNamespace', {
      sessionId: this.config.sessionId,
      namespace: 'artifacts',
    });

    // 2. Sync results back to Cloud Convex
    // @ts-ignore
    await this.cloudClient.mutation('sessions:syncSessionResults', {
      sessionId: this.config.sessionId as any,
      artifacts: artifacts.map((a: any) => ({
        type: a.value.type,
        title: a.value.title,
        content: a.value.content,
        metadata: a.value.metadata,
      })),
      finalMetadata: {
        totalTokensUsed: 0, // Should be tracked during execution
        totalCost: 0,
        resultSummary: finalResult,
      },
    });
  }

  private async updateStatus(
    status: SessionStatus,
    metadata?: any
  ): Promise<void> {
    this.status = status;
    console.log(`[SessionManager] Status: ${status}`);

    // Update Cloud Convex
    try {
      // @ts-ignore
      await this.cloudClient.mutation('sessions:updateSessionStatus', {
        sessionId: this.config.sessionId as any,
        status: status,
        metadata: metadata,
      });
    } catch (e) {
      console.warn('Failed to update session status in cloud:', e);
    }
  }

  getStatus(): SessionStatus {
    return this.status;
  }
}
