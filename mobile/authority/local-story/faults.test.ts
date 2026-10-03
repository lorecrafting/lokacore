// The fault corpus (14 §R6; OFF-03..07; 03 §§14-15; ADR-072): the kernel simulator's seeded command
// sequences (kernel/ts/test/sim.ts) played through the local authority on real SQLite (node:sqlite,
// the phone's rollback journal, no WAL), with real faults: SQLITE_FULL from a clamped
// max_page_count, a COMMIT a deferred foreign key fails, and a child process SIGKILLed just before
// or after its COMMIT, then the same invocation delivered again. Oracle: after each fault, memory
// and storage are exactly the revision before or after the faulted command, never between; no
// `saved` reply without its receipt durable; and the run then ends exactly as the same seed's
// fault-free run. That run is a metamorphic reference, allowed here because it is the independent
// fault-free execution of the same kernel path, not the code under test computing its own answer;
// the literal anchors below are hand-checked. A failing run's trace goes to tmp/obs/game_trace/
// (ADR-075 §2, CI artifact).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { mock, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolved } from '../../../kernel/ts/src/actions.ts';
import { encode } from '../../../kernel/ts/src/canonical.ts';
import type { Command } from '../../../kernel/ts/src/contracts.gen.ts';
import type { World } from '../../../kernel/ts/src/decision.ts';
import { append } from '../../../kernel/ts/play/obs.ts';
import { simulate } from '../../../kernel/ts/test/sim.ts';
import { openStory, type Reply } from './authority.ts';

// One seed per demo cartridge: bell, rooms, facts, items, dusk, details, road, errand (accepting
// its quest), gate, ferry (running Bram's job), green (delivering a reaction), the proof
// cartridge lantern_proof, and wear (wearing an item) (sim.ts picks by seed among the cartridge
// known answers, so a new cartridge remaps them). None emits an effect (no outbox is built yet);
// every sequence commits several NEW commands.
const SEEDS = [9, 15, 82, 7, 16, 10, 2, 44, 17, 40, 1, 4, 29];

type Tap = (statement: string, run: () => unknown) => unknown;
/** A process on `path` playing seed `seed`'s release; its ids count from 1, as in every run. */
function processOn(path: string, seed: number, tap: Tap = (_, run) => run()) {
  const s = simulate(seed);
  const sql = new DatabaseSync(path);
  sql.exec('PRAGMA page_size = 512'); // small pages: the FULL fault
  const db = {
    execSync: (q: string) => void tap(q, () => sql.exec(q)),
    runSync: (q: string, ...p: (string | number | null)[]) =>
      tap(q, () => sql.prepare(q).run(...p)),
    getFirstSync: <T>(q: string, ...p: (string | number | null)[]) =>
      tap(q, () => sql.prepare(q).get(...p) ?? null) as T | null,
    getAllSync: <T>(q: string, ...p: (string | number | null)[]) =>
      tap(q, () => sql.prepare(q).all(...p)) as T[],
    isInTransactionSync: () => sql.isTransaction,
  };
  let n = 0;
  const host = { kernel_version: `loka-kernel@${'0'.repeat(40)}`, newId: () => uuid(++n) };
  const o = openStory(db, [{ content_hash: s.loaded.hash, fresh: s.start }], host);
  assert.equal(o.kind, 'open');
  const story = o as Extract<typeof o, { kind: 'open' }>;
  /** Command `k` of the sequence as the invocation a GameView client sends now. */
  const send = (k: number) => story.invoke(invocationOf(story.world(), s.commands[k]!, k));
  return { sql, story, send, length: s.commands.length };
}
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** The ActionInvocation for `c`: the action resolving to its type, its targets in slot order. */
function invocationOf(world: World, c: Command, k: number) {
  const { type, actor_id, action, target_id, item_id, recipient_id, ...input } =
    c.payload as Record<string, unknown>;
  const set = resolved(world, world.character);
  const key = Object.keys(set).find(
    (a) => set[a]!.command === type && (!set[a]!.recipe || set[a]!.key === action),
  );
  const target_ids = [target_id, item_id, recipient_id].filter((t) => t !== undefined);
  return { invocation_id: uuid(1000 + k), action_key: key ?? type, actor_id, target_ids, input };
}

/** Memory and storage (head, rows, receipts), and the reply that left them. */
type Snap = { memory: string; stored: string; reply?: Reply };
const snap = (p: ReturnType<typeof processOn>, reply?: Reply): Snap => ({
  memory: encode(p.story.world().state as never),
  stored: JSON.stringify(
    ['head', 'state_row', 'receipt'].map((t) =>
      p.sql.prepare(`SELECT * FROM ${t} ORDER BY 1, 2`).all(),
    ),
  ),
  reply,
});
/** A saved reply's receipt, read on a second connection: durable, not this one's open transaction. */
function durable(path: string, reply: Reply, k: number) {
  if (reply.kind !== 'saved') return;
  const other = new DatabaseSync(path, { readOnly: true });
  const r = other
    .prepare('SELECT revision FROM receipt WHERE invocation_id = ?')
    .get(uuid(1000 + k));
  other.close();
  assert.equal(r?.revision, reply.revision, `saved without a durable receipt at ${k}`);
}
const save = () => join(mkdtempSync(join(tmpdir(), 'loka-s6a-')), 'save.db');

/** The fault-free run of `seed`: its save, and snapshots before (0) and after each command k (k + 1). */
function reference(seed: number) {
  const path = save();
  const p = processOn(path, seed);
  const snaps = [snap(p)];
  for (let k = 0; k < p.length; k++) snaps.push(snap(p, p.send(k)));
  p.sql.close();
  return [path, snaps] as const;
}
/** The fault points: commands that commit as NEW in the reference, those changing the world first. */
function committing(ref: Snap[]) {
  const saved = ref.flatMap((s, i) =>
    s.reply?.kind === 'saved' && !s.reply.replay ? [i - 1] : [],
  );
  const changing = saved.filter((k) => ref[k + 1]!.memory !== ref[k]!.memory);
  return changing.length >= 5 ? changing : saved;
}

/** Plays commands from..to-1 checking each reply and state against the reference. */
function play(
  p: ReturnType<typeof processOn>,
  path: string,
  ref: Snap[],
  from: number,
  to = p.length,
) {
  for (let k = from; k < to; k++) {
    const reply = p.send(k);
    durable(path, reply, k);
    assert.deepEqual(snap(p, reply), ref[k + 1], `command ${k}`);
  }
}
const at = (p: ReturnType<typeof processOn>, s: Snap) =>
  assert.deepEqual([snap(p).memory, snap(p).stored], [s.memory, s.stored]);

/** The save's trace as JSON lines in tmp/obs/game_trace/ when `run` fails (ADR-075 §2). */
function kept(path: string, name: string, run: () => void) {
  try {
    run();
  } catch (e) {
    const sql = new DatabaseSync(path, { readOnly: true });
    const rows = sql.prepare('SELECT record FROM trace ORDER BY rowid').all();
    append('game_trace', name, rows.map((r) => `${r.record}\n`).join(''), 'w');
    sql.close();
    throw e;
  }
}

/**
 * Per trace.command entry in order: ordinal, command, revision decided against, commit state and
 * revision. `settled` keeps what each command left (committed, or a kernel fault's unavailable),
 * in strictly increasing ordinals, which it then drops: an attempt that did not commit renumbers.
 */
function entries(path: string, settled = false) {
  const sql = new DatabaseSync(path, { readOnly: true });
  const rows = sql.prepare('SELECT record FROM trace WHERE ordinal > 0 ORDER BY rowid').all();
  sql.close();
  const all = rows
    .map((r) => JSON.parse(r.record as string))
    .map((r) => [
      r.data.ordinal,
      r.ids.command_id,
      r.ids.revision,
      r.data.commit.state,
      r.data.commit.revision,
    ]);
  if (!settled) return all;
  const kept = all.filter((e) => e[3] === 'committed' || e[3] === 'unavailable');
  assert.ok(
    kept.every((e, i) => !i || e[0] > kept[i - 1]![0]),
    'ordinals out of order',
  );
  return kept.map((e) => e.slice(1));
}

const FK = `PRAGMA foreign_keys = ON; CREATE TABLE IF NOT EXISTS parent (id INTEGER PRIMARY KEY);
  CREATE TABLE IF NOT EXISTS orphan (id INTEGER REFERENCES parent DEFERRABLE INITIALLY DEFERRED);
  CREATE TRIGGER orphaned AFTER INSERT ON receipt BEGIN INSERT INTO orphan VALUES (1); END;`;

// The child of the kill runs: `kill <save> <seed> <k> before|after|failed` plays the seed's
// commands before k, then SIGKILLs itself at command k's COMMIT: just before it runs, just after
// it commits, or just after it fails (a deferred foreign key; nothing settled or traced yet).
if (process.argv[2] === 'kill') {
  const [path, seed, k, when] = process.argv.slice(3) as [string, string, string, string];
  let armed = false;
  const p = processOn(path, Number(seed), (q, run) => {
    const die = armed && q === 'COMMIT';
    if (die && when === 'before') process.kill(process.pid, 'SIGKILL');
    try {
      return run();
    } finally {
      if (die) process.kill(process.pid, 'SIGKILL');
    }
  });
  for (let n = 0; n < Number(k); n++) p.send(n);
  if (when === 'failed') p.sql.exec(FK);
  armed = true;
  p.send(Number(k));
  process.exit(1); // not killed: the parent sees no SIGKILL
}

// Breaks (OFF-03..06; 03 §§14-15; ADR-072): memory adopted before COMMIT, a write left half done
// (some rows of a command without the others or its receipt), saved replied without a durable
// receipt, a definite failure that changes memory or storage, a kill before COMMIT that keeps
// anything or one after it that loses the commit, a duplicate delivery decided again (a second
// effect or RNG draw), or a fault's trace losing more than its own entry or reordering the rest.
for (const seed of SEEDS)
  test(`seed ${seed}: every fault leaves the prior or next revision and the run ends unchanged`, () => {
    const [refPath, ref] = reference(seed);
    const points = committing(ref);
    const point = (i: number) => points[Math.floor(((i + 1) * points.length) / 6)]!;
    const faults = [
      [
        'full',
        { errcode: 13 }, // SQLITE_FULL
        (sql: DatabaseSync) => sql.exec(`PRAGMA max_page_count = ${pages(sql)}`),
        'PRAGMA max_page_count = 1000000',
      ],
      ['commit', /nothing was saved/, (sql: DatabaseSync) => sql.exec(FK), 'DROP TRIGGER orphaned'],
    ] as const;
    for (const [i, [name, error, arm, lift]] of faults.entries()) {
      const path = save();
      const k = point(i);
      kept(path, `faults-${seed}-${name}`, () => {
        const p = processOn(path, seed);
        play(p, path, ref, 0, k);
        arm(p.sql);
        assert.throws(() => p.send(k), error);
        at(p, ref[k]!);
        p.sql.exec(lift);
        p.sql.close();
        const q = processOn(path, seed);
        at(q, ref[k]!);
        play(q, path, ref, k);
        q.sql.close();
        assert.deepEqual(entries(path, true), entries(refPath, true));
      });
    }
    for (const [i, when] of ['before', 'after', 'failed'].entries()) {
      const path = save();
      const k = point(i + 2);
      kept(path, `faults-${seed}-kill-${when}`, () => {
        const args = [fileURLToPath(import.meta.url), 'kill', path, String(seed), String(k), when];
        const child = spawnSync(process.execPath, args);
        assert.equal(child.signal, 'SIGKILL', `${when}: ${child.stderr}`);
        const q = processOn(path, seed);
        if (when === 'failed') q.sql.exec('DROP TRIGGER orphaned');
        if (when !== 'after') {
          at(q, ref[k]!);
          play(q, path, ref, k);
        } else {
          at(q, ref[k + 1]!);
          const again = q.send(k); // the same invocation delivered again
          const replayed = { ...ref[k + 1]!.reply, replay: true }; // canonical: prototypes aside
          assert.equal(encode(again as never), encode(replayed as never));
          at(q, ref[k + 1]!);
          play(q, path, ref, k + 1);
        }
        q.sql.close();
        assert.deepEqual(entries(path), entries(refPath));
      });
    }
  });
const pages = (sql: DatabaseSync) => Object.values(sql.prepare('PRAGMA page_count').get()!)[0];

// Breaks (the corpus's own footing): the driver or the authority drifting from answers checked by
// hand against the fixtures. Seed 293 (cartridge_details_hash.json): wait until 3600 advances the
// clock to 3600; wait until 3599 is not later than now, so invalid_state, and keeps the revision;
// looking at a detail changes nothing but the revision. Seed 88 (cartridge_dusk_hash.json):
// ring_bell lasts 60.
test('hand-checked anchors', () => {
  const p = processOn(save(), 293);
  const replies = [0, 1, 2].map((k) => p.send(k) as Extract<Reply, { kind: 'saved' }>);
  const shown = replies.map(({ revision, decision: d }) => {
    const { kind, outcome, error } = d as {
      kind: string;
      outcome?: string;
      error?: { code: string };
    };
    return [revision, kind, outcome ?? error!.code];
  });
  assert.deepEqual(shown, [
    [1, 'accepted', 'waited'],
    [1, 'rejected', 'invalid_state'],
    [2, 'accepted', 'examined'],
  ]);
  assert.deepEqual(
    { ...p.sql.prepare('SELECT revision, clock FROM head').get() },
    { revision: 2, clock: 3600 },
  );
  const d = processOn(save(), 88);
  d.send(0);
  assert.deepEqual(
    { ...d.sql.prepare('SELECT revision, clock FROM head').get() },
    { revision: 1, clock: 60 },
  );
});

// Breaks (07 §play_time; 15 DET-04): the play_time clock or the world advanced by reading a view,
// by closing and reopening the save, or by the host's wall clock (a command decided under a
// changed host clock differs from the reference). The app subscribes to no AppState, so
// backgrounding dispatches nothing; the device gate (S6b) covers the phone.
test('views, a reopen and a changed host clock leave the play_time clock and world as they were', () => {
  const [, ref] = reference(13);
  const path = save();
  const p = processOn(path, 13);
  p.send(0);
  for (let i = 0; i < 3; i++) p.story.world();
  at(p, ref[1]!);
  p.sql.close();
  mock.timers.enable({ apis: ['Date'], now: Date.UTC(2040, 0, 1) });
  try {
    const q = processOn(path, 13);
    at(q, ref[1]!);
    assert.equal(q.sql.prepare('SELECT clock FROM head').get()!.clock, 1);
    play(q, path, ref, 1);
  } finally {
    mock.timers.reset();
  }
});
