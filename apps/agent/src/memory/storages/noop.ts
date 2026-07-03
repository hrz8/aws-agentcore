import type { Snapshot, SnapshotManifest, SnapshotStorage } from '@strands-agents/sdk';

export class NoopMemorySnapshotStorage implements SnapshotStorage {
  async saveSnapshot(): Promise<void> {}
  async loadSnapshot(): Promise<Snapshot | null> {
    return null;
  }
  async listSnapshotIds(): Promise<string[]> {
    return [];
  }
  async deleteSession(): Promise<void> {}
  async loadManifest(): Promise<SnapshotManifest> {
    return {
      schemaVersion: '1',
      updatedAt: new Date(0).toISOString(),
    };
  }
  async saveManifest(): Promise<void> {}
}
