// Each new lineage's own world context and RNG seed, drawn from the host's random source, kept in
// its save and restored on reopen (ADR-075 §3 seed, §4 A4; 10 §§31-32; save.md "The save file"),
// on Node with real SQLite (node:sqlite), one connection per simulated process. Expected values
// are fixture literals or the kernel's newWorld, never the authority's code.
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync } from 'node:fs';
import { getRandomValues, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import type { WorldContextId } from '../../../kernel/ts/src/contracts.gen.ts';
import { encode } from '../../../kernel/ts/src/canonical.ts';
import { loadCartridge, newWorld, type Cartridge } from '../../../kernel/ts/src/index.ts';
import { validate } from '../../../kernel/ts/src/validate.ts';
import { INSTALLED } from '../../../kernel/ts/src/world.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { openStory, type Host, type Release, type Saved } from './authority.ts';
import { openGame } from './session.ts';

const TEMPLATE = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as WorldContextId; // session.ts CONTEXT
// numeric-vectors.json rng_steps[3].state and [4].state: dusk's pick_lock draws once (saves.test.ts).
const SEED = [27274249, 25704967, 31982592, 12605441];
const AFTER = [15224335, 29364750, 272377353, 1125134346];
const ACTOR = 'bd595711-ea5f-89a5-abb0-046cd349d2f9'; // the character under TEMPLATE (saves.test.ts)
const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const releaseOf = (path: string): Release => {
  const f = read(path) as { canonical: string; sha256: string };
  const artifact = `{"cartridge":${f.canonical},"content_hash":"${f.sha256}"}`;
  const loaded = loadCartridge(new TextEncoder().encode(artifact), INSTALLED);
  assert.ok(loaded.ok);
  const fresh = newWorld(loaded.cartridge as Cartridge, TEMPLATE, [1, 2, 3, 4] as never);
  return { content_hash: f.sha256, fresh };
};
const dusk = releaseOf('protocol/fixtures/cartridge_dusk_hash.json');
const bell = releaseOf('protocol/fixtures/cartridge_bell_hash.json'); // no pick_lock
const KERNEL = `loka-kernel@${'0123456789'.repeat(4)}`;
const counter = () => {
  let n = 0;
  return () => `aaaaaaaa-0000-4000-8000-${String(++n).padStart(12, '0')}`;
};

type P = (string | number | null)[];
/** expo-sqlite's sync names on one node:sqlite connection. */
const adapt = (sql: DatabaseSync) => ({
  execSync: (s: string) => void sql.exec(s),
  runSync: (s: string, ...p: P) => sql.prepare(s).run(...p),
  getFirstSync: <T>(s: string, ...p: P) => (sql.prepare(s).get(...p) ?? null) as T,
  getAllSync: <T>(s: string, ...p: P) => sql.prepare(s).all(...p) as T[],
  isInTransactionSync: () => sql.isTransaction,
});
type Options = { releases?: [Release, ...Release[]] } & Partial<Host>;
/** A process on the save at `path`: one connection. */
function processOn(path: string, { releases = [dusk], ...host }: Options = {}) {
  const sql = new DatabaseSync(path);
  const db = adapt(sql);
  const random = getRandomValues as Host['random'];
  const opened = openStory(db, releases, {
    kernel_version: KERNEL,
    newId: randomUUID,
    random,
    ...host,
  });
  const story = opened as Extract<typeof opened, { kind: 'open' }>;
  const one = (q: string) => Object.values(sql.prepare(q).get() ?? {})[0] as string;
  const pin = () => JSON.parse(one('SELECT pin FROM save'));
  const seed = () => JSON.parse(one('SELECT seed FROM save'));
  const rng = () => JSON.parse(one('SELECT rng FROM head'));
  const headers = () =>
    sql
      .prepare("SELECT record FROM trace WHERE record ->> '$.event' = 'trace.run' ORDER BY rowid")
      .all()
      .map((r) => JSON.parse(r.record as string));
  const pick = (n: number) =>
    story.invoke({
      invocation_id: `00000000-0000-4000-8000-00000000000${n}`,
      action_key: 'pick_lock',
      actor_id: story.world().character,
      target_ids: [],
      input: {},
    }) as Saved;
  return { sql, opened, story, one, pin, seed, rng, headers, pick };
}
const file = () => join(mkdtempSync(join(tmpdir(), 'loka-c1-host-')), 'save.db');
const state = (p: ReturnType<typeof processOn>) => encode(p.story.world().state as never);

// Breaks (ADR-075 §3): the app's path (session.ts openGame) drops the host's random source, so every
// phone game is the template world again (DIFFERENCES row 6).
test('the app path passes the random source: the pinned context is not the template', () => {
  const sql = new DatabaseSync(':memory:');
  openGame(adapt(sql), read('protocol/fixtures/cartridge_dusk_hash.json') as never, {
    newId: randomUUID,
    kernel_version: KERNEL,
    random: getRandomValues as Host['random'],
  });
  const pin = sql.prepare("SELECT pin ->> '$.world_context_id' AS c FROM save").get();
  assert.match(pin?.c as string, V4);
  assert.notEqual(pin?.c, TEMPLATE);
});

// Breaks (ADR-075 §3, §4 A4): the host's random source ignored, so every new game shares the
// template's seed or context; the drawn context not pinned, or not the one the trace header names.
test('two new games draw their own seed and world context, pinned and in the trace header', () => {
  const games = [processOn(':memory:'), processOn(':memory:')];
  const [a, b] = games.map((p) => [p.seed(), p.pin().world_context_id]);
  assert.notDeepEqual(a![0], b![0]);
  assert.notEqual(a![1], b![1]);
  for (const p of games) {
    const context = p.pin().world_context_id;
    assert.deepEqual(validate('RngState', p.seed()), []);
    assert.match(context, V4);
    assert.notEqual(context, TEMPLATE);
    assert.deepEqual(
      p.headers().map((h) => h.data.world_context_id),
      [context],
    );
  }
});

// Breaks (ADR-075 §4 A4): a reopen that rebuilds the world under the release's context, not the
// pinned one (the character's id differs); Start over or an app update that keeps the old
// lineage's world or names the old context in the new run's header.
test('a reopen rebuilds the ids from the pinned context: first open, Start over, app update', () => {
  const sources: [string, (path: string) => string][] = [
    ['first open', (path) => close(processOn(path))],
    ['start over', (path) => close(processOn(path), (p) => p.story.newGame())],
    ['app update', (path) => (close(processOn(path)), close(processOn(path, LATER)))],
  ];
  const LATER = { releases: [bell, dusk] as [Release, Release] };
  for (const [source, make] of sources) {
    const path = file();
    const before = make(path);
    const p = processOn(path, LATER);
    const context = p.pin().world_context_id;
    const expected = newWorld(dusk.fresh.cartridge, context, p.seed()).character;
    assert.notEqual(context, TEMPLATE, source);
    assert.equal(p.story.world().character, expected, source);
    assert.equal(state(p), before, source);
    assert.equal(p.headers().at(-1).data.world_context_id, context, source);
  }
});
/** Closes the process after `act`, returning its state. */
function close(p: ReturnType<typeof processOn>, act = (_: typeof p): unknown => p.pick(1)) {
  act(p);
  const s = state(p);
  p.sql.close();
  return s;
}

// Breaks (10 §31 "Restore the saved RNG"; RngState): the drawn seed not the run's initial RNG, an
// all-zero draw kept; a reopen that restarts the RNG from the seed or redraws it; a replay that
// re-decides and advances the RNG.
test('luck replays: the drawn seed is the RNG, and a reopen picks as the same process did', () => {
  let n = 0;
  const fixed = (w: Uint32Array) => (w.set(n++ ? SEED : [0, 0, 0, 0]), w);
  const a = processOn(':memory:', { random: fixed as Host['random'] });
  a.pick(1);
  assert.deepEqual([a.seed(), a.rng()], [SEED, AFTER]);

  const [A, B] = [file(), file()];
  processOn(A).sql.close();
  copyFileSync(A, B);
  const first = processOn(A);
  const picked = first.pick(1);
  const rng = first.rng();
  first.sql.close();
  const b = processOn(B);
  assert.deepEqual([encode(b.pick(1).decision), b.rng()], [encode(picked.decision), rng]);
  const again = processOn(A);
  const replayed = again.pick(1);
  assert.deepEqual(
    [replayed.replay, encode(replayed.decision), again.rng()],
    [true, encode(picked.decision), rng],
  );
});

// Breaks (save.md "Loading"; never rewrite an old pin): a save from before c1-host (no pinned
// context) rebuilt under another context, its pin or rows rewritten on reopen, or its next pick
// decided otherwise than without the reopen. The reopen's only trace row is the update's header.
test('a save from before c1-host opens unchanged and plays on', () => {
  const old = (path: string) => {
    const newId = counter();
    processOn(path, { random: undefined, newId }).sql.close();
    const sql = new DatabaseSync(path);
    sql.exec("UPDATE save SET pin = json_remove(pin, '$.world_context_id')");
    sql.close();
    const p = processOn(path, { random: undefined, newId });
    p.pick(1);
    return p;
  };
  const control = old(file()).pick(2).decision;
  const path = file();
  const p = old(path);
  const rows = ['head', 'state_row', 'save', 'receipt'].map((t) =>
    p.sql.prepare(`SELECT * FROM ${t}`).all(),
  );
  const traced = p.sql.prepare('SELECT * FROM trace').all().length;
  p.sql.close();
  const kernel_version = `loka-kernel@${'f'.repeat(40)}`;
  const q = processOn(path, { random: undefined, kernel_version });
  assert.deepEqual(
    ['head', 'state_row', 'save', 'receipt'].map((t) => q.sql.prepare(`SELECT * FROM ${t}`).all()),
    rows,
  );
  assert.equal('world_context_id' in q.pin(), false);
  assert.equal(q.story.world().character, ACTOR);
  const trace = q.sql.prepare('SELECT record FROM trace').all();
  assert.equal(trace.length, traced + 1);
  assert.deepEqual(
    [q.headers().at(-1).ids.kernel_version, q.headers().length],
    [kernel_version, 2],
  );
  assert.equal(encode(q.pick(2).decision), encode(control));
});

// Breaks (save.md "Loading"): a pinned context that is not a WorldContextId opened anyway, or
// thrown as an error that is not save_corrupt (the player could not start over).
test('a pinned context that is not a WorldContextId is save_corrupt', () => {
  const path = file();
  processOn(path).sql.close();
  const sql = new DatabaseSync(path);
  sql.exec(`UPDATE save SET pin = json_set(pin, '$.world_context_id', 'not-a-uuid')`);
  sql.close();
  assert.equal(processOn(path).opened.kind, 'save_corrupt');
});
