// Recovery carries of R6 S2/S3a/S3b and the phone trace cap (ADR-075 §§2, 4; OFF-07; 03 §15), on
// Node with real SQLite (node:sqlite) in WAL mode, one connection per simulated process, as
// local_story.test.ts. Expected values are literals, never from the code under test.
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
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
