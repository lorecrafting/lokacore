// A protected quest message over the message fragment (message_fixture.ts): every expected value is
// authored there (courier holding the 20g message, give_allowed false, receive then branch carried,
// Bram's lantern-quest hand_over, the 1000g satchel at the 1000g carry ceiling).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView, step, type World } from '../src/index.ts';
import type { Command } from '../src/contracts.gen.ts';
import { value } from '../src/mechanics/fact.ts';
import { key } from '../src/foundation/compose.ts';
import { genesis, prefix, ref } from './message_fixture.ts';

const fresh = genesis();
const id = (kind: string, name: string) => fresh.entityIds[`${prefix}:${kind}/${name}`]!;
const message = id('item', 'message'),
  satchel = id('item', 'satchel'),
  courier = id('npc', 'courier'),
  bram = id('npc', 'bram');

function setup() {
  let world = fresh;
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
  const choose = (choice_id: string, expected = 'accepted') =>
    run(
      { type: 'choose', continuation_id: gameView(world).choice!.continuation_id, choice_id },
      expected,
    );
  const custody = (changes: Record<string, string>) => {
    world = {
      ...world,
      state: {
        ...world.state,
        containers: { ...world.state.containers, ...changes } as World['state']['containers'],
      },
    };
  };
  const setBranch = (next: string) => {
    const scope = { kind: 'player', character_id: world.character };
    const k = key({ kind: 'fact', fact: ref('fact', 'branch'), scope });
    world = {
      ...world,
      state: { ...world.state, facts: { ...world.state.facts, [k]: next as never } },
    };
  };
  /** Accept the lantern quest, walk to the courier and open the message offer. */
  const ready = () => {
    run({ type: 'accept_quest', quest: ref('quest', 'lantern') });
    run({ type: 'move', direction: 'north' });
    run({ type: 'talk', target_id: courier });
  };
  return {
    run,
    choose,
    custody,
    setBranch,
    ready,
    world: () => world,
    branch: () => value(world, world.character, ref('fact', 'branch')),
  };
}
const unavailable = (w: World, code: string) => {
  const option = gameView(w).choice!.choices[0];
  assert.equal(option.available, false);
  assert.deepEqual('reason' in option && option.reason, { code });
};
const quest = (w: World) => Object.values(w.state.quests!).find((q) => q.quest.key === 'lantern')!;

// Breaks: receiving a duplicate or resolving the quest early, unrelated Give losing the message, or
// terminal hand_over respecting the ordinary Give ban.
test('the message is received once, cannot be given away, and resolves only at Bram', () => {
  const a = setup();
  a.run({ type: 'move', direction: 'north' });
  a.run({ type: 'take', item_id: message }, 'not_present');
  assert.equal(
    gameView(a.world()).entities.some((e) => e.id === message),
    false,
  );
  a.run({ type: 'move', direction: 'south' });
  a.ready();
  assert.equal(a.world().state.containers[message], courier);
  assert.deepEqual(
    gameView(a.world()).choice!.choices.map((c) => [c.choice_id, c.available]),
    [['carry', true]],
  );
  const continuation_id = gameView(a.world()).choice!.continuation_id;
  const selected = a.choose('carry');
  assert.equal(selected.kind, 'accepted');
  if (selected.kind !== 'accepted') return;
  // receive, then the authored sequence, then the resolution of the one-choice dialogue
  assert.deepEqual(
    selected.delta.ops.map((op) => op.op),
    ['entity.transfer', 'fact.assign', 'choice.resolve'],
  );
  assert.deepEqual(selected.delta.ops[0], {
    op: 'entity.transfer',
    writer_group: 0,
    entity_id: message,
    source_id: courier,
    destination_id: a.world().body,
  });
  assert.equal(a.branch(), 'carried');
  assert.equal(quest(a.world()).state, 'active');
  a.run({ type: 'choose', continuation_id, choice_id: 'carry' }, 'invalid_state');
  const give = gameView(a.world())
    .inventory.find((e) => e.id === message)!
    .actions.find((v) => v.action_key === 'give');
  assert.equal(give, undefined); // a refused item lists no Give pair (hs-8)
  a.run({ type: 'give', item_id: message, recipient_id: courier }, 'invalid_state');
  a.run({ type: 'take', item_id: id('item', 'lantern') });
  a.run({ type: 'give', item_id: id('item', 'lantern'), recipient_id: courier });
  a.run({ type: 'move', direction: 'south' });
  assert.equal(quest(a.world()).state, 'active');
  a.run({ type: 'talk', target_id: bram });
  const terminal = a.choose('deliver');
  assert.equal(terminal.kind, 'accepted');
  if (terminal.kind !== 'accepted') return;
  assert.deepEqual(terminal.delta.ops[0], {
    op: 'entity.transfer',
    writer_group: 0,
    entity_id: message,
    source_id: a.world().body,
    destination_id: bram,
  });
  assert.equal(a.world().state.containers[message], bram);
  assert.deepEqual([quest(a.world()).state, quest(a.world()).outcome], ['resolved', 'deliver']);
  assert.equal(terminal.events.filter((e) => e.payload.type === 'quest_resolved').length, 1);
});

// Breaks: Talk-time policy remains authoritative after the branch changes.
test('a pending receive rechecks its policy before Choose', () => {
  const a = setup();
  a.ready();
  a.setBranch('carried');
  unavailable(a.world(), 'invalid_state');
  a.choose('carry', 'invalid_state');
  a.run({ type: 'close_choice', continuation_id: gameView(a.world()).choice!.continuation_id });
});

// Breaks: refused incoming weight partially assigns the branch or consumes the pending continuation,
// or retry uses a replacement item.
test('capacity refusal preserves the pending receive and retries after ordinary Drop', () => {
  const a = setup();
  a.ready();
  a.run({ type: 'take', item_id: satchel }); // 1000g: the ceiling exactly (shared.ts over)
  const pending = gameView(a.world()).choice!.continuation_id;
  unavailable(a.world(), 'over_load');
  a.choose('carry', 'over_load');
  assert.deepEqual([a.branch(), a.world().state.containers[message]], ['unselected', courier]);
  a.run({ type: 'drop', item_id: satchel });
  assert.equal(gameView(a.world()).choice!.continuation_id, pending);
  a.choose('carry');
  assert.equal(a.world().state.containers[message], a.world().body);
});

// Breaks: transitive custody (the message in a held satchel) satisfies terminal hand_over, or the
// refusal consumes the pending turn-in.
test('turn-in rechecks direct message custody and remains retryable', () => {
  const a = setup();
  a.ready();
  a.choose('carry');
  a.run({ type: 'move', direction: 'south' });
  a.run({ type: 'talk', target_id: bram });
  const pending = gameView(a.world()).choice!.continuation_id;
  a.custody({ [satchel]: a.world().body });
  a.run({ type: 'put', item_id: message, container_id: satchel });
  unavailable(a.world(), 'not_owned');
  a.choose('deliver', 'not_owned');
  assert.equal(quest(a.world()).state, 'active');
  a.run({ type: 'take', item_id: message });
  assert.equal(gameView(a.world()).choice!.continuation_id, pending);
  a.choose('deliver');
  assert.equal(a.world().state.containers[message], bram);
});

// Breaks: putting the protected message in a portable container bypasses Give admission and strands
// it with an NPC.
test('Give refuses a satchel containing the message but permits the empty satchel after Take', () => {
  const a = setup();
  a.ready();
  a.choose('carry');
  a.custody({ [satchel]: a.world().body });
  a.run({ type: 'put', item_id: message, container_id: satchel });
  const offer = () =>
    gameView(a.world())
      .inventory.find((e) => e.id === satchel)!
      .actions.find((v) => v.action_key === 'give' && v.target_ids?.[1] === courier);
  assert.equal(offer(), undefined); // a refused item lists no Give pair to the courier (hs-8)
  a.run({ type: 'give', item_id: satchel, recipient_id: courier }, 'invalid_state');
  assert.equal(a.world().state.containers[message], satchel);
  assert.equal(a.world().state.containers[satchel], a.world().body);
  a.run({ type: 'take', item_id: message });
  assert.equal(offer()!.available, true);
  a.run({ type: 'give', item_id: satchel, recipient_id: courier });
  assert.equal(a.world().state.containers[satchel], courier);
  assert.equal(a.world().state.containers[message], a.world().body);
});
