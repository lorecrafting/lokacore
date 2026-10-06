import { restStarts } from './rest.ts';
// Shared scene@1 fact, running-line, modal and event-start queries (mechanics.md).
import type {
  CharacterId,
  DefinitionRef,
  DomainEvent,
  ReactionRule,
  SceneDefinition,
  SceneView,
  Key,
  TextKey,
} from '../../contracts.gen.ts';
import { bodyOf, has, values, refString, type World } from '../../runtime/decision.ts';
import { value } from '../fact.ts';
import { ALWAYS } from '../dialogue/shared.ts';
import type { ActionSet } from '../../commands/actions.ts';

const reference = (world: World, kind: string, key: string): DefinitionRef => ({
  cartridge_id: world.cartridge.manifest.id,
  cartridge_version: world.cartridge.manifest.version,
  kind,
  key: key as Key,
});
export const fact = (world: World, scene: SceneDefinition) =>
  reference(world, 'fact', `scene_${scene.key}`);

/** Current shown line, for this actor; the loader admits one scene per trigger. */
export function running(world: World, actor: CharacterId): SceneView | undefined {
  if (!has(world.cartridge.lock.capabilities, 'scene')) return undefined;
  for (const s of values(world.cartridge.scenes ?? {})) {
    if (s.control !== 'modal') continue;
    const index = value(world, actor, fact(world, s));
    const count = s.steps.length - 2;
    if (typeof index !== 'number' || index < 1 || index > count) continue;
    const line = s.steps[index - 1]!;
    if (line.type === 'narrate')
      return { scene: reference(world, 'scene', s.key), line: line.text, index, count };
  }
}

/** Reaction-shaped deliveries: on is unused here; sequence consumes when and apply. */
export function starts(world: World, e: DomainEvent): ReactionRule[] {
  return [...restStarts(world, e), ...legacyStarts(world, e)];
}

function legacyStarts(world: World, e: DomainEvent): ReactionRule[] {
  if (
    !has(world.cartridge.lock.capabilities, 'scene') ||
    (e.payload.type !== 'story_point_reached' &&
      e.payload.type !== 'quest_resolved' &&
      e.payload.type !== 'action_completed')
  )
    return [];
  const p = e.payload;
  return values(world.cartridge.scenes ?? {})
    .filter(
      (s) =>
        s.control === 'modal' &&
        ('action' in s.on && p.type === 'action_completed'
          ? s.on.action!.key === p.action &&
            e.actor_id !== undefined &&
            world.details[p.subject_id]?.key === s.on.detail &&
            world.details[p.subject_id]?.room === world.roomIds[refString(s.on.room!)] &&
            world.state.containers[bodyOf(world, e.actor_id)!] === world.details[p.subject_id]?.room
          : 'story_point' in s.on && p.type === 'story_point_reached'
            ? refString(s.on.story_point!) === refString(p.story_point)
            : 'quest' in s.on &&
              p.type === 'quest_resolved' &&
              refString(s.on.quest!) === refString(p.quest)) &&
        (p.type === 'action_completed' || s.on.outcome === p.outcome),
    )
    .map((s) => ({
      key: s.key as Key,
      on: { event: 'fact_changed', fact: fact(world, s) },
      when: { policy_version: 1, root: { op: 'fact_compare', fact: fact(world, s), equals: 0 } },
      apply: [{ op: 'fact.assign', fact: fact(world, s), value: 1 }],
    }));
}

/** Scene replacement contribution; it cannot be removed or overridden by content. */
export const modal = (): ActionSet => ({
  continue: {
    key: 'continue' as Key,
    command: 'continue' as Key,
    label: 'action.continue' as TextKey,
    target: { kind: 'none' },
    input: ['scene', 'line'],
    priority: 0,
    policy: ALWAYS,
    engine: true,
  },
});
