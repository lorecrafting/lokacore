// Built rooms S2 through real SQLite (save.md, Built rooms): the raised hut's identity row is the
// only saved trace of the room; reopen derives the room again and a forged row is save_corrupt.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  gameView,
  INSTALLED,
  loadCartridge,
  newWorld,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';
import { activeStatuses } from '../../../kernel/ts/src/mechanics/status/shared.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { resolved } from '../../../kernel/ts/src/commands/actions.ts';
import { pending } from '../../../kernel/ts/src/mechanics/dialogue/shared.ts';
import { compiled } from './__tests__/compiled.ts';
import { openStory } from './authority.ts';
import { coldReopen, elapsedHost } from './__tests__/elapsed-host.test.ts';

const kat = read('protocol/fixtures/build_sampler_hash.json');
const bundle = { canonical: kat.canonical as string, sha256: kat.sha256 as string };
const loaded = loadCartridge(
  new TextEncoder().encode(`{"cartridge":${bundle.canonical},"content_hash":"${bundle.sha256}"}`),
  INSTALLED,
);
if (!loaded.ok) throw new Error(JSON.stringify(loaded));
const initial = newWorld(
  loaded.cartridge as Cartridge,
  '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
  [1, 2, 3, 4],
);
const releases = [{ fresh: initial, content_hash: bundle.sha256 }] as const;
const shipped = { bundle, releases };
type Cart = typeof shipped;
const npc = (k: string) => initial.entityIds[`build_sampler@0.0.1:npc/${k}`]!;
const service = (key: string) => ({
  cartridge_id: 'build_sampler',
  cartridge_version: '0.0.1',
  kind: 'service',
  key,
});

const timber = (k: string) => initial.entityIds[`build_sampler@0.0.1:item/timber_${k}`]!;

// Built rooms S3: buy the plot, take two timber, order the hut; with `reopen`, close and reopen
// the save between order and completion; then elapse to the order's due time, stopping before it
// on 'ordered', or first through a real COMMIT that fails or whose acknowledgement is lost.
function build(
  path: string,
  reopen: boolean,
  mode?: 'ordered' | 'failed' | 'lost',
  cart: Cart = shipped,
) {
  let p = elapsedHost(path, undefined, cart.bundle);
  const open = () => {
    const s = openStory(p.db, cart.releases, p.host);
    if (s.kind !== 'open') throw new Error(JSON.stringify(s));
    return s;
  };
  let story = open();
  let n = 0;
  const invocation = (action_key: string, target_ids: string[], input = {}) => ({
    invocation_id: `aaaaaaaa-1091-4091-8091-${String(++n).padStart(12, '0')}`,
    actor_id: initial.character,
    action_key,
    target_ids,
    input,
  });
  const run = (i: ReturnType<typeof invocation>) => {
    const r = story.invoke(i);
    assert.equal(r.kind, 'saved', JSON.stringify(r));
    if (r.kind === 'saved') assert.equal((r.decision as any).kind, 'accepted', JSON.stringify(r));
    return r;
  };
  run(invocation('buy_plot', [npc('seller')], { service: service('buy_plot'), quoted_price: 10 }));
  run(invocation('take', [timber('a')]));
  run(invocation('take', [timber('b')]));
  const raise = invocation('raise_hut', [npc('carpenter')], {
    service: service('raise_hut'),
    quoted_price: 5,
  });
  run(raise);
  const created = () => Object.keys(story.world().state.created ?? {});
  assert.deepEqual(created(), []);
  const from = story.world().state.clock;
  if (reopen) {
    p.sql.close();
    p = elapsedHost(path, undefined, cart.bundle);
    story = open();
  }
  if (mode === 'ordered') return { p, raise, invocation, created, story };
  const evidence = { expected_run_id: story.runId(), from, until: from + 7200 };
  const rows = () => p.sql.prepare('SELECT * FROM state_row ORDER BY section, key').all();
  if (mode) {
    if (mode === 'failed')
      p.sql.exec(
        'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
      );
    const before = rows();
    p.fault.kind = mode;
    p.fault.armed = true;
    assert.equal(story.elapsed(evidence).kind, 'pending');
    assert.deepEqual(created(), []);
    p.fault.reads = false;
    if (mode === 'failed') assert.deepEqual(rows(), before);
  }
  const r = story.elapsed(evidence);
  assert.equal(r.kind, 'saved', JSON.stringify(r));
  if (mode) assert.equal(r.kind === 'saved' && r.replay, mode === 'lost');
  return { p, raise, invocation, created, story };
}

// Breaks: the order job's owner (actor_id) or the built identity row not saved or not hydrated
// (no hut, or north not offered after reopen), a reopen between order and completion minting
// a different room id, the receipt replay minting a second room, or load admitting a forged
// built row (refused as save_corrupt by a load check, not specifically by the direction check).
test('the hut survives cold reopen, its receipt replays, and a forged east row is save_corrupt', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-built-saves-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'hut.db');
  const straight = build(join(dir, 'straight.db'), false).created();
  straight.length || assert.fail('the uninterrupted run raised no hut');
  const built = build(path, true);
  const [hut] = built.created();
  assert.deepEqual(built.created(), straight);
  built.p.sql.close();

  const p = elapsedHost(path, undefined, bundle);
  const story = openStory(p.db, releases, p.host);
  if (story.kind !== 'open') throw new Error(JSON.stringify(story));
  const { raise, invocation } = built;
  assert.ok(gameView(story.world()).exits.some((e) => e.direction === 'north'));
  const again = story.invoke(raise);
  assert.equal(again.kind === 'saved' && again.replay, true, JSON.stringify(again));
  assert.deepEqual(Object.keys(story.world().state.created ?? {}), [hut]);
  const moved = story.invoke(invocation('move', [], { direction: 'north' }));
  assert.equal(moved.kind, 'saved');
  assert.equal(story.world().state.containers[story.world().body], hut);
  coldReopen(path, bundle);

  const row = p.sql
    .prepare("SELECT value FROM state_row WHERE section = 'created' AND key = ?")
    .get(hut) as { value: string };
  const forged = JSON.parse(row.value);
  forged.origin.direction = 'east';
  p.sql
    .prepare("UPDATE state_row SET value = ? WHERE section = 'created' AND key = ?")
    .run(JSON.stringify(forged), hut);
  p.sql.close();
  assert.throws(() => coldReopen(path, bundle), /save_corrupt/);
});

// Breaks: completion through a COMMIT that fails or whose acknowledgement is lost raising no hut,
// a second hut or a different room id on the retry, or half its rows (hut without the fact closed).
test('a real failed or lost COMMIT at completion retries to the same single hut', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-built-commit-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const straight = build(join(dir, 'straight.db'), false);
  for (const kind of ['failed', 'lost'] as const) {
    const b = build(join(dir, `${kind}.db`), false, kind);
    assert.deepEqual(b.created(), straight.created());
    const rows = (x: typeof b) =>
      x.p.sql
        .prepare(
          "SELECT key, value FROM state_row WHERE section IN ('created', 'facts', 'jobs', 'statuses')",
        )
        .all();
    assert.deepEqual(rows(b), rows(straight));
    b.p.sql.close();
  }
  straight.p.sql.close();
});

// Breaks: load admitting a saved build order whose owner (actor_id) names another actor, which
// would raise the room for them; refused by the receipt replay (liquid-save.ts), with the file left unchanged.
test('a pending build order forged to another owner is save_corrupt and the file is unchanged', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-built-owner-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'order.db');
  const { p } = build(path, false, 'ordered');
  const job = p.sql.prepare("SELECT key, value FROM state_row WHERE section = 'jobs'").all() as {
    key: string;
    value: string;
  }[];
  const order = job.find((j) => JSON.parse(j.value).job.kind === 'order')!;
  const forged = { ...JSON.parse(order.value), actor_id: npc('seller') };
  p.sql
    .prepare("UPDATE state_row SET value = ? WHERE section = 'jobs' AND key = ?")
    .run(JSON.stringify(forged), order.key);
  p.sql.close();
  const bytes = readFileSync(path);
  assert.throws(() => coldReopen(path, bundle), /save_corrupt/);
  assert.deepEqual(readFileSync(path), bytes);
});

const opened = (p: ReturnType<typeof elapsedHost>, rel = releases) => {
  const s = openStory(p.db, rel, p.host);
  if (s.kind !== 'open') throw new Error(JSON.stringify(s));
  return s;
};
const advance = (story: ReturnType<typeof opened>, by: number) => {
  const from = story.world().state.clock;
  const r = story.elapsed({ expected_run_id: story.runId(), from, until: from + by });
  assert.equal(r.kind, 'saved', JSON.stringify(r));
};
const held = (story: ReturnType<typeof opened>, holder: string) =>
  activeStatuses(story.world(), holder as never).map((s) => s.status.key);

// Built rooms S4 (save.md, Built rooms): the hut's weathering and ruin rows are saved status rows.
// Breaks: load checking a status row's holder before hydrate derives the built room (the hut's
// weathering or ruin row refused as save_corrupt), weathering's job not resumed after a reopen (no
// ruin), or the ruin landing on the player's body instead of the hut.
test('weathering and ruin on the hut survive cold reopen; weathering ends in ruin after one', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-built-weather-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'weather.db');
  const built = build(path, true);
  const [hut] = built.created();
  built.p.sql.close();
  let p = elapsedHost(path, undefined, bundle);
  let story = opened(p);
  assert.deepEqual(held(story, hut!), ['weathering']);
  advance(story, 600);
  assert.deepEqual(held(story, hut!), ['ruin']);
  assert.deepEqual(held(story, story.world().body), []);
  p.sql.close();
  p = elapsedHost(path, undefined, bundle);
  story = opened(p);
  assert.deepEqual(held(story, hut!), ['ruin']);
  p.sql.close();
});

// Breaks: an advance spanning the order's completion and weathering's end leaving weathering
// undrained (the step faults on an expired status) or raising the hut without its ruin.
test('one advance across completion and the end of weathering raises the hut in ruin', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-built-span-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'span.db');
  const { p } = build(path, false, 'ordered');
  p.sql.close();
  const q = elapsedHost(path, undefined, bundle);
  const story = opened(q);
  advance(story, 7800);
  const [hut] = Object.keys(story.world().state.created ?? {});
  assert.deepEqual(held(story, hut!), ['ruin']);
  q.sql.close();
  coldReopen(path, bundle);
});

// Built rooms S6 (save.md, Built rooms): a recipe-built hut is the same identity row as a hired one.
// Breaks: the raise's room not saved or not derived again on reopen (no hut, or the lane loses its
// way north), or the raise's receipt replaying into a second room.
test('a self-built hut survives cold reopen, its replay raises no second hut, and north enters it', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-built-self-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'self.db');
  const craft = compiled('cartridges/craft_sampler');
  const l = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${craft.canonical},"content_hash":"${craft.sha256}"}`),
    INSTALLED,
  );
  if (!l.ok) throw new Error(JSON.stringify(l));
  const fresh = newWorld(
    l.cartridge as Cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
  const open = () => {
    const p = elapsedHost(path, undefined, craft);
    const s = openStory(p.db, [{ fresh, content_hash: craft.sha256 }], p.host);
    if (s.kind !== 'open') throw new Error(JSON.stringify(s));
    return { p, story: s };
  };
  let { p, story } = open();
  let n = 0;
  const go = (command: string, input: object = {}, target_ids: string[] = [], key?: string) => {
    const set = resolved(story.world(), fresh.character);
    const action_key = Object.keys(set).find(
      (k) => set[k]!.command === command && (!key || set[k]!.key === key),
    )!;
    const i = {
      invocation_id: `aaaaaaaa-1212-4212-8212-${String(++n).padStart(12, '0')}`,
      actor_id: fresh.character,
      action_key,
      target_ids,
      input,
    };
    const r = story.invoke(i);
    assert.equal(r.kind === 'saved' && (r.decision as any).kind, 'accepted', JSON.stringify(r));
    return i;
  };
  const id = (k: string) => fresh.entityIds[`craft_sampler@0.0.1:${k}`]!;
  const chop = () => {
    go('move', { direction: 'west' });
    go('perform', {}, [], 'chop');
    go('perform', {}, [], 'chop');
    go('move', { direction: 'east' });
  };
  go('choose_ancestry', { ancestry: 'woodfolk' });
  go('take', {}, [id('item/axe')]);
  chop();
  go('talk', {}, [id('npc/old_carver')]);
  const [continuation_id] = pending(story.world(), fresh.character)!;
  go('choose', { choice_id: 'learn_carpentry', continuation_id });
  go('perform', {}, [], 'saw');
  chop();
  go('perform', {}, [], 'saw');
  go('move', { direction: 'east' });
  const raise = go('perform', {}, [], 'raise_timbered_hut');
  const huts = () =>
    Object.keys(story.world().state.created ?? {}).filter(
      (k) => story.world().state.created![k]!.origin.kind === 'built',
    );
  const [hut] = huts();
  p.sql.close();
  coldReopen(path, craft);
  ({ p, story } = open());
  assert.deepEqual(huts(), [hut]);
  assert.equal(story.invoke(raise).kind, 'saved');
  assert.deepEqual(huts(), [hut]);
  go('move', { direction: 'north' });
  assert.equal(story.world().state.containers[story.world().body], hut);
  p.sql.close();
});

// Built rooms S5: raze the hut with timber_c on its floor; its tombstone is a `built` row.
function razeRun(path: string, mode?: 'failed' | 'lost', cart: Cart = shipped) {
  const b = build(path, false, undefined, cart);
  const { p, story, invocation } = b;
  const ok = (i: ReturnType<typeof invocation>) => {
    const r = story.invoke(i);
    assert.equal(r.kind === 'saved' && (r.decision as any).kind, 'accepted', JSON.stringify(r));
  };
  ok(invocation('take', [timber('c')]));
  ok(invocation('move', [], { direction: 'north' }));
  ok(invocation('drop', [timber('c')]));
  ok(invocation('move', [], { direction: 'south' }));
  const raze = invocation('raze_hut', [npc('carpenter')], {
    service: service('raze_hut'),
    quoted_price: 2,
  });
  const rows = () => p.sql.prepare('SELECT * FROM state_row ORDER BY section, key').all();
  if (mode) {
    if (mode === 'failed')
      p.sql.exec(
        'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
      );
    const before = rows();
    p.fault.kind = mode;
    p.fault.armed = true;
    assert.deepEqual(story.invoke(raze), { kind: 'pending' });
    p.fault.reads = false;
    if (mode === 'failed') assert.deepEqual(rows(), before);
  }
  const r = story.invoke(raze);
  assert.equal(r.kind === 'saved' && (r.decision as any).kind, 'accepted', JSON.stringify(r));
  if (mode) assert.equal(r.kind === 'saved' && r.replay, mode === 'lost');
  const [hut] = b.created();
  return { ...b, raze, hut: hut!, rows };
}
const north = (story: ReturnType<typeof opened>) =>
  gameView(story.world()).exits.some((e) => e.direction === 'north');
const lane = (story: ReturnType<typeof opened>) => story.world().state.containers[timber('c')];

// Breaks: the tombstone not saved or not hydrated on reopen (north back, or the hut's exits
// derived again), the timber's move not saved, or the raze receipt's replay charging or moving twice.
test('a razed hut stays razed through cold reopen and its receipt replays without a second raze', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-built-raze-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'raze.db');
  const { p, raze, hut, rows } = razeRun(path);
  const after = rows();
  p.sql.close();
  coldReopen(path, bundle);
  const q = elapsedHost(path, undefined, bundle);
  const story = opened(q);
  assert.deepEqual(Object.keys(story.world().state.built ?? {}), [hut]);
  assert.equal(north(story), false);
  assert.deepEqual(story.world().rooms[hut]!.exits, {});
  const at = lane(story);
  assert.notEqual(at, hut);
  const again = story.invoke(raze);
  assert.equal(again.kind === 'saved' && again.replay, true, JSON.stringify(again));
  assert.equal(lane(story), at);
  assert.deepEqual(q.sql.prepare('SELECT * FROM state_row ORDER BY section, key').all(), after);
  q.sql.close();
});

// Breaks: a raze through a COMMIT that fails or whose acknowledgement is lost leaving no tombstone,
// a second charge, or half its rows (tombstone without the timber's move, or the reverse).
test('a real failed or lost COMMIT at raze retries to one tombstone and the timber in the lane once', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-raze-commit-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const straight = razeRun(join(dir, 'straight.db'));
  const pick = (x: typeof straight) =>
    x.p.sql
      .prepare(
        "SELECT section, key, value FROM state_row WHERE section IN ('built', 'containers', 'created', 'entities', 'statuses') ORDER BY section, key",
      )
      .all();
  for (const kind of ['failed', 'lost'] as const) {
    const b = razeRun(join(dir, `${kind}.db`), kind);
    assert.deepEqual(pick(b), pick(straight));
    b.p.sql.close();
  }
  straight.p.sql.close();
});

// Breaks: load admitting a late tombstone, one on a non-built entity, or a row inside a razed room
// (refused by hydrate or receipt recovery; per-check red controls: kernel forged-tombstone test).
test('a forged tombstone or a row inside a razed room is save_corrupt and the file is unchanged', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-raze-forged-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const base = join(dir, 'base.db');
  const { p, hut, story } = razeRun(base);
  const clock = story.world().state.clock;
  p.sql.close();
  const forge = (name: string, sql: string, ...args: string[]) => {
    const path = join(dir, `${name}.db`);
    writeFileSync(path, readFileSync(base));
    const h = elapsedHost(path, undefined, bundle);
    h.sql.prepare(sql).run(...args);
    h.sql.close();
    const bytes = readFileSync(path);
    assert.throws(() => coldReopen(path, bundle), /save_corrupt/, name);
    assert.deepEqual(readFileSync(path), bytes, name);
  };
  coldReopen(base, bundle);
  const copy = join(dir, 'copy.db');
  writeFileSync(copy, readFileSync(base));
  coldReopen(copy, bundle); // control: the copy itself opens
  const set = 'UPDATE state_row SET value = ? WHERE section = ? AND key = ?';
  forge('late', set, JSON.stringify({ razed_at: clock + 1 }), 'built', hut);
  forge(
    'not-built',
    "INSERT INTO state_row (section, key, value) VALUES ('built', ?, ?)",
    npc('seller'),
    JSON.stringify({ razed_at: 0 }),
  );
  forge('inside', set, JSON.stringify(hut), 'containers', timber('c'));
});

// A test-local build_sampler hut escrows one timber, so timber_b raises a second hut after the raze.
function oneTimber(): Cart {
  const dir = mkdtempSync(join(tmpdir(), 'loka-one-timber-'));
  try {
    cpSync(fileURLToPath(new URL('../../../cartridges/build_sampler', import.meta.url)), dir, {
      recursive: true,
    });
    const file = join(dir, 'services/raise_hut.json');
    const svc = JSON.parse(readFileSync(file, 'utf8'));
    svc.benefit.escrow.quantity = 1;
    writeFileSync(file, JSON.stringify(svc));
    const b = compiled(dir);
    const l = loadCartridge(
      new TextEncoder().encode(`{"cartridge":${b.canonical},"content_hash":"${b.sha256}"}`),
      INSTALLED,
    );
    if (!l.ok) throw new Error(JSON.stringify(l));
    const fresh = newWorld(
      l.cartridge as Cartridge,
      '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
      [1, 2, 3, 4],
    );
    assert.deepEqual(fresh.entityIds, initial.entityIds);
    return { bundle: b, releases: [{ fresh, content_hash: b.sha256 }] as const };
  } finally {
    rmSync(dir, { recursive: true });
  }
}

// Breaks: a second hut at the razed hut's site and direction refused on reopen (the tombstoned row
// still counted as a room there), or reopen deriving north to the razed hut instead of the new one.
test('a hut raised where a razed one stood survives cold reopen and north enters the new hut', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-raze-again-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'again.db');
  const cart = oneTimber();
  const { p, hut, story, invocation } = razeRun(path, undefined, cart);
  const r = story.invoke(
    invocation('raise_hut', [npc('carpenter')], { service: service('raise_hut'), quoted_price: 5 }),
  );
  assert.equal(r.kind === 'saved' && (r.decision as any).kind, 'accepted', JSON.stringify(r));
  advance(story, 7200);
  p.sql.close();
  coldReopen(path, cart.bundle);
  const q = elapsedHost(path, undefined, cart.bundle);
  const s = opened(q, cart.releases);
  const [again, ...rest] = Object.keys(s.world().state.created ?? {}).filter((k) => k !== hut);
  assert.ok(again && !rest.length, JSON.stringify(s.world().state.created));
  assert.deepEqual(Object.keys(s.world().state.built ?? {}), [hut]);
  const moved = s.invoke(invocation('move', [], { direction: 'north' }));
  assert.equal(moved.kind === 'saved' && (moved.decision as any).kind, 'accepted');
  assert.equal(s.world().state.containers[s.world().body], again);
  q.sql.close();
});
