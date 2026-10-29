import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView, step, stepElapsed, type World } from '../src/index.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { key } from '../src/foundation/compose.ts';
import { hydrate } from '../src/runtime/created.ts';
import { genesis, prefix, ref, shrine, spawned, unpacked } from './c4_pack_fixture.ts';

// The controlled goblins (cap 6, day 4, night 20-6, hourly wander, one-day replacement) as a plain
// population: no pack block (c4_pack*.test.ts covers packs), 150-second combat rounds. The body
// starts at the inn, two moves (west, south) from the pit.
const fresh = () => genesis(unpacked);
const run_id = 'bbbbbbbb-0000-4000-8000-000000000001' as never;

const hounds = (w: World) =>
  Object.entries(w.state.created ?? {}).filter(
    ([, i]) => i.origin.kind === 'spawned' && i.origin.role === 'hunter',
  );
const pelts = (w: World) =>
  Object.entries(w.state.created ?? {}).filter(
    ([, i]) => i.origin.kind === 'spawned' && i.origin.role === 'loot',
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

// Breaks: genesis mints a pelt without its goblin, in the wrong slot, or outside the goblin's hands.
test('genesis has four goblins in their slots, each holding its own pelt, and six slots', () => {
  const w = fresh();
  assert.equal(hounds(w).length, 4);
  assert.equal(pelts(w).length, 4);
  assert.equal(Object.keys(w.state.population_slots ?? {}).length, 6);
  for (let slot = 1; slot <= 4; slot++) {
    const member = spawned(w, slot);
    const pelt = spawned(w, slot, 'loot');
    assert.equal((w.state.created?.[pelt]?.origin as any).member_id, member);
    assert.equal(w.state.containers[pelt], member);
  }
});

// Breaks: an hourly plan job loses a slot, exceeds its cap, or leaves night births out at dawn.
test('hourly wander and night boundary keep four then six bounded living goblins', () => {
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
test('combat-first and population-first boundaries conserve the same fatal goblin slot and pelt', () => {
  const member = spawned(fresh(), 1);
  const pelt = spawned(fresh(), 1, 'loot');
  const hp = key({ kind: 'resource', entity_id: member, resource: ref('resource', 'hp') });
  for (const [n, combatFirst] of [
    [3, true],
    [5, false],
  ] as const) {
    let w = elapsed(fresh(), 68250);
    for (const [i, direction] of ['west', 'south'].entries())
      w = command(w, 'move', direction, i + 1);
    w = {
      ...w,
      state: {
        ...w.state,
        resources: { ...w.state.resources, [hp]: { value: 1, at: 68250 } },
      },
    };
    w = command(w, 'attack', member, n);
    const due = Object.entries(w.state.jobs ?? {})
      .filter(([, row]) => row.status === 'pending' && row.due_time === 68400)
      .map(([id, row]) => [id, row.job.kind] as const)
      .filter(([, kind]) => kind === 'npc' || kind === 'population');
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

// Breaks: a deliberate goblin kill yields generic loot or replenishes before the one-day delay.
test('deliberate attack leaves the same pelt in a goblin corpse and delays replacement', () => {
  let w = fresh();
  for (const [i, direction] of ['west', 'south'].entries())
    w = command(w, 'move', direction, i + 1);
  const member = hounds(w).find(
    ([id]) => w.state.containers[id] === w.state.containers[w.body],
  )![0];
  const pelt = pelts(w).find(([, i]) => (i.origin as any).member_id === member)![0];
  assert.ok(gameView(w).entities.some((e) => e.id === member));
  w = command(w, 'attack', member, 3);
  for (let i = 0; i < 20 && w.state.containers[pelt] === member; i++)
    w = elapsed(w, w.state.clock + 150);
  const corpse = w.state.containers[pelt];
  assert.equal(w.state.created?.[corpse]?.definition.key, 'npc_corpse');
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

// Breaks: a due extra slot is replaced at the first daytime wander after a kill, bypassing the
// night-only cap even though the replacement delay has elapsed.
test('a due extra-slot death waits for night before its next generation', () => {
  let w = advance(fresh(), 108000);
  for (const [i, direction] of ['west', 'south'].entries())
    w = command(w, 'move', direction, i + 1);
  const slotKey = Object.keys(w.state.population_slots ?? {}).find(
    (k) => JSON.parse(k).slot === 5,
  )!;
  const member = w.state.population_slots![slotKey]!.member_id!;
  const hp = key({ kind: 'resource', entity_id: member, resource: ref('resource', 'hp') });
  w = {
    ...w,
    state: { ...w.state, resources: { ...w.state.resources, [hp]: { value: 1, at: 108000 } } },
  };
  w = command(w, 'attack', member, 3);
  w = elapsed(w, 108150);
  assert.deepEqual(w.state.population_slots![slotKey], {
    generation: 1,
    member_id: member,
    replacement_due: 194550,
  });
  w = advance(w, 198000);
  assert.equal(w.state.population_slots![slotKey]!.generation, 1);
  w = advance(w, 244800);
  assert.equal(w.state.population_slots![slotKey]!.generation, 2);
  assert.notEqual(w.state.population_slots![slotKey]!.member_id, member);
});

// Breaks: a lethal goblin reply marks its living slot dead or strands the player's same body outside the shrine.
test('a lethal goblin reply returns the same body and keeps the surviving goblin', () => {
  let w = fresh();
  for (const [i, direction] of ['west', 'south'].entries())
    w = command(w, 'move', direction, i + 1);
  const member = hounds(w).find(
    ([id]) => w.state.containers[id] === w.state.containers[w.body],
  )![0];
  const body = w.body;
  const hpTarget = key({ kind: 'resource', entity_id: body, resource: ref('resource', 'hp') });
  w = {
    ...w,
    state: {
      ...w.state,
      resources: { ...w.state.resources, [hpTarget]: { value: 1, at: w.state.clock } },
    },
  };
  w = command(w, 'attack', member, 3);
  for (let i = 0; i < 20 && w.state.containers[body] !== shrine; i++)
    w = elapsed(w, w.state.clock + 150);
  assert.equal(w.body, body);
  assert.equal(w.state.containers[body], shrine);
  assert.equal(live(w).length, 4);
  assert.equal(
    w.state.containers[pelts(w).find(([, i]) => (i.origin as any).member_id === member)![0]],
    member,
  );
});
