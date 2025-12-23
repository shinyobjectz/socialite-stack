import { ConvexHttpClient } from 'convex/browser';
import { api } from '@socialite/db/convex/_generated/api';

export type AgentEventType = 'tool_start' | 'tool_end' | 'task_start' | 'task_end' | 'status_change' | 'artifact_created';

export interface AgentEvent {
  id: string;
  type: AgentEventType;
  timestamp: number;
  payload: any;
}

export type EventCallback = (event: AgentEvent) => void;

/**
 * SessionSocket manages the real-time connection to a running agent session.
 * It abstracts the underlying transport (Convex subscriptions) into a simple event emitter.
 */
export class SessionSocket {
  private sessionId: string;
  private cloudClient: ConvexHttpClient;
  private listeners: Set<EventCallback> = new Set();
  private isConnected: boolean = false;
  private lastSeenTimestamp: number = 0;

  constructor(sessionId: string, cloudConvexUrl: string) {
    this.sessionId = sessionId;
    this.cloudClient = new ConvexHttpClient(cloudConvexUrl);
  }

  /**
   * Connect to the session event stream.
   */
  public connect() {
    if (this.isConnected) return;

    console.log(`[SessionSocket] Connecting to session ${this.sessionId}...`);
    this.isConnected = true;

    // In a real implementation with Convex, we would use a subscription:
    // this.convexClient.onUpdate(api.sessions.getEvents, { sessionId: this.sessionId }, (events) => {
    //   events.forEach(event => this.emit(event));
    // });

    // For now, we'll simulate the connection
    this.startPolling();
  }

  /**
   * Disconnect from the session.
   */
  public disconnect() {
    this.isConnected = false;
    console.log(`[SessionSocket] Disconnected from session ${this.sessionId}`);
  }

  /**
   * Subscribe to agent events.
   */
  public onEvent(callback: EventCallback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private emit(event: AgentEvent) {
    this.listeners.forEach(callback => callback(event));
  }

  /**
   * Temporary polling implementation until full Convex subscriptions are wired up.
   */
  private async startPolling() {
    while (this.isConnected) {
      try {
        // Fetch recent logs/events from Convex
        // @ts-ignore
        const state = await this.cloudClient.query(api.sessions.getSessionState, {
          sessionId: this.sessionId as any
        });

        if (state && state.session) {
          // Check for status changes
          this.emit({
            id: `status-${Date.now()}`,
            type: 'status_change',
            timestamp: Date.now(),
            payload: { status: state.session.status }
          });

          // Check for new artifacts
          if (state.artifacts && state.artifacts.length > 0) {
            state.artifacts.forEach((artifact: any) => {
              if (artifact.createdAt > this.lastSeenTimestamp) {
                this.emit({
                  id: artifact._id,
                  type: 'artifact_created',
                  timestamp: artifact.createdAt,
                  payload: artifact
                });
              }
            });
          }
        }
      } catch (error) {
        console.error('[SessionSocket] Polling error:', error);
      }

      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}
