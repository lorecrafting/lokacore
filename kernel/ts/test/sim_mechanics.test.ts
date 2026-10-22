import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Command } from '../src/contracts.gen.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { step, stepElapsed, type World } from '../src/index.ts';
import { checked, KERNEL } from './sim.ts';
import { fixture } from './c5_bleed_fixture.ts';

const id = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}` as never;

function driver(start: World) {
  let world = start,
    revision = 0;
  const run = (payload: object) => {
    const before = world;
    const plain = {
      id: id(++revision),
      world_context_id: world.context,
      payload: { actor_id: world.character, ...payload },
    } as unknown as Command;
    const command =
      plain.payload.type === 'elapsed'
        ? {
            ...plain,
            id: elapsedCommandId(
              plain.payload.run_id,
              world.context,
              plain.payload.from,
              plain.payload.until,
            ) as never,
          }
        : plain;
    const result = (command.payload.type === 'elapsed' ? stepElapsed : step)(
      world,
      command,
      revision,
    );
    assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
    world = result.world;
    return { before, command, result, revision };
  };
  return {
    run,
    world: () => world,
    tick: (until: number) =>
      run({ type: 'elapsed', run_id: id(9001), from: world.state.clock, until }),
  };
}

// Breaks: missing corpse or entity world inputs make a lawful fatal receipt fail the simulator's oracle.
test('simulator accepts the fatal receipt of a hound fight', () => {
  // Every hound hits for 1 and the player, at 1 HP, always misses.
  const { world, target } = fixture(100, 1);
  const a = driver(world);
  a.run({ type: 'attack', target_id: target });
  // The first hound round is due at 64800 + interval 150 = 64950 and kills the player.
  const fatal = a.tick(64950);
  assert.ok(
    fatal.result.decision.kind === 'accepted' &&
      fatal.result.decision.delta.ops.some(
        (o) => o.op === 'entity.create' && o.identity.origin.kind === 'death',
      ),
    'fatal receipt must create a death corpse',
  );
  assert.equal(
    checked({ ...KERNEL, step: () => fatal.result }, fatal.before, fatal.command, fatal.revision)
      .failure,
    undefined,
  );
  const decision = fatal.result.decision;
  assert.ok(decision.kind === 'accepted');
  const wrong = {
    ...fatal.result,
    decision: {
      ...decision,
      delta: { ops: decision.delta.ops.filter((o) => o.op !== 'entity.create') },
    },
  };
  assert.equal(
    checked({ ...KERNEL, step: () => wrong }, fatal.before, fatal.command, fatal.revision).failure
      ?.id,
    'adopt_mismatch',
  );
});
