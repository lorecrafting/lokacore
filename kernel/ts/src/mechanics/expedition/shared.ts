import type { CharacterId, CommandId, EntityId, QuestInstanceId } from '../../contracts.gen.ts';
import { bodyOf, refString, type World } from '../../runtime/decision.ts';
import { KernelError } from '../../foundation/error.ts';
import { questOf } from '../lookups.ts';
import { living } from '../death/shared.ts';
import { standing } from '../position/shared.ts';
import { engaged } from '../combat/shared.ts';
export type Spec = NonNullable<NonNullable<World['cartridge']['quests']>[string]['expedition']>;

export function definition(world: World) {
  const entries = Object.entries(world.cartridge.quests ?? {}).filter(([, q]) => q.expedition);
  if (entries.length !== 1) throw new KernelError('precondition_failed');
  const [text, quest] = entries[0]!;
  return {
    ref: {
      cartridge_id: world.cartridge.manifest.id,
      cartridge_version: world.cartridge.manifest.version,
      kind: 'quest' as const,
      key: quest.key,
    },
    spec: quest.expedition!,
    text,
  };
}

export function current(world: World, actor: CharacterId) {
  if (!Object.values(world.cartridge.quests ?? {}).some((q) => q.expedition)) return undefined;
  const { ref } = definition(world);
  const found = questOf(world, actor, ref);
  return (
    found && {
      instance_id: found[0],
      quest: found[1],
      attempt: world.state.expeditions?.[found[0]],
    }
  );
}

export function detailFor(world: World, spec: Spec, transition: 'start' | 'restart' | 'shelter') {
  const room = transition === 'shelter' ? spec.shelter_room : spec.start_room;
  const detail = transition === 'shelter' ? spec.shelter_detail : spec.start_detail;
  return Object.entries(world.details).find(
    ([, d]) => d.room === world.roomIds[refString(room)] && d.key === detail,
  )?.[0] as EntityId | undefined;
}

/** Shared read-only admission for keyed projection and direct commands. */
export function refused(
  world: World,
  actor: CharacterId,
  transition: 'start' | 'restart' | 'shelter',
  detail_id: EntityId,
  instance_id?: QuestInstanceId,
  attempt_id?: CommandId,
  cursor?: number,
) {
  const { spec } = definition(world);
  const body = bodyOf(world, actor);
  if (!body || actor !== world.character) return 'not_found' as const;
  if (detailFor(world, spec, transition) !== detail_id) return 'invalid_target' as const;
  const room =
    world.roomIds[refString(transition === 'shelter' ? spec.shelter_room : spec.start_room)];
  if (world.state.containers[body] !== room) return 'not_present' as const;
  if (!living(world, body) || !standing(world, actor) || engaged(world, body))
    return 'invalid_state' as const;
  const now = current(world, actor);
  if (transition === 'start') return now ? ('invalid_state' as const) : undefined;
  if (!now || now.instance_id !== instance_id || now.attempt?.attempt_id !== attempt_id)
    return 'invalid_state' as const;
  if (transition === 'restart')
    return now.quest.state === 'active' && now.attempt?.status === 'failed'
      ? undefined
      : ('invalid_state' as const);
  return now.quest.state === 'active' &&
    now.attempt?.status === 'active' &&
    now.attempt.cursor === 3 &&
    cursor === 3 &&
    !now.attempt.sheltered
    ? undefined
    : ('invalid_state' as const);
}

export function actionRefused(
  world: World,
  actor: CharacterId,
  a: { command: string; key: string },
  target: EntityId | undefined,
) {
  if (a.command !== 'expedition' || target === undefined) return;
  const spec = definition(world).spec;
  const stage = (Object.keys(spec.actions) as ('start' | 'restart' | 'shelter')[]).find(
    (k) => spec.actions[k] === a.key,
  );
  if (!stage) return 'invalid_target' as const;
  const now = current(world, actor);
  return refused(
    world,
    actor,
    stage,
    target,
    now?.instance_id,
    now?.attempt?.attempt_id,
    now?.attempt?.cursor,
  );
}

export function atDetail(world: World, target: string) {
  return Object.values(world.cartridge.quests ?? {}).some(
    (q) =>
      q.expedition &&
      (detailFor(world, q.expedition, 'start') === target ||
        detailFor(world, q.expedition, 'shelter') === target),
  );
}
