import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView, step } from '../src/index.ts';
import { value } from '../src/mechanics/fact.ts';
import { key } from '../src/foundation/compose.ts';
import { identify, resolve } from '../src/commands/invocation.ts';
import { fragment } from './fragment.ts';
import { fatal } from './death_fixture.ts';
import { buttonsOf } from '../../../mobile/app/book/model.ts';
import { expeditionLine } from '../../../mobile/app/book/words.ts';

const { genesis, ref } = fragment('protocol/fixtures/expedition_sampler_hash.json');

function source(cleared = false) {
  let world = genesis((c) => (c.calendar.start = 43200));
  if (cleared) {
    const hounds = Object.entries(world.state.created ?? {}).filter(
      ([, row]) => row.origin.kind === 'spawned' && row.origin.role === 'hunter',
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
            fact: ref('fact', 'wild_standing'),
            scope: { kind: 'player', character_id: world.character },
          })]: -10,
        },
      },
    };
  }
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
test('sampler starts a cleared pack at noon and resolves once at the faction floor', () => {
  const a = source(true);
  assert.equal(
    a.command({ type: 'expedition', detail_id: a.detail('cairn'), transition: 'start' }).kind,
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
  assert.equal(value(a.world(), a.world().character, ref('fact', 'wild_standing')), -10);
  assert.equal(value(a.world(), a.world().character, ref('fact', 'night_survived')), true);
  assert.equal(gameView(a.world()).time, 43200);
  assert.equal(gameView(a.world()).resources!.find((r) => r.resource.key === 'hp')!.current, 10);
  assert.equal(
    a.command({ type: 'expedition', detail_id: a.detail('cairn'), transition: 'start' }).kind,
    'rejected',
  );
});

// Breaks: a captured shelter action bypasses current attempt/cursor binding, or an alias invokes another stage.
test('sampler shelter offer executes once and stale or mismatched invocations refuse atomically', () => {
  const a = source(true);
  assert.equal(
    a.command({ type: 'expedition', detail_id: a.detail('cairn'), transition: 'start' }).kind,
    'accepted',
  );
  for (const direction of ['west', 'west', 'south'])
    assert.equal(a.command({ type: 'move', direction }).kind, 'accepted');
  const notice = gameView(a.world()).notices!.find((n) =>
    n.actions?.some((action) => action.action_key === 'use_shelter'),
  )!;
  const offered = notice.actions!.find((action) => action.action_key === 'use_shelter')!;
  assert.equal(offered.available, true);
  const captured = buttonsOf(
    gameView(a.world()),
    (key) => key,
    (key) => key,
  ).find((button) => button.action_key === 'use_shelter')!;
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
    a.command({ ...payload, attempt_id: 'ffffffff-0000-4000-8000-000000009999' }, 'use_shelter')
      .kind,
    'rejected',
  );
  assert.equal(a.command(payload, 'begin_walk').kind, 'rejected');
  assert.equal(
    a.command({ ...payload, detail_id: a.detail('cairn') }, 'use_shelter').kind,
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
  const journal = () => gameView(a.world()).journal.find((q) => q.quest.key === 'night_walk')!;
  assert.equal(
    a.command({ type: 'expedition', detail_id: a.detail('cairn'), transition: 'start' }).kind,
    'accepted',
  );
  assert.equal(a.command({ type: 'move', direction: 'west' }).kind, 'accepted');
  assert.equal(a.command({ type: 'move', direction: 'north' }).kind, 'accepted');
  assert.equal(journal().state, 'active');
  assert.equal(journal().expedition!.status, 'failed');
  assert.equal(journal().journal, 'walk.journal.failed');
  assert.equal(a.command({ type: 'move', direction: 'south' }).kind, 'accepted');
  assert.equal(a.command({ type: 'move', direction: 'east' }).kind, 'accepted');
  const prior = a.attempt()!;
  assert.equal(
    a.command({
      type: 'expedition',
      detail_id: a.detail('cairn'),
      transition: 'restart',
      quest_instance_id: prior.quest_instance_id,
      attempt_id: prior.attempt_id,
    }).kind,
    'accepted',
  );
  assert.equal(journal().journal, 'walk.journal.active');
  assert.equal(journal().expedition!.status, 'active');
  assert.equal(journal().expedition!.cursor, 0);
});

// Breaks: a retained stage direction is advertised as the current room's immediate move after a legal detour.
test('a legal detour retains the next checkpoint and hides an inapplicable direction', () => {
  const a = source(true);
  const journal = () =>
    gameView(a.world()).journal.find((q) => q.quest.key === 'night_walk')!.expedition!;
  assert.equal(
    a.command({ type: 'expedition', detail_id: a.detail('cairn'), transition: 'start' }).kind,
    'accepted',
  );
  assert.equal(a.command({ type: 'move', direction: 'west' }).kind, 'accepted');
  assert.equal(journal().direction, 'west');
  assert.equal(journal().next_title, 'room.glade.title');
  assert.equal(a.command({ type: 'move', direction: 'east' }).kind, 'accepted');
  assert.equal(gameView(a.world()).place.title.key, 'room.trailhead.title');
  assert.equal(journal().cursor, 1);
  assert.equal(journal().next_title, 'room.glade.title');
  assert.equal(journal().direction, undefined);
  assert.equal(
    expeditionLine(journal(), (key) => (key === 'room.glade.title' ? 'Glade' : key)),
    'Next checkpoint: Glade.',
  );
  assert.equal(a.command({ type: 'move', direction: 'west' }).kind, 'accepted');
  assert.equal(journal().cursor, 1);
  assert.equal(journal().direction, 'west');
  assert.equal(journal().next_title, 'room.glade.title');
  assert.equal(
    expeditionLine(journal(), (key) => (key === 'room.glade.title' ? 'Glade' : key)),
    'Next: west to Glade.',
  );
});
