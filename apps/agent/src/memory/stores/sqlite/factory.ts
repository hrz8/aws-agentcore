import type { MemoryStore } from '@strands-agents/sdk';

import {
  MEMORY_SQLITE_DB_PATH,
  MEMORY_SQLITE_MAX_SEARCH_RESULTS,
  MEMORY_SQLITE_STORE_DESCRIPTION,
  MEMORY_SQLITE_STORE_NAME,
} from '../../../config.js';
import { openSqliteMemoryDb } from './db.js';
import { SqliteMemoryStore } from './store.js';

export type CreateSqliteStoresInput = {
  readonly actorId: string;
  readonly sessionId: string;
};

export function createSqliteMemoryStores(input: CreateSqliteStoresInput): MemoryStore[] | null {
  if (input.actorId.length === 0) return null;

  const db = openSqliteMemoryDb(MEMORY_SQLITE_DB_PATH);
  return [
    new SqliteMemoryStore({
      db,
      actorId: input.actorId,
      sessionId: input.sessionId,
      name: MEMORY_SQLITE_STORE_NAME,
      description: MEMORY_SQLITE_STORE_DESCRIPTION,
      maxSearchResults: MEMORY_SQLITE_MAX_SEARCH_RESULTS,
    }),
  ];
}
