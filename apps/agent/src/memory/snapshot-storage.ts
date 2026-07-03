import type { SnapshotStorage } from '@strands-agents/sdk';

import { MEMORY_STORAGE, MemoryStorage } from '../config.js';
import { NoopMemorySnapshotStorage } from './storages/noop.js';

export function createMemorySnapshotStorage(): SnapshotStorage {
  switch (MEMORY_STORAGE) {
    case MemoryStorage.Noop:
    default:
      return new NoopMemorySnapshotStorage();
  }
}
