// Homestead hs-6 (docs/system/mechanics.md Furnishing) on the compiled furnish sampler: a bed, a
// forge and a rug (tags bed, forge, rug) lie in the yard; the hut north of it holds a chest and a
// bench. An item_present leaf holds while an item with the tag lies directly in the actor's room:
// resting in the hut with the bed there applies well_rested (+2 mv every 600 s for 3600 s), the
// bench's temper recipe needs the forge there, and the rug turns on the hut's variant line.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, gameView, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { LIMITS, type Tag } from '../src/contracts.gen.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { holds } from '../src/mechanics/policy.ts';
import { activeStatuses } from '../src/mechanics/status/shared.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), 'loka-furnish-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/furnish_sampler', file], {
    cwd: root,
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const loaded = loadCartridge(artifact, INSTALLED);
assert.ok(loaded.ok, JSON.stringify(loaded));
const content = loaded.cartridge as Cartridge;

let n = 0;
const play = (w: World, payload: object) =>
  step(
    w,
    {
      id: `eeeeeeee-6666-4444-8444-${String(++n).padStart(12, '0')}`,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...payload },
    } as never,
    n,
  );
const ok = (w: World, payload: object) => {
  const r = play(w, payload);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
};
const P = 'furnish_sampler@0.0.1:';
const item = (w: World, k: string) => w.entityIds[`${P}item/${k}`]!;
const fresh = () =>
  newWorld(content, '7b2f4d3e-8c5a-4f6b-9d0e-3c1a2b4d5e6f' as never, [1, 2, 3, 4]);
const take = (w: World, k: string) => ok(w, { type: 'take', item_id: item(w, k) });
const drop = (w: World, k: string) => ok(w, { type: 'drop', item_id: item(w, k) });
const go = (w: World, direction: string) => ok(w, { type: 'move', direction });
// Carry `keys` from the yard into the hut and drop them there.
const furnish = (...keys: string[]) => {
  let w = fresh();
  for (const k of keys) w = take(w, k);
  w = go(w, 'north');
  for (const k of keys) w = drop(w, k);
  return w;
};
const rested = (w: World) => activeStatuses(w, w.body).map((s) => s.spec.key);
const mv = (w: World) => level(w, w.body, resourceRef(w, 'mv'));
const elapse = (w: World, by: number) => {
  const run_id = `aaaaaaaa-2222-4000-8000-${String(++n).padStart(12, '0')}`;
  const [from, until] = [w.state.clock, w.state.clock + by];
  const payload = { type: 'elapsed', actor_id: w.character, run_id, from, until };
  const command = { id: elapsedCommandId(run_id, w.context, from, until), payload };
  return stepElapsed(w, { ...command, world_context_id: w.context } as never, n);
};
const said = (r: { decision: { kind: string } }) =>
  r.decision.kind === 'accepted'
    ? ((r.decision as { narration?: { key: string }[] }).narration ?? []).map((x) => x.key)
    : [];
const offer = (w: World) => {
  let found: { available: boolean; reason?: { code: string } } | undefined;
  JSON.stringify(gameView(w), (_, v) => (v?.action_key === 'temper' ? (found = v) : v));
  return found;
};
const shows = (w: World, key: string) => JSON.stringify(gameView(w)).includes(`"${key}"`);
const leaf = (w: World, tag: string, steps = { n: 0 }) =>
  holds(w, w.character, { op: 'item_present', tag: tag as Tag }, { steps });

// Breaks: the leaf reads the actor's inventory, climbs into containers, ignores the tag, or
// reads a room other than the actor's.
test('item_present holds only for a tagged item lying directly in the actor room', () => {
  let w = furnish('bed');
  assert.equal(leaf(w, 'bed'), true, 'on the hut floor');
  assert.equal(leaf(w, 'rug'), false, 'another tag');
  assert.equal(leaf(go(w, 'south'), 'bed'), false, 'from the yard');
  assert.equal(leaf(take(w, 'bed'), 'bed'), false, 'carried');
  w = ok(take(w, 'bed'), { type: 'put', item_id: item(w, 'bed'), container_id: item(w, 'chest') });
  assert.equal(leaf(w, 'bed'), false, 'inside the chest in the hut');
  assert.equal(leaf(fresh(), 'bed'), true, 'in the yard, read from the yard');
});

// Breaks: the leaf costs a flat step, scans past the query budget, or a spent budget holds.
test('item_present costs one step per entity scanned and fails past the budget', () => {
  const w = furnish('bed');
  const room = w.state.containers[w.body];
  const inRoom = Object.entries(w.state.containers).filter(([, at]) => at === room);
  const steps = { n: 0 };
  assert.equal(leaf(w, 'rug', steps), false);
  assert.equal(steps.n, 1 + inRoom.length);
  // The bed is the k-th entity scanned: the leaf's step plus k scans land exactly on the limit.
  const k = inRoom.findIndex(([id]) => id === item(w, 'bed')) + 1;
  assert.equal(leaf(w, 'bed', { n: LIMITS.query_steps - 1 - k }), true, 'budget just fits');
  assert.equal(leaf(w, 'bed', { n: LIMITS.query_steps - k }), false, 'one step over');
});

// Breaks: the rested reaction ignores its when, or a taken bed still rests you well.
test('a Rest in the hut with the bed there applies well_rested; with it taken, nothing', () => {
  const w = furnish('bed');
  const r = play(w, { type: 'rest' });
  assert.ok(said(r).includes('narration.well_rested.applied'), String(said(r)));
  assert.deepEqual(rested(r.world), ['well_rested']);
  const bare = ok(take(w, 'bed'), { type: 'rest' });
  assert.deepEqual(rested(bare), []);
  assert.deepEqual(rested(ok(furnish('rug'), { type: 'rest' })), [], 'the rug is no bed');
});

// Breaks: the status ticks at its end, stops early, ticks negative, or stays past 3600 s; a second
// Rest stacks a second row (the faucet is one refreshed row, capped by the mv maximum).
test('well_rested ticks +2 mv five times in its hour, ends at 3600 s and does not stack', () => {
  const base = ok(take(furnish('bed'), 'bed'), { type: 'rest' });
  const w = ok(furnish('bed'), { type: 'rest' });
  const before = elapse(w, 3599);
  assert.deepEqual(rested(before.world), ['well_rested'], 'still on at 3599 s');
  const end = elapse(w, 3600);
  assert.deepEqual(rested(end.world), [], 'gone at 3600 s');
  assert.equal(said(end).filter((k) => k === 'narration.well_rested.tick').length, 5);
  assert.equal(mv(end.world)! - mv(elapse(base, 3600).world)!, 10);
  const again = ok(ok(w, { type: 'stand' }), { type: 'rest' });
  assert.equal(Object.keys(again.state.statuses ?? {}).length, 1, 'one row');
});

// Breaks: temper's item_present policy is skipped, or holds with the forge left in the yard.
test('temper at the bench is refused with the forge in the yard and allowed with it in the hut', () => {
  const bare = go(fresh(), 'north');
  assert.equal(offer(bare)?.available, false, JSON.stringify(offer(bare)));
  assert.notEqual(play(bare, { type: 'perform', action: 'temper' }).decision.kind, 'accepted');
  const forged = furnish('forge');
  assert.equal(offer(forged)?.available, true, JSON.stringify(offer(forged)));
  assert.equal(play(forged, { type: 'perform', action: 'temper' }).decision.kind, 'accepted');
});

// Breaks: the room variant ignores its when, or keeps the rug line after the rug is taken.
test('a rug dropped in the hut shows the variant line; taken, the base line returns', () => {
  const w = furnish('rug');
  assert.ok(shows(w, 'room.hut.rug'), 'rug line');
  const taken = take(w, 'rug');
  assert.ok(!shows(taken, 'room.hut.rug') && shows(taken, 'room.hut.description'), 'base line');
});
