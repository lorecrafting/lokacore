// Homestead hs-2 (docs/system/mechanics.md "Farming") on the compiled farm sampler: the field
// holds a public furrow, a plot (put lock on `owns_plot`, sold by the seller for 10 of 30 pennies),
// a seed sack holding seed_01 and a watering can; the sealed larder holds turnip_01..03, the
// sealed midden nothing. The clock starts at 3600 in spring (winter from 345600). Putting the seed
// in a bed sends the seed to the midden at once and grows the bed for 86400 s; at the end the bed
// yields one turnip when `watered_at` is under 43200 s old (`not time_since at_least 43200`), so
// water at C0+43200 (43200 s old) withers and at C0+43201 ripens; otherwise it withers. Each
// sowing yields at most one crop. The midden returns the seed to the sack every 172800 s from
// world start (first at 176400), and the next sowing cures `withered`. Expected values are
// hand-counted from those literals.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, gameView, loadCartridge, newWorld, step } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import type { EntityId } from '../src/contracts.gen.ts';
import { hydrate } from '../src/runtime/created.ts';
import { activeStatuses } from '../src/mechanics/status/shared.ts';
import { value } from '../src/mechanics/fact.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-farm-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/farm_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const loaded = loadCartridge(artifact, INSTALLED);
assert.ok(loaded.ok, JSON.stringify(loaded));
const S = 'farm_sampler@0.0.1';
const fresh = () =>
  newWorld(loaded.cartridge as Cartridge, '3d7f2b0c-8e4a-4f6b-9c2d-1a3e5f7b9d2c' as never, [1]);

let n = 0;
const send = (w: World, payload: object) =>
  step(
    w,
    {
      id: `eeeeeeee-1081-4081-8081-${String(++n).padStart(12, '0')}`,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...payload },
    } as never,
    n,
  );
const code = (w: World, payload: object) => {
  const d = send(w, payload).decision;
  return d.kind === 'accepted' ? 'accepted' : (d as any).error.code;
};
function play(w: World, payload: object) {
  const r = send(w, payload);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
const item = (w: World, k: string) => w.entityIds[`${S}:item/${k}`]!;
const npc = (w: World, k: string) => w.entityIds[`${S}:npc/${k}`]!;
const room = (w: World, k: string) => w.roomIds[`${S}:room/${k}`]!;
const ref = (key: string) =>
  ({ cartridge_id: 'farm_sampler', cartridge_version: '0.0.1', kind: 'fact', key }) as never;
const at = (w: World, until: number) => play(w, { type: 'wait', until });
const clock = (w: World) => (w.state as any).clock as number;
/** Item keys directly in `holder`, sorted. */
const inside = (w: World, holder: string) =>
  Object.entries(w.entityIds)
    .filter(([, id]) => w.state.containers[id] === holder)
    .map(([k]) => k.split('/')[1]!)
    .sort();
const statuses = (w: World, id: EntityId) => activeStatuses(w, id).map((s: any) => s.status.key);
const text = (w: World, k: string) =>
  gameView(w).entities.find((e) => e.id === item(w, k))?.description;
const take = (w: World, k: string) => play(w, { type: 'take', item_id: item(w, k) });
const put = (w: World, bed: string) =>
  play(w, { type: 'put', item_id: item(w, 'seed_01'), container_id: item(w, bed) });
const water = (w: World, bed: string) => ({
  type: 'perform',
  action: `water_${bed}`,
  target_id: item(w, bed),
  item_id: item(w, 'can'),
});
const buy = (w: World) =>
  play(w, {
    type: 'use_service',
    provider_id: npc(w, 'seller'),
    service: {
      cartridge_id: 'farm_sampler',
      cartridge_version: '0.0.1',
      kind: 'service',
      key: 'buy_plot',
    },
    quoted_price: 10,
  });
/** The world holding the can and the seed, the plot bought when `bed` is the plot. */
function ready(bed: string) {
  let w = take(take(fresh(), 'can'), 'seed_01');
  return bed === 'plot' ? buy(w) : w;
}
const BEDS = [
  ['furrow', 'plot'],
  ['plot', 'furrow'],
] as const;

for (const [bed, other] of BEDS) {
  // Breaks: a stage threshold or its status gate changed (wrong text at a boundary, or a ripe bed
  // still reads "heavy heads"); water offered on a bare bed; ripen reading the other bed's
  // watered_at or never firing; wither firing on a watered bed; a bed not immune to the other
  // bed's growing status (that bed ripens or withers too); the crop or spent seed not moved.
  test(`${bed}: sown at C0, watered at C0+50000, it reads its stages and yields turnip_01 at C0+86400`, () => {
    let w = ready(bed);
    assert.equal(code(w, water(w, bed)), 'invalid_state', 'nothing grows: no water');
    w = put(w, bed);
    const c0 = clock(w);
    const base = `item.${bed}.description`;
    assert.equal(text(w, bed), base);
    assert.deepEqual(statuses(w, item(w, bed)), [bed === 'plot' ? 'growing_plot' : 'growing']);
    w = at(w, c0 + 3599);
    assert.equal(text(w, bed), base);
    w = at(w, c0 + 3600);
    assert.equal(text(w, bed), 'item.bed.shoots');
    w = at(w, c0 + 50000);
    w = play(w, water(w, bed));
    assert.equal(value(w, w.character, ref('watered_at'), item(w, bed)), c0 + 50000);
    w = at(w, c0 + 64799);
    assert.equal(text(w, bed), 'item.bed.shoots');
    w = at(w, c0 + 64800);
    assert.equal(text(w, bed), 'item.bed.heavy');
    w = at(w, c0 + 86400);
    assert.deepEqual(inside(w, item(w, bed)), ['turnip_01']);
    assert.deepEqual(inside(w, room(w, 'midden')), ['seed_01']);
    assert.deepEqual(inside(w, room(w, 'larder')), ['turnip_02', 'turnip_03']);
    assert.equal(text(w, bed), base);
    assert.deepEqual(statuses(w, item(w, bed)), []);
    // The one sow rule stamps its holder only (deviation: `sown_at` names no item).
    assert.deepEqual(statuses(w, item(w, other)), []);
    assert.deepEqual(inside(w, item(w, other)), []);
    assert.equal(value(w, w.character, ref('sown_at'), item(w, other)), 0);
    w = take(w, 'turnip_01');
    assert.equal(w.state.containers[item(w, 'turnip_01')], w.body);
  });

  // Breaks: wither's `when` inverted or removed, ripen's `when` removed (a turnip with no water),
  // or the seed not sent to the midden on wither.
  test(`${bed}: never watered, it withers with no turnip`, () => {
    let w = put(ready(bed), bed);
    w = at(w, clock(w) + 86400);
    assert.deepEqual(statuses(w, item(w, bed)), ['withered']);
    assert.deepEqual(inside(w, item(w, bed)), []);
    assert.deepEqual(inside(w, room(w, 'midden')), ['seed_01']);
    assert.equal(inside(w, room(w, 'larder')).length, 3);
  });

  // Breaks: the ripen/wither 43200 literal or the `not` moved by one second either way.
  test(`${bed}: watered at C0+43200 it withers, at C0+43201 it ripens`, () => {
    for (const [dt, crop] of [
      [43200, []],
      [43201, ['turnip_01']],
    ] as const) {
      let w = put(ready(bed), bed);
      const c0 = clock(w);
      w = at(play(at(w, c0 + dt), water(w, bed)), c0 + 86400);
      assert.deepEqual(inside(w, item(w, bed)), crop, String(dt));
      assert.deepEqual(statuses(w, item(w, bed)), crop.length ? [] : ['withered'], String(dt));
    }
  });

  // Breaks: the sow rule's spent_<bed> step removed: the seed stays in the bed, so a Take back
  // and a Put in the other bed sow a second crop from one seed.
  test(`${bed}: the seed leaves for the midden at sowing, so one seed grows one crop`, () => {
    let w = put(ready(bed), bed);
    assert.deepEqual(inside(w, item(w, bed)), []);
    assert.deepEqual(inside(w, room(w, 'midden')), ['seed_01']);
    assert.equal(code(w, { type: 'take', item_id: item(w, 'seed_01') }), 'not_present');
    const sow = { type: 'put', item_id: item(w, 'seed_01'), container_id: item(w, other) };
    assert.notEqual(code(w, sow), 'accepted');
    w = play(at(w, clock(w) + 50000), water(w, bed));
    w = at(w, clock(w) + 36400);
    assert.deepEqual(inside(w, room(w, 'larder')), ['turnip_02', 'turnip_03']);
  });
}

// Breaks: the seed_return entry removed or its `every` changed, or the sow rule's withered cure
// removed (the re-sown bed stays withered).
test('the seed returns to the sack at 176400 and sowing it cures the withered furrow', () => {
  let w = at(put(ready('furrow'), 'furrow'), 90000);
  assert.deepEqual(statuses(w, item(w, 'furrow')), ['withered']);
  w = at(w, 176399);
  assert.deepEqual(inside(w, item(w, 'sack')), []);
  w = at(w, 176400);
  assert.deepEqual(inside(w, item(w, 'sack')), ['seed_01']);
  w = put(take(w, 'seed_01'), 'furrow');
  assert.deepEqual(statuses(w, item(w, 'furrow')), ['growing']);
});

// Breaks: the sow rule's `not has_item` gate removed, so taking the seed from the sack (holder:
// the body) puts a draining growing status on the player.
test('taking the seed from the sack puts no growing status on the body', () => {
  let w = ready('furrow');
  const hp = level(w, w.body, resourceRef(w, 'hp'));
  w = at(w, clock(w) + 7200);
  assert.deepEqual(statuses(w, w.body), []);
  assert.equal(level(w, w.body, resourceRef(w, 'hp')), hp);
});

// Breaks: the sack's or the seller's `immune` list removed: the seed put in the sack or given to
// the seller would grow there, and its expiry would ripen or wither a bed.
test('a seed put in the sack or given to the seller grows nothing', () => {
  let w = take(fresh(), 'seed_01');
  w = play(w, { type: 'put', item_id: item(w, 'seed_01'), container_id: item(w, 'sack') });
  assert.deepEqual(statuses(w, item(w, 'sack')), []);
  w = take(w, 'seed_01');
  w = play(w, { type: 'give', item_id: item(w, 'seed_01'), recipient_id: npc(w, 'seller') });
  assert.deepEqual(statuses(w, npc(w, 'seller')), []);
  w = at(w, clock(w) + 86400);
  assert.equal(inside(w, room(w, 'larder')).length, 3);
  for (const bed of ['furrow', 'plot']) assert.deepEqual(statuses(w, item(w, bed)), []);
});

// Breaks: the season leaf removed from the sow rule (a winter sowing grows).
test('a seed sown in winter does not take', () => {
  let w = at(take(fresh(), 'seed_01'), 345600);
  w = put(w, 'furrow');
  assert.deepEqual(statuses(w, item(w, 'furrow')), []);
});

// Breaks: the plot's put lock removed (a stranger sows it).
test("a stranger's Put on the plot is permission_denied; the buyer's is accepted", () => {
  let w = take(fresh(), 'seed_01');
  const sow = { type: 'put', item_id: item(w, 'seed_01'), container_id: item(w, 'plot') };
  assert.equal(code(w, sow), 'permission_denied');
  assert.equal(code(buy(w), sow), 'accepted');
});

// Breaks: the plot's get lock removed (a stranger takes the owner's crop).
test("a stranger's Take of the plot's turnip is permission_denied", () => {
  let w = put(ready('plot'), 'plot');
  w = play(at(w, clock(w) + 50000), water(w, 'plot'));
  w = at(w, clock(w) + 36400);
  const state = JSON.parse(JSON.stringify(w.state));
  const owned = Object.keys(state.facts).filter((k) => k.includes('owns_plot'));
  assert.equal(owned.length, 1);
  for (const k of owned) delete state.facts[k];
  const stranger = hydrate(fresh(), state, true)!;
  assert.equal(
    code(stranger, { type: 'take', item_id: item(w, 'turnip_01') }),
    'permission_denied',
  );
  assert.equal(code(w, { type: 'take', item_id: item(w, 'turnip_01') }), 'accepted');
});

// Breaks: a water reaction's stamp or ripen's `watered_at` read that depends on how the wait is
// chunked or on in-memory state a reopen drops (one path ripens, another withers).
test('one advance, hourly steps and a reopen before ripening reach the same harvest', () => {
  let w = put(ready('furrow'), 'furrow');
  const c0 = clock(w);
  const one = at(play(at(w, c0 + 50000), water(w, 'furrow')), c0 + 86400);
  let hourly = w;
  for (let t = c0 + 3600; t < c0 + 50000; t += 3600) hourly = at(hourly, t);
  hourly = play(at(hourly, c0 + 50000), water(hourly, 'furrow'));
  for (let t = c0 + 50400; t <= c0 + 86400; t += 3600) hourly = at(hourly, t);
  w = play(at(w, c0 + 50000), water(w, 'furrow'));
  const reopened = at(hydrate(fresh(), JSON.parse(JSON.stringify(w.state)), true)!, c0 + 86400);
  assert.deepEqual(inside(one, item(one, 'furrow')), ['turnip_01']);
  assert.deepEqual(statuses(one, item(one, 'furrow')), []);
  for (const x of [hourly, reopened]) {
    assert.deepEqual(x.state.containers, one.state.containers);
    assert.deepEqual(statuses(x, item(x, 'furrow')), []);
  }
});
