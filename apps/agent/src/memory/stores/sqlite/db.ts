import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

import Database from 'better-sqlite3';

export type SqliteDatabase = InstanceType<typeof Database>;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS memory_entries (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  store_name    TEXT    NOT NULL,
  actor_id      TEXT    NOT NULL,
  session_id    TEXT,
  content       TEXT    NOT NULL,
  content_hash  TEXT    NOT NULL,
  metadata_json TEXT,
  created_at    INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_memory_dedupe
  ON memory_entries(store_name, actor_id, content_hash);
CREATE INDEX IF NOT EXISTS ix_memory_lookup
  ON memory_entries(store_name, actor_id, created_at DESC);

CREATE VIRTUAL TABLE IF NOT EXISTS memory_entries_fts USING fts5(
  content,
  content='memory_entries',
  content_rowid='id',
  tokenize='porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS memory_entries_ai AFTER INSERT ON memory_entries BEGIN
  INSERT INTO memory_entries_fts(rowid, content) VALUES (new.id, new.content);
END;
CREATE TRIGGER IF NOT EXISTS memory_entries_ad AFTER DELETE ON memory_entries BEGIN
  INSERT INTO memory_entries_fts(memory_entries_fts, rowid, content) VALUES ('delete', old.id, old.content);
END;
CREATE TRIGGER IF NOT EXISTS memory_entries_au AFTER UPDATE ON memory_entries BEGIN
  INSERT INTO memory_entries_fts(memory_entries_fts, rowid, content) VALUES ('delete', old.id, old.content);
  INSERT INTO memory_entries_fts(rowid, content) VALUES (new.id, new.content);
END;
`;

const CURRENT_SCHEMA_VERSION = 1;

const cache = new Map<string, SqliteDatabase>();

function cacheKey(path: string): string {
  if (path === ':memory:') return ':memory:';
  return isAbsolute(path) ? path : resolve(path);
}

let exitHookRegistered = false;
function registerExitHook(): void {
  if (exitHookRegistered) return;
  exitHookRegistered = true;
  process.on('exit', () => {
    for (const db of cache.values()) {
      try { db.close(); } catch { /* best-effort on shutdown */ }
    }
  });
}

export function openSqliteMemoryDb(path: string): SqliteDatabase {
  const key = cacheKey(path);
  const cached = cache.get(key);
  if (cached) return cached;

  if (path !== ':memory:') {
    mkdirSync(dirname(key), { recursive: true });
  }

  const db = new Database(key);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');

  const currentVersion = (db.pragma('user_version', { simple: true }) as number) ?? 0;
  if (currentVersion < CURRENT_SCHEMA_VERSION) {
    db.exec(SCHEMA_SQL);
    db.pragma(`user_version = ${CURRENT_SCHEMA_VERSION}`);
  }

  cache.set(key, db);
  registerExitHook();
  return db;
}

/**
 * Close and drop a cached DB handle. Intended for tests / graceful shutdown; not used by
 * production code, which relies on the process-exit hook.
 */
export function closeSqliteMemoryDb(path: string): void {
  const key = cacheKey(path);
  const db = cache.get(key);
  if (!db) return;
  try { db.close(); } catch { /* ignore */ }
  cache.delete(key);
}
