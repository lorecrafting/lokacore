// Independent literal v042 idle-world model; no mechanic is replaced by the proof.
import assert from 'node:assert/strict';
import type { World } from '../src/index.ts';
import { fuelView } from '../src/mechanics/light/shared.ts';
import type { CaseHost } from './e1_case_host.ts';

const CAPS: Record<string, number> = {
  crow_branches: 1,
  crow_green_1: 1,
  crow_green_2: 1,
  crow_oak: 1,
  fen_hounds: 6,
  oak_deer: 1,
  orchard_deer: 1,
  willow_deer: 1,
};
const DESTINATIONS = [
  ['ada', 7, 'orchard'],
  ['ada', 17, 'elspeth_cottage'],
  ['ash', 6, 'scriptorium'],
  ['ash', 12, 'cloister'],
  ['ash', 20, 'scriptorium'],
  ['gareth', 8, 'smithy'],
  ['gareth', 18, 'drowned_lantern'],
  ['gareth', 22, 'smithy'],
  ['hale', 6, 'kitchen_garden'],
  ['hale', 18, 'cloister'],
  ['hob', 6, 'old_mill'],
  ['hob', 18, 'mill_loft'],
] as const;

export function boundedPopulations(world: World) {
  const counts: Record<string, number> = {};
  for (const [key, slot] of Object.entries(world.state.population_slots ?? {})) {
    if (slot.member_id === null) continue;
    const address = JSON.parse(key),
      origin = world.state.created?.[slot.member_id]?.origin;
    assert.equal(origin?.kind, 'spawned', 'population member lacks provenance');
    if (origin?.kind !== 'spawned') continue;
    assert.deepEqual(
      [origin.by.key, origin.slot, origin.generation],
      [address.plan.key, address.slot, slot.generation],
      'population provenance disagrees with its slot',
    );
    if (slot.replacement_due === null)
      counts[address.plan.key] = (counts[address.plan.key] ?? 0) + 1;
  }
  for (const [plan, count] of Object.entries(counts)) {
    assert.ok(Object.hasOwn(CAPS, plan), `unknown idle-world population ${plan}`);
    assert.ok(count <= CAPS[plan]!, `${plan} population ${count} exceeds ${CAPS[plan]}`);
  }
  const pending = Object.values(world.state.jobs ?? {}).filter((j) => j.status === 'pending');
  assert.equal(
    pending.length,
    13,
    'idle world needs exactly five schedule and eight population jobs',
  );
  assert.ok(
    pending.every((j) => j.due_time > world.state.clock),
    'pending job is already due',
  );
  return counts;
}

export function thirtyDays(a: CaseHost) {
  a.invoke('choose_ancestry', [], { ancestry: 'fen_born' });
  a.move('north', 'west');
  const torch = a.entity('item', 'torch');
  a.invoke('buy', [a.entity('npc', 'peg'), torch], { quoted_price: 3 });
  a.invoke('ignite', [torch]);
  const destinations = new Set<string>(),
    observedClocks: number[] = [];
  boundedPopulations(a.story.world());
  a.watch((_before, after, command) => {
    if (command.payload.type !== 'elapsed') return;
    boundedPopulations(after);
    const clock = after.state.clock;
    assert.equal(
      clock,
      64800 + 3600 * (observedClocks.length + 1),
      'elapsed commits must land on every hourly boundary',
    );
    assert.ok(clock > (observedClocks.at(-1) ?? 64800));
    observedClocks.push(clock);
    if (clock % 3600 === 0) {
      const hour = Math.floor(clock / 3600) % 24;
      for (const [npc, at, room] of DESTINATIONS)
        if (hour === at) {
          const id = a.entity('npc', npc),
            holder = after.state.containers[id];
          assert.equal(after.rooms[holder!]?.key, room, `${npc} missed ${at}:00 ${room}`);
          destinations.add(`${npc}/${at}/${room}`);
        }
    }
    if (clock === 68400) assert.equal(fuelView(after, torch)?.remaining, 3600);
    if (clock >= 72000)
      assert.deepEqual(fuelView(after, torch), { remaining: 0, capacity: 7200, lit: false });
  });
  a.elapsed(51_840_000);
  assert.equal(
    a.story.world().state.clock,
    2_656_800,
    'thirty adopted calendar days did not execute',
  );
  assert.equal(destinations.size, 12, 'not every authored schedule destination was observed');
  assert.equal(observedClocks.length, 720, 'thirty days must observe every hourly boundary');
  a.reopen();
  assert.equal(a.story.world().state.clock, 2_656_800);
  return {
    days: 30,
    start: 64800,
    until: 2_656_800,
    observed_boundaries: observedClocks.length,
    destinations: [...destinations].sort(),
    population_caps: CAPS,
    pending_jobs: 13,
    fuel: { remaining: 0, lit: false },
    per_step_digest: a.digest(),
  };
}
