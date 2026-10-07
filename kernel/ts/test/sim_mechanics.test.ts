import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Command } from '../src/contracts.gen.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { compose } from '../src/foundation/compose.ts';
import {
  INSTALLED,
  loadCartridge,
  newWorld,
  step,
  stepElapsed,
  type Cartridge,
  type World,
} from '../src/index.ts';
import { gameView } from '../src/runtime/world.ts';
import { check } from '../src/runtime/invariants.ts';
import { base, checked, KERNEL } from './sim.ts';
import { read } from './read.ts';

const bundle = read('protocol/fixtures/missing_child_v042_hash.json');
const loaded = loadCartridge(
  new TextEncoder().encode(
    JSON.stringify({ cartridge: bundle.value, content_hash: bundle.sha256 }),
  ),
  INSTALLED,
);
assert.ok(loaded.ok, JSON.stringify(loaded));
const content = loaded.cartridge as Cartridge;
const id = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}` as never;
const fresh = () => newWorld(content, id(100), [1, 2, 3, 4]);

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

// Breaks: the simulator rejects a legal C6 Start because its delta checker reads the clock as the prior expedition row.
test('simulator accepts a legal Night Marsh Start and refuses a false prior attempt', () => {
  const a = driver(fresh());
  a.run({ type: 'choose_ancestry', ancestry: 'road_born' });
  for (const direction of ['south', 'south', 'east']) a.run({ type: 'move', direction });
  const detail_id = Object.entries(a.world().details).find(([, d]) => d.key === 'gnawed_bones')![0];
  const start = a.run({ type: 'expedition', detail_id, transition: 'start' });
  assert.equal(
    checked({ ...KERNEL, step: () => start.result }, start.before, start.command, start.revision)
      .failure,
    undefined,
  );
  const decision = start.result.decision;
  assert.ok(decision.kind === 'accepted');
  const state = base(start.before);
  const result = compose(state as never, decision.delta);
  assert.ok(!('fault' in result));
  assert.equal(
    check('delta_preconditions_hold', {
      state,
      delta: {
        ops: decision.delta.ops.map((op) =>
          op.op === 'expedition.transition' ? { ...op, expected: op.value } : op,
        ),
      },
      result,
    }),
    false,
  );
});

// Breaks: missing corpse/population/entity world inputs make a lawful fatal receipt fail the simulator's oracle.
test('simulator accepts the fatal receipt of the chapter combat and bleed journey', () => {
  const a = driver(fresh());
  a.run({ type: 'choose_ancestry', ancestry: 'fey_touched' });
  for (const direction of ['south', 'south', 'east']) a.run({ type: 'move', direction });
  a.tick(67950);
  const target = Object.entries(a.world().state.created!).find(
    ([member, e]) =>
      e.origin.kind === 'spawned' &&
      e.origin.role === 'hound' &&
      a.world().state.containers[member] === a.world().state.containers[a.world().body],
  )![0];
  a.run({ type: 'attack', target_id: target });
  let fatal: ReturnType<typeof a.run> | undefined;
  for (const until of [
    68100, 68200, 68250, 68300, 68400, 68500, 68550, 68600, 68700, 68750, 68800, 68850, 68900,
  ]) {
    const out = a.tick(until);
    if (
      out.result.decision.kind === 'accepted' &&
      out.result.decision.delta.ops.some(
        (o) => o.op === 'entity.create' && o.identity.origin.kind === 'death',
      )
    )
      fatal = out;
  }
  assert.ok(fatal, 'fatal receipt must create a death corpse');
  assert.equal(fatal.result.world.state.clock, 68900);
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

// Breaks: the simulator writes a retired quest as null instead of deleting its row, rejecting explicit repeat.
test('simulator accepts repeat Infirmary exchange while detecting a retained retired row', () => {
  const a = driver(fresh());
  a.run({ type: 'choose_ancestry', ancestry: 'fey_touched' });
  const world = a.world(),
    prefix = `${content.manifest.id}@${content.manifest.version}`;
  const wick = world.entityIds[`${prefix}:npc/wick`];
  const herbs = Object.entries(world.entities)
    .filter(([, e]) => e.key.startsWith('fenwort_'))
    .map(([id]) => id);
  const b = driver({
    ...world,
    state: {
      ...world.state,
      containers: {
        ...world.state.containers,
        [world.body]: world.roomIds[`${prefix}:room/infirmary`],
        ...Object.fromEntries(herbs.map((h) => [h, world.body])),
      },
    },
  });
  const talk = () => b.run({ type: 'talk', target_id: wick });
  const choose = (choice_id: string) =>
    b.run({
      type: 'choose',
      choice_id,
      continuation_id: gameView(b.world()).choice!.continuation_id,
    });
  talk();
  choose('accept');
  talk();
  choose('exchange');
  talk();
  const repeated = choose('accept');
  assert.equal(
    checked(
      { ...KERNEL, step: () => repeated.result },
      repeated.before,
      repeated.command,
      repeated.revision,
    ).failure,
    undefined,
  );
  const decision = repeated.result.decision;
  assert.ok(decision.kind === 'accepted');
  const retired = decision.delta.ops.find((o) => o.op === 'quest.retire');
  assert.ok(retired);
  assert.equal(Object.keys(b.world().state.quests!).length, 1);
  assert.equal(Object.hasOwn(b.world().state.quests!, retired.instance_id), false);
  const wrong = {
    ...repeated.result,
    world: {
      ...b.world(),
      state: {
        ...b.world().state,
        quests: {
          ...b.world().state.quests,
          [retired.instance_id]: repeated.before.state.quests![retired.instance_id],
        },
      },
    },
  };
  assert.equal(
    checked({ ...KERNEL, step: () => wrong }, repeated.before, repeated.command, repeated.revision)
      .failure?.id,
    'adopt_mismatch',
  );
});
