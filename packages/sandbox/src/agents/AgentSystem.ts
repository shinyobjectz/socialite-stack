import { generateText, Tool as AiTool } from 'ai';
import { z } from 'zod';
import { ConvexClient } from 'convex/browser';
import { ToolBus } from '../toolBus/ToolBus.js';
import { BackendModel } from './BackendModel.js';

export interface AgentConfig {
  name: string;
  model: string;
  instructions: string;
  tools?: Record<string, AiTool>;
}

export interface MetaAgentConfig extends AgentConfig {
  sessionId: string;
  localConvexUrl: string;
  toolBus: ToolBus;
  backendUrl: string;
  authToken: string;
}

/**
 * OmegaAgent is a specialist agent focused on a specific domain.
 */
export class OmegaAgent {
  public readonly id: string;
  private model: BackendModel;
  private instructions: string;
  private tools: Record<string, AiTool>;

  constructor(config: AgentConfig, backendUrl: string, authToken: string) {
    this.id = config.name;
    this.instructions = config.instructions;
    this.tools = config.tools || {};
    this.model = new BackendModel(config.model, backendUrl, authToken);
  }

  async run(task: string): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      system: this.instructions,
      prompt: task,
      tools: this.tools,
    });
    return text;
  }
}

/**
 * MetaAgent is the orchestrator that plans and delegates tasks to OmegaAgents.
 */
export class MetaAgent {
  private model: BackendModel;
  private instructions: string;
  private toolBus: ToolBus;
  private blackboard: ConvexClient;
  private sessionId: string;
  private subAgents: Map<string, OmegaAgent> = new Map();

  constructor(config: MetaAgentConfig) {
    this.sessionId = config.sessionId;
    this.toolBus = config.toolBus;
    this.blackboard = new ConvexClient(config.localConvexUrl);
    this.instructions = config.instructions;
    this.model = new BackendModel(
      config.model,
      config.backendUrl,
      config.authToken
    );
  }

  /**
   * Register a sub-agent (OmegaAgent) that the MetaAgent can delegate to.
   */
  registerSubAgent(agent: OmegaAgent) {
    this.subAgents.set(agent.id, agent);
  }

  /**
   * Main entry point for the MetaAgent to process a user request.
   */
  async run(userRequest: string): Promise<string> {
    const tools: Record<string, AiTool> = {
      ...this.toolBus.getRegisteredTools(),
      delegate_task: this.createDelegateTaskTool(),
      query_blackboard: this.createBlackboardQueryTool(),
    };

    const { text } = await generateText({
      model: this.model,
      system: this.instructions,
      prompt: userRequest,
      tools,
    });

    return text;
  }

  private createDelegateTaskTool(): AiTool {
    return {
      description: 'Delegate a specific task to a specialized sub-agent',
      parameters: z.object({
        agentId: z.string().describe('ID of the agent to delegate to'),
        task: z.string().describe('Detailed task description'),
      }),
      execute: async args => {
        const agent = this.subAgents.get(args.agentId);
        if (!agent) return `Error: Agent "${args.agentId}" not found.`;

        const taskId = crypto.randomUUID();

        // Log task start
        // @ts-ignore
        await this.blackboard.mutation('tasks:createTask', {
          sessionId: this.sessionId,
          taskId,
          delegatedTo: args.agentId,
          task: args.task,
        });

        const result = await agent.run(args.task);

        // Log task completion
        // @ts-ignore
        await this.blackboard.mutation('tasks:updateTaskStatus', {
          sessionId: this.sessionId,
          taskId,
          status: 'completed',
          result,
        });

        return result;
      },
    };
  }

  private createBlackboardQueryTool(): AiTool {
    return {
      description: 'Search the session blackboard for existing information',
      parameters: z.object({
        query: z.string().describe('Search pattern'),
        namespace: z.string().optional(),
      }),
      execute: async args => {
        // @ts-ignore
        return this.blackboard.query('blackboard:search', {
          sessionId: this.sessionId,
          namespace: args.namespace,
          pattern: args.query,
        });
      },
    };
  }
}
