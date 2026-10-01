// Save identity, bookmarks and recovery checkpoints (10 §§31-32; 07 §9; OFF-07) on Node with real
// SQLite (node:sqlite) in WAL mode, one connection per simulated process, as local_story.test.ts.
// Expected values are literals from the fixtures named beside them, never from the code under test.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import type { RngState, WorldContextId } from '../../../kernel/ts/src/contracts.gen.ts';
import { loadCartridge, newWorld, type Cartridge } from '../../../kernel/ts/src/index.ts';
import { encode } from '../../../kernel/ts/src/canonical.ts';
import { sha256Hex, utf8 } from '../../../kernel/ts/src/sha256.ts';
import { validate } from '../../../kernel/ts/src/validate.ts';
import { INSTALLED } from '../../../kernel/ts/src/world.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { openStory } from './authority.ts';

// protocol/fixtures/cartridge_dusk_hash.json, seeded with numeric-vectors.json rng_steps[3].state:
// its pick_lock draws once and fails (kernel/ts/test/invocation_cases.json), taking 600 time.
const kat = read('protocol/fixtures/cartridge_dusk_hash.json');
const SEED = [27274249, 25704967, 31982592, 12605441];
const AFTER = [15224335, 29364750, 272377353, 1125134346]; // rng_steps[4].state
// The next xoshiro128** 1.1 state after AFTER, by an independent Python implementation (checked
// to step rng_steps[3] to [4]).
const NEXT = [1110993931, 286554632, 2431677446, 2165318166];
const ACTOR = 'bd595711-ea5f-89a5-abb0-046cd349d2f9';
// A pending job (the job.schedule example of the delta contract), due long after any pick.
const JOB = '66666666-7777-8888-8999-aaaaaaaaaaaa';
const JOBS = {
  [JOB]: {
    due_time: 86400,
    job: {
      cartridge_id: 'ashmere_dusk',
      cartridge_version: '0.0.1',
      key: 'bram_to_green',
      kind: 'schedule',
    },
    status: 'pending',
  },
};
const fresh = (() => {
  const artifact = `{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`;
  const loaded = loadCartridge(new TextEncoder().encode(artifact), INSTALLED);
  assert.ok(loaded.ok);
  const context = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as WorldContextId;
  const w = newWorld(loaded.cartridge as Cartridge, context, SEED as unknown as RngState);
  return { ...w, state: { ...w.state, jobs: JOBS } as typeof w.state };
})();
const KERNEL = `loka-kernel@${'0123456789'.repeat(4)}`;
/** The n-th id a test's allocator hands out. */
const id = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ids = () => {
  let n = 0;
  return () => id(++n);
};
const none = (): string => assert.fail('allocated a new id');

type Tap = (statement: string, run: () => unknown) => unknown;
/** A process on the save at `path`: one connection, expo-sqlite's sync names, `tap` faults. */
function processOn(
  path: string,
  { newId = none, tap = ((_, run) => run()) as Tap, hash = kat.sha256, world = fresh } = {},
) {
  const sql = new DatabaseSync(path);
  sql.exec('PRAGMA journal_mode = WAL');
  type P = (string | number | null)[];
  const db = {
    execSync: (s: string) => void tap(s, () => sql.exec(s)),
    runSync: (s: string, ...p: P) => tap(s, () => sql.prepare(s).run(...p)),
    getFirstSync: <T>(s: string, ...p: P) => tap(s, () => sql.prepare(s).get(...p) ?? null) as T,
    getAllSync: <T>(s: string, ...p: P) => tap(s, () => sql.prepare(s).all(...p)) as T[],
    isInTransactionSync: () => sql.isTransaction,
  };
  const opened = openStory(db, world, { content_hash: hash, kernel_version: KERNEL, newId });
  const one = (q: string) => Object.values(sql.prepare(q).get() ?? {})[0];
  const all = (q: string) =>
    sql
      .prepare(q)
      .all()
      .map((r) => Object.values(r));
  const story = opened as Extract<typeof opened, { kind: 'open' }>;
  return { sql, opened, story, one, all };
}
const save = () => join(mkdtempSync(join(tmpdir(), 'loka-s3a-')), 'save.db');
const pick = (n: number) => ({
  invocation_id: `00000000-0000-4000-8000-00000000000${n}`,
  action_key: 'pick_lock',
  actor_id: ACTOR,
  target_ids: [],
  input: {},
});
/** Everything the save holds but the trace: head, rows, identity, receipts and snapshots. */
const stored = (p: ReturnType<typeof processOn>) =>
  ['head', 'state_row', 'save', 'receipt', 'snapshot'].map((t) => p.all(`SELECT * FROM ${t}`));
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
// The state after the first pick: the body in the landing (cartridge_dusk_hash.json entry room),
// the job, the clock at 600 and RNG at AFTER; hand-written canonical JSON (sorted keys).
const STATE = `{"clock":600,"containers":{"3d4829ad-9e43-81ef-bc10-66b1b267e157":"1a7c3699-2844-8a55-b29f-eac079c7bf50"},"jobs":{"${JOB}":{"due_time":86400,"job":{"cartridge_id":"ashmere_dusk","cartridge_version":"0.0.1","key":"bram_to_green","kind":"schedule"},"status":"pending"}},"rng":[${AFTER}]}`;
const BOOKMARK = `{"lineage_id":"${id(1)}","revision":1,"run_id":"${id(2)}","state":${STATE}}`;

// The pin of a dusk save: the fixture's manifest, lock and hash; no profile version is exposed.
const PIN = {
  cartridge_id: 'ashmere_dusk',
  cartridge_version: '0.0.1',
  content_hash: kat.sha256,
  capability_lock: JSON.parse(kat.canonical).lock,
  rule_ir: 1,
  numeric_profile: null,
  rng_profile: null,
};
// After the second pick: the clock at 1200 and the RNG at NEXT.
const STATE2 = STATE.replace('"clock":600', '"clock":1200').replace(`[${AFTER}]`, `[${NEXT}]`);
const snapshot = (lineage: number, revision: number, state: string) =>
  `{"lineage_id":"${id(lineage)}","revision":${revision},"run_id":"${id(lineage + 1)}","state":${state}}`;
const parent = (lineage: number, revision: number) =>
  `{"lineage_id":"${id(lineage)}","revision":${revision},"run_id":"${id(lineage + 1)}"}`;
const FLIP = `UPDATE snapshot SET bytes = replace(bytes, '"clock":600', '"clock":700')`;
const TRACE = 'SELECT record FROM trace ORDER BY rowid';
/** Per trace record: its run, then the header's initial state or the entry's ordinal and state. */
const traced = (p: ReturnType<typeof processOn>) =>
  p.all(TRACE).map(([r]) => {
    const { event, ids, data } = JSON.parse(r as string);
    assert.deepEqual(validate('ObservationRecord', JSON.parse(r as string)), []);
    return event === 'trace.run'
      ? [ids.run_id, data.initial_state.state]
      : [ids.run_id, data.ordinal, data.commit.state];
  });
/** A lost COMMIT acknowledgement once `arm()`ed, whose first reconcile read then fails too. */
const lostAck = () => {
  let stage = 0;
  const tap: Tap = (s, run) => {
    if (stage === 2 && s.startsWith('SELECT')) {
      stage = 3;
      throw new Error('read failed');
    }
    const out = run();
    if (stage === 1 && s === 'COMMIT') {
      stage = 2;
      throw new Error('COMMIT acknowledgement lost');
    }
    return out;
  };
  return { tap, arm: () => (stage = 1) };
};

/** A save allocated ids 1 and 2, picked once (revision 1) and bookmarked in slot 1. */
function bookmarked(path = save(), tap?: Tap) {
  const p = processOn(path, { newId: ids(), ...(tap && { tap }) });
  p.story.invoke(pick(1));
  assert.deepEqual(p.story.bookmark(1, 'At the gate'), { kind: 'bookmarked' });
  return p;
}

// Breaks (10 §§31-32; pin 8): ids fixed or not persisted; reallocated on a restart or a receipt
// replay; the scope not derived from the lineage and actor; the pin not written or incomplete.
test('a new save allocates and pins its identity; a restart and a replay reuse it', () => {
  const path = save();
  const a = processOn(path, { newId: ids() });
  a.story.invoke(pick(1));
  const row = ['loka-save-v1', id(1), id(2), 'null', `[${SEED}]`, encode(PIN)];
  assert.deepEqual(a.all('SELECT format, lineage_id, run_id, parent, seed, pin FROM save'), [row]);
  a.sql.close();
  const b = processOn(path);
  assert.equal((b.story.invoke(pick(1)) as { replay: boolean }).replay, true);
  assert.deepEqual(b.all('SELECT format, lineage_id, run_id, parent, seed, pin FROM save'), [row]);
  assert.equal(b.one('SELECT DISTINCT scope FROM receipt'), `story/${id(1)}/${ACTOR}`);
});

// Breaks (10 §31; 00a "save/restore preserves jobs and RNG"): a bookmark missing a section (jobs),
// the RNG, clock or revision, not canonical, or stored without its sha256.
test('a bookmark stores the canonical whole state and its sha256', () => {
  const p = bookmarked();
  const [label, bytes, digest] = p.all('SELECT label, bytes, sha256 FROM snapshot')[0]!;
  assert.deepEqual([label, bytes, digest], ['At the gate', BOOKMARK, sha(BOOKMARK)]);
});

// A measurement, not a check: a bookmark of a state of about 730 KB (AGENTS.md: such a checkpoint
// took about 490 ms on a Pixel 3a), split into encode, sha256 and the rest (mostly the write).
test('bookmark time on a large state', (t) => {
  const job = JOBS[JOB];
  const jobs = Object.fromEntries([...Array(4300)].map((_, n) => [id(n), job]));
  const p = processOn(save(), {
    newId: ids(),
    world: { ...fresh, state: { ...fresh.state, jobs } as typeof fresh.state },
  });
  const time = (f: () => unknown) => {
    const t0 = performance.now();
    f();
    return performance.now() - t0;
  };
  const total = time(() => assert.deepEqual(p.story.bookmark(1, 'timed'), { kind: 'bookmarked' }));
  let text = '';
  const e = time(() => (text = encode({ revision: 0, state: p.story.world().state } as never)));
  const h = time(() => sha256Hex(utf8(text)));
  const ms = (x: number) => x.toFixed(1);
  t.diagnostic(
    `bookmark of ${text.length} B on Node: ${ms(total)} ms = encode ${ms(e)} + sha256 ${ms(h)} + write ${ms(total - e - h)}`,
  );
});

// Breaks (10 §31; pin 5): a restore keeping the old ids or recording no parent; the RNG, clock, jobs
// or revision not restored, so the next roll is not the bookmark's continuation; the head left not
// kept as a recovery checkpoint; receipts of the old lineage replayed in the new one; the new run
// opening no trace segment; memory or a restart not taking the restored head.
test('restoring a bookmark forks a new run that continues its RNG', () => {
  const path = save();
  const p = bookmarked(path);
  p.story.invoke(pick(2));
  assert.deepEqual(p.story.restore('bookmark', 1), { kind: 'restored', revision: 1 });
  const fork = [[id(3), id(4), parent(1, 1), `[${AFTER}]`]];
  assert.deepEqual(p.all('SELECT lineage_id, run_id, parent, seed FROM save'), fork);
  assert.equal(encode(p.story.world().state as never), STATE);
  assert.deepEqual(p.all("SELECT slot, bytes FROM snapshot WHERE kind = 'recovery'"), [
    [1, snapshot(1, 2, STATE2)],
  ]);
  const again = p.story.invoke(pick(2)) as { replay: boolean; revision: number };
  assert.deepEqual([again.replay, again.revision], [false, 2]);
  assert.equal(encode(p.story.world().state as never), STATE2);
  assert.deepEqual(traced(p), [
    [id(2), 'fresh'],
    [id(2), 1, 'committed'],
    [id(2), 2, 'committed'],
    [id(4), 'unavailable'],
    [id(4), 1, 'committed'],
  ]);
  p.sql.close();
  const b = processOn(path);
  assert.deepEqual(b.all('SELECT lineage_id, run_id, parent, seed FROM save'), fork);
  assert.equal(encode(b.story.world().state as never), STATE2);
});

// Breaks (10 §31; OFF-07; pin 5): a bookmark adopted without checking its sha256, or a failed check
// that still writes (the recovery checkpoint, new ids) or changes memory. One stored byte flipped.
test('a bookmark with one flipped byte is save_corrupt and changes nothing', () => {
  const p = bookmarked();
  p.sql.exec(FLIP);
  const [before, world] = [stored(p), p.story.world()];
  assert.deepEqual(p.story.restore('bookmark', 1), { kind: 'save_corrupt', snapshots: [] });
  assert.deepEqual(stored(p), before);
  assert.equal(p.story.world(), world);
});

// Breaks (pin 5; 03 §15): a restore while an attempt's COMMIT outcome is unknown that does not
// settle it first, so the committed pick is lost from the recovery checkpoint or traced under the
// new run.
test('a restore settles a pending attempt first, in the run it was made in', () => {
  const { tap, arm } = lostAck();
  const p = bookmarked(save(), tap);
  arm();
  assert.deepEqual(p.story.invoke(pick(2)), { kind: 'pending' });
  assert.deepEqual(p.story.restore('bookmark', 1), { kind: 'restored', revision: 1 });
  assert.deepEqual(p.all("SELECT bytes FROM snapshot WHERE kind = 'recovery'"), [
    [snapshot(1, 2, STATE2)],
  ]);
  assert.deepEqual(traced(p).slice(2), [
    [id(2), 2, 'unknown'],
    [id(2), 2, 'committed'],
    [id(4), 'unavailable'],
  ]);
});

// Breaks (03 §15; pin 5): memory adopting a restore whose COMMIT outcome is unknown, or, once it
// settles, play deciding under the old lineage's scope (a replay of pick 2) or tracing under the
// old run's header.
test('a restore whose COMMIT is unknown is fenced; settling it moves play to the new run', () => {
  const { tap, arm } = lostAck();
  const p = bookmarked(save(), tap);
  p.story.invoke(pick(2));
  const world = p.story.world();
  arm();
  assert.deepEqual(p.story.restore('bookmark', 1), { kind: 'pending' });
  assert.equal(p.story.world(), world);
  const next = p.story.invoke(pick(2)) as { replay: boolean; revision: number };
  assert.deepEqual([next.replay, next.revision], [false, 2]);
  assert.equal(p.one('SELECT scope FROM receipt ORDER BY rowid DESC'), `story/${id(3)}/${ACTOR}`);
  assert.deepEqual(traced(p).slice(3), [
    [id(4), 'unavailable'],
    [id(4), 1, 'committed'],
  ]);
});

// Breaks (10 §32; pin 2): a save opened under a cartridge that is not its pinned release, or that
// open writing anything (a trace segment, a new head).
test('a save opened with another content hash is refused and left untouched', () => {
  const path = save();
  const a = bookmarked(path);
  const before = [...stored(a), a.all(TRACE)];
  a.sql.close();
  const b = processOn(path, { hash: 'f'.repeat(64) });
  assert.deepEqual(b.opened, {
    kind: 'pinned_release_missing',
    pinned: PIN,
    offered: 'f'.repeat(64),
  });
  assert.deepEqual([...stored(b), b.all(TRACE)], before);
});

// Breaks (10 §31; pin 4): an empty, blank or 41-character label accepted, or 40 refused (by
// counting UTF-16 units or off by one); an untrimmed label stored; a slot outside 1..3 accepted; an
// occupied slot overwritten without an explicit replace.
test('bookmark labels and slots are checked; an occupied slot is replaced only on request', () => {
  const p = processOn(save(), { newId: ids() });
  const bad: [number, unknown][] = [
    [1, ''],
    [1, '  '],
    [1, 'x'.repeat(41)],
    [0, 'a'],
    [4, 'a'],
    [1, 5],
  ];
  for (const [slot, label] of bad)
    assert.deepEqual(p.story.bookmark(slot, label), { kind: 'invalid_bookmark' });
  const forty = 'x'.repeat(40);
  assert.deepEqual(p.story.bookmark(1, ` ${forty} `), { kind: 'bookmarked' });
  assert.deepEqual(p.story.bookmark(2, '🦊'.repeat(40)), { kind: 'bookmarked' });
  assert.deepEqual(p.story.bookmark(1, 'other'), { kind: 'occupied' });
  assert.equal(p.one('SELECT label FROM snapshot WHERE slot = 1'), forty);
  assert.deepEqual(p.story.bookmark(1, 'other', true), { kind: 'bookmarked' });
  assert.equal(p.one('SELECT label FROM snapshot WHERE slot = 1'), 'other');
});

/** Picks (revision 2) and restores bookmark 1 once per n, each restore taking a checkpoint. */
const cycle = (p: ReturnType<typeof processOn>, n: number) => {
  for (let i = 0; i < n; i++) {
    p.story.invoke(pick(2));
    assert.deepEqual(p.story.restore('bookmark', 1), { kind: 'restored', revision: 1 });
  }
};
const recovery = (p: ReturnType<typeof processOn>) =>
  p.all("SELECT slot, json_extract(bytes, '$.lineage_id') FROM snapshot WHERE kind = 'recovery'");

// Breaks (10 §31; pin 6): no cap; the newest checkpoint (the only copy of the head just left)
// evicted instead of the oldest; bookmarks evicted with checkpoints; restoring from the oldest
// checkpoint failing, or not forking, when all three are kept.
test('recovery checkpoints keep the newest three, never the one just taken', () => {
  const p = bookmarked();
  cycle(p, 4);
  assert.deepEqual(recovery(p), [
    [2, id(3)],
    [3, id(5)],
    [4, id(7)],
  ]);
  assert.equal(p.one("SELECT count(*) FROM snapshot WHERE kind = 'bookmark'"), 1);
  assert.deepEqual(p.story.restore('recovery', 2), { kind: 'restored', revision: 2 });
  assert.equal(encode(p.story.world().state as never), STATE2);
  assert.equal(p.one('SELECT parent FROM save'), parent(3, 2));
  assert.deepEqual(recovery(p), [
    [3, id(5)],
    [4, id(7)],
    [5, id(9)],
  ]);
});

// Breaks (10 §31: never discard the only working save; pin 5: one transaction): a fault part way
// through a restore, after the checkpoint and the new rows, leaving a mixed head, an evicted
// checkpoint, new ids or changed memory. Real fault: the identity row's update raises.
test('a restore that fails part way leaves the old head, its checkpoints and memory', () => {
  const p = bookmarked();
  cycle(p, 3);
  p.story.invoke(pick(2));
  const [before, world] = [stored(p), p.story.world()];
  p.sql.exec(`CREATE TRIGGER t BEFORE UPDATE ON save BEGIN SELECT RAISE(ABORT, 'I/O error'); END`);
  assert.throws(() => p.story.restore('bookmark', 1), /I\/O error/);
  assert.deepEqual(stored(p), before);
  assert.equal(p.story.world(), world);
});

// Breaks (OFF-07; pin 7): a head that does not parse replaced by the fresh world, or a snapshot
// adopted without the player's pick; a snapshot failing its sha256 offered; the pick not restoring
// the head as a fork of the snapshot's run.
test('a save whose head does not parse is save_corrupt and offers what verifies', () => {
  const path = save();
  const a = bookmarked(path);
  a.story.bookmark(2, 'flipped');
  a.sql.exec(`${FLIP} WHERE slot = 2`);
  a.story.invoke(pick(2));
  a.story.restore('bookmark', 1);
  a.sql.exec(`UPDATE state_row SET value = '{' WHERE section = 'jobs'`);
  const before = stored(a);
  a.sql.close();
  let n = 8;
  const b = processOn(path, { newId: () => id(++n) });
  assert.equal(b.opened.kind, 'save_corrupt');
  const corrupt = b.opened as Extract<typeof b.opened, { kind: 'save_corrupt' }>;
  assert.deepEqual(
    corrupt.snapshots.map((r) => ({ ...r })),
    [
      { kind: 'bookmark', slot: 1, label: 'At the gate' },
      { kind: 'recovery', slot: 1, label: null },
    ],
  );
  assert.deepEqual(stored(b), before);
  assert.deepEqual(corrupt.restore('recovery', 1), { kind: 'restored' });
  b.sql.close();
  const c = processOn(path);
  assert.equal(encode(c.story.world().state as never), STATE2);
  assert.deepEqual(c.all('SELECT lineage_id, run_id, parent FROM save'), [
    [id(9), id(10), parent(1, 2)],
  ]);
});
