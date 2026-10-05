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
import { key } from '../src/foundation/compose.ts';
import { read } from './read.ts';
import { elapsed, hp } from './combat_fixture.ts';

const bundle = read('protocol/fixtures/missing_child_v011_hash.json');
const ids = read('protocol/fixtures/missing_child_v011_ids.json');
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
    cartridge_version: '0.0.11',
    kind,
    key: name,
  }) as DefinitionRef;
const message = ids['item/vesper_message'];
function setup() {
  let world = newWorld(cartridge, '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]);
  let n = 0;
  const run = (payload: object, expected = 'accepted') => {
    const command = {
      id: `cccccccc-0000-4000-8000-${String(++n).padStart(12, '0')}`,
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
  const custody = (changes: Record<string, string>) => {
    world = {
      ...world,
      state: {
        ...world.state,
        containers: { ...world.state.containers, ...changes } as World['state']['containers'],
      },
    };
  };
  const setFlag = (name: string, next: string) => {
    const scope =
      name === 'village_child_status'
        ? { kind: 'instance', world_context_id: world.context }
        : { kind: 'player', character_id: world.character };
    world = {
      ...world,
      state: {
        ...world.state,
        facts: {
          ...world.state.facts,
          [key({ kind: 'fact', fact: ref('fact', name), scope })]: next as never,
        },
      },
    };
  };
  const ready = () => {
    talk('elspeth');
    choose('accept');
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
    talk('vesper');
  };
  return {
    run,
    move,
    choose,
    talk,
    flag,
    setFlag,
    custody,
    ready,
    world: () => world,
    set: (w: World) => {
      world = w;
    },
  };
}
const unavailable = (w: World, code: string) => {
  const option = gameView(w).choice!.choices[0];
  assert.equal(option.available, false);
  assert.deepEqual('reason' in option && option.reason, { code });
};
const quest = (w: World) =>
  Object.values(w.state.quests!).find((q) => q.quest.key === 'missing_child')!;

// Breaks: receiving a duplicate or resolving Q2 early, unrelated Give losing the message, or terminal hand_over respecting the ordinary Give ban.
test('the original message is received once, cannot be given away, and resolves only at Elspeth', () => {
  const a = setup();
  assert.equal(message, 'b03b53e3-456d-8c7a-b056-ff22f4adf06d');
  assert.equal(a.world().character, 'bd595711-ea5f-89a5-abb0-046cd349d2f9');
  assert.equal(a.world().entityIds['ashmere_missing_child@0.0.11:item/vesper_message'], message);
  a.move('south', 'south', 'south', 'south');
  a.run({ type: 'take', item_id: message }, 'not_present');
  assert.equal(
    gameView(a.world()).entities.some((e) => e.id === message),
    false,
  );
  a.talk('vesper');
  assert.deepEqual(
    gameView(a.world()).choice!.choices.map((c) => c.choice_id),
    ['greet'],
  );
  a.choose('greet');
  a.move('north', 'north', 'north', 'north');
  a.ready();
  assert.equal(a.world().state.containers[message], ids['npc/vesper']);
  assert.deepEqual(
    gameView(a.world()).choice!.choices.map((c) => [c.choice_id, c.available]),
    [['carry_message', true]],
  );
  const continuation_id = gameView(a.world()).choice!.continuation_id;
  const selected = a.choose('carry_message');
  assert.equal(selected.kind, 'accepted');
  if (selected.kind !== 'accepted') return;
  assert.deepEqual(
    selected.delta.ops.map((op) => op.op),
    ['entity.transfer', 'fact.assign', 'choice.resolve'],
  );
  assert.deepEqual(selected.delta.ops[0], {
    op: 'entity.transfer',
    writer_group: 0,
    entity_id: message,
    source_id: ids['npc/vesper'],
    destination_id: ids.body,
  });
  assert.equal(a.flag('fen_return_branch'), 'stays');
  assert.equal(a.flag('village_child_status'), 'missing');
  assert.equal(quest(a.world()).state, 'active');
  a.run({ type: 'choose', continuation_id, choice_id: 'carry_message' }, 'invalid_state');
  const give = gameView(a.world())
    .inventory.find((e) => e.id === message)!
    .actions.find((v) => v.action_key === 'give');
  assert.ok(give && !give.available);
  a.run({ type: 'give', item_id: message, recipient_id: ids['npc/wren'] }, 'invalid_state');
  a.run({ type: 'give', item_id: ids['item/fox_drawing'], recipient_id: ids['npc/wren'] });
  a.move('north', 'north', 'north', 'north');
  assert.equal(quest(a.world()).state, 'active');
  a.talk('elspeth');
  const terminal = a.choose('stays');
  assert.equal(terminal.kind, 'accepted');
  if (terminal.kind !== 'accepted') return;
  assert.deepEqual(
    terminal.delta.ops.map((op) => op.op),
    ['entity.transfer', 'fact.assign', 'quest.transition', 'quest.transition', 'choice.resolve'],
  );
  assert.deepEqual(terminal.delta.ops[0], {
    op: 'entity.transfer',
    writer_group: 0,
    entity_id: message,
    source_id: ids.body,
    destination_id: ids['npc/elspeth'],
  });
  assert.equal(a.world().state.containers[message], ids['npc/elspeth']);
  assert.deepEqual(
    [quest(a.world()).state, quest(a.world()).outcome, a.flag('village_child_status')],
    ['resolved', 'stays', 'stays'],
  );
  assert.equal(terminal.events.filter((e) => e.payload.type === 'quest_resolved').length, 1);
});

// Breaks: Talk-time policy remains authoritative after a branch or terminal status change.
test('pending branch rechecks branch and status policy before Choose', () => {
  const a = setup();
  a.ready();
  const original = a.world();
  for (const [name, changed] of [
    ['fen_return_branch', 'stays'],
    ['village_child_status', 'lost'],
  ]) {
    a.set(original);
    a.setFlag(name, changed);
    unavailable(a.world(), 'invalid_state');
    a.choose('carry_message', 'invalid_state');
    a.run({ type: 'close_choice', continuation_id: gameView(a.world()).choice!.continuation_id });
  }
});

// Breaks: refused incoming weight partially assigns the branch or consumes the pending continuation, or retry uses a replacement item.
test('capacity refusal preserves the pending branch and retries after ordinary Drop', () => {
  const a = setup();
  a.ready();
  const w = a.world();
  const trunk = ids['item/trunk'];
  // Controlled ballast exactly at the chapter's real 12000g body ceiling; the whistle remains elsewhere.
  a.set({
    ...w,
    entities: {
      ...w.entities,
      [trunk]: { ...w.entities[trunk], mass_grams: 12000 },
    } as World['entities'],
  });
  a.custody({ [trunk]: ids.body, [ids['item/tin_whistle']]: ids['room/inn_attic'] });
  const pending = gameView(a.world()).choice!.continuation_id;
  unavailable(a.world(), 'too_heavy');
  a.choose('carry_message', 'too_heavy');
  assert.deepEqual(
    [a.flag('fen_return_branch'), a.world().state.containers[message]],
    ['unselected', ids['npc/vesper']],
  );
  a.run({ type: 'drop', item_id: trunk });
  assert.equal(gameView(a.world()).choice!.continuation_id, pending);
  a.choose('carry_message');
  assert.equal(a.world().state.containers[message], ids.body);
});

// Breaks: historical or transitive custody satisfies terminal hand_over, departed Elspeth accepts, or Drop/Put lose the original item.
test('turn-in rechecks direct message custody and present Elspeth and remains retryable', () => {
  const a = setup();
  a.ready();
  a.choose('carry_message');
  a.move('north', 'north', 'north', 'north');
  a.talk('elspeth');
  const pending = gameView(a.world()).choice!.continuation_id;
  a.run({ type: 'drop', item_id: message });
  unavailable(a.world(), 'invalid_state');
  a.choose('stays', 'invalid_state');
  a.run({ type: 'take', item_id: message });
  // The authored openable trunk is brought to this controlled room; Put and Take execute normally.
  const trunk = ids['item/trunk'];
  a.custody({ [trunk]: ids.body, [ids['item/brass_key']]: ids.body });
  a.run({ type: 'unlock', target_id: trunk });
  a.run({ type: 'open', target_id: trunk });
  a.run({ type: 'put', item_id: message, container_id: trunk });
  unavailable(a.world(), 'not_owned');
  a.choose('stays', 'not_owned');
  assert.equal(a.flag('village_child_status'), 'missing');
  assert.equal(quest(a.world()).state, 'active');
  a.run({ type: 'take', item_id: message });
  a.custody({ [ids['npc/elspeth']]: ids['room/village_green'] });
  unavailable(a.world(), 'not_present');
  a.choose('stays', 'not_present');
  a.custody({ [ids['npc/elspeth']]: ids['room/ferry_landing'] });
  assert.equal(gameView(a.world()).choice!.continuation_id, pending);
  a.choose('stays');
  assert.equal(a.world().state.containers[message], ids['npc/elspeth']);
});

// Breaks: player death deletes or duplicates the quest message, clears branch progress, or makes ordinary corpse recovery impossible.
test('fatal combat preserves the same message in its corpse and ordinary travel and Take recover it', () => {
  const a = setup();
  a.ready();
  a.choose('carry_message');
  a.move('north', 'north', 'north', 'north', 'north', 'east', 'down');
  a.set(hp(a.world(), a.world().body, 1));
  a.run({ type: 'attack', target_id: ids['npc/cellar_rat_1'] });
  const dead = elapsed(a.world(), a.world().state.clock + 150, 100);
  assert.equal(dead.decision.kind, 'accepted', JSON.stringify(dead.decision));
  a.set(dead.world);
  assert.equal(a.world().state.containers[ids.body], ids['room/chapel_nave']);
  const corpse = a.world().state.containers[message];
  assert.ok(a.world().state.created![corpse]);
  assert.equal(
    dead.decision.kind === 'accepted' &&
      dead.decision.events.some(
        (e) => e.payload.type === 'entity_died' && e.payload.corpse_id === corpse,
      ),
    true,
  );
  assert.equal(a.world().state.containers[corpse], ids['room/lantern_cellar']);
  assert.deepEqual(
    [a.flag('fen_return_branch'), a.flag('village_child_status'), quest(a.world()).state],
    ['stays', 'missing', 'active'],
  );
  a.run({ type: 'take', item_id: message }, 'not_present');
  a.move('south', 'south', 'south', 'south', 'east', 'down');
  a.run({ type: 'take', item_id: message });
  assert.equal(a.world().state.containers[message], ids.body);
  a.move('up', 'west', 'south');
  a.talk('elspeth');
  a.choose('stays');
  assert.equal(a.world().state.containers[message], ids['npc/elspeth']);
});

// Breaks: putting the protected message in a portable container bypasses Give admission and strands it with an NPC.
test('Give refuses a trunk containing the message but permits the empty trunk after Take', () => {
  const a = setup();
  a.ready();
  a.choose('carry_message');
  const trunk = ids['item/trunk'];
  a.custody({
    [trunk]: ids.body,
    [ids['item/brass_key']]: ids.body,
    [ids['item/tin_whistle']]: ids['room/inn_attic'],
  });
  a.run({ type: 'unlock', target_id: trunk });
  a.run({ type: 'open', target_id: trunk });
  a.run({ type: 'put', item_id: message, container_id: trunk });
  a.run({ type: 'close', target_id: trunk });
  const offer = () =>
    gameView(a.world())
      .inventory.find((e) => e.id === trunk)!
      .actions.find((v) => v.action_key === 'give');
  const blocked = offer()!;
  assert.equal(blocked.available, false);
  assert.deepEqual('reason' in blocked && blocked.reason, { code: 'invalid_state' });
  a.run({ type: 'give', item_id: trunk, recipient_id: ids['npc/wren'] }, 'invalid_state');
  assert.equal(a.world().state.containers[message], trunk);
  assert.equal(a.world().state.containers[trunk], ids.body);
  a.run({ type: 'open', target_id: trunk });
  a.run({ type: 'take', item_id: message });
  assert.equal(offer()!.available, true);
  a.run({ type: 'give', item_id: trunk, recipient_id: ids['npc/wren'] });
  assert.equal(a.world().state.containers[trunk], ids['npc/wren']);
  assert.equal(a.world().state.containers[message], ids.body);
});
