import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { closeSqliteMemoryDb, openSqliteMemoryDb } from '../src/memory/stores/sqlite/db.ts';
import { SqliteMemoryStore } from '../src/memory/stores/sqlite/store.ts';

function makeStore(actorId: string, opts: { name?: string; maxSearchResults?: number } = {}) {
  const db = openSqliteMemoryDb(':memory:');
  return new SqliteMemoryStore({
    db,
    actorId,
    name: opts.name ?? 'notes',
    ...(opts.maxSearchResults !== undefined ? { maxSearchResults: opts.maxSearchResults } : {}),
  });
}

describe('SqliteMemoryStore', () => {
  beforeEach(() => {
    // Each test gets a fresh in-memory DB by closing the singleton before it opens.
    closeSqliteMemoryDb(':memory:');
  });

  afterEach(() => {
    closeSqliteMemoryDb(':memory:');
  });

  describe('add', () => {
    it('inserts content and returns a numeric id', async () => {
      const store = makeStore('tenant-a__actor-1');
      const result = await store.add('The user prefers dark mode.');
      expect(result.id).toBeTypeOf('number');
      expect(result.id).toBeGreaterThan(0);
    });

    it('is idempotent on duplicate content (INSERT OR IGNORE)', async () => {
      const store = makeStore('tenant-a__actor-1');
      const a = await store.add('User lives in Berlin.');
      const b = await store.add('User lives in Berlin.');
      expect(a.id).toBeTypeOf('number');
      expect(b.id).toBeNull();
    });

    it('scopes deduplication per store + actor (different actors can hold identical content)', async () => {
      const alice = makeStore('tenant-a__alice');
      const bob = makeStore('tenant-a__bob');
      const a = await alice.add('Prefers Kotlin.');
      const b = await bob.add('Prefers Kotlin.');
      expect(a.id).toBeTypeOf('number');
      expect(b.id).toBeTypeOf('number');
      expect(b.id).not.toBe(a.id);
    });

    it('persists metadata as JSON and returns it on search', async () => {
      const store = makeStore('tenant-a__actor-1');
      await store.add('Loves espresso.', { source: 'extraction', turn: 3 });
      const hits = await store.search('espresso');
      expect(hits).toHaveLength(1);
      expect(hits[0]?.metadata?.source).toBe('extraction');
      expect(hits[0]?.metadata?.turn).toBe(3);
    });

    it('rejects empty content', async () => {
      const store = makeStore('tenant-a__actor-1');
      await expect(store.add('')).rejects.toThrow(/non-empty/);
    });
  });

  describe('search', () => {
    it('finds FTS matches ordered by relevance and returns _score', async () => {
      const store = makeStore('tenant-a__actor-1');
      await store.add('User lives in Berlin and loves rock climbing.');
      await store.add('User prefers vegetarian food.');
      await store.add('User works at a startup in Berlin, focused on climbing gyms.');
      const hits = await store.search('climbing berlin');
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0]?.content).toContain('climbing');
      for (const h of hits) {
        expect(h.metadata?._score).toBeTypeOf('number');
        expect(h.metadata?._id).toBeTypeOf('number');
        expect(h.metadata?._createdAt).toBeTypeOf('number');
      }
    });

    it('supports prefix matching so partial tokens still hit', async () => {
      const store = makeStore('tenant-a__actor-1');
      await store.add('User bookmarks tabs for later.');
      const hits = await store.search('book');
      expect(hits).toHaveLength(1);
      expect(hits[0]?.content).toContain('bookmark');
    });

    it('does not leak entries across actors', async () => {
      const alice = makeStore('tenant-a__alice');
      const bob = makeStore('tenant-a__bob');
      await alice.add('Alice loves TypeScript.');
      await bob.add('Bob loves Rust.');
      const aliceHits = await alice.search('loves');
      const bobHits = await bob.search('loves');
      expect(aliceHits).toHaveLength(1);
      expect(aliceHits[0]?.content).toContain('Alice');
      expect(bobHits).toHaveLength(1);
      expect(bobHits[0]?.content).toContain('Bob');
    });

    it('does not leak entries across stores on the same DB', async () => {
      const notes = makeStore('tenant-a__actor-1', { name: 'notes' });
      const other = makeStore('tenant-a__actor-1', { name: 'preferences' });
      await notes.add('User prefers dark mode.');
      await other.add('User speaks German.');
      const noteHits = await notes.search('user');
      expect(noteHits).toHaveLength(1);
      expect(noteHits[0]?.content).toContain('dark');
    });

    it('respects maxSearchResults from options', async () => {
      const store = makeStore('tenant-a__actor-1', { maxSearchResults: 10 });
      for (let i = 0; i < 6; i++) await store.add(`Fact number ${i} about the user.`);
      const capped = await store.search('user', { maxSearchResults: 2 });
      expect(capped).toHaveLength(2);
    });

    it('falls back to LIKE when the query has no FTS-safe tokens', async () => {
      const store = makeStore('tenant-a__actor-1');
      await store.add('User uses foo & bar syntax daily.');
      await store.add('Unrelated content about mountains.');
      // '&' has no FTS-safe tokens → LIKE '%&%' fallback → matches the entry containing '&'.
      const hits = await store.search('&');
      expect(hits).toHaveLength(1);
      expect(hits[0]?.content).toContain('&');
    });

    it('returns an empty array when nothing matches', async () => {
      const store = makeStore('tenant-a__actor-1');
      await store.add('User uses Vim.');
      expect(await store.search('emacs')).toEqual([]);
    });
  });

  describe('MemoryStore contract', () => {
    it('declares writable=true and extraction=true (client-side ModelExtractor path)', () => {
      const store = makeStore('tenant-a__actor-1');
      expect(store.writable).toBe(true);
      expect(store.extraction).toBe(true);
      expect(store.name).toBe('notes');
    });
  });
});

describe('openSqliteMemoryDb', () => {
  const tempPath = join(tmpdir(), `sqlite-memory-test-${process.pid}.db`);

  afterEach(() => {
    closeSqliteMemoryDb(tempPath);
    try { rmSync(tempPath, { force: true }); } catch { /* ignore */ }
    try { rmSync(`${tempPath}-wal`, { force: true }); } catch { /* ignore */ }
    try { rmSync(`${tempPath}-shm`, { force: true }); } catch { /* ignore */ }
  });

  it('returns the same handle for repeated opens of the same path', () => {
    const a = openSqliteMemoryDb(tempPath);
    const b = openSqliteMemoryDb(tempPath);
    expect(a).toBe(b);
  });

  it('creates the schema on first open (user_version=1)', () => {
    const db = openSqliteMemoryDb(tempPath);
    const version = db.pragma('user_version', { simple: true });
    expect(version).toBe(1);
    const info = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='memory_entries'",
    ).get();
    expect(info).toBeDefined();
  });

  it('enables WAL journal mode', () => {
    const db = openSqliteMemoryDb(tempPath);
    const mode = db.pragma('journal_mode', { simple: true });
    expect(String(mode).toLowerCase()).toBe('wal');
  });
});
