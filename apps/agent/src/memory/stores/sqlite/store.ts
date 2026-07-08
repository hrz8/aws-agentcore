import { createHash } from 'node:crypto';

import type Database from 'better-sqlite3';
import type {
  JSONValue,
  MemoryEntry,
  MemoryStore,
  SearchOptions,
} from '@strands-agents/sdk';

import type { SqliteDatabase } from './db.js';

type Statement = Database.Statement<unknown[]>;

export type SqliteMemoryStoreOptions = {
  readonly db: SqliteDatabase;
  readonly actorId: string;
  readonly sessionId?: string;
  readonly name: string;
  readonly description?: string;
  readonly maxSearchResults?: number;
};

type EntryRow = {
  id: number;
  content: string;
  metadata_json: string | null;
  created_at: number;
  score?: number;
};

/**
 * FTS5 MATCH treats a few characters as operators (double quotes, parens, minus, star, colon).
 * Sanitizing to alphanumeric+whitespace tokens is the simplest robust way to accept arbitrary user
 * strings; anything that survives is joined into a prefix-query so partial words still hit
 * ("book" matches "bookmark"). If nothing survives, we fall back to LIKE on the base table.
 */
function toFtsQuery(raw: string): string | null {
  const tokens = raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `${t}*`).join(' ');
}

function parseMetadata(raw: string | null): Record<string, JSONValue> | undefined {
  if (raw === null || raw.length === 0) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, JSONValue>;
    }
  } catch { /* fall through */ }
  return undefined;
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export class SqliteMemoryStore implements MemoryStore {
  readonly name: string;
  readonly description?: string;
  readonly maxSearchResults?: number;
  readonly writable = true;
  readonly extraction = true;

  private readonly _db: SqliteDatabase;
  private readonly _actorId: string;
  private readonly _sessionId: string | null;
  private readonly _searchFts: Statement;
  private readonly _searchLike: Statement;
  private readonly _insert: Statement;

  constructor(opts: SqliteMemoryStoreOptions) {
    if (opts.actorId.length === 0) {
      throw new Error('SqliteMemoryStore: actorId is required');
    }
    if (opts.name.length === 0) {
      throw new Error('SqliteMemoryStore: name is required');
    }

    this.name = opts.name;
    if (opts.description !== undefined) this.description = opts.description;
    if (opts.maxSearchResults !== undefined) this.maxSearchResults = opts.maxSearchResults;

    this._db = opts.db;
    this._actorId = opts.actorId;
    this._sessionId = opts.sessionId ?? null;

    this._searchFts = this._db.prepare(`
      SELECT e.id, e.content, e.metadata_json, e.created_at,
             bm25(memory_entries_fts) AS score
      FROM memory_entries_fts
      JOIN memory_entries e ON e.id = memory_entries_fts.rowid
      WHERE memory_entries_fts MATCH ?
        AND e.store_name = ?
        AND e.actor_id = ?
      ORDER BY score ASC
      LIMIT ?
    `);

    this._searchLike = this._db.prepare(`
      SELECT id, content, metadata_json, created_at
      FROM memory_entries
      WHERE store_name = ?
        AND actor_id = ?
        AND content LIKE ?
      ORDER BY created_at DESC
      LIMIT ?
    `);

    this._insert = this._db.prepare(`
      INSERT OR IGNORE INTO memory_entries
        (store_name, actor_id, session_id, content, content_hash, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
  }

  async search(query: string, options?: SearchOptions): Promise<MemoryEntry[]> {
    const limit = Math.max(1, options?.maxSearchResults ?? this.maxSearchResults ?? 5);
    const ftsQuery = toFtsQuery(query);

    const rows: EntryRow[] = ftsQuery !== null
      ? (this._searchFts.all(ftsQuery, this.name, this._actorId, limit) as EntryRow[])
      : (this._searchLike.all(this.name, this._actorId, `%${query}%`, limit) as EntryRow[]);

    return rows.map((r) => this._toEntry(r));
  }

  async add(content: string, metadata?: Record<string, JSONValue>): Promise<{ id: number | null }> {
    if (content.length === 0) {
      throw new Error('SqliteMemoryStore.add: content must be non-empty');
    }
    const hash = sha256Hex(content);
    const metadataJson = metadata !== undefined ? JSON.stringify(metadata) : null;
    const result = this._insert.run(
      this.name,
      this._actorId,
      this._sessionId,
      content,
      hash,
      metadataJson,
      Date.now(),
    );
    // On dedupe (INSERT OR IGNORE with no-op), lastInsertRowid is 0 and changes is 0.
    const id = result.changes > 0 ? Number(result.lastInsertRowid) : null;
    return { id };
  }

  private _toEntry(row: EntryRow): MemoryEntry {
    const userMetadata = parseMetadata(row.metadata_json) ?? {};
    const metadata: Record<string, JSONValue> = {
      _id: row.id,
      _createdAt: row.created_at,
      ...userMetadata,
    };
    if (typeof row.score === 'number') {
      metadata._score = row.score;
    }
    return {
      content: row.content,
      metadata,
    };
  }
}
