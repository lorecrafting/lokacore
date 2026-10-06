import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  gameView,
  INSTALLED,
  loadCartridge,
  newWorld,
  step,
  stepElapsed,
  type Cartridge,
  type World,
} from '../src/index.ts';
import type { Command, DefinitionRef } from '../src/contracts.gen.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { key } from '../src/foundation/compose.ts';
import { value } from '../src/mechanics/fact.ts';
import { read } from './read.ts';

const bundle = read('protocol/fixtures/missing_child_v016_hash.json');
const loaded = loadCartridge(
  new TextEncoder().encode(
    JSON.stringify({ cartridge: bundle.value, content_hash: bundle.sha256 }),
  ),
  INSTALLED,
);
assert.ok(loaded.ok, JSON.stringify(loaded));
const cartridge = loaded.cartridge as Cartridge;
const ref = (kind: string, name: string) =>
  ({
    cartridge_id: 'ashmere_missing_child',
    cartridge_version: '0.0.16',
    kind,
    key: name,
  }) as DefinitionRef;

function setup() {
  let world = newWorld(cartridge, '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]);
  let revision = 0;
  const id = (kind: string, name: string) =>
    world.entityIds[`ashmere_missing_child@0.0.16:${kind}/${name}`];
  const run = (payload: object, expected = 'accepted') => {
    const before = world;
    const command = {
      id: `cccccccc-0000-4000-8000-${String(++revision).padStart(12, '0')}`,
      world_context_id: world.context,
      payload: { actor_id: world.character, ...payload },
    } as Command;
    const result = step(world, command, revision);
    const actual =
      result.decision.kind === 'accepted'
        ? 'accepted'
        : result.decision.kind === 'rejected'
          ? result.decision.error.code
          : result.decision.code;
    assert.equal(actual, expected, JSON.stringify(result.decision));
    if (expected !== 'accepted') assert.equal(result.world, before);
    world = result.world;
    return result.decision;
  };
  const move = (...directions: string[]) =>
    directions.forEach((direction) => run({ type: 'move', direction }));
  const talk = (name: string) => run({ type: 'talk', target_id: id('npc', name) });
  const choose = (choice_id: string, expected = 'accepted') =>
    run(
      { type: 'choose', continuation_id: gameView(world).choice!.continuation_id, choice_id },
      expected,
    );
  const advance = (until: number) => {
    const command = {
      id: elapsedCommandId(
        '6f6f6f6f-1111-4222-8333-444444444444',
        world.context,
        world.state.clock,
        until,
      ),
      world_context_id: world.context,
      payload: {
        type: 'elapsed',
        run_id: '6f6f6f6f-1111-4222-8333-444444444444',
        actor_id: world.character,
        from: world.state.clock,
        until,
      },
    } as Command;
    const result = stepElapsed(world, command, ++revision);
    assert.equal(result.decision.kind, 'accepted', JSON.stringify(result.decision));
    world = result.world;
  };
  const quest = () =>
    Object.entries(world.state.quests ?? {}).find(([, q]) => q.quest.key === 'chandlers_debt');
  const flag = (name: string) => value(world, world.character, ref('fact', name));
  const balance = (entity: string) =>
    world.state.resources![
      key({ kind: 'resource', resource: ref('resource', 'pennies'), entity_id: entity })
    ]!.value;
  const accept = () => {
    move('north', 'west');
    talk('peg');
    choose('accept_on_time');
  };
  const chapel = () => {
    move('east', 'north', 'north', 'north', 'north');
    talk('aldric');
  };
  return {
    run,
    move,
    talk,
    choose,
    advance,
    quest,
    flag,
    balance,
    accept,
    chapel,
    id,
    world: () => world,
    set: (w: World) => {
      world = w;
    },
  };
}

// Breaks: acceptance manufactures a replacement ledger or creates a second obligation/job.
test('Peg transfers the original ledger and binds one expiry', () => {
  const a = setup();
  const ledger = a.id('item', 'tithe_ledger');
  const peg = a.id('npc', 'peg');
  assert.equal(a.world().state.containers[ledger], peg);
  a.accept();
  assert.equal(a.world().state.containers[ledger], a.world().body);
  const [instance, q] = a.quest()!;
  assert.equal(q.scope.kind, 'player');
  assert.deepEqual(
    q.bindings?.map((r) => r.role),
    ['aldric', 'ledger', 'peg'],
  );
  assert.equal(
    Object.values(a.world().state.jobs ?? {}).filter(
      (j) => j.quest_instance_id === instance && j.due_time === 237601 && j.status === 'pending',
    ).length,
    1,
  );
  assert.equal(a.flag('priory_tithe_delivered'), 'pending');
  assert.deepEqual([a.balance(a.world().body), a.balance(a.id('npc', 'aldric'))], [20, 10]);
  a.run({ type: 'give', item_id: ledger, recipient_id: peg }, 'invalid_state');
});

// Breaks: the on-time cutoff excludes equality, or the late interval pays or shifts the wrong amount.
test('151200 pays exactly; 151201 and 237600 complete late', () => {
  for (const [when, outcome, axis, player, aldric] of [
    [151200, 'on_time', 2, 30, 0],
    [151201, 'late', -1, 20, 10],
    [237600, 'late', -1, 20, 10],
  ] as const) {
    const a = setup();
    a.accept();
    a.chapel();
    a.advance(when);
    a.choose(outcome);
    assert.deepEqual(
      [
        a.quest()?.[1].state,
        a.quest()?.[1].outcome,
        a.flag('priory_tithe_delivered'),
        a.flag('priory_fen_axis'),
      ],
      ['resolved', outcome, outcome, axis],
    );
    assert.deepEqual(
      [a.balance(a.world().body), a.balance(a.id('npc', 'aldric'))],
      [player, aldric],
    );
    assert.equal(a.world().state.containers[a.id('item', 'tithe_ledger')], a.id('npc', 'aldric'));
  }
});

// Breaks: input beats the due job at 237601, or a completed obligation is penalized later.
test('237601 fails an accepted obligation once and leaves custody unchanged', () => {
  const a = setup();
  a.accept();
  a.chapel();
  const ledger = a.id('item', 'tithe_ledger');
  a.advance(237601);
  assert.deepEqual(
    [
      a.quest()?.[1].state,
      a.quest()?.[1].outcome,
      a.flag('priory_tithe_delivered'),
      a.flag('peg_trust'),
    ],
    ['failed', 'never', 'never', -5],
  );
  assert.equal(a.world().state.containers[ledger], a.world().body);
  assert.deepEqual([a.balance(a.world().body), a.balance(a.id('npc', 'aldric'))], [20, 10]);
  a.choose('late', 'invalid_state');
  a.advance(237602);
  assert.equal(a.flag('peg_trust'), -5);
});

// Breaks: missing funding permits the ledger handoff or creates pennies from a default row.
test('on-time delivery refuses absent funding atomically', () => {
  const a = setup();
  a.accept();
  a.chapel();
  const w = a.world();
  const target = key({
    kind: 'resource',
    resource: ref('resource', 'pennies'),
    entity_id: a.id('npc', 'aldric'),
  });
  const { [target]: _, ...resources } = w.state.resources!;
  a.set({ ...w, state: { ...w.state, resources } });
  a.choose('on_time', 'insufficient_resource');
  assert.deepEqual(
    [
      a.quest()?.[1].state,
      a.flag('priory_tithe_delivered'),
      a.world().state.containers[a.id('item', 'tithe_ledger')],
    ],
    ['active', 'pending', a.world().body],
  );
});

// Breaks: a late offer advertises timely pay or a never-accepted expired offer creates debt.
test('Peg offers late-only acceptance, then explains an elapsed unaccepted offer', () => {
  const late = setup();
  late.advance(151201);
  late.move('north', 'west');
  late.talk('peg');
  const view = gameView(late.world()).choice!;
  assert.deepEqual(
    view.choices.filter((c) => c.available).map((c) => c.choice_id),
    ['accept_late'],
  );
  late.choose('accept_late');
  assert.equal(late.flag('priory_tithe_delivered'), 'pending');
  const expired = setup();
  expired.advance(237601);
  expired.move('north', 'west');
  expired.talk('peg');
  assert.deepEqual(
    gameView(expired.world())
      .choice!.choices.filter((c) => c.available)
      .map((c) => c.choice_id),
    ['elapsed'],
  );
  expired.choose('elapsed');
  assert.equal(expired.quest(), undefined);
  assert.deepEqual(
    [
      expired.flag('peg_trust'),
      expired.world().state.containers[expired.id('item', 'tithe_ledger')],
    ],
    [0, expired.id('npc', 'peg')],
  );
});

// Breaks: a full body receives the ledger before capacity refusal, leaving a partial obligation.
test('full carrying capacity refuses the offer without moving or scheduling anything', () => {
  const a = setup();
  a.move('north', 'west');
  a.talk('peg');
  const w = a.world();
  a.set({
    ...w,
    cartridge: { ...w.cartridge, world: { ...w.cartridge.world!, carry: { max_grams: 0 } } },
  });
  a.choose('accept_on_time', 'too_heavy');
  assert.equal(a.quest(), undefined);
  assert.equal(a.world().state.containers[a.id('item', 'tithe_ledger')], a.id('npc', 'peg'));
  assert.equal(
    Object.values(a.world().state.jobs ?? {}).filter((j) => !!j.quest_instance_id).length,
    0,
  );
  assert.equal(gameView(a.world()).choice?.choices[1].available, false);
});

// Breaks: a stale expiry penalizes a completed occurrence after its on-time handoff.
test('completion makes its original expiry harmless', () => {
  const a = setup();
  a.accept();
  a.chapel();
  a.advance(151200);
  a.choose('on_time');
  a.advance(237601);
  assert.deepEqual(
    [a.quest()?.[1].outcome, a.flag('peg_trust'), a.flag('priory_tithe_delivered')],
    ['on_time', 0, 'on_time'],
  );
  assert.deepEqual([a.balance(a.world().body), a.balance(a.id('npc', 'aldric'))], [30, 0]);
});
