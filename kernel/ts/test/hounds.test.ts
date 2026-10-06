import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import {
  INSTALLED,
  gameView,
  loadCartridge,
  newWorld,
  step,
  stepElapsed,
  type Cartridge,
  type World,
} from '../src/index.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { encode } from '../src/foundation/canonical.ts';
import { key } from '../src/foundation/compose.ts';
import { hydrate } from '../src/runtime/created.ts';
import { read } from './read.ts';

const pin = read('protocol/fixtures/missing_child_c3_provisional_hash.json');
const ids = read('protocol/fixtures/missing_child_c3_provisional_ids.json');
const loaded = loadCartridge(
  new TextEncoder().encode(`{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`),
  INSTALLED,
);
assert.ok(loaded.ok, JSON.stringify(loaded));
const context = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never;
const run_id = 'bbbbbbbb-0000-4000-8000-000000000001' as never;
const fresh = () => newWorld(loaded.cartridge as Cartridge, context, [1, 2, 3, 4]);

// Breaks: the installed loader accepts a forged one-way population area after its content hash is re-pinned.
test('loader refuses a one-way hound area with a valid hash', () => {
  const c = structuredClone(pin.value);
  const room = c.rooms['ashmere_missing_child@0.0.28:room/adder_nest'];
  room.exits.north = room.exits.west;
  delete room.exits.west;
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  const result = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
  assert.equal(result.ok, false);
  if (!result.ok)
    assert.equal(
      result.diagnostic.path,
      '.cartridge.populations["ashmere_missing_child@0.0.28:population/fen_hounds"].area',
    );
});

// Breaks: a plan whose wander interval exceeds its replacement delay enters the loaded world.
test('loader refuses a slower wander than replacement with a valid hash', () => {
  const c = structuredClone(pin.value);
  const plan = c.populations['ashmere_missing_child@0.0.28:population/fen_hounds'];
  plan.wander_interval = 7200;
  plan.replacement_delay = 3600;
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  const result = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
  assert.equal(result.ok, false);
  if (!result.ok)
    assert.equal(
      result.diagnostic.path,
      '.cartridge.populations["ashmere_missing_child@0.0.28:population/fen_hounds"].wander_interval',
    );
});
const hounds = (w: World) =>
  Object.entries(w.state.created ?? {}).filter(
    ([, i]) => i.origin.kind === 'spawned' && i.origin.role === 'hound',
  );
const pelts = (w: World) =>
  Object.entries(w.state.created ?? {}).filter(
    ([, i]) => i.origin.kind === 'spawned' && i.origin.role === 'pelt',
  );
const live = (w: World) =>
  Object.values(w.state.population_slots ?? {}).filter(
    (s) => s.member_id !== null && s.replacement_due === null,
  );
function elapsed(w: World, until: number): World {
  const result = stepElapsed(
    w,
    {
      id: elapsedCommandId(run_id, w.context, w.state.clock, until) as never,
      world_context_id: w.context,
      payload: { type: 'elapsed', actor_id: w.character, run_id, from: w.state.clock, until },
    },
    1,
  );
  assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
  return result.world;
}
function advance(w: World, until: number): World {
  while (w.state.clock < until) {
    const due = Object.values(w.state.jobs ?? {})
      .filter((j) => j.status === 'pending')
      .map((j) => j.due_time)
      .filter((at) => at > w.state.clock);
    w = elapsed(w, Math.min(until, ...due));
  }
  return w;
}
function command(w: World, type: 'move' | 'attack', argument: string, n: number) {
  const payload =
    type === 'move'
      ? { type, actor_id: w.character, direction: argument as never }
      : { type, actor_id: w.character, target_id: argument as never };
  const result = step(
    w,
    {
      id: `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}` as never,
      world_context_id: w.context,
      payload,
    },
    n,
  );
  assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
  return result.world;
}

// Breaks: new rooms or hound creation shift the deterministic genesis IDs or mint a pelt without its hound.
test('the integrated chapter has the independent genesis identities and one held pelt per hound', () => {
  const w = fresh();
  assert.equal(w.character, ids.character);
  assert.equal(w.body, ids.body);
  for (const name of ['hound_run', 'adder_nest'])
    assert.equal(w.roomIds[`ashmere_missing_child@0.0.28:room/${name}`], ids[`room/${name}`]);
  assert.equal(hounds(w).length, 4);
  assert.equal(pelts(w).length, 4);
  assert.equal(Object.keys(w.state.population_slots ?? {}).length, 6);
  for (let slot = 1; slot <= 4; slot++) {
    const member = ids[`population/fen_hounds/slot${slot}/member`];
    const pelt = ids[`population/fen_hounds/slot${slot}/pelt`];
    assert.equal((w.state.created?.[member]?.origin as any).slot, slot);
    assert.equal((w.state.created?.[pelt]?.origin as any).member_id, member);
    assert.equal(w.state.containers[pelt], member);
  }
  assert.equal(
    w.state.population_plans?.[Object.keys(w.state.population_plans)[0]!]?.job_id,
    ids['population/fen_hounds/job'],
  );
});

// Breaks: an hourly plan job loses a slot, exceeds its cap, or leaves night births out at dawn.
test('hourly wander and night boundary keep four then six bounded living hounds', () => {
  let w = fresh();
  const before = hounds(w).map(([id]) => w.state.containers[id]);
  w = advance(w, 68400);
  assert.equal(live(w).length, 4);
  assert.ok(hounds(w).some(([id], i) => w.state.containers[id] !== before[i]));
  w = advance(w, 72000);
  assert.equal(live(w).length, 6);
  assert.equal(pelts(w).length, 6);
  w = advance(w, 108000);
  assert.equal(live(w).length, 6);
  assert.equal(hounds(w).length, 6);
  assert.equal(
    Object.values(w.state.jobs ?? {}).filter(
      (j) => j.status === 'pending' && j.job.kind === 'population',
    ).length,
    1,
  );
});

// Breaks: hourly successors leak new members or lose the sole current plan job over many days.
test('thirty days of segmented elapsed time retain six members and one plan successor', () => {
  const w = advance(fresh(), 64800 + 30 * 86400);
  assert.equal(hounds(w).length, 6);
  assert.equal(pelts(w).length, 6);
  assert.equal(live(w).length, 6);
  assert.equal(
    Object.values(w.state.jobs ?? {}).filter(
      (j) => j.status === 'pending' && j.job.kind === 'population',
    ).length,
    1,
  );
});

// Breaks: equal-time population and fatal combat deliveries conflict, move the engaged victim, or lose its pelt in either real job-ID order.
test('combat-first and population-first boundaries conserve the same fatal hound slot and pelt', () => {
  const member = ids['population/fen_hounds/slot1/member'];
  const pelt = ids['population/fen_hounds/slot1/pelt'];
  const hp = key({
    kind: 'resource',
    entity_id: member,
    resource: {
      cartridge_id: 'ashmere_missing_child',
      cartridge_version: '0.0.28',
      kind: 'resource',
      key: 'hp',
    },
  });
  for (const [n, combatFirst] of [
    [4, true],
    [7, false],
  ] as const) {
    let w = elapsed(fresh(), 68250);
    for (const [i, direction] of ['south', 'south', 'east'].entries())
      w = command(w, 'move', direction, i + 1);
    w = {
      ...w,
      state: {
        ...w.state,
        resources: { ...w.state.resources, [hp]: { value: 1, at: 68250 } },
      },
      cartridge: {
        ...w.cartridge,
        world: {
          ...w.cartridge.world!,
          combat: {
            ...w.cartridge.world!.combat!,
            player_attack: { chance: 100, damage_min: 1, damage_max: 1 },
          },
        },
      },
    };
    w = command(w, 'attack', member, n);
    const due = Object.entries(w.state.jobs ?? {})
      .filter(([, row]) => row.status === 'pending' && row.due_time === 68400)
      .map(([id, row]) => [id, row.job.kind] as const);
    assert.equal(due.length, 2);
    const fight = due.find(([, kind]) => kind === 'npc')![0];
    const population = due.find(([, kind]) => kind === 'population')![0];
    assert.equal(fight < population, combatFirst);
    w = elapsed(w, 68400);
    assert.equal(w.state.resources?.[hp]?.value, 0);
    const slot = Object.values(w.state.population_slots ?? {}).find(
      (row) => row.member_id === member,
    );
    assert.deepEqual(slot, { generation: 1, member_id: member, replacement_due: 154800 });
    const corpses = Object.entries(w.state.created ?? {}).filter(
      ([, i]) => i.origin.kind === 'death',
    );
    assert.equal(corpses.length, 1);
    assert.equal(w.state.containers[pelt], corpses[0]![0]);
    assert.equal(w.state.containers[corpses[0]![0]], w.state.containers[member]);
    assert.deepEqual(
      Object.values(w.state.jobs ?? {})
        .filter((row) => row.status === 'pending' && row.job.kind === 'population')
        .map((row) => row.due_time),
      [72000],
    );
  }
});

// Breaks: a deliberate hound kill yields generic rat loot or replenishes before the one-day delay.
test('deliberate attack leaves the same pelt in a hound corpse and delays replacement', () => {
  let w = fresh();
  for (const [i, direction] of ['south', 'south', 'east'].entries())
    w = command(w, 'move', direction, i + 1);
  const member = hounds(w).find(
    ([id]) => w.state.containers[id] === w.state.containers[w.body],
  )![0];
  const pelt = pelts(w).find(([, i]) => (i.origin as any).member_id === member)![0];
  assert.ok(gameView(w).entities.some((e) => e.id === member));
  w = command(w, 'attack', member, 4);
  for (let i = 0; i < 20 && w.state.containers[pelt] === member; i++)
    w = elapsed(w, w.state.clock + 150);
  const corpse = w.state.containers[pelt];
  assert.equal(w.state.created?.[corpse]?.definition.key, 'hound_corpse');
  assert.equal(w.state.containers[corpse], w.state.containers[member]);
  const pickup = step(
    w,
    {
      id: 'aaaaaaaa-0000-4000-8000-000000000030' as never,
      world_context_id: w.context,
      payload: { type: 'take', actor_id: w.character, item_id: pelt as never },
    },
    30,
  );
  assert.equal(pickup.decision.kind, 'accepted', JSON.stringify(pickup.decision));
  w = pickup.world;
  assert.equal(w.state.containers[pelt], w.body);
  assert.ok(gameView(w).inventory.some((e) => e.id === pelt));
  const slot = Object.values(w.state.population_slots ?? {}).find((s) => s.member_id === member)!;
  assert.equal(slot.replacement_due, w.state.clock + 86400);
  assert.equal(live(w).length, 3);
  w = advance(w, slot.replacement_due - 1);
  assert.equal(live(w).length, 5);
  w = advance(w, slot.replacement_due);
  assert.equal(live(w).length, 6);
  assert.equal(w.state.containers[pelt], w.body);
  const reopened = hydrate(fresh(), JSON.parse(JSON.stringify(w.state)), true);
  assert.ok(reopened);
  assert.equal(reopened.state.containers[pelt], w.body);
  assert.equal(
    reopened.state.population_slots &&
      Object.values(reopened.state.population_slots).filter(
        (s) => s.member_id !== null && s.replacement_due === null,
      ).length,
    6,
  );
});

// Breaks: a lethal hound reply marks its living slot dead or strands the player's same body outside the shrine.
test('a lethal hound reply returns the same body and keeps the surviving hound', () => {
  let w = fresh();
  for (const [i, direction] of ['south', 'south', 'east'].entries())
    w = command(w, 'move', direction, i + 1);
  const member = hounds(w).find(
    ([id]) => w.state.containers[id] === w.state.containers[w.body],
  )![0];
  const body = w.body;
  const hpTarget = key({
    kind: 'resource',
    entity_id: body,
    resource: {
      cartridge_id: 'ashmere_missing_child',
      cartridge_version: '0.0.28',
      kind: 'resource',
      key: 'hp',
    },
  });
  w = {
    ...w,
    state: {
      ...w.state,
      resources: { ...w.state.resources, [hpTarget]: { value: 1, at: w.state.clock } },
    },
  };
  w = command(w, 'attack', member, 4);
  for (
    let i = 0;
    i < 20 &&
    w.state.containers[body] !== w.roomIds['ashmere_missing_child@0.0.28:room/chapel_nave'];
    i++
  )
    w = elapsed(w, w.state.clock + 150);
  assert.equal(w.body, body);
  assert.equal(
    w.state.containers[body],
    w.roomIds['ashmere_missing_child@0.0.28:room/chapel_nave'],
  );
  assert.equal(live(w).length, 4);
  assert.equal(
    w.state.containers[pelts(w).find(([, i]) => (i.origin as any).member_id === member)![0]],
    member,
  );
});
