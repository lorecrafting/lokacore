// One declared first paid Rest delivery; cursor/quest/fact operations already exist.
import type { DomainEvent, Key, ReactionRule } from '../../contracts.gen.ts';
import { bodyOf, refString, type World } from '../../runtime/decision.ts';
import { level, resourceRef } from '../resource.ts';
import { questOf } from '../lookups.ts';
import { fact } from './shared.ts';
import type { Dream } from './dream_shared.ts';

export function restStarts(world: World, event: DomainEvent): ReactionRule[] {
  const p = event.payload,
    actor = event.actor_id;
  if (
    p.type !== 'rested' ||
    !actor ||
    event.scope.kind !== 'player' ||
    event.scope.character_id !== actor ||
    bodyOf(world, actor) !== p.body_id ||
    world.state.containers[p.body_id] !== p.room_id ||
    (level(world, p.body_id, resourceRef(world, 'hp')) ?? 0) <= 0
  )
    return [];
  return Object.values(world.cartridge.scenes ?? {})
    .filter(
      (s): s is Dream =>
        s.control === 'presentation_only' &&
        world.roomIds[refString(s.on.rest.room)] === p.room_id &&
        !questOf(world, actor, s.on.rest.quest),
    )
    .map((s) => reaction(world, s));
}

function reaction(world: World, s: Dream): ReactionRule {
  return {
    key: s.key as Key,
    on: { event: 'rested', room: s.on.rest.room },
    when: {
      policy_version: 1,
      root: {
        op: 'all',
        items: [
          { op: 'fact_compare', fact: s.on.rest.entitlement, equals: true },
          { op: 'fact_compare', fact: s.on.rest.credit, equals: false },
          { op: 'fact_compare', fact: fact(world, s), equals: 0 },
        ],
      },
    },
    apply: [
      { op: 'fact.assign', fact: s.on.rest.credit, value: true },
      { op: 'quest.activate', quest: s.on.rest.quest },
      { op: 'fact.assign', fact: fact(world, s), value: 1 },
    ],
  };
}
