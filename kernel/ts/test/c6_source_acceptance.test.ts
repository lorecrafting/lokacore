import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView, step } from '../src/index.ts';
import type { FactValue } from '../src/contracts.gen.ts';
import { spokenBy } from '../src/mechanics/dialogue/selection.ts';
import { value } from '../src/mechanics/fact.ts';
import { key } from '../src/foundation/compose.ts';
import { identify, resolve } from '../src/commands/invocation.ts';
import { fresh, ref } from './transport_fixture.ts';
import { fatal } from './death_fixture.ts';
import { buttonsOf, expeditionLine } from '../../../mobile/app/book/model.ts';

function source(cleared = false, allegiance?: 'prior') {
  let world = fresh((c) => {
    c.entry = ref('room', 'hound_run');
    c.calendar.start = 43200;
  });
  if (cleared) {
    const hounds = Object.entries(world.state.created ?? {}).filter(
      ([, row]) => row.origin.kind === 'spawned' && row.origin.role === 'hound',
    );
    hounds.forEach(([id], index) => {
      world = fatal(
        world,
        id as never,
        `ffffffff-0000-4000-8000-${String(index + 1).padStart(12, '0')}` as never,
      ).next.world;
    });
    world = {
      ...world,
      state: {
        ...world.state,
        facts: {
          ...world.state.facts,
          [key({
            kind: 'fact',
            fact: ref('fact', 'priory_fen_axis'),
            scope: { kind: 'player', character_id: world.character },
          })]: -10,
        },
      },
    };
  }
  if (allegiance)
    world = {
      ...world,
      state: {
        ...world.state,
        facts: {
          ...world.state.facts,
          [key({
            kind: 'fact',
            fact: ref('fact', 'chapel_allegiance'),
            scope: { kind: 'player', character_id: world.character },
          })]: allegiance as FactValue,
        },
      },
    };
  let ordinal = 0;
  const command = (payload: object, action?: string) => {
    const before = world;
    const result = step(
      world,
      {
        id: `bbbbbbbb-0000-4000-8000-${String(++ordinal).padStart(12, '0')}`,
        world_context_id: world.context,
        payload: { actor_id: world.character, ...payload },
      } as never,
      ordinal,
      action as never,
    );
    if (result.decision.kind !== 'accepted') assert.equal(result.world, before);
    world = result.world;
    return result.decision;
  };
  const detail = (name: string) =>
    Object.entries(world.details).find(([, d]) => d.key === name)![0];
  const attempt = () => Object.values(world.state.expeditions ?? {})[0];
  return { command, detail, attempt, world: () => world };
}

// Breaks: cleared hounds or daylight block the expedition, or the C6 consequence underflows its authored floor.
test('actual source starts a cleared pack at noon and resolves once at the faction floor', () => {
  const a = source(true);
  assert.equal(
    a.command({ type: 'expedition', detail_id: a.detail('gnawed_bones'), transition: 'start' })
      .kind,
    'accepted',
  );
  assert.equal(a.attempt()!.cursor, 0);
  assert.equal(gameView(a.world()).combat, undefined);
  for (const [direction, cursor] of [
    ['west', 1],
    ['west', 2],
    ['south', 3],
    ['north', 4],
    ['east', 5],
  ] as const) {
    assert.equal(a.command({ type: 'move', direction }).kind, 'accepted');
    assert.equal(a.attempt()!.cursor, cursor);
  }
  assert.equal(a.attempt()!.status, 'completed');
  assert.equal(value(a.world(), a.world().character, ref('fact', 'priory_fen_axis')), -10);
  assert.equal(value(a.world(), a.world().character, ref('fact', 'fen_night_survived')), true);
  assert.equal(gameView(a.world()).time, 43200);
  assert.equal(gameView(a.world()).resources!.find((r) => r.resource.key === 'hp')!.current, 10);
  assert.equal(
    a.command({ type: 'expedition', detail_id: a.detail('gnawed_bones'), transition: 'start' })
      .kind,
    'rejected',
  );
});

// Breaks: a captured shelter action bypasses current attempt/cursor binding, or an alias invokes another stage.
test('actual source shelter offer executes once and stale or mismatched invocations refuse atomically', () => {
  const a = source(true);
  assert.equal(
    a.command({ type: 'expedition', detail_id: a.detail('gnawed_bones'), transition: 'start' })
      .kind,
    'accepted',
  );
  for (const direction of ['west', 'west', 'south'])
    assert.equal(a.command({ type: 'move', direction }).kind, 'accepted');
  const notice = gameView(a.world()).notices!.find((n) =>
    n.actions?.some((action) => action.action_key === 'use_marsh_shelter'),
  )!;
  const offered = notice.actions!.find((action) => action.action_key === 'use_marsh_shelter')!;
  assert.equal(offered.available, true);
  const captured = buttonsOf(
    gameView(a.world()),
    (key) => key,
    (key) => key,
  ).find((button) => button.action_key === 'use_marsh_shelter')!;
  const invocation = {
    invocation_id: 'dddddddd-0000-4000-8000-000000000001',
    actor_id: a.world().character,
    action_key: offered.action_key,
    target_ids: captured.target_ids,
    input: captured.input,
  };
  const identified = identify('c6-source', a.world().character, invocation);
  assert.equal(identified.kind, 'identified');
  if (identified.kind !== 'identified') throw new Error('offered action did not identify');
  const resolved = resolve(a.world(), identified);
  assert.ok(!('kind' in resolved), JSON.stringify(resolved));
  if ('kind' in resolved) throw new Error('offered action did not resolve');
  const { actor_id: _, ...payload } = resolved.payload as any;
  const before = a.world();
  assert.equal(
    a.command(
      { ...payload, attempt_id: 'ffffffff-0000-4000-8000-000000009999' },
      'use_marsh_shelter',
    ).kind,
    'rejected',
  );
  assert.equal(a.command(payload, 'begin_marsh_watch').kind, 'rejected');
  assert.equal(
    a.command({ ...payload, detail_id: a.detail('gnawed_bones') }, 'use_marsh_shelter').kind,
    'rejected',
  );
  assert.equal(a.world(), before);
  assert.equal(a.command(payload, offered.action_key).kind, 'accepted');
  assert.equal(a.attempt()!.sheltered, true);
  assert.equal(a.attempt()!.cursor, 3);
  assert.equal(gameView(a.world()).time, 43200);
  assert.equal(a.command(payload, offered.action_key).kind, 'rejected');
  assert.equal(a.command({ type: 'move', direction: 'north' }).kind, 'accepted');
  assert.equal(a.command(payload, offered.action_key).kind, 'rejected');
  assert.equal(a.attempt()!.cursor, 4);
});

// Breaks: the nonterminal quest's active state hides a failed attempt and its immediate retry copy.
test('departure shows failed journal prose until explicit Restart', () => {
  const a = source(true);
  const journal = () =>
    gameView(a.world()).journal.find((q) => q.quest.key === 'a_night_in_the_marsh')!;
  assert.equal(
    a.command({ type: 'expedition', detail_id: a.detail('gnawed_bones'), transition: 'start' })
      .kind,
    'accepted',
  );
  assert.equal(a.command({ type: 'move', direction: 'west' }).kind, 'accepted');
  assert.equal(a.command({ type: 'move', direction: 'north' }).kind, 'accepted');
  assert.equal(journal().state, 'active');
  assert.equal(journal().expedition!.status, 'failed');
  assert.equal(journal().journal, 'marsh.journal.failed');
  assert.equal(a.command({ type: 'move', direction: 'south' }).kind, 'accepted');
  assert.equal(a.command({ type: 'move', direction: 'east' }).kind, 'accepted');
  const prior = a.attempt()!;
  assert.equal(
    a.command({
      type: 'expedition',
      detail_id: a.detail('gnawed_bones'),
      transition: 'restart',
      quest_instance_id: prior.quest_instance_id,
      attempt_id: prior.attempt_id,
    }).kind,
    'accepted',
  );
  assert.equal(journal().journal, 'marsh.journal.active');
  assert.equal(journal().expedition!.status, 'active');
  assert.equal(journal().expedition!.cursor, 0);
});

// Breaks: a retained stage direction is advertised as the current room's immediate move after a legal detour.
test('a legal detour retains the next checkpoint and hides an inapplicable direction', () => {
  const a = source(true);
  const journal = () =>
    gameView(a.world()).journal.find((q) => q.quest.key === 'a_night_in_the_marsh')!.expedition!;
  assert.equal(
    a.command({ type: 'expedition', detail_id: a.detail('gnawed_bones'), transition: 'start' })
      .kind,
    'accepted',
  );
  assert.equal(a.command({ type: 'move', direction: 'west' }).kind, 'accepted');
  assert.equal(journal().direction, 'west');
  assert.equal(journal().next_title, 'room.willow_shade.title');
  assert.equal(a.command({ type: 'move', direction: 'east' }).kind, 'accepted');
  assert.equal(gameView(a.world()).place.title.key, 'room.hound_run.title');
  assert.equal(journal().cursor, 1);
  assert.equal(journal().next_title, 'room.willow_shade.title');
  assert.equal(journal().direction, undefined);
  assert.equal(
    expeditionLine(journal(), (key) => (key === 'room.willow_shade.title' ? 'Willow Shade' : key)),
    'Next checkpoint: Willow Shade.',
  );
  assert.equal(a.command({ type: 'move', direction: 'west' }).kind, 'accepted');
  assert.equal(journal().cursor, 1);
  assert.equal(journal().direction, 'west');
  assert.equal(journal().next_title, 'room.willow_shade.title');
  assert.equal(
    expeditionLine(journal(), (key) => (key === 'room.willow_shade.title' ? 'Willow Shade' : key)),
    'Next: west to Willow Shade.',
  );
});

// Breaks: D9's hostile default dialogue swallows an explicitly offered C6 acknowledgement or D1 lesson.
test('actual source hostile Sedge retains explicit marsh acknowledgement and free swim', () => {
  const a = source(true, 'prior');
  const accepted = (payload: object) => assert.equal(a.command(payload).kind, 'accepted');
  accepted({ type: 'expedition', detail_id: a.detail('gnawed_bones'), transition: 'start' });
  for (const direction of ['west', 'west', 'south', 'north', 'east'])
    accepted({ type: 'move', direction });
  assert.equal(a.attempt()!.status, 'completed');
  const invoke = (action_key: string, target_ids: string[], input: object = {}) => {
    const w = a.world();
    const identified = identify('c6-hostile', w.character, {
      invocation_id: 'cccccccc-0000-4000-8000-000000000001',
      actor_id: w.character,
      action_key,
      target_ids,
      input,
    } as never);
    assert.equal(identified.kind, 'identified');
    const resolved = resolve(w, identified as never);
    assert.ok('payload' in resolved);
    if (!('payload' in resolved)) throw Error('unresolved action');
    const { actor_id: _, ...payload } = resolved.payload as any;
    assert.equal(a.command(payload, action_key).kind, 'accepted');
  };
  for (const direction of ['north', 'north', 'west']) accepted({ type: 'move', direction });
  const offer = gameView(a.world()).notices!.find((n) => n.transport)!.transport!;
  invoke(offer.action.action_key, [...offer.action.target_ids!], {
    route: offer.route,
    quoted_fare: offer.fare,
  });
  accepted({ type: 'move', direction: 'east' });
  const sedge = Object.entries(a.world().entities).find(([, e]) => e.key === 'sedge')![0];
  assert.equal(
    spokenBy(a.world(), a.world().character, sedge as never)?.prompt,
    'dialogue.d9_sedge_prior.prompt',
  );
  invoke('sedge_marsh', [sedge]);
  accepted({
    type: 'choose',
    continuation_id: gameView(a.world()).choice!.continuation_id,
    choice_id: 'acknowledge',
  });
  assert.equal(gameView(a.world()).skills!.find((s) => s.skill.key === 'swim')!.acquired, false);
  const pennies = gameView(a.world()).resources!.find((r) => r.resource.key === 'pennies')!.current;
  invoke('sedge_swim', [sedge]);
  accepted({
    type: 'choose',
    continuation_id: gameView(a.world()).choice!.continuation_id,
    choice_id: 'learn',
  });
  assert.equal(gameView(a.world()).skills!.find((s) => s.skill.key === 'swim')!.acquired, true);
  assert.equal(
    gameView(a.world()).resources!.find((r) => r.resource.key === 'pennies')!.current,
    pennies,
  );
  assert.equal(gameView(a.world()).time, 43200);
});
