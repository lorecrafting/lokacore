// The local Story authority on Node with real SQLite (node:sqlite) in WAL mode, as expo-sqlite
// opens it, one connection per simulated process; a restart closes it and opens a new one on the
// same file, and a kill is a real child process (03 §§14-15; 07 §§8-9; ADR-075 §4).
// Expected values are literals from the fixtures named beside them, never from the code under test.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { encode } from '../../../kernel/ts/src/canonical.ts';
import type { RngState, WorldContextId } from '../../../kernel/ts/src/contracts.gen.ts';
import { loadCartridge, newWorld, type Cartridge } from '../../../kernel/ts/src/index.ts';
import { validate } from '../../../kernel/ts/src/validate.ts';
import { INSTALLED } from '../../../kernel/ts/src/world.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { openStory, type Reply, type Saved } from './authority.ts';

const SCOPE = 'story/lineage-1/character-1';
const ACTOR = 'bd595711-ea5f-89a5-abb0-046cd349d2f9';
// ashmere_items ids (kernel/ts/test/invocation_cases.json): the satchel, the NPC, the body.
const SATCHEL = 'd530207e-b845-8be5-9d53-b44b2cf5d8a1';
const NPC = 'ff864ad5-cd56-80c8-9392-dc88bdc28fd2';
const BODY = '3d4829ad-9e43-81ef-bc10-66b1b267e157';

const world = (fixture: string, seed: readonly number[]) => {
  const kat = read(`protocol/fixtures/${fixture}`);
  const artifact = `{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`;
  const loaded = loadCartridge(new TextEncoder().encode(artifact), INSTALLED);
  assert.ok(loaded.ok);
  const context = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as WorldContextId;
  const fresh = newWorld(loaded.cartridge as Cartridge, context, seed as RngState);
  const kernel_version = `loka-kernel@${'0123456789'.repeat(4)}`;
  const run_id = '6f6f6f6f-1111-4222-8333-444444444444';
  return { fresh, ids: { content_hash: kat.sha256, kernel_version, seed, run_id } };
};
const items = world('cartridge_items_hash.json', [1, 2, 3, 4]);
// numeric-vectors.json rng_steps[3].state; its next draw fails pick_lock (invocation_cases.json).
const dusk = world('cartridge_dusk_hash.json', [27274249, 25704967, 31982592, 12605441]);

type Tap = (statement: string, run: () => unknown) => unknown;
/**
 * A process: one connection to the save at `path`, adapted to expo-sqlite's sync names. `tap`
 * wraps each execSync and runSync, the one place a test simulates a fault.
 */
function processOn(path: string, story = items, pageSize = 0, tap: Tap = (_, run) => run()) {
  const sql = new DatabaseSync(path);
  if (pageSize) sql.exec(`PRAGMA page_size = ${pageSize}`); // before WAL fixes it
  sql.exec('PRAGMA journal_mode = WAL');
  const db = {
    execSync: (s: string) => void tap(s, () => sql.exec(s)),
    runSync: (s: string, ...p: (string | number | null)[]) =>
      tap(s, () => sql.prepare(s).run(...p)),
    getFirstSync: <T>(s: string, ...p: (string | number | null)[]) =>
      (sql.prepare(s).get(...p) ?? null) as T | null,
    getAllSync: <T>(s: string, ...p: (string | number | null)[]) => sql.prepare(s).all(...p) as T[],
    isInTransactionSync: () => sql.isTransaction,
  };
  const one = (q: string) => Object.values(sql.prepare(q).get()!)[0];
  return { sql, story: openStory(db, story.fresh, SCOPE, story.ids), one };
}
const save = () => join(mkdtempSync(join(tmpdir(), 'loka-s1-')), 'save.db');
const invocation = (n: number, action_key: string, target_ids: string[], token?: string) => ({
  invocation_id: `00000000-0000-4000-8000-00000000000${n}`,
  action_key,
  actor_id: ACTOR,
  target_ids,
  input: {},
  ...(token && { view_freshness_token: token }),
});
const take = invocation(1, 'take', [SATCHEL], 'view-1');
const outcome = (r: Reply) => (r as Saved).decision as { outcome: string };
const saved = (r: Reply) => [(r as Saved).replay, (r as Saved).revision];
// dusk's pick_lock; its draw leaves numeric-vectors.json rng_steps[4].state.
const pick = invocation(2, 'pick_lock', []);
const after = [15224335, 29364750, 272377353, 1125134346];

/**
 * The save's game trace, every record valid against the ObservationRecord contract, a trace.run
 * header first whose ids and world every entry shares (ADR-075 §4, the relationships a schema
 * cannot state); per entry: ordinal, the revision decided against, commit state and revision.
 */
function traced(p: { sql: DatabaseSync }) {
  const rows = p.sql.prepare('SELECT record FROM trace ORDER BY rowid').all();
  const [head, ...entries] = rows.map((r) => JSON.parse(r.record as string));
  for (const r of [head, ...entries]) assert.deepEqual(validate('ObservationRecord', r), []);
  assert.equal(head.event, 'trace.run');
  for (const e of entries) {
    const { command_id, revision, ...shared } = e.ids;
    assert.deepEqual([shared, e.data.command.id], [head.ids, command_id]);
    assert.equal(e.data.command.world_context_id, head.data.world_context_id);
  }
  return entries.map((e) => [
    e.data.ordinal,
    e.ids.revision,
    e.data.commit.state,
    e.data.commit.revision ?? null,
  ]);
}
const state = (p: { story: { world: () => { state: unknown } } }) =>
  encode(p.story.world().state as never);

// The child of the kill test: `kill <save> commit|trace` opens the save, then takes the satchel and
// SIGKILLs itself right after the real COMMIT (before memory adopts it) or as the first trace row
// is written (memory adopted, no reply yet).
if (process.argv[2] === 'kill') {
  const [path, at] = process.argv.slice(3) as [string, string];
  let armed = false;
  const die = () => process.kill(process.pid, 'SIGKILL');
  const p = processOn(path, items, 0, (s, run) => {
    if (armed && at === 'trace' && s.startsWith('INSERT INTO trace')) die();
    const out = run();
    if (armed && at === 'commit' && s === 'COMMIT') die();
    return out;
  });
  armed = true;
  p.story.invoke(take);
  process.exit(1); // not killed: the parent sees no SIGKILL
}

// Breaks: load returning the fresh world, changed rows, clock or RNG not written, or the revision
// not persisted; a receipted rejection traced as advancing the revision (ADR-075 §4 matrix).
test('a tiny world survives a restart with the same state', () => {
  const path = save();
  const a = processOn(path);
  const give = a.story.invoke(invocation(2, 'give', [SATCHEL, NPC])); // not held yet: not_owned
  assert.deepEqual(
    [...saved(give), ((give as Saved).decision as { kind: string }).kind],
    [false, 0, 'rejected'],
  );
  assert.equal((a.story.invoke(take) as Saved).revision, 1);
  const before = state(a);
  assert.ok(before.includes(`"${SATCHEL}":"${BODY}"`));
  a.sql.close();
  const b = processOn(path);
  assert.equal(state(b), before);
  assert.equal(b.one('SELECT revision FROM head'), 1);
  assert.deepEqual(traced(b), [
    [1, 0, 'committed', 0],
    [2, 0, 'committed', 1],
  ]);
});

// Breaks (03 §14): the receipt looked up after resolving against the current world (the satchel
// was given away), a replay that decides again or reports the current revision, the view token in
// the match, altered intent replayed or applied instead of refused, or a receipt of another
// intent_digest_version compared as if it were this one.
test('a retried consumed take replays its receipt; altered intent is a conflict', () => {
  const path = save();
  const a = processOn(path);
  const first = a.story.invoke(take);
  assert.equal(outcome(first).outcome, 'taken');
  a.sql.close();
  const b = processOn(path);
  const give = b.story.invoke(invocation(2, 'give', [SATCHEL, NPC]));
  assert.deepEqual([outcome(give).outcome, (give as Saved).revision], ['given', 2]);
  const before = b.story.world();
  const retry = b.story.invoke({ ...take, view_freshness_token: 'stale' });
  assert.deepEqual(retry, { ...first, replay: true });
  const altered = { ...invocation(1, 'give', [SATCHEL, NPC]) };
  assert.deepEqual(b.story.invoke(altered), { kind: 'conflict' });
  b.sql.exec("UPDATE receipt SET intent_digest_version = 'loka-intent-v0'");
  assert.deepEqual(b.story.invoke(take), { kind: 'conflict' });
  assert.equal(b.story.world(), before);
  assert.equal(b.one('SELECT count(*) FROM receipt'), 2);
  assert.equal(b.one('SELECT revision FROM head'), 2);
});

// Breaks (04 §5.0; 03 §14; ADR-075 §4): a failed attempt not committing its draw, a rejection
// advancing the revision or getting no receipt, a replay drawing again, or the receipt without its
// intent digest version, or the clock not saved; a replay or restart tracing a command again.
test('a failed attempt and a rejection persist; their retries draw nothing', () => {
  const path = save();
  const dance = invocation(3, 'dance', []);
  const a = processOn(path, dusk);
  const failed = a.story.invoke(pick);
  assert.deepEqual([(failed as Saved).revision, outcome(failed).outcome], [1, 'failure']);
  const rejected = a.story.invoke(dance);
  assert.deepEqual(rejected, {
    kind: 'saved',
    replay: false,
    revision: 1,
    decision: { kind: 'rejected', error: { code: 'unsupported_capability' } },
  });
  const before = state(a);
  a.sql.close();
  const b = processOn(path, dusk);
  assert.equal(state(b), before);
  assert.deepEqual(b.story.world().state.rng, after);
  assert.equal(b.story.world().state.clock, dusk.fresh.state.clock + 600); // pick_lock's duration
  assert.deepEqual(b.story.invoke(pick), { ...failed, replay: true });
  assert.deepEqual(b.story.invoke(dance), { ...rejected, replay: true });
  assert.deepEqual(b.story.world().state.rng, after);
  assert.equal(b.one('SELECT rng FROM head'), JSON.stringify(after));
  assert.equal(b.one('SELECT DISTINCT intent_digest_version FROM receipt'), 'loka-intent-v1');
  assert.deepEqual(traced(b), [[1, 0, 'committed', 1]]); // dance, rejected before a Command: none
});

// Breaks (03 §15; ADR-072): memory adopted before COMMIT, a partial write surviving the failed
// transaction, or saved success reported. A 512-byte page makes the receipt need new pages, which
// max_page_count forbids: a real SQLITE_FULL (storage lessons). Lifting it, the same id commits
// as NEW, since a definite rollback left no receipt.
test('a definite write failure leaves memory and storage at the prior revision', () => {
  const p = processOn(save(), items, 512);
  const before = p.story.world();
  const rows = p.one('SELECT group_concat(key || value) FROM state_row ORDER BY key');
  p.sql.exec(`PRAGMA max_page_count = ${p.one('PRAGMA page_count')}`);
  assert.throws(() => p.story.invoke(take), { errcode: 13 }); // SQLITE_FULL
  assert.equal(p.story.world(), before);
  assert.equal(p.one('SELECT count(*) FROM receipt'), 0);
  assert.equal(p.one('SELECT revision FROM head'), 0);
  assert.equal(p.one('SELECT group_concat(key || value) FROM state_row ORDER BY key'), rows);
  p.sql.exec('PRAGMA max_page_count = 1000000');
  const retry = p.story.invoke(take) as { replay: boolean; revision: number };
  assert.deepEqual(
    [retry.replay, retry.revision, p.one('SELECT revision FROM head')],
    [false, 1, 1],
  );
});

// Breaks (04 §5.2 step 7; ADR-075 §4): a fault receipted, which would replay it forever, or its
// proposal adopted. The bell's ring_bell assigns a value its FactSpec does not allow
// (invocation.test.ts), which faults precondition_failed.
test('a fault changes nothing and gets no receipt', () => {
  const ok = world('cartridge_bell_hash.json', [1, 2, 3, 4]);
  const cartridge = structuredClone(ok.fresh.cartridge) as any;
  cartridge.recipes['ashmere_bell@0.0.1:recipe/ring_bell'].outcomes.success.sequence[0].value =
    'yes';
  const p = processOn(save(), { ...ok, fresh: { ...ok.fresh, cartridge } });
  const before = p.story.world();
  const ring = invocation(4, 'ring_bell', []);
  assert.deepEqual(p.story.invoke(ring), { kind: 'fault', code: 'precondition_failed' });
  assert.equal(p.story.world(), before);
  assert.equal(p.one('SELECT count(*) FROM receipt'), 0);
  assert.deepEqual(traced(p), [[1, 0, 'unavailable', null]]);
});

// Breaks (03 §15): an unknown first save presumed done, a COMMIT error presumed rolled back so
// memory stays at revision 0 (the retry decides and draws again, the next attempt decides at
// revision 1), or no unknown entry and follow-up at one ordinal. Simulated fault: the real
// COMMIT runs, then its acknowledgement is lost.
test('a lost COMMIT acknowledgement reconciles to the committed receipt', () => {
  let lose = true;
  const tap: Tap = (s, run) => {
    const out = run();
    if (!lose || s !== 'COMMIT') return out;
    lose = false;
    throw new Error('COMMIT acknowledgement lost');
  };
  const path = save();
  assert.throws(() => processOn(path, dusk, 0, tap), /first save unknown/);
  const p = processOn(path, dusk, 0, tap);
  lose = true;
  const first = p.story.invoke(pick);
  assert.deepEqual([...saved(first), outcome(first).outcome], [false, 1, 'failure']);
  assert.deepEqual(p.story.world().state.rng, after);
  assert.deepEqual(p.story.invoke(pick), { ...first, replay: true });
  assert.deepEqual(p.story.world().state.rng, after);
  assert.deepEqual(saved(p.story.invoke(invocation(3, 'pick_lock', []))), [false, 2]);
  assert.deepEqual(traced(p), [
    [1, 0, 'unknown', null],
    [1, 0, 'committed', 1],
    [2, 1, 'committed', 2],
  ]);
});

// Breaks (03 §15; storage lessons): reconcile reading the attempt's own uncommitted receipt inside
// the still-open transaction (a false save), a failed COMMIT reported as saved or adopted, or the
// retry refused. A deferred foreign-key violation fails the real COMMIT and leaves it open; the
// two ROLLBACKs after it are made to fail (simulated), so the outcome stays unknown once.
test('a genuinely failed COMMIT reconciles to not committed; the retry is a fresh attempt', () => {
  let jams = 0;
  const p = processOn(save(), items, 0, (s, run) => {
    if (!jams || s !== 'ROLLBACK') return run();
    jams -= 1;
    throw new Error('ROLLBACK failed');
  });
  p.sql.exec(`PRAGMA foreign_keys = ON; CREATE TABLE parent (id INTEGER PRIMARY KEY);
    CREATE TABLE orphan (id INTEGER REFERENCES parent DEFERRABLE INITIALLY DEFERRED);
    CREATE TRIGGER orphaned AFTER INSERT ON receipt BEGIN INSERT INTO orphan VALUES (1); END;`);
  const before = p.story.world();
  jams = 2;
  assert.deepEqual(p.story.invoke(take), { kind: 'pending' });
  assert.throws(() => p.story.invoke(take), /nothing was saved/); // settles, then fails anew
  assert.equal(p.story.world(), before);
  assert.deepEqual(
    [p.one('SELECT count(*) FROM receipt'), p.one('SELECT revision FROM head')],
    [0, 0],
  );
  p.sql.exec('DROP TRIGGER orphaned');
  assert.deepEqual(saved(p.story.invoke(take)), [false, 1]);
  assert.deepEqual(traced(p), [
    [1, 0, 'unknown', null],
    [1, 0, 'failed', null],
    [2, 0, 'unknown', null],
    [2, 0, 'failed', null],
    [3, 0, 'committed', 1],
  ]);
});

// Breaks (03 §15): a call decided or answered while the COMMIT outcome is unknown, memory adopting
// the unconfirmed attempt, or a restart that does not load the commit or recover its trace entry.
// Simulated fault: the connection breaks right after the real COMMIT.
test('while the COMMIT outcome is unknown every call is fenced; a restart settles it', () => {
  const path = save();
  let arm = false;
  const a = processOn(path, items, 0, (s, run) => {
    const out = run();
    if (!arm || s !== 'COMMIT') return out;
    arm = false;
    a.sql.close();
    throw new Error('connection lost');
  });
  const before = a.story.world();
  arm = true;
  assert.deepEqual(a.story.invoke(take), { kind: 'pending' });
  assert.deepEqual(a.story.invoke(invocation(2, 'give', [SATCHEL, NPC])), { kind: 'pending' });
  assert.equal(a.story.world(), before);
  const b = processOn(path);
  assert.deepEqual(saved(b.story.invoke(take)), [true, 1]);
  assert.deepEqual(traced(b), [[1, 0, 'committed', 1]]);
});

// Breaks (OFF-03-05; ADR-075 §4): the trace written before or inside the commit, a restart not
// loading the commit or not recovering its missing entry, or recovery writing it twice.
test('a process killed after COMMIT restarts with the take once and its trace entry once', () => {
  for (const at of ['commit', 'trace']) {
    const path = save();
    const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), 'kill', path, at]);
    assert.equal(child.signal, 'SIGKILL', `${at}: ${child.stderr}`);
    const b = processOn(path);
    const retry = b.story.invoke(take);
    assert.deepEqual([...saved(retry), outcome(retry).outcome], [true, 1, 'taken']);
    b.sql.close();
    assert.deepEqual(traced(processOn(path)), [[1, 0, 'committed', 1]]);
  }
});

// Breaks (ADR-075 §4): no entry for a definite failure or one traced as unknown, the trace written
// inside the gameplay transaction, a trace failure reaching the player, or its missed entry
// recovered after a later command's (replay by ordinal would then run give before take).
test('a definite failure is traced once; a failed trace write changes nothing', () => {
  const path = save();
  const a = processOn(path);
  const raise = (table: string) =>
    `CREATE TRIGGER t BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT, 'no space'); END`;
  a.sql.exec(raise('receipt'));
  assert.throws(() => a.story.invoke(take), /no space/);
  a.sql.exec(`DROP TRIGGER t; ${raise('trace')}`);
  assert.deepEqual(saved(a.story.invoke(take)), [false, 1]);
  a.sql.exec('DROP TRIGGER t');
  assert.deepEqual(saved(a.story.invoke(invocation(2, 'give', [SATCHEL, NPC]))), [false, 2]);
  a.sql.close();
  assert.deepEqual(traced(processOn(path)), [
    [1, 0, 'failed', null],
    [2, 0, 'committed', 1],
    [3, 1, 'committed', 2],
  ]);
});
