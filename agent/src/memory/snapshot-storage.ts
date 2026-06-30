import type { SnapshotStorage } from '@strands-agents/sdk';

import { MEMORY_STORAGE } from '../config.js';
import { NoopMemorySnapshotStorage } from './storages/noop.js';

export function createMemorySnapshotStorage(): SnapshotStorage {
  switch (MEMORY_STORAGE) {
    case 'noop':
    default:
      return new NoopMemorySnapshotStorage();
  }
}
