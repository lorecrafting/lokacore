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
import { fatal } from './death_fixture.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { activeStatuses } from '../src/mechanics/status/shared.ts';
import { key } from '../src/foundation/compose.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';

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
// The player's mv pool set to `value` now (regen 18 an hour from here), as status.test.ts withPool.
const withMv = (w: World, value: number): World => ({
  ...w,
  state: {
    ...w.state,
    resources: {
      ...w.state.resources,
      [key({ kind: 'resource', entity_id: w.body, resource: resourceRef(w, 'mv') })]: {
        value,
        at: w.state.clock,
        rate: 18,
        remainder: 0,
      },
    },
  },
});

// Breaks: the pen lock dropped or reading another fact (a stranger walks in).
test('a stranger is refused the pen; the bought entitlement lets them in', () => {
  const w = fresh();
  assert.equal(code(w, { type: 'move', direction: 'north' }), 'permission_denied');
  assert.equal(code(buy(w), { type: 'move', direction: 'north' }), 'accepted');
});

// Breaks: co_present not reaching the trough event's NPCs, spent_grain not running in the Put's own
// advance (hs-1), the feed `when` letting a Take in the pen feed, or a Give of the grain accepted
// (it would feed the seller or a hen and never reach the midden), or a Put into either corpse.
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
  assert.equal(hens(d).length, 2);
  for (const h of hens(d)) assert.deepEqual(statuses(d, h as EntityId), []);
  assert.equal(
    code(d, { type: 'put', item_id: item(d, 'grain_01'), container_id: item(d, 'nest') }),
    'permission_denied',
  );
  // A corpse would hold the grain, feed its room and let the sack be taken back at will.
  const corpse = play(d, { type: 'attack', target_id: hens(d)[0]! });
  const body = elapsed(corpse, corpse.state.clock + 600, 1);
  const named = new Set(Object.values(body.entityIds));
  const remains = Object.keys(body.state.containers).filter(
    (id) =>
      body.state.containers[id] === room(body, 'pen') &&
      !named.has(id as EntityId) &&
      body.entities[id]?.kind === 'item',
  );
  assert.equal(remains.length, 1);
  assert.equal(
    code(body, { type: 'put', item_id: item(body, 'grain_01'), container_id: remains[0] }),
    'permission_denied',
  );
  // fatal() names its killer by the containers sampler's id; alias it to a live hen here.
  const killer = { 'cellar_sampler@0.0.8:npc/cellar_rat_1': hens(body)[0]! };
  const died = fatal({ ...body, entityIds: { ...body.entityIds, ...killer } }).next.world;
  const corpseId = Object.keys(died.state.containers).find(
    (id) => died.state.containers[id] === room(died, 'pen') && !(id in body.state.containers),
  )!;
  // The grain the player carried lies in the corpse; take it back and try to return it.
  const back = play(play(died, { type: 'move', direction: 'north' }), {
    type: 'take',
    item_id: item(died, 'grain_01'),
  });
  assert.equal(
    code(back, { type: 'put', item_id: item(back, 'grain_01'), container_id: corpseId }),
    'permission_denied',
  );
  for (const to of [npc(d, 'seller'), hens(d)[0]!])
    assert.equal(
      code(d, { type: 'give', item_id: item(d, 'grain_01'), recipient_id: to }),
      'invalid_state',
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

// Breaks: any egg's `edible` block dropped or bound to a pool the eat does not raise.
test('each of the six eggs is eaten and raises mv by 2', () => {
  let w = feed();
  const eaten: string[] = [];
  for (const t of [14400, 28800, 43200]) {
    w = elapsed(w, C0 + t);
    for (const k of inside(w, item(w, 'nest'))) {
      const egg = item(w, k);
      w = withMv(play(w, { type: 'take', item_id: egg }), 90);
      w = play(w, { type: 'eat', item_id: egg });
      assert.notEqual(w.state.containers[egg], w.body);
      assert.equal(level(w, w.body, resourceRef(w, 'mv')), 92);
      eaten.push(k);
    }
  }
  assert.deepEqual(eaten.sort(), ['egg_01', 'egg_02', 'egg_03', 'egg_04', 'egg_05', 'egg_06']);
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

// Breaks: replacement_delay ignored or off by one; a slot above the floor refilling before its due.
// Killed at 21:00 so its due falls at night, when slot 3 is under the target.
test('a killed born hen refills its slot 86400 after its death', () => {
  let w = elapsed(fresh(), C0 + 43200 + 3600);
  w = play(buy(w), { type: 'move', direction: 'north' });
  const third = slots(w)[2]![1].member_id!;
  w = play(w, { type: 'attack', target_id: third });
  // One-unit steps, so the clock stops at the death.
  while (slots(w)[2]![1].replacement_due === null) w = elapsed(w, w.state.clock + 1, 1);
  const due = slots(w)[2]![1].replacement_due!;
  assert.equal(due, w.state.clock + 86400);
  w = elapsed(w, due - 1);
  assert.equal(hens(w).length, 3);
  w = elapsed(w, due);
  assert.equal(hens(w).length, 4);
  assert.notEqual(slots(w)[2]![1].member_id, third);
});

// Breaks: the floor dropped or below 2 (slot 2's hen killed on day one strands the flock, as
// births need two live hens).
test('a starting hen killed on day one is replaced within the hour', () => {
  let w = play(buy(fresh()), { type: 'move', direction: 'north' });
  const first = slots(w)[1]![1].member_id!;
  w = play(w, { type: 'attack', target_id: first });
  // It dies at C0+150 (one combat round); a floor slot is due at once and the next hourly
  // settle refills it, long before the night births that need two live hens.
  w = elapsed(w, C0 + 3600);
  assert.equal(hens(w).length, 2);
  assert.notEqual(slots(w)[1]![1].member_id, first);
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
