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

// loka-x2gv (a). Breaks: a round paired with an equal-due bleed tick takes the bleed's group and
// never joins (or registers) its opponent's status group, so the opponent's poison tick due at
// the same clock writes the hound's HP in another group: the wait faults conflicting_write.
test('a bleed-paired round and the hound poison tick at one clock commit in one wait', () => {
  for (let n = 4; n < 20; n++) {
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
    if (!bleed.active || row.job_id < bleed.job_id) continue; // bleed first wanted
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
    return;
  }
  assert.fail('no bleed-first ordering found');
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
