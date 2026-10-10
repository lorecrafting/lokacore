// Writer groups inside one advance (loka-x2gv, loka-kgd.43): a due job joins every group that
// already wrote its rows, and a status join coexists with a completing sight job.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { refString, type World } from '../src/runtime/decision.ts';
import { apply, base } from '../src/runtime/apply.ts';
import { compose } from '../src/foundation/compose.ts';
import { check } from '../src/runtime/invariants.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { applyStatus } from '../src/mechanics/status/shared.ts';
import { step, stepElapsed } from '../src/index.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { command, elapsed, fixture, hp } from './c5_bleed_fixture.ts';
import { fresh, ref } from './deer_fixture.ts';
import { value } from '../src/mechanics/fact.ts';
import { sightHandoffValid } from '../src/foundation/compose_sight.ts';
import { sightHandoffHolds } from '../src/runtime/invariants_sight.ts';

/** `w` with status `key` (-1 HP every `every`, for `duration`) on `holder`, its job id `job`. */
function poisoned(
  w: World,
  holder: string,
  job: string,
  every: number,
  duration: number,
  key = 'poison',
) {
  const { id, version } = w.cartridge.manifest;
  const poison = { cartridge_id: id, cartridge_version: version, kind: 'status', key };
  const any = Object.keys(w.cartridge.text)[0]!;
  const spec = {
    duration,
    tick_every: every,
    resource: resourceRef(w, 'hp'),
    per_tick: -1,
    label: any,
    narration: { applied: any, tick: any, expired: any },
  };
  const statuses = { ...w.cartridge.statuses, [refString(poison as never)]: spec };
  const moved = { ...w, cartridge: { ...w.cartridge, statuses } as never } as World;
  const out = apply(
    moved,
    applyStatus(moved, holder as never, poison as never, 0, () => job as never),
    false,
  );
  assert.ok('world' in out, JSON.stringify(out));
  return out.world;
}

// loka-x2gv (a), both job orders. Breaks: a round paired with an equal-due bleed tick (bleed first)
// takes the bleed's group and never joins (or registers) its opponent's status group, so the
// opponent's poison tick at the same clock writes the hound's HP in another group: the wait
// faults conflicting_write.
test('a bleed-paired round and the hound poison tick at one clock commit in one wait', () => {
  const orders = new Set<string>();
  for (let n = 4; n < 20 && orders.size < 2; n++) {
    const { world, target, room } = fixture();
    const first = elapsed(
      command(world, 1, { type: 'attack', target_id: target }, 1).world,
      64950,
      2,
    );
    const fled = command(first.world, 2, { type: 'flee' }, 3);
    const waited = elapsed(fled.world, 65000, 4);
    const from = waited.world.state.containers[world.body];
    const direction = Object.entries(waited.world.rooms[from].exits).find(
      ([, edge]) => waited.world.roomIds[refString(edge.to)] === room,
    )![0];
    const back = command(
      command(waited.world, 3, { type: 'move', direction }, 5).world,
      n,
      { type: 'attack', target_id: target },
      6,
    );
    const tick = elapsed(back.world, 65050, 7).world;
    const row = Object.values(tick.state.encounters ?? {}).find((e) => e.status === 'open')!;
    const bleed = tick.state.bleeds![world.body]!;
    assert.ok(bleed.active);
    orders.add(row.job_id < bleed.job_id ? 'round_first' : 'bleed_first');
    const combat = tick.cartridge.world!.combat!;
    const sure = {
      ...tick,
      cartridge: {
        ...tick.cartridge,
        world: {
          ...tick.cartridge.world!,
          combat: { ...combat, player_attack: { chance: 100, damage_min: 1, damage_max: 1 } },
        },
      },
    } as World;
    const hounds = level(sure, target, resourceRef(sure, 'hp'))!;
    // The poison ticks at 65150 (65050 + 100), after the bleed and the round (its id sorts last).
    const ready = poisoned(sure, target, 'ffffffff-0000-4000-8000-000000000001', 100, 300);
    const r = elapsed(ready, 65150, 8);
    assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
    // The bleed tick takes 1 and the hound's sure hit 1 (10 - 4 by 65050 in the C5 pairing case).
    assert.equal(hp(r.world), 6);
    // The player's sure blow takes 1 and the poison 1.
    assert.equal(level(r.world, target, resourceRef(r.world, 'hp')), hounds - 2);
  }
  assert.deepEqual([...orders].sort(), ['bleed_first', 'round_first']);
});

// loka-kgd.43. Breaks: a sight job completes between two writes that share an older writer group
// in one wait (two status ticks on the body, or a reaction to each tick adjusting one fact row,
// loka-j2mo); the sight handoff check (compose_sight.ts, invariants_sight.ts) refuses any older
// group but the handoff pair, so the wait faults precondition_failed. One wait equals the same
// play in three waits.
test('a sight flight between two status or fact-row joins commits as step-by-step play', () => {
  const walk = (w: World, n: number, direction: string) =>
    step(
      w,
      {
        id: `aaaaaaaa-0000-4000-8000-00000000000${n}`,
        world_context_id: w.context,
        payload: { type: 'move', actor_id: w.character, direction },
      } as never,
      n,
    ).world;
  const at = walk(walk(walk(fresh(), 1, 'south'), 2, 'south'), 3, 'west');
  assert.equal(at.state.clock, 64800);
  const wait = (w: World, until: number) => {
    const run = 'bbbbbbbb-0000-4000-8000-000000000001';
    const payload = {
      type: 'elapsed',
      actor_id: w.character,
      run_id: run,
      from: w.state.clock,
      until,
    };
    const id = elapsedCommandId(run as never, w.context, w.state.clock, until);
    return stepElapsed(w, { id, world_context_id: w.context, payload } as never, 5);
  };
  const fact = {
    cartridge_id: at.cartridge.manifest.id,
    cartridge_version: at.cartridge.manifest.version,
    kind: 'fact',
    key: 'maud_trust',
  } as never;
  const item = Object.keys(at.entities).find((e) => at.entities[e]!.kind === 'item')!;
  // Poison on the body ticks at 65050 and chill (on the body, or on an item) at 65200, each next
  // one after the wait; the deer's sight flight is due at 65100. With `counted`, a reaction adds 1
  // to the player's maud_trust on each tick.
  for (const [chilled, counted] of [
    [at.body, false],
    [item, true],
  ] as const) {
    const key = 'zz_count_ticks';
    const rule = {
      key,
      on: { event: 'status_ticked' },
      apply: [{ op: 'fact.adjust', fact, amount: 1 }],
    };
    const reactions = { ...at.cartridge.reactions, [ref('reaction', key)]: rule };
    const start = counted ? ({ ...at, cartridge: { ...at.cartridge, reactions } } as World) : at;
    const poison = poisoned(start, start.body, 'cccccccc-0000-4000-8000-000000000001', 250, 1000);
    const ready = poisoned(
      poison,
      chilled,
      'cccccccc-0000-4000-8000-000000000002',
      400,
      1000,
      'chill',
    );
    const one = wait(ready, 65200);
    assert.equal(one.decision.kind, 'accepted', JSON.stringify(one.decision));
    const delta = one.decision.kind === 'accepted' && one.decision.delta;
    const result = compose(base(ready), delta as never);
    assert.ok(check('delta_preconditions_hold', { state: base(ready), delta, result }));
    const three = wait(wait(wait(ready, 65050).world, 65100).world, 65200).world;
    assert.equal(hp(one.world), hp(ready)! - (counted ? 1 : 2));
    assert.equal(value(one.world, one.world.character, fact), counted ? 2 : 0);
    assert.deepEqual(one.world.state, three.state);
  }
});

// loka-x2gv. Breaks: a bleed tick with no round to pair registers no holder group, so a status
// tick on the same body later in the wait writes its HP in another group: conflicting_write.
test('a lone bleed tick and a later poison tick on one body commit in one wait', () => {
  const { world, target } = fixture();
  const first = elapsed(
    command(world, 1, { type: 'attack', target_id: target }, 1).world,
    64950,
    2,
  );
  const waited = elapsed(command(first.world, 2, { type: 'flee' }, 3).world, 65000, 4).world;
  const bleed = waited.state.bleeds![world.body]!;
  assert.ok(bleed.active && bleed.next_tick_at === 65050);
  // The poison ticks at 65060, after the bleed's 65050 tick.
  const ready = poisoned(waited, waited.body, 'cccccccc-0000-4000-8000-000000000001', 60, 300);
  const r = elapsed(ready, 65100, 5);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  assert.equal(hp(r.world), hp(ready)! - 2);
});

// loka-kgd.43 review finding 1. Breaks: the invariant exempts op kinds while compose exempts every
// write outside the sighted deer's encounter, so another NPC's round that joins an older group
// after a sight passes compose and fails the invariant; and a deer-encounter advance in that older
// group must still fail both.
test('after a sight, only the sighted deer encounter is held to the handoff, in both checks', () => {
  const state = {
    jobs: { s: { status: 'pending', sight: { member_id: 'deer' } }, r: { status: 'pending' } },
    encounters: {
      e1: { npc_id: 'deer', status: 'open' },
      e2: { npc_id: 'goblin', status: 'open' },
    },
  } as never;
  const ops = (encounter: string) =>
    [
      { op: 'job.complete', job_id: 'r0', writer_group: 1 },
      { op: 'job.complete', job_id: 's', writer_group: 2 },
      { op: 'encounter.advance', encounter_id: encounter, job_id: 'r', writer_group: 1 },
      { op: 'job.complete', job_id: 'r', writer_group: 1 },
    ] as never[];
  for (const [encounter, ok] of [
    ['e2', true],
    ['e1', false],
  ] as const) {
    assert.equal(sightHandoffValid(state, ops(encounter)), ok, encounter);
    assert.equal(sightHandoffHolds(state, ops(encounter), state), ok, encounter);
  }
});

// loka-x2gv (protocol.md C5 pair clause). A bleed tick joins its body's group with no pair binding
// check; that is safe only because a stale occurrence writes nothing but its own completion. Breaks:
// a bleed job whose generation no longer matches the body's row still ticks HP in the round's group.
test('a stale bleed occurrence due with the round joins its group but writes no hp', () => {
  const { world, target, room } = fixture();
  const first = elapsed(
    command(world, 1, { type: 'attack', target_id: target }, 1).world,
    64950,
    2,
  );
  const waited = elapsed(command(first.world, 2, { type: 'flee' }, 3).world, 65000, 4);
  const from = waited.world.state.containers[world.body];
  const direction = Object.entries(waited.world.rooms[from].exits).find(
    ([, edge]) => waited.world.roomIds[refString(edge.to)] === room,
  )![0];
  const moved = command(waited.world, 3, { type: 'move', direction }, 5).world;
  const back = command(moved, 4, { type: 'attack', target_id: target }, 6).world;
  const tick = elapsed(back, 65050, 7).world;
  const id = (tick.state.bleeds![world.body] as { job_id: string }).job_id;
  const round = Object.values(tick.state.encounters ?? {}).find((e) => e.status === 'open')!;
  const job = tick.state.jobs![id]!;
  assert.equal(job.due_time, tick.state.jobs![round.job_id]!.due_time);
  const jobs = { ...tick.state.jobs, [id]: { ...job, bleed_generation: 2 } };
  const stale = { ...tick, state: { ...tick.state, jobs } } as World;
  const r = elapsed(stale, job.due_time, 8);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  const ops = r.decision.kind === 'accepted' ? r.decision.delta.ops : [];
  const own = ops.filter((o) => 'job_id' in o && o.job_id === id);
  assert.deepEqual(
    own.map((o) => o.op),
    ['job.complete'],
  );
  const group = (of: string) =>
    ops.find((o) => o.op === 'job.complete' && o.job_id === of)!.writer_group;
  assert.equal(group(id), group(round.job_id));
  // Only the hound's sure hit (1) lands; a live bleed tick would take another 1.
  assert.equal(hp(r.world), hp(tick)! - 1);
});
