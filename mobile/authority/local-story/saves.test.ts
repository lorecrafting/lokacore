// The save's identity and pin, a new game, and a corrupt save (10 §§31-32 as amended; 07 §9;
// OFF-07) on Node with real SQLite (node:sqlite) in WAL mode, one connection per simulated
// process, as local_story.test.ts. Expected values are literals from the fixtures named beside
// them, never from the code under test.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import type { RngState, WorldContextId } from '../../../kernel/ts/src/contracts.gen.ts';
import { loadCartridge, newWorld, type Cartridge } from '../../../kernel/ts/src/index.ts';
import { encode } from '../../../kernel/ts/src/canonical.ts';
import { validate } from '../../../kernel/ts/src/validate.ts';
import { INSTALLED } from '../../../kernel/ts/src/world.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { openStory } from './authority.ts';

// protocol/fixtures/cartridge_dusk_hash.json, seeded with numeric-vectors.json rng_steps[3].state:
// its pick_lock draws once and fails (kernel/ts/test/invocation_cases.json), taking 600 time.
const kat = read('protocol/fixtures/cartridge_dusk_hash.json');
const SEED = [27274249, 25704967, 31982592, 12605441];
const AFTER = [15224335, 29364750, 272377353, 1125134346]; // rng_steps[4].state
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
/** An installed release: the fixture's cartridge, fresh from `seed`, plus `extra` sections. */
const release = (fixture: { canonical: string; sha256: string }, seed: number[], extra = {}) => {
  const artifact = `{"cartridge":${fixture.canonical},"content_hash":"${fixture.sha256}"}`;
  const loaded = loadCartridge(new TextEncoder().encode(artifact), INSTALLED);
  assert.ok(loaded.ok);
  const context = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as WorldContextId;
  const w = newWorld(loaded.cartridge as Cartridge, context, seed as unknown as RngState);
  const fresh = { ...w, state: { ...w.state, ...extra } as typeof w.state };
  return { content_hash: fixture.sha256, fresh };
};
const dusk = release(kat, SEED, { jobs: JOBS });
// Two other real releases, for an app update (protocol/fixtures): neither has pick_lock.
const bell = release(read('protocol/fixtures/cartridge_bell_hash.json'), [1, 2, 3, 4]);
const BELL = bell.content_hash;
const items = release(read('protocol/fixtures/cartridge_items_hash.json'), [1, 2, 3, 4]);
type Releases = Parameters<typeof openStory>[1];
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
  { newId = none, tap = ((_, run) => run()) as Tap, releases = [dusk] as Releases } = {},
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
  const opened = openStory(db, releases, { kernel_version: KERNEL, newId });
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
/** The save file's bytes, by hash; read with no connection open (WAL checkpointed). */
const bytes = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
/** The content hash the save is pinned to. */
const pinned = (p: ReturnType<typeof processOn>) =>
  JSON.parse(p.one('SELECT pin FROM save') as string).content_hash;
/** A result without its newGame function. */
const typed = ({ newGame: _, ...rest }: { newGame?: unknown }) => rest;
// After an app update dropping dusk: bell newest, then items.
const LATER: Releases = [bell, items];
/** The player's new game from a save that did not open; reopened, it plays the newest release. */
function startOver(path: string) {
  const c = processOn(path, { newId: ids(), releases: LATER });
  assert.deepEqual((c.opened as { newGame: () => unknown }).newGame(), { kind: 'replaced' });
  c.sql.close();
  const d = processOn(path, { releases: LATER });
  const cartridge = d.story.world().cartridge.manifest.id;
  assert.deepEqual([d.opened.kind, pinned(d), cartridge], ['open', BELL, 'ashmere_bell']);
}
const pick = (n: number) => ({
  invocation_id: `00000000-0000-4000-8000-00000000000${n}`,
  action_key: 'pick_lock',
  actor_id: ACTOR,
  target_ids: [],
  input: {},
});
const saved = (r: unknown) => [
  (r as { replay: boolean }).replay,
  (r as { revision: number }).revision,
];
/** Everything the save holds but the trace: head, rows, identity and receipts. */
const stored = (p: ReturnType<typeof processOn>) =>
  ['head', 'state_row', 'save', 'receipt'].map((t) => p.all(`SELECT * FROM ${t}`));
const IDENTITY = 'SELECT format, lineage_id, run_id, parent, seed, pin FROM save';
// The pin of a dusk save: the fixture's manifest, lock and hash; no profile version is exposed.
const PIN = encode({
  cartridge_id: 'ashmere_dusk',
  cartridge_version: '0.0.1',
  content_hash: kat.sha256,
  capability_lock: JSON.parse(kat.canonical).lock,
  rule_ir: 1,
  numeric_profile: null,
  rng_profile: null,
});
const identity = (lineage: number) => [
  'loka-save-v1',
  id(lineage),
  id(lineage + 1),
  'null',
  `[${SEED}]`,
  PIN,
];
// The fresh world and the state after one pick (clock 600, RNG AFTER), hand-written canonical
// JSON: the body in the landing (cartridge_dusk_hash.json entry room) and the job.
const BODY = `"containers":{"3d4829ad-9e43-81ef-bc10-66b1b267e157":"1a7c3699-2844-8a55-b29f-eac079c7bf50"}`;
const job = `"jobs":{"${JOB}":{"due_time":86400,"job":{"cartridge_id":"ashmere_dusk","cartridge_version":"0.0.1","key":"bram_to_green","kind":"schedule"},"status":"pending"}}`;
const FRESH = `{"clock":0,${BODY},${job},"rng":[${SEED}]}`;
const PICKED = `{"clock":600,${BODY},${job},"rng":[${AFTER}]}`;
const state = (p: { story: { world: () => { state: unknown } } }) =>
  encode(p.story.world().state as never);
/** Per trace record: its run, then the header's initial state or the entry's ordinal and state. */
const traced = (p: ReturnType<typeof processOn>) =>
  p.all('SELECT record FROM trace ORDER BY rowid').map(([r]) => {
    const record = JSON.parse(r as string);
    assert.deepEqual(validate('ObservationRecord', record), []);
    const { event, ids, data } = record;
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

// Breaks (10 §§31-32; 07 §9; pin 8): ids fixed or not persisted; reallocated on a restart or a
// receipt replay; the scope not derived from the lineage and actor; the pin not written or
// incomplete; a restart losing the jobs section or the RNG (00a "save/restore preserves jobs and
// RNG").
test('a new save allocates and pins its identity; a restart and a replay reuse it', () => {
  const path = save();
  const a = processOn(path, { newId: ids() });
  a.story.invoke(pick(1));
  assert.deepEqual(a.all(IDENTITY), [identity(1)]);
  a.sql.close();
  const b = processOn(path);
  assert.equal(state(b), PICKED);
  assert.deepEqual(saved(b.story.invoke(pick(1))), [true, 1]);
  assert.deepEqual(b.all(IDENTITY), [identity(1)]);
  assert.equal(b.one('SELECT DISTINCT scope FROM receipt'), `story/${id(1)}/${ACTOR}`);
});

// Breaks (10 §32 "Missing required package"; OFF-11): a save opened under a release that is not
// its pin (the newest), or that open writing anything (a trace segment, a new head); the player's
// new game from it missing, or not pinning the newest release.
test('a save whose pinned release is missing is refused untouched; a new game moves on', () => {
  const path = save();
  const a = processOn(path, { newId: ids() });
  a.story.invoke(pick(1));
  a.sql.close();
  const before = bytes(path);
  const b = processOn(path, { releases: LATER });
  const missing = {
    kind: 'pinned_release_missing',
    pinned: JSON.parse(PIN),
    installed: [BELL, items.content_hash],
  };
  assert.deepEqual(typed(b.opened as never), missing);
  b.sql.close();
  assert.equal(bytes(path), before);
  startOver(path);
});

// Breaks (07 §9 save format version; 10 §32): a save of another format read or opened (as corrupt,
// or by its pin), or a table created for it, before its format is checked; no new game from it.
test('a save of an unknown format is refused with nothing written; a new game moves on', () => {
  const unsupported = {
    kind: 'unsupported_save_format',
    format: 'loka-save-v2',
    supported: ['loka-save-v1'],
  };
  // A newer app's save, pinned to dusk: another format, without a table this one creates; then
  // also a renamed identity column (its new game is the carried case: replace() throws).
  for (const newer of ['DROP TABLE trace', 'ALTER TABLE save RENAME COLUMN pin TO pins']) {
    const path = save();
    const a = processOn(path, { newId: ids() });
    a.story.invoke(pick(1));
    a.sql.exec(`UPDATE save SET format = 'loka-save-v2'; ${newer}`);
    a.sql.close();
    const before = bytes(path);
    const b = processOn(path, { releases: LATER });
    assert.deepEqual(typed(b.opened as never), unsupported, newer);
    b.sql.close();
    assert.equal(bytes(path), before);
    if (newer.startsWith('DROP')) startOver(path);
  }
});

// Breaks (10 §32; OFF-11): after an app update adds a newer release, a save reopened on the newest
// (bell has no pick_lock: the pick is rejected) or re-pinned, its trace entry under the newest
// release's hash; a new game, or a new save, pinning the old release or keeping its world.
test('an app update reopens a save on its pinned release; new games pin the newest', () => {
  const path = save();
  processOn(path, { newId: ids() }).sql.close();
  const b = processOn(path, { newId: ids(), releases: [bell, dusk] });
  assert.deepEqual(saved(b.story.invoke(pick(1))), [false, 1]);
  assert.equal(state(b), PICKED);
  assert.deepEqual(b.all(IDENTITY), [identity(1)]);
  const entry = JSON.parse(b.one('SELECT record FROM trace ORDER BY rowid DESC LIMIT 1') as string);
  assert.equal(entry.ids.content_hash, kat.sha256);
  assert.deepEqual(b.story.newGame(), { kind: 'replaced' });
  assert.deepEqual([pinned(b), b.story.world().cartridge.manifest.id], [BELL, 'ashmere_bell']);
  const c = processOn(save(), { newId: ids(), releases: [bell, dusk] });
  assert.deepEqual([pinned(c), c.story.world().cartridge.manifest.id], [BELL, 'ashmere_bell']);
});

// Breaks (OFF-07): a head that does not parse replaced by the fresh world or opened at all; a
// corrupt save under a release not installed reported corrupt, not missing; a save missing its
// head (or head and identity) taken for an empty one and overwritten; a head RNG of the wrong
// shape opened; the player's new game not making a playable save
// with new ids or its trace segment not starting fresh.
test('a save that does not parse is save_corrupt until the player starts a new game', () => {
  const path = save();
  const a = processOn(path, { newId: ids() });
  a.story.invoke(pick(1));
  a.sql.exec(`UPDATE state_row SET value = '{' WHERE section = 'jobs'`);
  const before = stored(a);
  a.sql.close();
  assert.equal(processOn(path, { releases: [bell] }).opened.kind, 'pinned_release_missing');
  const b = processOn(path, { newId: () => id(9) });
  assert.equal(b.opened.kind, 'save_corrupt');
  assert.deepEqual(stored(b), before);
  const lone = processOn(save(), { newId: ids() }); // a head without its identity row
  lone.sql.exec('DELETE FROM save');
  assert.equal(processOn(lone.sql.location()!).opened.kind, 'save_corrupt');
  for (const damage of [
    'DELETE FROM head; DELETE FROM save', // rows and receipts survive: not an empty database
    "UPDATE head SET rng = '[1,2]'", // parses, but is no RngState
  ]) {
    const other = processOn(save(), { newId: ids() });
    other.story.invoke(pick(1));
    other.sql.exec(damage);
    const before = stored(other);
    const reopened = processOn(other.sql.location()!);
    assert.equal(reopened.opened.kind, 'save_corrupt', damage);
    assert.deepEqual(stored(reopened), before);
  }
  b.sql.exec('DELETE FROM head');
  assert.equal(processOn(path).opened.kind, 'save_corrupt'); // never a new save over the rest
  b.sql.exec("UPDATE save SET pin = '{'"); // an unreadable identity: no pin to compare
  let n = 4;
  const c = processOn(path, { newId: () => id(++n) });
  assert.equal(c.opened.kind, 'save_corrupt');
  const corrupt = c.opened as Extract<typeof c.opened, { kind: 'save_corrupt' }>;
  assert.deepEqual(corrupt.newGame(), { kind: 'replaced' });
  c.sql.close();
  const d = processOn(path);
  assert.equal(state(d), FRESH);
  assert.deepEqual(d.all(IDENTITY), [identity(5)]);
  assert.deepEqual(traced(d).at(-1), [id(6), 'fresh']);
});

// Breaks (10 §31 as amended; pin 8): a new game keeping the old state (a row the old game wrote), ids or receipts (an old
// invocation id then replays the old answer), not persisted, or its run's trace not opening with
// a fresh header.
test('a new game replaces the save; an old invocation id is new again', () => {
  const path = save();
  const a = processOn(path, { newId: ids() });
  a.story.invoke(pick(1));
  a.sql.exec(`INSERT INTO state_row VALUES ('facts', 'k', 'true')`); // one a fresh world lacks
  assert.deepEqual(a.story.newGame(), { kind: 'replaced' });
  assert.equal(state(a), FRESH);
  a.sql.close();
  const b = processOn(path);
  assert.deepEqual(b.all(IDENTITY), [identity(3)]);
  assert.equal(state(b), FRESH);
  assert.deepEqual(saved(b.story.invoke(pick(1))), [false, 1]);
  assert.equal(b.one('SELECT DISTINCT scope FROM receipt'), `story/${id(3)}/${ACTOR}`);
  assert.deepEqual(traced(b), [
    [id(2), 'fresh'],
    [id(2), 1, 'committed'],
    [id(4), 'fresh'],
    [id(4), 1, 'committed'],
  ]);
});

// Breaks (10 §31: the save is replaced only whole; ADR-072 one transaction): a fault part way
// through a new game, after the fresh rows and identity, leaving a mixed save, lost receipts or
// changed memory. Real fault: deleting the receipts raises.
test('a new game that fails part way leaves the old save and memory', () => {
  const p = processOn(save(), { newId: ids() });
  p.story.invoke(pick(1));
  const [before, world] = [stored(p), p.story.world()];
  p.sql.exec(
    `CREATE TRIGGER t BEFORE DELETE ON receipt BEGIN SELECT RAISE(ABORT, 'I/O error'); END`,
  );
  assert.throws(() => p.story.newGame(), /I\/O error/);
  assert.deepEqual(stored(p), before);
  assert.equal(p.story.world(), world);
});

// Breaks (03 §15): a new game while an attempt's COMMIT outcome is unknown that does not settle it
// first, so the attempt is settled against the new save (traced as failed under the new run).
test('a new game settles a pending attempt first, in the run it was made in', () => {
  const { tap, arm } = lostAck();
  const p = processOn(save(), { newId: ids(), tap });
  arm();
  assert.deepEqual(p.story.invoke(pick(1)), { kind: 'pending' });
  assert.deepEqual(p.story.newGame(), { kind: 'replaced' });
  p.story.invoke(pick(2));
  assert.deepEqual(traced(p), [
    [id(2), 'fresh'],
    [id(2), 1, 'unknown'],
    [id(2), 1, 'committed'],
    [id(4), 'fresh'],
    [id(4), 1, 'committed'],
  ]);
});

// Breaks (03 §15): memory adopting a new game whose COMMIT outcome is unknown, or, once it
// settles, play deciding under the old lineage's scope (a replay of pick 1) or tracing under the
// old run's header.
test('a new game whose COMMIT is unknown is fenced; settling it moves play to the new run', () => {
  const { tap, arm } = lostAck();
  const p = processOn(save(), { newId: ids(), tap });
  p.story.invoke(pick(1));
  const world = p.story.world();
  arm();
  assert.deepEqual(p.story.newGame(), { kind: 'pending' });
  assert.equal(p.story.world(), world);
  assert.deepEqual(saved(p.story.invoke(pick(1))), [false, 1]);
  assert.equal(p.one('SELECT DISTINCT scope FROM receipt'), `story/${id(3)}/${ACTOR}`);
  assert.deepEqual(traced(p).slice(2), [
    [id(4), 'fresh'],
    [id(4), 1, 'committed'],
  ]);
});

// The definite COMMIT failure of the storage lessons: a deferred foreign-key violation, raised by
// the identity row's write, fails the real COMMIT; its ROLLBACK succeeds.
const FAIL_COMMIT = `PRAGMA foreign_keys = ON; CREATE TABLE parent (id INTEGER PRIMARY KEY);
  CREATE TABLE orphan (id INTEGER REFERENCES parent DEFERRABLE INITIALLY DEFERRED);
  CREATE TRIGGER orphaned AFTER INSERT ON save BEGIN INSERT INTO orphan VALUES (1); END;`;

// Breaks (03 §15; 10 §31): a new game whose COMMIT genuinely failed answered as replaced (or
// pending forever), memory or the save changed, or the old run's receipts no longer replaying.
test('a new game whose COMMIT fails keeps the old save, memory and receipts', () => {
  const p = processOn(save(), { newId: ids() });
  const first = p.story.invoke(pick(1));
  p.sql.exec(FAIL_COMMIT);
  const [before, world] = [stored(p), p.story.world()];
  assert.throws(() => p.story.newGame(), /nothing was replaced/);
  assert.deepEqual(stored(p), before);
  assert.equal(p.story.world(), world);
  assert.deepEqual(p.story.invoke(pick(1)), { ...(first as object), replay: true });
});

// Breaks (03 §15; ADR-072: memory after the commit): a committed new game whose adoption read
// fails thrown with memory still the old run (the next action then saves the old world over the
// new save), or a retry that replaces the save a second time under new ids.
test('a committed new game is adopted before play; a retry does not replace it twice', () => {
  let [armed, unread] = [false, false];
  const tap: Tap = (s, run) => {
    if (unread && s.startsWith('SELECT revision')) {
      unread = false;
      throw new Error('read failed');
    }
    const out = run();
    if (armed && s === 'COMMIT') [armed, unread] = [false, true];
    return out;
  };
  const p = processOn(save(), { newId: ids(), tap });
  p.story.invoke(pick(1));
  const world = p.story.world();
  armed = true;
  assert.deepEqual(p.story.newGame(), { kind: 'pending' });
  assert.equal(p.story.world(), world);
  assert.deepEqual(p.story.newGame(), { kind: 'replaced' });
  assert.deepEqual(p.all(IDENTITY), [identity(3)]);
  assert.deepEqual(saved(p.story.invoke(pick(1))), [false, 1]);
  assert.deepEqual([p.one('SELECT revision FROM head'), state(p)], [1, PICKED]);
});

// Breaks (OFF-07; 03 §15): the corrupt save's new game answering pending forever, or replaced, when
// its COMMIT genuinely failed; answering replaced while its outcome is unknown; or a retry after an
// unknown COMMIT that committed replacing it again under new ids.
test("a corrupt save's new game settles its COMMIT like any other", () => {
  const corrupted = (tap?: Tap) => {
    const path = save();
    const a = processOn(path, { newId: ids() });
    a.story.invoke(pick(1));
    a.sql.exec(`UPDATE state_row SET value = '{' WHERE section = 'jobs'`);
    a.sql.close();
    let n = 4;
    const p = processOn(path, { newId: () => id(++n), ...(tap && { tap }) });
    return { p, newGame: (p.opened as Extract<typeof p.opened, { kind: 'save_corrupt' }>).newGame };
  };
  const failing = corrupted();
  failing.p.sql.exec(FAIL_COMMIT);
  const before = stored(failing.p);
  assert.throws(() => failing.newGame(), /nothing was replaced/);
  assert.deepEqual(stored(failing.p), before);
  const { tap, arm } = lostAck();
  const lost = corrupted(tap);
  arm();
  assert.deepEqual(lost.newGame(), { kind: 'pending' });
  assert.deepEqual(lost.newGame(), { kind: 'replaced' });
  assert.deepEqual(lost.p.all(IDENTITY), [identity(5)]);
});

// Breaks (ADR-075 §4): with the trace unwritable across a new game and its first command, the
// reopen filing the new run's entry under the old run's header (a replay of the old run would
// apply it) instead of after the new run's own fresh header.
test("a new run's entries missed by the trace follow its own header", () => {
  const path = save();
  const a = processOn(path, { newId: ids() });
  a.story.invoke(pick(1));
  a.sql.exec(`CREATE TRIGGER t BEFORE INSERT ON trace BEGIN SELECT RAISE(ABORT, 'no space'); END`);
  assert.deepEqual(a.story.newGame(), { kind: 'replaced' });
  assert.deepEqual(saved(a.story.invoke(pick(1))), [false, 1]);
  a.sql.exec('DROP TRIGGER t');
  a.sql.close();
  assert.deepEqual(traced(processOn(path)), [
    [id(2), 'fresh'],
    [id(2), 1, 'committed'],
    [id(4), 'fresh'],
    [id(4), 1, 'committed'],
  ]);
});

// Breaks (03 §15): a retry recognised by a stale run id rather than by its own fence: after the
// pending new game settled through play, a later new game (behind another unknown COMMIT) answered
// replaced without replacing anything.
test('a new game after a settled one replaces the save again', () => {
  const { tap, arm } = lostAck();
  const p = processOn(save(), { newId: ids(), tap });
  arm();
  assert.deepEqual(p.story.newGame(), { kind: 'pending' });
  assert.deepEqual(saved(p.story.invoke(pick(1))), [false, 1]);
  arm();
  assert.deepEqual(p.story.invoke(pick(2)), { kind: 'pending' });
  assert.deepEqual(p.story.newGame(), { kind: 'replaced' });
  assert.deepEqual(p.all(IDENTITY), [identity(5)]);
});
