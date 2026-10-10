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
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { elapsed, hp } from './combat_fixture.ts';
import { read } from './read.ts';

const bundle = read('protocol/fixtures/missing_child_v012_hash.json');
const ids = read('protocol/fixtures/missing_child_v012_ids.json');
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
    cartridge_version: '0.0.12',
    kind,
    key: name,
  }) as DefinitionRef;
function setup() {
  let world = newWorld(cartridge, '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]);
  let n = 0;
  const run = (payload: object, expected = 'accepted') => {
    const command = {
      id: `dddddddd-0000-4000-8000-${String(++n).padStart(12, '0')}`,
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
  const choose = (choice_id: string, expected = 'accepted', answer?: string) =>
    run(
      {
        type: 'choose',
        continuation_id: gameView(world).choice!.continuation_id,
        choice_id,
        ...(answer && { answer }),
      },
      expected,
    );
  const talk = (name: string) => run({ type: 'talk', target_id: ids[`npc/${name}`] });
  const flag = (name: string) => value(world, world.character, ref('fact', name));
  const ready = () => {
    talk('elspeth');
    choose('accept');
    run({ type: 'close_choice', continuation_id: gameView(world).choice!.continuation_id }); // the hub stays open after an answer (loka-x6t.5): Leave the conversation
    move('north', 'north');
    run({ type: 'take', item_id: ids['item/fox_drawing'] });
    move('south', 'south');
    talk('elspeth');
    choose('report');
    move('south', 'south');
    run({ type: 'perform', action: 'study_tracks' });
    move('south', 'south');
    talk('vesper');
    choose('meet_wren');
    talk('vesper');
    choose('answer', 'accepted', 'lantern');
    talk('wren');
  };
  return {
    run,
    move,
    choose,
    talk,
    flag,
    ready,
    world: () => world,
    set: (w: World) => {
      world = w;
    },
  };
}
const relation = (w: World) => w.state.escorts![w.character];
const together = (w: World, room: string) =>
  assert.deepEqual(
    [w.state.containers[ids.body], w.state.containers[ids['npc/wren']]],
    [ids[`room/${room}`], ids[`room/${room}`]],
  );
const quest = (w: World) =>
  Object.values(w.state.quests!).find((q) => q.quest.key === 'missing_child')!;

// Breaks: start loses the original binding, shared Move omits the follower, or completed escorts continue following.
test('rescue binds the original Wren, follows each Move, and finishes beside Elspeth', () => {
  const a = setup();
  a.ready();
  const start = a.choose('rescue');
  assert.equal(start.kind, 'accepted');
  if (start.kind !== 'accepted') return;
  assert.deepEqual(
    start.delta.ops.map((op) => op.op),
    ['fact.assign', 'escort.transition', 'choice.resolve'],
  );
  // Independent Python SHA-256: command 20 ordinal 0 opens the choice; command 10 ordinal 2 activates Q2 after its two root events; command 3 leaves Elspeth's hub.
  assert.deepEqual(relation(a.world()), {
    kind: 'escort',
    actor_id: 'bd595711-ea5f-89a5-abb0-046cd349d2f9',
    body_id: '3d4829ad-9e43-81ef-bc10-66b1b267e157',
    npc_id: 'b3b7a7a6-b9e6-8d9c-82a2-c9cc728e3462',
    quest_instance_id: '0ac84234-4782-8ee2-9859-0b3a874e3592',
    continuation_id: 'ec640c6a-0cab-8c9f-a70d-e8804b95d91f',
    choice_id: 'rescue',
    status: 'following',
  });
  assert.deepEqual(
    [a.flag('fen_return_branch'), a.flag('village_child_status'), quest(a.world()).state],
    ['rescue', 'missing', 'active'],
  );
  assert.equal(a.world().state.containers[ids['item/vesper_message']], ids['npc/vesper']);
  a.run({ type: 'move', direction: 'south' }, 'not_found');
  together(a.world(), 'fox_hollow');
  for (const destination of ['mire_crossing', 'reed_bank', 'reed_path', 'ferry_landing']) {
    const moved = a.run({ type: 'move', direction: 'north' });
    assert.equal(moved.kind, 'accepted');
    if (moved.kind !== 'accepted') return;
    assert.deepEqual(
      moved.delta.ops
        .filter((op) => op.op === 'entity.transfer')
        .map((op) => [op.entity_id, op.destination_id]),
      [
        [ids.body, ids[`room/${destination}`]],
        [ids['npc/wren'], ids[`room/${destination}`]],
      ],
    );
    together(a.world(), destination);
  }
  assert.equal(quest(a.world()).state, 'active');
  a.talk('elspeth');
  const terminal = a.choose('rescued');
  assert.equal(terminal.kind, 'accepted');
  if (terminal.kind !== 'accepted') return;
  assert.deepEqual(
    terminal.delta.ops.map((op) => op.op),
    ['fact.assign', 'escort.transition', 'quest.transition', 'quest.transition', 'choice.resolve'],
  );
  assert.deepEqual(
    [
      relation(a.world()).status,
      quest(a.world()).state,
      quest(a.world()).outcome,
      a.flag('village_child_status'),
    ],
    ['completed', 'resolved', 'rescued', 'rescued'],
  );
  a.move('north');
  assert.equal(a.world().state.containers[ids['npc/wren']], ids['room/ferry_landing']);
});

// Breaks: combat Flee bypasses the shared follower transfer or adds a follower fare/random draw.
test('two-exit Flee carries the original follower to the drawn destination with one fare', () => {
  const a = setup();
  a.ready();
  a.choose('rescue');
  a.move('north', 'north', 'north', 'north', 'north', 'east', 'down');
  a.run({ type: 'attack', target_id: ids['npc/cellar_rat_1'] });
  const w = a.world();
  a.set({
    ...w,
    state: { ...w.state, rng: [1, 33554432, 3, 4] },
    rooms: {
      ...w.rooms,
      [ids['room/lantern_cellar']]: {
        ...w.rooms[ids['room/lantern_cellar']],
        exits: {
          west: { to: ref('room', 'chapel_nave') },
          north: { to: ref('room', 'drowned_lantern') },
        },
      },
    },
  });
  const before = level(a.world(), a.world().body, resourceRef(a.world(), 'mv'))!;
  a.run({ type: 'flee' });
  together(a.world(), 'chapel_nave');
  assert.equal(level(a.world(), a.world().body, resourceRef(a.world(), 'mv')), before - 2);
  assert.deepEqual(a.world().state.rng, [33554437, 33554434, 2, 8208]);
  assert.equal(relation(a.world()).status, 'following');
});

// Breaks: fatal player death fails to separate the follower, or walking back resumes following without explicit Rejoin.
test('real fatal combat leaves Wren behind and only a bound explicit Rejoin resumes travel', () => {
  const a = setup();
  a.ready();
  a.choose('rescue');
  a.move('north', 'north', 'north', 'north', 'north', 'east', 'down');
  a.set(hp(a.world(), a.world().body, 1));
  a.run({ type: 'attack', target_id: ids['npc/cellar_rat_1'] });
  const fatal = elapsed(a.world(), a.world().state.clock + 150, 100);
  assert.equal(fatal.decision.kind, 'accepted', JSON.stringify(fatal.decision));
  a.set(fatal.world);
  assert.deepEqual(
    [
      a.world().state.containers[ids.body],
      a.world().state.containers[ids['npc/wren']],
      relation(a.world()).status,
    ],
    [ids['room/chapel_nave'], ids['room/lantern_cellar'], 'separated'],
  );
  a.move('south', 'south', 'south', 'south', 'east', 'down');
  together(a.world(), 'lantern_cellar');
  assert.equal(relation(a.world()).status, 'separated');
  a.move('up');
  assert.equal(a.world().state.containers[ids['npc/wren']], ids['room/lantern_cellar']);
  a.move('down');
  a.talk('wren');
  const before = relation(a.world());
  a.choose('rejoin');
  assert.deepEqual(relation(a.world()), { ...before, status: 'following' });
  a.move('up');
  together(a.world(), 'drowned_lantern');
  a.move('west', 'south');
  a.talk('elspeth');
  a.choose('rescued');
  assert.equal(relation(a.world()).status, 'completed');
});

// Breaks: a forged pending start substitutes a different co-located NPC of the same kind.
test('an escort choice cannot bind Vesper in place of the authored Wren', () => {
  const a = setup();
  a.ready();
  const w = a.world(),
    continuation = gameView(w).choice!.continuation_id;
  const row = w.state.choices![continuation];
  a.set({
    ...w,
    state: {
      ...w.state,
      choices: {
        ...w.state.choices,
        [continuation]: {
          ...row,
          roles: row.roles.map((r) =>
            r.role === 'wren' ? { ...r, entity_id: ids['npc/vesper'] } : r,
          ),
        },
      },
    },
  });
  const option = gameView(a.world()).choice!.choices[0];
  assert.deepEqual('reason' in option && option.reason, { code: 'invalid_state' });
  a.choose('rescue', 'invalid_state');
  assert.equal(a.world().state.escorts?.[a.world().character], undefined);
  assert.equal(a.flag('fen_return_branch'), 'unselected');
});

// Breaks: Rejoin trusts a surviving relation after its retained original choice no longer binds the same NPC.
test('Rejoin refuses a relation whose original accepted choice names a different NPC', () => {
  const a = setup();
  a.ready();
  a.choose('rescue');
  a.move('north', 'north', 'north', 'north', 'north', 'east', 'down');
  a.set(hp(a.world(), a.world().body, 1));
  a.run({ type: 'attack', target_id: ids['npc/cellar_rat_1'] });
  const fatal = elapsed(a.world(), a.world().state.clock + 150, 100);
  assert.equal(fatal.decision.kind, 'accepted');
  a.set(fatal.world);
  a.move('south', 'south', 'south', 'south', 'east', 'down');
  a.talk('wren');
  const w = a.world(),
    original = relation(w).continuation_id,
    row = w.state.choices![original];
  a.set({
    ...w,
    state: {
      ...w.state,
      choices: {
        ...w.state.choices,
        [original]: {
          ...row,
          roles: row.roles.map((r) =>
            r.role === 'wren' ? { ...r, entity_id: ids['npc/vesper'] } : r,
          ),
        },
      },
    },
  });
  const option = gameView(a.world()).choice!.choices[0];
  assert.deepEqual('reason' in option && option.reason, { code: 'invalid_state' });
  a.choose('rejoin', 'invalid_state');
  assert.equal(relation(a.world()).status, 'separated');
});
