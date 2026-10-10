import { restStarts } from '../src/mechanics/scene/rest.ts';
import { key } from '../src/foundation/compose.ts';
import { check } from '../src/runtime/invariants.ts';
import { continueQuery } from '../src/mechanics/scene/dream_shared.ts';
import { LIMITS } from '../src/contracts.gen.ts';
import type { Key } from '../src/contracts.gen.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fresh, route, ref, sceneRef, phase, mv, command, entity } from './dream_fixture.ts';
import { step, gameView } from '../src/index.ts';
import { assigned } from '../src/mechanics/fact.ts';
import { identify, resolve } from '../src/commands/invocation.ts';
import { same } from '../src/foundation/compose.ts';

const started = { slept: true, seen: false, cursor: 1, quest: 'active' };
const before = { slept: false, seen: false, cursor: 0, quest: null };
const dream = (w: ReturnType<typeof fresh>) => gameView(w).notices!.find((n) => n.bed)!.dream!;

// Breaks: rental/Sleep/old unpaid Rest grants credit, or first paid Rest changes MV/time/custody or awards memory.
test('only a new actual paid Rest starts one checkpoint without giving its end consequence', () => {
  const a = route(fresh());
  assert.deepEqual(phase(a.world), before);
  const body = a.world.body,
    room = a.world.state.containers[body],
    custody = a.world.state.containers;
  a.invoke({ type: 'sleep' });
  assert.deepEqual(phase(a.world), before);
  a.invoke({ type: 'stand' });
  a.invoke({ type: 'rest' });
  assert.deepEqual(phase(a.world), started);
  assert.equal(mv(a.world), 50);
  assert.equal(a.world.state.clock, 0);
  assert.equal(a.world.body, body);
  assert.equal(a.world.state.containers, custody);
  assert.equal(a.world.state.containers[body], room);
  assert.equal(gameView(a.world).scene, undefined);
  assert.equal(
    gameView(a.world).actions.some((a) => a.action_key === 'dream_next'),
    false,
  );
  const repeat = step(a.world, command(a.world, 30, { type: 'rest' }), 30, 'rest' as Key);
  assert.equal(repeat.decision.kind, 'rejected');
  assert.equal(repeat.world, a.world);
  a.invoke({ type: 'stand' });
  a.invoke({ type: 'rest' });
  assert.deepEqual(phase(a.world), started);
  const unpaid = fresh((c) => {
    c.entry.key = 'inn_rooms';
    c.npcs['ashmere_missing_child@0.0.28:npc/maud'].room = ref('room', 'inn_rooms');
    c.resources['ashmere_missing_child@0.0.28:resource/mv'].start = 50;
  });
  const rested = step(unpaid, command(unpaid, 1, { type: 'rest' }), 1, 'rest' as Key);
  assert.equal(rested.decision.kind, 'accepted');
  assert.deepEqual(phase(rested.world), before);
  const paid = step(
    rested.world,
    command(rested.world, 2, {
      type: 'use_service',
      provider_id: entity(rested.world, 'npc', 'maud'),
      service: ref('service', 'lantern_room'),
      quoted_price: 3,
    }),
    2,
    'rent_lantern_room' as Key,
  );
  assert.equal(paid.decision.kind, 'accepted');
  assert.deepEqual(phase(paid.world), before);
  const oldRest = step(paid.world, command(paid.world, 3, { type: 'rest' }), 3, 'rest' as Key);
  assert.equal(oldRest.decision.kind, 'rejected');
  assert.equal(oldRest.world, paid.world);
  const stood = step(paid.world, command(paid.world, 4, { type: 'stand' }), 4, 'stand' as Key);
  const later = step(stood.world, command(stood.world, 5, { type: 'rest' }), 5, 'rest' as Key);
  assert.equal(later.decision.kind, 'accepted');
  assert.deepEqual(phase(later.world), started);
  const free = ref('fact', 'dream_seen');
  assert.throws(
    () =>
      assigned(
        a.world,
        a.world.character,
        { ops: [], position: 0, facts: {} },
        { fact: free, value: true },
      ),
    /precondition_failed/,
  );
});

// Breaks: Continue skips the choice, a scene choice hijacks dialogue, branch selection grants memory, or final ack fails/duplicates resolution.
test('both exact branches keep World usable and award memory only after shown final acknowledgement', () => {
  for (const selected of ['follow_fox', 'wake']) {
    const a = route(fresh());
    a.invoke({ type: 'rest' });
    const containers = a.world.state.containers,
      rng = a.world.state.rng;
    for (const line of [1, 2, 3]) {
      const current = dream(a.world),
        offer = current.action!;
      const invocation = {
        invocation_id: `dddddddd-2222-4333-8444-${String(line).padStart(12, '0')}`,
        actor_id: a.world.character,
        action_key: offer.action_key,
        target_ids: [],
        input: { scene: current.scene, line: current.index },
      };
      const id = identify(`story/test/${a.world.character}`, a.world.character, invocation);
      assert.equal(id.kind, 'identified');
      if (id.kind !== 'identified') throw Error('identify');
      const resolved = resolve(a.world, id);
      assert.ok('payload' in resolved);
      assert.equal(offer.action_key, 'dream_next');
      const view = gameView(a.world),
        committed = a.invoke((resolved as any).payload, offer.action_key);
      assert.ok(
        check('gameview_agrees_with_admission', {
          view,
          command: resolved,
          decision: committed.decision,
          action_key: offer.action_key,
        }),
      );
      const wrong = {
        ...view,
        notices: view.notices!.map((n) =>
          n.dream
            ? {
                ...n,
                dream: { ...n.dream, action: { ...n.dream.action!, action_key: 'foreign_next' } },
              }
            : n,
        ),
      };
      assert.equal(
        check('gameview_agrees_with_admission', {
          view: wrong,
          command: resolved,
          decision: committed.decision,
          action_key: offer.action_key,
        }),
        false,
      );
      assert.deepEqual(phase(a.world), {
        slept: true,
        seen: false,
        cursor: line + 1,
        quest: 'active',
      });
    }
    assert.equal(gameView(a.world).choice, undefined);
    assert.ok(gameView(a.world).actions.some((a) => a.action_key === 'stand'));
    const current = dream(a.world),
      c = current.choice!,
      option = c.choices.find((o) => o.choice_id === selected)!;
    a.invoke(
      {
        type: 'choose',
        continuation_id: c.continuation_id,
        choice_id: option.choice_id,
        dream: option.dream,
      },
      option.action_key,
    );
    assert.deepEqual(phase(a.world), { slept: true, seen: false, cursor: 5, quest: 'active' });
    assert.equal(dream(a.world).branch, selected);
    const finalLine = selected === 'follow_fox' ? 'dream.follow.final' : 'dream.wake.final';
    assert.equal(dream(a.world).line, finalLine);
    const stale = step(
      a.world,
      command(a.world, 90, { type: 'continue', scene: sceneRef, line: 2 }),
      90,
      'dream_next' as Key,
    );
    assert.equal(stale.decision.kind, 'rejected');
    assert.equal(stale.world, a.world);
    const ended = a.invoke({ type: 'continue', scene: sceneRef, line: 5 }, 'dream_next');
    assert.deepEqual(phase(a.world), { slept: true, seen: true, cursor: -1, quest: 'resolved' });
    assert.equal(dream(a.world).branch, selected);
    assert.equal(dream(a.world).available, false);
    assert.ok(ended.decision.kind === 'accepted');
    assert.equal(ended.decision.narration![0].key, finalLine);
    assert.equal(
      Object.values(a.world.state.quests!).find((q) => q.quest.key === 'a_room_at_the_lantern')!
        .outcome,
      'acknowledged',
    );
    const resolvedQuest = ended.decision.events.find((e) => e.payload.type === 'quest_resolved')!;
    assert.ok(resolvedQuest.payload.type === 'quest_resolved');
    assert.equal(resolvedQuest.payload.outcome, 'acknowledged');
    assert.equal(
      ended.decision.events.some((e) => e.payload.type === 'story_point_reached'),
      false,
    );
    assert.equal(a.world.state.containers, containers);
    assert.deepEqual(a.world.state.rng, rng);
    assert.equal(mv(a.world), 50);
  }
});

// Breaks: pending ordinary choice suppresses first credit or a dormant scene choice blocks real dialogue/elapsed/travel.
test('first credit defers presentation behind the unchanged ordinary choice', () => {
  let w = fresh((c) => {
    c.npcs['ashmere_missing_child@0.0.28:npc/peg'].room = ref('room', 'drowned_lantern');
  });
  const talk = step(w, command(w, 1, { type: 'talk', target_id: entity(w, 'npc', 'peg') }), 1);
  assert.equal(talk.decision.kind, 'accepted', JSON.stringify(talk.decision));
  w = talk.world;
  const ordinary = gameView(w).choice!;
  assert.ok(ordinary);
  const a = route(w);
  a.invoke({ type: 'rest' });
  assert.deepEqual(phase(a.world), started);
  assert.equal(gameView(a.world).choice?.continuation_id, ordinary.continuation_id);
  assert.equal(dream(a.world).available, false);
  a.invoke({ type: 'close_choice', continuation_id: ordinary.continuation_id }, 'close_choice');
  assert.equal(dream(a.world).available, true);
});

// Breaks: scene-owned pending rows hijack real S2 dialogue/handoff or prevent the ordinary Bell modal scene from taking foreground.
test('a dormant dream choice survives the actual S2 message handoff and the Bell modal scene', () => {
  const a = route(
    fresh((c) => {
      c.calendar.start = 64800;
    }),
  );
  a.invoke({ type: 'rest' });
  for (const line of [1, 2, 3]) a.invoke({ type: 'continue', scene: sceneRef, line }, 'dream_next');
  const retained = a.world.state.choices;
  const move = (...directions: string[]) =>
    directions.forEach((direction) => a.invoke({ type: 'move', direction }));
  const talk = (name: string) =>
    a.invoke({ type: 'talk', target_id: entity(a.world, 'npc', name) });
  const choose = (choice_id: string, answer?: string) =>
    a.invoke({
      type: 'choose',
      continuation_id: gameView(a.world).choice!.continuation_id,
      choice_id,
      ...(answer && { answer }),
    });
  a.invoke({ type: 'stand' });
  move('down', 'west', 'south');
  talk('elspeth');
  choose('accept');
  a.invoke(
    { type: 'close_choice', continuation_id: gameView(a.world).choice!.continuation_id },
    'close_choice',
  ); // the hub stays open after an answer (loka-x6t.5): Leave the conversation
  move('north', 'north');
  a.invoke({ type: 'take', item_id: entity(a.world, 'item', 'fox_drawing') });
  move('south', 'south');
  talk('elspeth');
  choose('report');
  move('south', 'south');
  a.invoke({ type: 'perform', action: 'study_tracks' });
  move('south', 'south');
  talk('vesper');
  choose('meet_wren');
  talk('vesper');
  choose('answer', 'LANTERN');
  talk('vesper');
  choose('carry_message');
  move('north', 'north', 'north', 'north');
  talk('elspeth');
  choose('stays');
  assert.equal(
    a.world.state.containers[entity(a.world, 'item', 'vesper_message')],
    entity(a.world, 'npc', 'elspeth'),
  );
  assert.deepEqual(phase(a.world), { slept: true, seen: false, cursor: 4, quest: 'active' });
  move('north', 'north', 'north', 'north', 'north');
  talk('aldric');
  choose('accept');
  move('up', 'up');
  a.invoke({ type: 'perform', action: 'ring_bell' });
  assert.equal(gameView(a.world).scene!.scene.key, 'bell_rung');
  while (gameView(a.world).scene) {
    const d = gameView(a.world).scene!;
    a.invoke({ type: 'continue', scene: d.scene, line: d.index }, 'continue');
  }
  for (const [id, row] of Object.entries(retained ?? {}))
    assert.deepEqual(a.world.state.choices![id], row);
  assert.deepEqual(phase(a.world), { slept: true, seen: false, cursor: 4, quest: 'active' });
  move('down', 'down', 'south', 'south', 'south', 'south', 'east', 'up');
  assert.equal(dream(a.world).available, true);
});

// Breaks: stale/wrong scene-owned draw or binding resolves a retained branch, or keyed view admission ignores the authored alias policy/shared budget.
test('captured scene choices and exact keyed availability reject foreign and stale draws without changing any truth', () => {
  const a = route(fresh());
  a.invoke({ type: 'rest' });
  for (const line of [1, 2, 3]) a.invoke({ type: 'continue', scene: sceneRef, line }, 'dream_next');
  const d = dream(a.world),
    c = d.choice!,
    o = c.choices[0];
  for (const input of [
    { ...o.dream, body_id: entity(a.world, 'npc', 'maud') },
    { ...o.dream, room_id: a.world.roomIds['ashmere_missing_child@0.0.28:room/village_green'] },
    { ...o.dream, expected_revision: o.dream!.expected_revision + 1 },
    { ...o.dream, scene: ref('scene', 'bell_rung') },
    undefined,
  ]) {
    const result = step(
      a.world,
      command(a.world, 80, {
        type: 'choose',
        continuation_id: c.continuation_id,
        choice_id: o.choice_id,
        ...(input && { dream: input }),
      } as any),
      80,
      'dream_choose' as Key,
    );
    assert.equal(result.decision.kind, 'rejected', JSON.stringify(result.decision));
    assert.equal(result.world, a.world);
  }
  const blocked = route(
    fresh((c) => {
      for (const k of ['dream_next', 'dream_choose'])
        c.actions[`ashmere_missing_child@0.0.28:action/${k}`].policy.root = {
          op: 'fact_compare',
          fact: ref('fact', 'dream_seen'),
          equals: true,
        };
    }),
  );
  blocked.invoke({ type: 'rest' });
  const current = dream(blocked.world),
    p = { type: 'continue', scene: current.scene, line: current.index } as const;
  assert.equal(current.action!.action_key, 'dream_next');
  assert.equal(current.action!.available, false);
  const result = step(
    blocked.world,
    command(blocked.world, 90, p),
    90,
    current.action!.action_key as Key,
  );
  assert.equal(result.decision.kind, 'rejected');
  assert.equal(result.world, blocked.world);
  assert.equal(
    continueQuery(
      blocked.world,
      { ...p, actor_id: blocked.world.character },
      { n: LIMITS.query_steps },
    ),
    'budget_exceeded',
  );
});

// Breaks: the first-Rest delivery treats a typed event as sufficient proof even when the current bounded body HP is zero.
test('a Rest occurrence cannot credit a nonliving body', () => {
  const a = route(fresh()),
    before = a.world,
    r = a.invoke({ type: 'rest' });
  assert.ok(r.decision.kind === 'accepted');
  const event = r.decision.events.find((e) => e.payload.type === 'rested')!;
  const at = key({ kind: 'resource', resource: ref('resource', 'hp'), entity_id: before.body });
  const dead = {
    ...before,
    state: {
      ...before.state,
      resources: {
        ...before.state.resources,
        [at]: { ...before.state.resources![at], value: 0, at: 0 },
      },
    },
  };
  assert.deepEqual(restStarts(dead, event), []);
});

// Breaks: a paid-up renter with no pennies left reads "unaffordable" instead of "already paid" (audit A6).
test('a second Rent at zero pennies refuses as already paid, not unaffordable', () => {
  const w = fresh((c) => {
    c.resources[`ashmere_missing_child@0.0.28:resource/pennies`].start = 3;
  });
  const rent = (at: typeof w, n: number) =>
    step(
      at,
      command(at, n, {
        type: 'use_service',
        provider_id: entity(at, 'npc', 'maud'),
        service: ref('service', 'lantern_room'),
        quoted_price: 3,
      }),
      n,
      'rent_lantern_room' as Key,
    );
  const paid = rent(w, 1);
  assert.equal(paid.decision.kind, 'accepted');
  const again = rent(paid.world, 2);
  assert.deepEqual(again.decision, { kind: 'rejected', error: { code: 'invalid_state' } });
});
