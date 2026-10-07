// size: allow 525, deer same-clock behavior and counterfeit cause share the controlled journey
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { gameView, INSTALLED, loadCartridge, step, stepElapsed, type World } from '../src/index.ts';
import { encode } from '../src/foundation/canonical.ts';
import { elapsedCommandId, jobCommandId } from '../src/foundation/id_source.ts';
import { sightRebindValid } from '../src/foundation/compose_sight_rebind.ts';
import { compose } from '../src/foundation/compose.ts';
import { base } from '../src/runtime/apply.ts';
import { runSight } from '../src/mechanics/population/behavior.ts';
import { content, fresh, ref } from './deer_fixture.ts';
import { read } from './read.ts';
const run = 'bbbbbbbb-0000-4000-8000-000000000001' as never;
const missSeed = [2710938419, 1329376837, 2657997399, 1914447725] as const;
function command(w: World, type: 'move' | 'attack', argument: string, n: number) {
  const payload =
    type === 'move'
      ? { type, actor_id: w.character, direction: argument }
      : { type, actor_id: w.character, target_id: argument };
  const r = step(
    w,
    {
      id: `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`,
      world_context_id: w.context,
      payload,
    } as never,
    n,
  );
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
function walkToWillow(w: World) {
  return command(command(command(w, 'move', 'south', 1), 'move', 'south', 2), 'move', 'west', 3);
}
function deer(w: World, home: string) {
  return Object.entries(w.state.created ?? {}).find(
    ([, i]) => i.origin.kind === 'spawned' && i.origin.role === 'deer' && i.definition.key === home,
  )?.[0] as never;
}
function elapsed(w: World, until: number, n = 5) {
  const r = stepElapsed(
    w,
    {
      id: elapsedCommandId(run, w.context, w.state.clock, until) as never,
      world_context_id: w.context,
      payload: { type: 'elapsed', actor_id: w.character, run_id: run, from: w.state.clock, until },
    },
    n,
  );
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r;
}
function advance(w: World, until: number): World {
  while (w.state.clock < until) {
    const due = Object.values(w.state.jobs ?? {})
      .filter((j) => j.status === 'pending')
      .map((j) => j.due_time)
      .filter((at) => at > w.state.clock);
    w = elapsed(w, Math.min(until, ...due)).world;
  }
  return w;
}
function slot(w: World, member: string) {
  return Object.values(w.state.population_slots ?? {}).find((s) => s.member_id === member)!;
}
// Breaks: a new plan shifts genesis allocation or mints a second member or hide.
test('provisional v040 genesis IDs include all three deer pairs and control jobs', () => {
  const w = fresh();
  const expected = read('protocol/fixtures/missing_child_v040_ids.json');
  for (const name of ['oak_deer', 'orchard_deer', 'willow_deer']) {
    for (const role of ['deer', 'hide']) {
      const id = Object.entries(w.state.created ?? {}).find(
        ([, row]) =>
          row.origin.kind === 'spawned' && row.origin.by.key === name && row.origin.role === role,
      )?.[0];
      assert.equal(id, expected[`population/${name}/slot1/${role}`], `${name}/${role}`);
    }
    const job = Object.entries(w.state.jobs ?? {}).find(([, row]) => row.job.key === name)?.[0];
    assert.equal(job, expected[`population/${name}/job`], `${name}/job`);
  }
});

// Breaks: a deer birth reuses hound provenance, duplicates a hide, or exceeds its one-slot plan.
test('three independent fresh deer each hold one typed hide at their authored home', () => {
  const w = fresh();
  for (const [name, home] of [
    ['willow_deer', 'willow_shade'],
    ['oak_deer', 'drowned_oak'],
    ['orchard_deer', 'orchard'],
  ]) {
    const id = deer(w, name);
    const origin = w.state.created![id]!.origin;
    assert.equal(origin.kind, 'spawned');
    assert.equal(w.state.containers[id], w.roomIds[ref('room', home)]);
    assert.equal(slot(w, id).generation, 1);
    const hides = Object.entries(w.state.created ?? {}).filter(
      ([item, i]) =>
        i.origin.kind === 'spawned' &&
        i.origin.role === 'hide' &&
        i.origin.member_id === id &&
        w.state.containers[item] === id,
    );
    assert.equal(hides.length, 1);
    assert.equal(w.entities[hides[0]![0]]?.kind, 'item');
    const hide = w.entities[hides[0]![0]];
    assert.equal(hide?.kind === 'item' && hide.mass_grams, 100);
  }
  assert.equal(
    Object.values(w.state.created ?? {}).filter(
      (i) => i.origin.kind === 'spawned' && i.origin.role === 'deer',
    ).length,
    3,
  );
});

// Breaks: player entry fails to bind the original deer, or sight flight creates loot or moves it outside the two-room area.
test('unengaged +300 sight flight preserves the same live deer and held hide', () => {
  let w = walkToWillow(fresh());
  const id = deer(w, 'willow_deer');
  const pending = Object.entries(w.state.jobs ?? {}).filter(
    ([, j]) => j.status === 'pending' && j.sight,
  );
  assert.equal(pending.length, 1);
  assert.equal(pending[0]![1].due_time, 65100);
  assert.ok(gameView(w).entities.some((e) => e.id === id));
  const before = Object.keys(w.state.created ?? {}).length;
  const r = elapsed(w, 65100);
  w = r.world;
  assert.deepEqual(r.decision.kind === 'accepted' && r.decision.narration, [
    { key: 'combat.deer_fled_south' },
  ]);
  assert.equal(w.state.containers[id], w.roomIds[ref('room', 'drowned_oak')]);
  assert.ok(!gameView(w).entities.some((e) => e.id === id));
  assert.equal(slot(w, id).replacement_due, null);
  assert.equal(Object.keys(w.state.created ?? {}).length, before);
  const hide = Object.entries(w.state.created ?? {}).find(
    ([, i]) => i.origin.kind === 'spawned' && i.origin.role === 'hide' && i.origin.member_id === id,
  )![0];
  assert.equal(w.state.containers[hide], id);
});

// Breaks: a fatal +150 round drops no hide, makes extra loot, or replenishes the slot before its two-day due time.
test('+150 death transfers the one hide to the corpse and replacement waits until +172800', () => {
  let w = walkToWillow(fresh());
  const id = deer(w, 'willow_deer');
  w = command(w, 'attack', id, 4);
  const death = elapsed(w, 64950);
  w = death.world;
  const hideTransfers =
    death.decision.kind === 'accepted' &&
    death.decision.delta.ops.filter((o) => {
      const origin = o.op === 'entity.transfer' && w.state.created?.[o.entity_id]?.origin;
      return origin && origin.kind === 'spawned' && origin.role === 'hide';
    });
  assert.equal(hideTransfers && hideTransfers.length, 1);
  const row = slot(w, id);
  assert.equal(row.replacement_due, 237750);
  const corpse = Object.entries(w.state.created ?? {}).find(
    ([, i]) => i.origin.kind === 'death' && i.origin.victim_id === id,
  )![0];
  const hide = Object.entries(w.state.created ?? {}).find(
    ([, i]) => i.origin.kind === 'spawned' && i.origin.role === 'hide' && i.origin.member_id === id,
  )![0];
  assert.equal(w.state.containers[hide], corpse);
  assert.equal(w.state.created![corpse]!.definition.key, 'deer_corpse');
  const taken = step(
    w,
    {
      id: 'aaaaaaaa-0000-4000-8000-000000000030' as never,
      world_context_id: w.context,
      payload: { type: 'take', actor_id: w.character, item_id: hide as never },
    },
    30,
  );
  assert.equal(taken.decision.kind, 'accepted', JSON.stringify(taken.decision));
  assert.equal(taken.world.state.containers[hide], taken.world.body);
  assert.ok(gameView(taken.world).inventory.some((e) => e.id === hide));
  assert.equal(
    Object.values(w.state.population_slots ?? {}).filter((s) => {
      const origin = s.member_id && w.state.created?.[s.member_id]?.origin;
      return s.replacement_due === null && origin?.kind === 'spawned' && origin.role === 'deer';
    }).length,
    2,
  );
});

// Breaks: a different deer's earlier equal-time sight steals the Willow encounter handoff.
test('equal-time Oak sight does not consume Willow round handoff', () => {
  let w = walkToWillow(fresh(missSeed));
  const willow = deer(w, 'willow_deer');
  w = elapsed(w, 65100).world;
  w = elapsed(w, 68100).world;
  w = command(w, 'move', 'south', 8);
  const sights = Object.entries(w.state.jobs ?? {}).filter(
    ([, j]) => j.status === 'pending' && j.sight && j.due_time === 68400,
  );
  assert.deepEqual(
    sights.map(([, j]) => j.sight!.member_id),
    [deer(w, 'oak_deer'), willow],
  );
  w = { ...w, state: { ...w.state, rng: missSeed as never } };
  w = command(w, 'attack', willow, 10);
  w = elapsed(w, 68250).world;
  assert.equal(Object.values(w.state.encounters ?? {})[0]?.status, 'open');
  assert.equal(w.state.jobs?.[Object.values(w.state.encounters ?? {})[0]!.job_id]?.due_time, 68400);
  const result = elapsed(w, 68400);
  assert.ok(
    result.decision.kind === 'accepted' &&
      result.decision.delta.ops.some((o) => o.op === 'encounter.advance'),
    JSON.stringify(result.decision),
  );
  assert.equal(
    result.world.state.containers[willow],
    result.world.roomIds[ref('room', 'willow_shade')],
  );
  assert.equal(Object.values(result.world.state.encounters ?? {})[0]?.status, 'closed');
});

// Breaks: a harmless sight clear conflicts with a later equal-time arrival's new binding.
test('same-time harmless Oak sight and Oak arrival rebind the one slot', () => {
  let w = walkToWillow(fresh());
  const oak = deer(w, 'oak_deer');
  w = elapsed(w, 65100).world;
  w = elapsed(w, 68100).world;
  w = command(w, 'move', 'south', 8);
  w = command(w, 'move', 'north', 9);
  const result = elapsed(w, 68400);
  const row = slot(result.world, oak);
  assert.equal(
    result.world.state.containers[oak],
    result.world.roomIds[ref('room', 'willow_shade')],
  );
  assert.equal(row.sight_job_id !== null, true);
  assert.equal(result.world.state.jobs?.[row.sight_job_id!]?.due_time, 68700);
  if (result.decision.kind !== 'accepted') return;
  const unrelated = result.decision.delta.ops.map((op) =>
    op.op === 'population.slot' && op.value.sight_job_id === row.sight_job_id
      ? { ...op, writer_group: op.writer_group + 9 }
      : op,
  );
  const fault = compose(base(w), { ops: unrelated } as never);
  assert.deepEqual('fault' in fault && fault.fault.code, 'conflicting_write');
});

// Breaks: a second sight job masquerades as the current population control occurrence.
test('sight-only completion cannot authorize an equal-time slot rebind', () => {
  let w = walkToWillow(fresh());
  w = elapsed(w, 65100).world;
  w = elapsed(w, 68100).world;
  w = command(w, 'move', 'south', 8);
  w = command(w, 'move', 'north', 9);
  const oak = deer(w, 'oak_deer');
  const [oldId, oldJob] = Object.entries(w.state.jobs ?? {}).find(
    ([, job]) => job.status === 'pending' && job.sight?.member_id === oak,
  )!;
  const control = Object.entries(w.state.population_plans ?? {}).find(
    ([, row]) => w.state.jobs?.[row.job_id]?.job.key === 'oak_deer',
  )![1];
  const fake = '00000000-0000-4000-8000-000000000099';
  assert.notEqual(fake, oldId);
  const result = elapsed(w, 68400);
  assert.equal(result.decision.kind, 'accepted');
  if (result.decision.kind !== 'accepted') return;
  const ops = result.decision.delta.ops.map((op) => {
    if (op.op === 'job.complete' && op.job_id === control.job_id) return { ...op, job_id: fake };
    if (op.op === 'job.schedule' && op.sight?.member_id === oak)
      return { ...op, sight: { ...op.sight, cause_id: jobCommandId(fake, 68400) } };
    return op;
  });
  const index = ops.findIndex(
    (op) =>
      op.op === 'population.slot' && op.value.sight_job_id != null && op.value.member_id === oak,
  );
  const clear = ops.find(
    (op) =>
      op.op === 'population.slot' && op.value.sight_job_id == null && op.value.member_id === oak,
  );
  assert.ok(index > 0 && clear?.op === 'population.slot');
  const state = { ...base(w), jobs: { ...w.state.jobs, [fake]: oldJob } };
  assert.equal(sightRebindValid(state, ops as never, index, clear.writer_group), false);
});

// Breaks: an equal-due surviving round blocks sight with conflicting_write, or flight leaves its successor active.
test('two missed rounds hand off only the matching encounter and successor at +300', () => {
  let w = walkToWillow(fresh(missSeed));
  const id = deer(w, 'willow_deer');
  w = command(w, 'attack', id, 4);
  w = elapsed(w, 64950).world;
  const r = elapsed(w, 65100);
  assert.equal(r.decision.kind, 'accepted');
  assert.equal(r.world.state.containers[id], r.world.roomIds[ref('room', 'drowned_oak')]);
  assert.equal(Object.values(r.world.state.encounters ?? {})[0]?.status, 'closed');
  const group =
    r.decision.kind === 'accepted' &&
    r.decision.delta.ops.find((o) => o.op === 'encounter.advance')?.writer_group;
  assert.ok(group);
  const closed =
    r.decision.kind === 'accepted' && r.decision.delta.ops.find((o) => o.op === 'encounter.close');
  assert.equal(closed && closed.writer_group, group);
  const sightDone =
    r.decision.kind === 'accepted' &&
    r.decision.delta.ops.find((o) => o.op === 'job.complete' && w.state.jobs?.[o.job_id]?.sight);
  assert.notEqual(sightDone && sightDone.writer_group, group);
  const successor =
    r.decision.kind === 'accepted' &&
    r.decision.delta.ops.find((o) => o.op === 'job.schedule' && o.encounter_id);
  assert.equal(
    successor && successor.op === 'job.schedule' && r.world.state.jobs?.[successor.job_id]?.status,
    'cancelled',
  );
});

// Breaks: sight-first equal-time ordering leaves the round active or lets it strike from the next room.
test('sight-first +300 cancels the pending round before any off-room hit', () => {
  let w = walkToWillow(fresh(missSeed));
  const id = deer(w, 'willow_deer');
  w = command(w, 'attack', id, 7);
  w = elapsed(w, 64950).world;
  const round = Object.values(w.state.encounters ?? {})[0]!.job_id;
  const r = elapsed(w, 65100);
  assert.equal(r.decision.kind, 'accepted');
  if (r.decision.kind !== 'accepted') return;
  assert.deepEqual(
    r.decision.events.filter((e) => e.payload.type === 'attack_result'),
    [],
  );
  assert.equal(r.world.state.jobs?.[round]?.status, 'cancelled');
  assert.equal(r.world.state.containers[id], r.world.roomIds[ref('room', 'drowned_oak')]);
  assert.equal(Object.values(r.world.state.encounters ?? {})[0]?.status, 'closed');
  const close = r.decision.delta.ops.find((o) => o.op === 'encounter.close');
  const sightDone = r.decision.delta.ops.find(
    (o) => o.op === 'job.complete' && w.state.jobs?.[o.job_id]?.sight,
  );
  assert.equal(close?.writer_group, sightDone?.writer_group);
});

// Breaks: the narrow handoff silently permits an unrelated cross-group encounter overwrite.
test('an unrelated group still conflicts on the encounter target', () => {
  let w = walkToWillow(fresh(missSeed));
  const id = deer(w, 'willow_deer');
  w = command(w, 'attack', id, 4);
  w = elapsed(w, 64950).world;
  const r = elapsed(w, 65100);
  assert.equal(r.decision.kind, 'accepted');
  if (r.decision.kind !== 'accepted') return;
  const ops = r.decision.delta.ops.map((o) =>
    o.op === 'encounter.close' ? { ...o, writer_group: o.writer_group + 9 } : o,
  );
  const result = compose(base(w), { ops } as never);
  assert.deepEqual('fault' in result && result.fault.code, 'conflicting_write');
});

// Breaks: leaving and re-entering keeps the original sight occurrence live or fires before the new +300 deadline.
test('re-entry replaces the pending generation sight occurrence', () => {
  let w = walkToWillow(fresh());
  const id = deer(w, 'willow_deer');
  const old = Object.entries(w.state.jobs ?? {}).find(
    ([, j]) => j.status === 'pending' && j.sight,
  )![0];
  w = command(w, 'move', 'east', 4);
  w = elapsed(w, 64900).world;
  w = command(w, 'move', 'west', 6);
  assert.equal(w.state.jobs?.[old]?.status, 'cancelled');
  const next = Object.entries(w.state.jobs ?? {}).find(
    ([, j]) => j.status === 'pending' && j.sight,
  )!;
  assert.equal(next[1].due_time, 65200);
  w = elapsed(w, 65100).world;
  assert.equal(w.state.containers[id], w.roomIds[ref('room', 'willow_shade')]);
  w = elapsed(w, 65200).world;
  assert.equal(w.state.containers[id], w.roomIds[ref('room', 'drowned_oak')]);
});

// Breaks: a same-deadline population wander and sight each transfer the deer, or create a second hide.
test('intervening population at the sight deadline transfers at most once', () => {
  let w = walkToWillow(fresh());
  const id = deer(w, 'willow_deer');
  w = elapsed(w, 65100).world;
  w = elapsed(w, 68100).world;
  w = command(w, 'move', 'south', 8);
  const sight = Object.entries(w.state.jobs ?? {}).find(
    ([, j]) => j.status === 'pending' && j.sight,
  )![1];
  assert.equal(sight.due_time, 68400);
  const r = elapsed(w, 68400);
  assert.equal(r.decision.kind, 'accepted');
  if (r.decision.kind !== 'accepted') return;
  assert.equal(
    r.decision.delta.ops.filter((o) => o.op === 'entity.transfer' && o.entity_id === id).length,
    1,
  );
  assert.equal(
    Object.values(r.world.state.created ?? {}).filter(
      (i) => i.origin.kind === 'spawned' && i.origin.role === 'hide' && i.origin.member_id === id,
    ).length,
    1,
  );
  assert.equal(r.world.state.containers[id], r.world.roomIds[ref('room', 'willow_shade')]);
});

// Breaks: a stale occurrence whose member generation changed can move the new slot's deer.
test('generation mismatch makes a sight occurrence harmless', () => {
  const w = walkToWillow(fresh());
  const [jobId, job] = Object.entries(w.state.jobs ?? {}).find(
    ([, j]) => j.status === 'pending' && j.sight,
  )!;
  const [slotKey, row] = Object.entries(w.state.population_slots ?? {}).find(
    ([, s]) => s.member_id === job.sight!.member_id,
  )!;
  const stale = {
    ...w,
    state: {
      ...w.state,
      population_slots: {
        ...w.state.population_slots,
        [slotKey]: { ...row, generation: row.generation + 1 },
      },
    },
  } as World;
  const result = runSight(stale, jobId as never, job, { n: 0 });
  assert.equal(result.kind, 'accepted');
  if (result.kind === 'accepted')
    assert.deepEqual(
      result.delta.ops.map((o) => o.op),
      ['job.complete'],
    );
});

// Breaks: a dead slot refills early, or its due replacement reuses the dead identity or loses the one-hide bundle.
test('dead deer replacement appears at its exact two-day due time with a new pair', () => {
  let w = walkToWillow(fresh());
  const dead = deer(w, 'willow_deer');
  w = command(w, 'attack', dead, 4);
  w = elapsed(w, 64950).world;
  w = advance(w, 237749);
  assert.equal(slot(w, dead).member_id, dead);
  assert.equal(slot(w, dead).replacement_due, 237750);
  w = elapsed(w, 237750).world;
  const live = Object.values(w.state.population_slots ?? {}).find(
    (s) =>
      s.generation === 2 &&
      s.member_id &&
      w.state.created?.[s.member_id]?.definition.key === 'willow_deer',
  )!.member_id!;
  assert.notEqual(live, dead);
  assert.equal(slot(w, live).generation, 2);
  assert.equal(slot(w, live).replacement_due, null);
  assert.equal(
    Object.entries(w.state.created ?? {}).filter(
      ([item, i]) =>
        i.origin.kind === 'spawned' &&
        i.origin.role === 'hide' &&
        i.origin.member_id === live &&
        w.state.containers[item] === live,
    ).length,
    1,
  );
});

// Breaks: repeated wander or replacement cycles multiply live members or hide origins over thirty logical days.
test('thirty-day replay conserves three live deer and one hide per actual birth', () => {
  let w = walkToWillow(fresh());
  const victim = deer(w, 'willow_deer');
  w = command(w, 'attack', victim, 4);
  w = elapsed(w, 64950).world;
  w = advance(w, 64800 + 30 * 86400);
  const slots = Object.values(w.state.population_slots ?? {}).filter((s) => {
    const origin = s.member_id && w.state.created?.[s.member_id]?.origin;
    return origin && origin.kind === 'spawned' && origin.role === 'deer';
  });
  assert.equal(slots.length, 3);
  assert.equal(slots.filter((s) => s.replacement_due === null).length, 3);
  assert.equal(slots.filter((s) => s.generation === 2).length, 1);
  assert.equal(
    Object.values(w.state.created ?? {}).filter(
      (i) => i.origin.kind === 'spawned' && i.origin.role === 'deer',
    ).length,
    4,
  );
  assert.equal(
    Object.values(w.state.created ?? {}).filter(
      (i) => i.origin.kind === 'spawned' && i.origin.role === 'hide',
    ).length,
    4,
  );
});

// Breaks: a hash-correct untrusted cartridge bypasses the deer role pair or sight route checks.
test('loader refuses malformed deer roles, missing hide and flight text', () => {
  for (const changed of ['role', 'narration', 'missing_item']) {
    const c = structuredClone(content) as any;
    if (changed === 'role')
      c.population_bundles[ref('population_bundle', 'willow_deer')].loot_role = 'pelt';
    else if (changed === 'narration')
      delete c.populations[ref('population', 'willow_deer')].sight.narration.south;
    else delete c.population_bundles[ref('population_bundle', 'willow_deer')].item;
    const canonical = encode(c);
    const hash = createHash('sha256').update(canonical).digest('hex');
    const loaded = loadCartridge(
      new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${hash}"}`),
      INSTALLED,
    );
    assert.equal(loaded.ok, false, changed);
  }
});

// Breaks: a hash-correct sight-enabled hound cartridge loads but cannot cold-reopen its first world.
test('loader refuses sight on a hound and pelt bundle', () => {
  const c = structuredClone(content) as any;
  c.populations[ref('population', 'fen_hounds')].sight = {
    delay: 300,
    narration: {
      east: 'combat.deer_fled_east',
      west: 'combat.deer_fled_west',
    },
  };
  const canonical = encode(c);
  const hash = createHash('sha256').update(canonical).digest('hex');
  const loaded = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${hash}"}`),
    INSTALLED,
  );
  assert.equal(loaded.ok, false);
});
