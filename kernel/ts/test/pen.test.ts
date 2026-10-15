// Homestead hs-4 (docs/system/mechanics.md "Animals") on the compiled pen sampler. The clock starts
// at C0 = 28800 (08:00, 3600 units an hour). The pen's enter lock reads `owns_pen` (sold by the
// seller for 10 of 30 pennies); it holds a trough, a nest (put lock never open) and two hens at
// genesis (day target 2, night target 4 from 20:00 to 06:00, cap 4). Putting grain_01 in the
// trough applies `fed` (one day, a tick every 14400) to every hen in the pen and sends the grain to
// the sealed midden at once; the midden returns it to the yard every 86400 from C0. Each fed hen's
// tick moves one egg (egg_01..06, sealed larder) to the nest, capped at 3: with two hens, 2 eggs
// at C0+14400 and 3 from C0+28800. Births need two live hens and fill slots 3 and 4 at the night
// boundary C0+43200; a dead hen's slot refills 86400 after its death while two others live (no
// floor, so a lone hen never recovers). Hand-counted from those literals.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import type { EntityId } from '../src/contracts.gen.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { activeStatuses } from '../src/mechanics/status/shared.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-pen-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/pen_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const loaded = loadCartridge(artifact, INSTALLED);
assert.ok(loaded.ok, JSON.stringify(loaded));
const S = 'pen_sampler@0.0.1';
const C0 = 28800;
const fresh = () =>
  newWorld(
    loaded.cartridge as Cartridge,
    '5b2c7e1a-4d3f-4a8b-9c6e-2f1d0a3b4c5d' as never,
    [1, 2, 3, 4],
  );

let n = 0;
const send = (w: World, payload: object) =>
  step(
    w,
    {
      id: `eeeeeeee-1082-4082-8082-${String(++n).padStart(12, '0')}`,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...payload },
    } as never,
    n,
  );
function play(w: World, payload: object) {
  const r = send(w, payload);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
// Advances to `until` in steps of at most `size` units (one hour by default).
function elapsed(w: World, until: number, size = 3600): World {
  while (w.state.clock < until) {
    const run_id = `aaaaaaaa-1082-4082-8082-${String(++n).padStart(12, '0')}` as never;
    const from = w.state.clock;
    const to = Math.min(until, from - (from % size) + size);
    const r = stepElapsed(
      w,
      {
        id: elapsedCommandId(run_id, w.context, from, to) as never,
        world_context_id: w.context,
        payload: { type: 'elapsed', actor_id: w.character, run_id, from, until: to },
      },
      n,
    );
    assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
    w = r.world;
  }
  return w;
}
const item = (w: World, k: string) => w.entityIds[`${S}:item/${k}`]!;
const inside = (w: World, holder: string) =>
  Object.entries(w.entityIds)
    .filter(([, id]) => w.state.containers[id] === holder)
    .map(([k]) => k.split('/')[1]!)
    .sort();
const slots = (w: World) =>
  Object.entries(w.state.population_slots!)
    .map(([k, s]) => [JSON.parse(k).slot as number, s] as const)
    .sort((a, b) => a[0] - b[0]);
const statuses = (w: World, id: EntityId) => activeStatuses(w, id).map((s: any) => s.status.key);

const npc = (w: World, k: string) => w.entityIds[`${S}:npc/${k}`]!;
const buy = (w: World) =>
  play(w, {
    type: 'use_service',
    provider_id: npc(w, 'seller'),
    service: {
      cartridge_id: 'pen_sampler',
      cartridge_version: '0.0.1',
      kind: 'service',
      key: 'buy_pen',
    },
    quoted_price: 10,
  });
const hens = (w: World) =>
  slots(w)
    .filter(([, s]) => s.member_id && s.replacement_due === null)
    .map(([, s]) => s.member_id!);
const room = (w: World, k: string) => w.roomIds[`${S}:room/${k}`]!;
const code = (w: World, payload: object) => {
  const d = send(w, payload).decision;
  return d.kind === 'accepted' ? 'accepted' : (d as any).error.code;
};
const feed = () => {
  let w = play(fresh(), { type: 'take', item_id: item(fresh(), 'grain_01') });
  w = play(buy(w), { type: 'move', direction: 'north' });
  return play(w, { type: 'put', item_id: item(w, 'grain_01'), container_id: item(w, 'trough') });
};
const nest = (w: World) => inside(w, item(w, 'nest')).length;

// Breaks: the pen lock dropped or reading another fact (a stranger walks in).
test('a stranger is refused the pen; the bought entitlement lets them in', () => {
  const w = fresh();
  assert.equal(code(w, { type: 'move', direction: 'north' }), 'permission_denied');
  assert.equal(code(buy(w), { type: 'move', direction: 'north' }), 'accepted');
});

// Breaks: co_present not reaching the trough event's NPCs, spent_grain not running in the Put's own
// advance (hs-1), or the feed reaction firing on a Drop or Take of the grain in the pen.
test('grain in the trough feeds both hens and goes to the midden in the same advance', () => {
  const w = feed();
  assert.equal(hens(w).length, 2);
  for (const h of hens(w)) assert.deepEqual(statuses(w, h as EntityId), ['fed']);
  assert.deepEqual(inside(w, room(w, 'midden')), ['grain_01']);
  assert.deepEqual(inside(w, item(w, 'trough')), []);
  let d = play(fresh(), { type: 'take', item_id: item(fresh(), 'grain_01') });
  d = play(buy(d), { type: 'move', direction: 'north' });
  d = play(d, { type: 'drop', item_id: item(d, 'grain_01') });
  d = play(d, { type: 'take', item_id: item(d, 'grain_01') });
  for (const h of hens(d)) assert.deepEqual(statuses(d, h as EntityId), []);
  assert.equal(
    code(d, { type: 'put', item_id: item(d, 'grain_01'), container_id: item(d, 'nest') }),
    'permission_denied',
  );
});

// Breaks: a lay on an unfed hen, a lay before the first tick, the cap exceeded or not counted.
test('fed hens lay on each tick up to the nest cap; unfed hens never lay', () => {
  let w = feed();
  const seen = [14399, 14400, 28799, 28800, 57600].map((t) => nest((w = elapsed(w, C0 + t))));
  assert.deepEqual(seen, [0, 2, 2, 3, 3]);
  assert.equal(inside(w, room(w, 'larder')).length, 3);
  assert.equal(nest(elapsed(fresh(), C0 + 57600)), 0);
});

// Breaks: grain_return off its 86400 period, or not returning the sack to the yard.
test('the midden returns the grain to the yard at C0+86400', () => {
  const w = elapsed(feed(), C0 + 86399);
  assert.deepEqual(inside(w, room(w, 'midden')), ['grain_01']);
  assert.ok(inside(elapsed(w, C0 + 86400), room(w, 'yard')).includes('grain_01'));
});

// Breaks: birth_when not holding at two hens, births off the night boundary, or above the cap.
test('the third and fourth hens are born at the night boundary', () => {
  let w = elapsed(fresh(), C0 + 43199);
  assert.equal(hens(w).length, 2);
  w = elapsed(w, C0 + 43200);
  assert.equal(hens(w).length, 4);
  assert.equal(hens(elapsed(w, C0 + 3 * 86400)).length, 4);
});

// Breaks: replacement_delay ignored or off by one; the slot refilling before its due time.
test('a killed hen refills its slot 86400 after its death', () => {
  let w = elapsed(fresh(), C0 + 86400);
  w = play(buy(w), { type: 'move', direction: 'north' });
  const first = slots(w)[0]![1].member_id!;
  w = play(w, { type: 'attack', target_id: first });
  // One-unit steps, so the clock stops at the death.
  while (slots(w)[0]![1].replacement_due === null) w = elapsed(w, w.state.clock + 1, 1);
  const due = slots(w)[0]![1].replacement_due!;
  assert.equal(due, w.state.clock + 86400);
  w = elapsed(w, due - 1);
  assert.equal(hens(w).length, 3);
  w = elapsed(w, due);
  assert.equal(hens(w).length, 4);
  assert.notEqual(slots(w)[0]![1].member_id, first);
});

// Breaks: births not gated by birth_when (a lone hen breeds to the night target).
test('a lone hen does not breed', () => {
  let w = play(buy(fresh()), { type: 'move', direction: 'north' });
  w = play(w, { type: 'attack', target_id: slots(w)[0]![1].member_id! });
  w = elapsed(w, C0 + 43200);
  assert.equal(hens(w).length, 1);
});

// Breaks: a lay, birth or return that depends on how the elapsed time is chunked.
test('one long advance reaches the same pen as hourly steps', () => {
  const w = feed();
  const a = elapsed(w, C0 + 3 * 86400);
  const b = elapsed(w, C0 + 3 * 86400, 10 ** 9);
  // Born hens' ids derive from the command, so compare the named items and the slot generations.
  const pen = (x: World) => [
    ...['nest', 'trough'].map((k) => inside(x, item(x, k))),
    ...['yard', 'midden', 'larder'].map((k) => inside(x, room(x, k))),
    slots(x).map(([, s]) => [s.generation, s.replacement_due]),
  ];
  assert.deepEqual(pen(b), pen(a));
  assert.equal(nest(b), 3);
  assert.equal(hens(b).length, 4);
});
