// Recovery carries of R6 S2/S3a/S3b and the phone trace cap (ADR-075 §§2, 4; OFF-07; 03 §15), on
// Node with real SQLite (node:sqlite) in WAL mode, one connection per simulated process, as
// local_story.test.ts. Expected values are literals, never from the code under test.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import type { RngState, WorldContextId } from '../../../kernel/ts/src/contracts.gen.ts';
import { loadCartridge, newWorld, type Cartridge } from '../../../kernel/ts/src/index.ts';
import { INSTALLED } from '../../../kernel/ts/src/world.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { openStory, type Saved } from './authority.ts';

const ACTOR = 'bd595711-ea5f-89a5-abb0-046cd349d2f9';
// ashmere_items ids (kernel/ts/test/invocation_cases.json): the satchel and the NPC.
const SATCHEL = 'd530207e-b845-8be5-9d53-b44b2cf5d8a1';
const NPC = 'ff864ad5-cd56-80c8-9392-dc88bdc28fd2';
const kat = read('protocol/fixtures/cartridge_items_hash.json');
const loaded = loadCartridge(
  new TextEncoder().encode(`{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`),
  INSTALLED,
);
assert.ok(loaded.ok);
const context = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as WorldContextId;
const fresh = newWorld(loaded.cartridge as Cartridge, context, [1, 2, 3, 4] as RngState);
const releases = [{ content_hash: kat.sha256, fresh }] as const;
/** The n-th id a process's allocator hands out. */
const id = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;
const host = () => {
  let n = 0;
  return { kernel_version: `loka-kernel@${'0'.repeat(40)}`, newId: () => id(++n) };
};

type Tap = (statement: string, run: () => unknown) => unknown;
/** A connection adapted to expo-sqlite's sync names; `tap` wraps each statement to fault it. */
const adapt = (sql: DatabaseSync, tap: Tap = (_, run) => run()) => ({
  execSync: (s: string) => void tap(s, () => sql.exec(s)),
  runSync: (s: string, ...p: (string | number | null)[]) => tap(s, () => sql.prepare(s).run(...p)),
  getFirstSync: <T>(s: string, ...p: (string | number | null)[]) =>
    tap(s, () => sql.prepare(s).get(...p) ?? null) as T | null,
  getAllSync: <T>(s: string, ...p: (string | number | null)[]) =>
    tap(s, () => sql.prepare(s).all(...p)) as T[],
  isInTransactionSync: () => sql.isTransaction,
});
/** A process on the save at `path`: its connection in WAL mode and what `openStory` returns. */
function processOn(path: string, tap?: Tap) {
  const sql = new DatabaseSync(path);
  sql.exec('PRAGMA journal_mode = WAL');
  const one = (q: string) => Object.values(sql.prepare(q).get() ?? {})[0];
  return { sql, opened: openStory(adapt(sql, tap), releases, host()), one };
}
const open = (path: string, tap?: Tap) => {
  const p = processOn(path, tap);
  assert.equal(p.opened.kind, 'open');
  return { ...p, story: p.opened as Extract<typeof p.opened, { kind: 'open' }> };
};
const save = () => join(mkdtempSync(join(tmpdir(), 'loka-s6a-')), 'save.db');
const invocation = (n: number, action_key: string, target_ids: string[]) => ({
  invocation_id: `00000000-0000-4000-8000-00000000000${n}`,
  action_key,
  actor_id: ACTOR,
  target_ids,
  input: {},
});
const take = invocation(1, 'take', [SATCHEL]);
const give = invocation(2, 'give', [SATCHEL, NPC]);
const revision = (r: unknown) => (r as Saved).revision;
/** Per trace.command entry: its ordinal, the revision decided against and its commit state. */
const traced = (p: { sql: DatabaseSync }) =>
  p.sql
    .prepare('SELECT record FROM trace ORDER BY rowid')
    .all()
    .map((r) => JSON.parse(r.record as string))
    .filter((r) => r.event === 'trace.command')
    .map((r) => [r.data.ordinal, r.ids.revision, r.data.commit.state]);

// Breaks (ADR-075 §4; S2 review R2-F1, the review's scenario): catchUp reading the trace inside a
// transaction a failed ROLLBACK left open, taking take's uncommitted entry as written, so a later
// ROLLBACK discards it and give is traced before take (replay by ordinal then runs give first).
// Real faults: a deferred foreign key fails each trace COMMIT; two ROLLBACKs fail (simulated).
test('a leftover transaction is settled before the trace catches up', () => {
  const path = save();
  let jams = 0;
  const p = open(path, (s, run) => {
    if (!jams || s !== 'ROLLBACK') return run();
    jams -= 1;
    throw new Error('ROLLBACK failed');
  });
  p.sql.exec(`PRAGMA foreign_keys = ON; CREATE TABLE parent (id INTEGER PRIMARY KEY);
    CREATE TABLE orphan (id INTEGER REFERENCES parent DEFERRABLE INITIALLY DEFERRED);
    CREATE TRIGGER orphaned AFTER INSERT ON trace BEGIN INSERT INTO orphan VALUES (1); END;`);
  jams = 2;
  assert.equal(revision(p.story.invoke(take)), 1);
  assert.throws(() => p.story.invoke(give), /ROLLBACK failed/);
  p.sql.exec('DROP TRIGGER orphaned');
  assert.equal(revision(p.story.invoke(give)), 2);
  p.sql.close();
  assert.deepEqual(traced(open(path)), [
    [1, 0, 'committed'],
    [2, 1, 'committed'],
  ]);
});

/** The save's file with no connection open (WAL checkpointed), by hash. */
const bytes = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
/** A save at revision 1 (the satchel taken), its connection closed. */
function taken() {
  const path = save();
  const p = open(path);
  p.story.invoke(take);
  p.sql.close();
  return path;
}
/** `path` with byte 0 of `table`'s root page (its b-tree page type) overwritten. */
function corruptPage(path: string, table: string) {
  const sql = new DatabaseSync(path);
  const at = (q: string) => Number(Object.values(sql.prepare(q).get()!)[0]);
  const [root, size] = [
    at(`SELECT rootpage FROM sqlite_master WHERE name = '${table}'`),
    at('PRAGMA page_size'),
  ];
  sql.close();
  const file = readFileSync(path);
  file[(root - 1) * size] = 0xff;
  writeFileSync(path, file);
}

// Breaks (OFF-07): a file SQLite rejects (NOTADB) or a page read that raises SQLITE_CORRUPT
// throwing from openStory instead of the typed save_corrupt, or that open writing anything.
// Real damage: a garbage file; a b-tree page whose type byte is invalid.
test('a file that is not a database or has a corrupt page is save_corrupt', () => {
  const notadb = save();
  writeFileSync(notadb, Buffer.alloc(4096, 'x'));
  const sql = new DatabaseSync(notadb); // no WAL pragma: SQLite rejects the file at its first read
  assert.equal(openStory(adapt(sql), releases, host()).kind, 'save_corrupt');
  sql.close();
  for (const table of ['state_row', 'head', 'receipt']) {
    const path = taken();
    corruptPage(path, table);
    const before = bytes(path);
    const p = processOn(path);
    assert.equal(p.opened.kind, 'save_corrupt', table);
    p.sql.close();
    assert.equal(bytes(path), before, table);
  }
});

// Breaks (OFF-07; S3b review S3B-4/5): a head table with a dropped column throwing from openStory,
// or the player's new game keeping that table (its head write then fails) instead of recreating it.
test('a head with a damaged column is save_corrupt; its new game recreates the head', () => {
  const path = taken();
  const sql = new DatabaseSync(path);
  sql.exec('ALTER TABLE head DROP COLUMN clock');
  sql.close();
  const p = processOn(path);
  assert.equal(p.opened.kind, 'save_corrupt');
  assert.deepEqual((p.opened as { newGame: () => unknown }).newGame(), { kind: 'replaced' });
  p.sql.close();
  const q = open(path);
  assert.deepEqual([q.one('SELECT revision FROM head'), q.one('SELECT clock FROM head')], [0, 0]);
  assert.equal(revision(q.story.invoke(take)), 1);
});

// The phone trace cap in rows (ADR-075 §2 as amended in R6 S6a).
const CAP = 5000;
/** Copies the trace's first entry until the trace holds `rows` rows: one run's long play. */
const pad = (p: { sql: DatabaseSync }, rows: number) =>
  p.sql
    .prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ? - (SELECT
        count(*) FROM trace)) INSERT INTO trace SELECT t.* FROM n, trace t WHERE t.ordinal = 1`,
    )
    .run(rows);
const runs = (p: { sql: DatabaseSync }) =>
  p.sql
    .prepare('SELECT record FROM trace ORDER BY rowid')
    .all()
    .map((r) => JSON.parse(r.record as string).ids.run_id);

// Breaks (ADR-075 §2, cap rule): a trace that grows past the cap, or that makes room by dropping
// part of a run (its header or beginning, which replay needs) or the current run, not the old one.
test('at the cap a new game deletes the oldest run whole and keeps the current one', () => {
  const p = open(save());
  p.story.invoke(take);
  pad(p, CAP - 2);
  assert.deepEqual(p.story.newGame(), { kind: 'replaced' });
  assert.equal(revision(p.story.invoke(take)), 1);
  assert.equal(p.one('SELECT count(*) FROM trace'), CAP);
  assert.equal(revision(p.story.invoke(give)), 2);
  assert.deepEqual(runs(p), [id(4), id(4), id(4)]);
  assert.deepEqual(traced(p), [
    [1, 0, 'committed'],
    [2, 1, 'committed'],
  ]);
});

// Breaks (ADR-075 §2, cap rule): with the current run alone at the cap, its entries still
// appended, its own beginning deleted to make room, the dropped entries caught up at the next open,
// the cap reaching play, or a dropped entry counted as a failed write (every later command would
// then rescan the receipts to catch up).
test('a run alone at the cap keeps its beginning and appends no more entries', () => {
  const path = save();
  const p = open(path);
  p.story.invoke(take);
  pad(p, CAP);
  const last = p.one('SELECT max(rowid) FROM trace');
  assert.equal(revision(p.story.invoke(give)), 2);
  p.sql.close();
  let scans = 0;
  const q = open(path, (s, run) => ((scans += +s.includes('FROM receipt WHERE command')), run()));
  scans = 0;
  assert.equal(revision(q.story.invoke(invocation(3, 'take', [SATCHEL]))), 2); // given: rejected
  assert.equal(scans, 0);
  assert.deepEqual(
    [q.one('SELECT count(*) FROM trace'), q.one('SELECT max(rowid) FROM trace')],
    [CAP, last],
  );
  assert.equal(q.one('SELECT ordinal FROM trace ORDER BY rowid LIMIT 1'), 0);
});
