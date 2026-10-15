// Built rooms S2 through real SQLite (save.md, Built rooms): the raised hut's identity row is the
// only saved trace of the room; reopen derives the room again and a forged row is save_corrupt.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
function build(path: string, reopen: boolean, mode?: 'ordered' | 'failed' | 'lost') {
  let p = elapsedHost(path, undefined, bundle);
  const open = () => {
    const s = openStory(p.db, releases, p.host);
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
    p = elapsedHost(path, undefined, bundle);
    story = open();
  }
  if (mode === 'ordered') return { p, raise, invocation, created };
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
  return { p, raise, invocation, created };
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

const opened = (p: ReturnType<typeof elapsedHost>) => {
  const s = openStory(p.db, releases, p.host);
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
