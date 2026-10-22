import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView, step, type World } from '../src/index.ts';
import type { Command } from '../src/contracts.gen.ts';
import { targetOf, value } from '../src/mechanics/fact.ts';
import { key } from '../src/foundation/compose.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { elapsed, hp } from './combat_fixture.ts';
import { entity, genesis, prefix, ref, room } from './escort_fixture.ts';

function setup() {
  let world = genesis();
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
  const talk = (name: string) => run({ type: 'talk', target_id: entity(world, 'npc', name) });
  const flag = (name: string) => value(world, world.character, ref('fact', name));
  // The quest-active gate: accept Homeward at Ferry Landing, walk to Village Green, meet the child.
  const ready = () => {
    talk('keeper');
    choose('accept');
    const open = gameView(world).choice;
    if (open) run({ type: 'close_choice', continuation_id: open.continuation_id });
    move('north', 'north');
    talk('child');
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
const child = (w: World) => entity(w, 'npc', 'child');
const together = (w: World, name: string) =>
  assert.deepEqual(
    [w.state.containers[w.body], w.state.containers[child(w)]],
    [room(w, name), room(w, name)],
  );
const homeward = (w: World) =>
  Object.entries(w.state.quests!).find(([, q]) => q.quest.key === 'homeward')!;
const quest = (w: World) => homeward(w)[1];
// Lantern Cellar from Village Green, where the escort starts.
const toCellar = ['south', 'east', 'down'];
function fallInCellar(a: ReturnType<typeof setup>) {
  a.move(...toCellar);
  a.set(hp(a.world(), a.world().body, 1));
  a.run({ type: 'attack', target_id: entity(a.world(), 'npc', 'cellar_rat_1') });
  const fatal = elapsed(a.world(), a.world().state.clock + 150, 100);
  assert.equal(fatal.decision.kind, 'accepted', JSON.stringify(fatal.decision));
  a.set(fatal.world);
}
// The chapel shrine back down to the Lantern Cellar.
const shrineToCellar = ['south', 'south', 'south', 'south', 'east', 'down'];
const forgeChild = (w: World, continuation: string) => {
  const row = w.state.choices![continuation];
  return {
    ...w,
    state: {
      ...w.state,
      choices: {
        ...w.state.choices,
        [continuation]: {
          ...row,
          roles: row.roles.map((r) =>
            r.role === 'child' ? { ...r, entity_id: entity(w, 'npc', 'stranger') } : r,
          ),
        },
      },
    },
  } as World;
};

// Breaks: start loses the original binding, shared Move omits the follower, or completed escorts continue following.
test('rescue binds the original child, follows each Move, and finishes beside the keeper', () => {
  const a = setup();
  a.ready();
  const continuation = gameView(a.world()).choice!.continuation_id;
  const start = a.choose('rescue');
  assert.equal(start.kind, 'accepted');
  if (start.kind !== 'accepted') return;
  assert.deepEqual(
    start.delta.ops.map((op) => op.op),
    ['fact.assign', 'escort.transition', 'choice.resolve'],
  );
  const w = a.world();
  assert.deepEqual(relation(w), {
    kind: 'escort',
    actor_id: w.character,
    body_id: w.body,
    npc_id: child(w),
    quest_instance_id: homeward(w)[0],
    continuation_id: continuation,
    choice_id: 'rescue',
    status: 'following',
  });
  assert.deepEqual([a.flag('homeward_started'), quest(w).state], [true, 'active']);
  assert.equal(w.state.containers[entity(w, 'npc', 'stranger')], room(w, 'village_green'));
  a.run({ type: 'move', direction: 'west' }, 'not_found');
  together(a.world(), 'village_green');
  for (const destination of ['well_lane', 'ferry_landing']) {
    const moved = a.run({ type: 'move', direction: 'south' });
    assert.equal(moved.kind, 'accepted');
    if (moved.kind !== 'accepted') return;
    assert.deepEqual(
      moved.delta.ops
        .filter((op) => op.op === 'entity.transfer')
        .map((op) => [op.entity_id, op.destination_id]),
      [
        [w.body, room(w, destination)],
        [child(w), room(w, destination)],
      ],
    );
    together(a.world(), destination);
  }
  assert.equal(quest(a.world()).state, 'active');
  a.talk('keeper');
  const terminal = a.choose('home');
  assert.equal(terminal.kind, 'accepted');
  if (terminal.kind !== 'accepted') return;
  assert.deepEqual(
    terminal.delta.ops.map((op) => op.op),
    ['escort.transition', 'quest.transition', 'quest.transition', 'choice.resolve'],
  );
  assert.deepEqual(
    [relation(a.world()).status, quest(a.world()).state, quest(a.world()).outcome],
    ['completed', 'resolved', 'home'],
  );
  a.move('north');
  assert.equal(a.world().state.containers[child(w)], room(w, 'ferry_landing'));
});

// Toolbox row G8. Breaks: the group walk does not skip the escorted NPC, so the child, also a
// member, is transferred twice and the Move faults.
test('an escorted NPC who is also a group member moves once', () => {
  const a = setup();
  a.ready();
  a.choose('rescue');
  const w = a.world();
  const member = ref('fact', 'in_group');
  const c = structuredClone(w.cartridge) as any;
  c.facts[`${prefix}:fact/in_group`] = {
    ...member,
    version: 1,
    value_type: { type: 'bool', default: false },
    scopes: ['player'],
    per_subject: true,
    meaning: 'In the group.',
  };
  c.world.group = { member };
  const grouped = { ...w, cartridge: c } as World;
  const at = key(targetOf(grouped, w.character, member, child(w)));
  a.set({ ...grouped, state: { ...w.state, facts: { ...w.state.facts, [at]: true } } });
  const moved = a.run({ type: 'move', direction: 'south' });
  assert.deepEqual(
    moved.kind === 'accepted' &&
      moved.delta.ops.filter((op) => op.op === 'entity.transfer').map((op) => op.entity_id),
    [w.body, child(w)],
  );
});

// Breaks: combat Flee bypasses the shared follower transfer or adds a follower fare/random draw.
test('two-exit Flee carries the original follower to the drawn destination with one fare', () => {
  const a = setup();
  a.ready();
  a.choose('rescue');
  a.move(...toCellar);
  a.run({ type: 'attack', target_id: entity(a.world(), 'npc', 'cellar_rat_1') });
  const w = a.world();
  const cellar = room(w, 'lantern_cellar');
  a.set({
    ...w,
    state: { ...w.state, rng: [1, 33554432, 3, 4] },
    rooms: {
      ...w.rooms,
      [cellar]: {
        ...w.rooms[cellar],
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
test('real fatal combat leaves the child behind and only a bound explicit Rejoin resumes travel', () => {
  const a = setup();
  a.ready();
  a.choose('rescue');
  fallInCellar(a);
  const w = a.world();
  assert.deepEqual(
    [w.state.containers[w.body], w.state.containers[child(w)], relation(w).status],
    [room(w, 'chapel_nave'), room(w, 'lantern_cellar'), 'separated'],
  );
  a.move(...shrineToCellar);
  together(a.world(), 'lantern_cellar');
  assert.equal(relation(a.world()).status, 'separated');
  a.move('up');
  assert.equal(a.world().state.containers[child(w)], room(w, 'lantern_cellar'));
  a.move('down');
  a.talk('child');
  const before = relation(a.world());
  a.choose('rejoin');
  assert.deepEqual(relation(a.world()), { ...before, status: 'following' });
  a.move('up');
  together(a.world(), 'drowned_lantern');
  a.move('west', 'south');
  a.talk('keeper');
  a.choose('home');
  assert.equal(relation(a.world()).status, 'completed');
});

// Breaks: a forged pending start substitutes a different co-located NPC of the same kind.
test('an escort choice cannot bind the stranger in place of the authored child', () => {
  const a = setup();
  a.ready();
  a.set(forgeChild(a.world(), gameView(a.world()).choice!.continuation_id));
  const option = gameView(a.world()).choice!.choices[0];
  assert.deepEqual('reason' in option && option.reason, { code: 'invalid_state' });
  a.choose('rescue', 'invalid_state');
  assert.equal(a.world().state.escorts?.[a.world().character], undefined);
  assert.equal(a.flag('homeward_started'), false);
});

// Breaks: Rejoin trusts a surviving relation after its retained original choice no longer binds the same NPC.
test('Rejoin refuses a relation whose original accepted choice names a different NPC', () => {
  const a = setup();
  a.ready();
  a.choose('rescue');
  fallInCellar(a);
  a.move(...shrineToCellar);
  a.talk('child');
  a.set(forgeChild(a.world(), relation(a.world()).continuation_id));
  const option = gameView(a.world()).choice!.choices[0];
  assert.deepEqual('reason' in option && option.reason, { code: 'invalid_state' });
  a.choose('rejoin', 'invalid_state');
  assert.equal(relation(a.world()).status, 'separated');
});
