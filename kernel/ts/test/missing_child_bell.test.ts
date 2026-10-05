import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  gameView,
  INSTALLED,
  loadCartridge,
  newWorld,
  step,
  type Cartridge,
  type World,
} from '../src/index.ts';
import type { Command, DefinitionRef } from '../src/contracts.gen.ts';
import { value } from '../src/mechanics/fact.ts';
import { validate } from '../src/foundation/validate.ts';
import { read } from './read.ts';

const bundle = read('protocol/fixtures/missing_child_v013_hash.json');
const ids = read('protocol/fixtures/missing_child_v013_ids.json');
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
    cartridge_version: '0.0.13',
    kind,
    key: name,
  }) as DefinitionRef;

// Breaks: generated TS contracts disagree with Elixir about the new typed forms.
test('bell contract controls match the shared fixtures', () => {
  for (const c of read('protocol/fixtures/bell_contracts.json'))
    assert.equal(validate(c.contract, c.value).length === 0, c.valid, c.name);
});

function setup() {
  let world = newWorld(cartridge, '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]);
  let n = 0;
  const run = (payload: object, expected = 'accepted') => {
    const command = {
      id: `eeeeeeee-0000-4000-8000-${String(++n).padStart(12, '0')}`,
      world_context_id: world.context,
      payload: { actor_id: world.character, ...payload },
    } as Command;
    const before = world;
    const result = step(world, command, n);
    assert.equal(
      result.decision.kind === 'rejected' ? result.decision.error.code : result.decision.kind,
      expected,
      JSON.stringify(result.decision),
    );
    if (expected !== 'accepted') assert.equal(result.world, before);
    world = result.world;
    return result.decision;
  };
  const move = (...directions: string[]) =>
    directions.forEach((direction) => run({ type: 'move', direction }));
  const talk = (name: string) => run({ type: 'talk', target_id: ids[`npc/${name}`] });
  const choose = (choice_id: string) =>
    run({ type: 'choose', continuation_id: gameView(world).choice!.continuation_id, choice_id });
  const quest = (name: string) =>
    Object.values(world.state.quests ?? {}).find((q) => q.quest.key === name);
  const flag = (name: string) => value(world, world.character, ref('fact', name));
  const search = () => {
    talk('elspeth');
    choose('accept');
    move('north', 'north');
    run({ type: 'take', item_id: ids['item/fox_drawing'] });
    move('south', 'south');
    talk('elspeth');
    choose('report');
    move('south', 'south');
    run({ type: 'perform', action: 'study_tracks' });
  };
  const chapel = () => {
    move('north', 'north', 'north', 'north', 'north', 'north', 'north');
    talk('aldric');
    choose('accept');
    move('up', 'up');
  };
  const scene = () => {
    for (let i = 0; i < 3; i++) run({ type: 'continue' });
  };
  return {
    run,
    move,
    talk,
    choose,
    quest,
    flag,
    search,
    chapel,
    scene,
    world: () => world,
    set: (w: World) => {
      world = w;
    },
  };
}

// Breaks: removing the Q2/tracks guard lets an impossible active Q3 ring a bell without a search.
test('Ring admission still requires Q2 eligibility even if Q3 state is active', () => {
  const a = setup();
  a.move('north', 'north', 'north', 'north', 'north', 'up', 'up');
  const w = a.world();
  a.set({
    ...w,
    state: {
      ...w.state,
      quests: {
        '11111111-2222-4333-8444-555555555555': {
          quest: ref('quest', 'bell_of_ashmere'),
          scope: { kind: 'player', character_id: w.character },
          state: 'active',
        },
      },
    },
  });
  a.run({ type: 'perform', action: 'ring_bell' }, 'invalid_state');
  assert.deepEqual([a.flag('chapel_bell_rung'), a.flag('chapel_allegiance')], [false, 'unknown']);
});

// Breaks: an early Ring can resolve Q3 while leaving Q2 active, or can write lost without an accepted action.
test('bell-first Ring resolves Q3, fails Q2 and starts exactly one retained scene', () => {
  const a = setup();
  a.run({ type: 'perform', action: 'ring_bell' }, 'invalid_state');
  a.search();
  a.chapel();
  const ring = a.run({ type: 'perform', action: 'ring_bell' });
  assert.equal(ring.kind, 'accepted');
  assert.deepEqual(
    [
      a.quest('bell_of_ashmere')?.state,
      a.quest('bell_of_ashmere')?.outcome,
      a.quest('missing_child')?.state,
      a.quest('missing_child')?.outcome,
    ],
    ['resolved', 'prior', 'failed', 'lost'],
  );
  assert.deepEqual(
    [a.flag('chapel_bell_rung'), a.flag('chapel_allegiance'), a.flag('village_child_status')],
    [true, 'prior', 'lost'],
  );
  assert.equal(gameView(a.world()).scene?.index, 1);
  for (const index of [2, 3]) {
    a.run({ type: 'continue' });
    assert.equal(gameView(a.world()).scene?.index, index);
  }
  a.run({ type: 'continue' });
  assert.equal(gameView(a.world()).scene, undefined);
  a.run({ type: 'perform', action: 'ring_bell' }, 'invalid_state');
});

// Breaks: ringing after the accepted Wren meeting closes either ordinary Q2 return.
test('late Ring preserves both message and escort returns', () => {
  for (const branch of ['stays', 'rescue']) {
    const a = setup();
    a.search();
    a.move('south', 'south');
    a.talk('vesper');
    a.choose('meet_wren');
    a.move('north', 'north');
    a.chapel();
    a.run({ type: 'perform', action: 'ring_bell' });
    a.scene();
    assert.deepEqual(
      [a.quest('missing_child')?.state, a.flag('village_child_status')],
      ['active', 'missing'],
    );
    a.move(
      'down',
      'down',
      'south',
      'south',
      'south',
      'south',
      'south',
      'south',
      'south',
      'south',
      'south',
    );
    a.talk('vesper');
    a.run({
      type: 'choose',
      continuation_id: gameView(a.world()).choice!.continuation_id,
      choice_id: 'answer',
      answer: 'LANTERN',
    });
    if (branch === 'stays') {
      a.talk('vesper');
      a.choose('carry_message');
    } else {
      a.talk('wren');
      a.choose('rescue');
    }
    a.move('north', 'north', 'north', 'north');
    a.talk('elspeth');
    a.choose(branch === 'stays' ? 'stays' : 'rescued');
    assert.deepEqual(
      [
        a.quest('missing_child')?.state,
        a.quest('missing_child')?.outcome,
        a.flag('village_child_status'),
        a.flag('chapel_allegiance'),
      ],
      [
        'resolved',
        branch === 'stays' ? 'stays' : 'rescued',
        branch === 'stays' ? 'stays' : 'rescued',
        'prior',
      ],
    );
  }
});

// Breaks: Q3 can no longer be offered or Ring refuses after an already complete Q2 return.
test('Ring after either completed return preserves the completed outcome', () => {
  for (const branch of ['stays', 'rescue']) {
    const a = setup();
    a.search();
    a.move('south', 'south');
    a.talk('vesper');
    a.choose('meet_wren');
    a.talk('vesper');
    a.run({
      type: 'choose',
      continuation_id: gameView(a.world()).choice!.continuation_id,
      choice_id: 'answer',
      answer: 'LANTERN',
    });
    if (branch === 'stays') {
      a.talk('vesper');
      a.choose('carry_message');
    } else {
      a.talk('wren');
      a.choose('rescue');
    }
    a.move('north', 'north', 'north', 'north');
    a.talk('elspeth');
    a.choose(branch === 'stays' ? 'stays' : 'rescued');
    a.move('north', 'north', 'north', 'north', 'north');
    a.talk('aldric');
    a.choose('accept');
    a.move('up', 'up');
    a.run({ type: 'perform', action: 'ring_bell' });
    assert.deepEqual(
      [
        a.quest('missing_child')?.state,
        a.quest('missing_child')?.outcome,
        a.flag('village_child_status'),
        a.quest('bell_of_ashmere')?.state,
      ],
      [
        'resolved',
        branch === 'stays' ? 'stays' : 'rescued',
        branch === 'stays' ? 'stays' : 'rescued',
        'resolved',
      ],
    );
  }
});
