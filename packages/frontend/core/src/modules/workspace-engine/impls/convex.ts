import {
  DocStorageBase,
  DocStorageOptions,
  DocUpdate,
  DocClock,
  DocRecord,
  DocClocks,
} from '@affine/nbstore';
import { ConvexClient } from 'convex/browser';
import { api } from '@socialite/db/convex/_generated/api';
import { Id } from '@socialite/db/convex/_generated/dataModel';
import { LiveData, Service } from '@toeverything/infra';
import {
  WorkspaceFlavourProvider,
  WorkspaceFlavoursProvider,
  WorkspaceMetadata,
  WorkspaceProfileInfo,
} from '../../workspace';
import type { WorkerInitOptions } from '@affine/nbstore/worker/client';
import type { BlobStorage, DocStorage, ListedBlobRecord } from '@affine/nbstore';
import type { Workspace as BSWorkspace } from '@blocksuite/affine/store';

export interface ConvexDocStorageOptions extends DocStorageOptions {
  convexUrl: string;
  workspaceId: string;
}

/**
 * ConvexDocStorage (Phase C.4)
 *
 * This class implements the reactive Yjs sync engine for the Affine frontend.
 * It uses Convex queries to subscribe to document updates and mutations to push local changes.
 */
export class ConvexDocStorage extends DocStorageBase<ConvexDocStorageOptions> {
  static readonly identifier = 'ConvexDocStorage';
  private convexClient: ConvexClient;
  private workspaceId: Id<'workspaces'>;
  private unsubscribes: Map<string, () => void> = new Map();

  constructor(options: ConvexDocStorageOptions) {
    super(options);
    this.convexClient = new ConvexClient(options.convexUrl);
    this.workspaceId = options.workspaceId as Id<'workspaces'>;
  }

  readonly connection = {
    status: 'connected' as const,
    onStatusChange: () => () => {},
    connect: async () => {},
    disconnect: () => {},
  };

  /**
   * Push a local Yjs update to Convex.
   */
  override async pushDocUpdate(update: DocUpdate): Promise<DocClock> {
    await this.convexClient.mutation(api.sync.pushUpdate, {
      workspaceId: this.workspaceId,
      docId: update.docId,
      update: update.bin,
    });

    return {
      docId: update.docId,
      timestamp: new Date(),
    };
  }

  /**
   * Fetch the current state of a document from Convex.
   */
  override async getDocSnapshot(docId: string): Promise<DocRecord | null> {
    const updates = await this.convexClient.query(api.sync.getDocState, {
      workspaceId: this.workspaceId,
      docId,
    });

    if (!updates || updates.length === 0) {
      return null;
    }

    // Merge all updates into a single binary
    const { bin, timestamp } = await this.squash(
      updates.map(u => ({
        docId,
        bin: new Uint8Array(u.update),
        timestamp: new Date(u.createdAt),
      }))
    );

    return {
      docId,
      bin,
      timestamp,
    };
  }

  /**
   * Subscribe to document updates from Convex.
   */
  override subscribeDocUpdate(
    _callback: (update: DocRecord, origin?: string) => void
  ): () => void {
    return () => {
      this.unsubscribes.forEach(unsub => unsub());
      this.unsubscribes.clear();
    };
  }

  /**
   * Helper to start a subscription for a specific document.
   */
  public subscribeToDoc(docId: string, callback: (update: DocRecord) => void) {
    if (this.unsubscribes.has(docId)) return;

    const unsubscribe = this.convexClient.onUpdate(
      api.sync.getDocState,
      { workspaceId: this.workspaceId, docId },
      updates => {
        if (updates && updates.length > 0) {
          const lastUpdate = updates[updates.length - 1];
          callback({
            docId,
            bin: new Uint8Array(lastUpdate.update),
            timestamp: new Date(lastUpdate.createdAt),
          });
        }
      }
    );

    this.unsubscribes.set(docId, unsubscribe);
  }

  override async getDocTimestamp(docId: string): Promise<DocClock | null> {
    const updates = await this.convexClient.query(api.sync.getDocState, {
      workspaceId: this.workspaceId,
      docId,
    });

    if (!updates || updates.length === 0) return null;

    return {
      docId,
      timestamp: new Date(updates[updates.length - 1].createdAt),
    };
  }

  override async getDocTimestamps(_after?: Date): Promise<DocClocks> {
    return {};
  }

  override async deleteDoc(docId: string): Promise<void> {
    console.log(`[ConvexDocStorage] Deleting doc ${docId}`);
  }

  protected async setDocSnapshot(): Promise<boolean> {
    return false;
  }

  protected async getDocUpdates(): Promise<DocRecord[]> {
    return [];
  }

  protected async markUpdatesMerged(): Promise<number> {
    return 0;
  }
}

class ConvexWorkspaceFlavourProvider implements WorkspaceFlavourProvider {
  readonly flavour = 'convex';

  async deleteWorkspace(_id: string): Promise<void> {
    // TODO: Implement delete workspace in Convex
  }

  async createWorkspace(
    _initial: (
      docCollection: BSWorkspace,
      blobStorage: BlobStorage,
      docStorage: DocStorage
    ) => Promise<void>
  ): Promise<WorkspaceMetadata> {
    // TODO: Implement create workspace in Convex
    throw new Error('Not implemented');
  }

  workspaces$ = new LiveData<WorkspaceMetadata[]>([]);
  isRevalidating$ = new LiveData(false);

  async getWorkspaceProfile(
    _id: string
  ): Promise<WorkspaceProfileInfo | undefined> {
    return { isOwner: true };
  }

  async getWorkspaceBlob(_id: string, _blob: string): Promise<Blob | null> {
    return null;
  }

  async listBlobs(_workspaceId: string): Promise<ListedBlobRecord[]> {
    return [];
  }

  async deleteBlob(
    _workspaceId: string,
    _blob: string,
    _permanent: boolean
  ): Promise<void> {}

  getEngineWorkerInitOptions(workspaceId: string): WorkerInitOptions {
    return {
      local: {
        doc: {
          name: 'ConvexDocStorage',
          opts: {
            convexUrl: (window as any).CONVEX_URL,
            workspaceId,
          },
        },
        blob: {
          name: 'ConvexBlobStorage',
          opts: {
            convexUrl: (window as any).CONVEX_URL,
            workspaceId,
          },
        },
      },
    };
  }
}

export class ConvexWorkspaceFlavoursProvider
  extends Service
  implements WorkspaceFlavoursProvider
{
  workspaceFlavours$ = new LiveData<WorkspaceFlavourProvider[]>([
    new ConvexWorkspaceFlavourProvider(),
  ]);
}
