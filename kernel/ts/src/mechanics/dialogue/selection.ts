import type {
  CharacterId,
  DefinitionRef,
  EntityId,
  TextKey,
  Key,
  ContinuationId,
} from '../../contracts.gen.ts';
import type { Offered } from '../../commands/actions.ts';
import {
  bodyOf,
  refString,
  type Steps,
  type World,
  type ChoiceRow,
} from '../../runtime/decision.ts';
import { cmp } from '../../foundation/validate.ts';
import { holds } from '../policy.ts';
import { living } from '../death/shared.ts';

/** The dialogues whose speaker is `target`, in key order (a speaker may have several). */
const spoken = (world: World, target: EntityId | undefined) =>
  Object.values(world.cartridge.dialogues ?? {})
    .filter(
      (d) =>
        target !== undefined &&
        living(world, target) &&
        world.entityIds[refString(d.npc)] === target,
    )
    .sort((a, b) => cmp(a.key, b.key));

/** Whether `target` speaks any dialogue (else its talk is not_found). */
export const speaks = (world: World, target: EntityId | undefined) =>
  spoken(world, target).length > 0;

/**
 * The dialogue `actor`'s talk to `target` opens: the first of `target`'s dialogues, in key order,
 * whose own policy holds, if any. Each policy leaf it evaluates adds one to `steps` (04 §5.4).
 */
export const spokenBy = (
  world: World,
  actor: CharacterId,
  target: EntityId | undefined,
  steps: Steps = { n: 0 },
  selected?: DefinitionRef,
) =>
  spoken(world, target).find(
    (d) =>
      (!selected || world.cartridge.dialogues?.[refString(selected)] === d) &&
      holds(world, actor, d.policy.root, { target, steps }),
  );

/**
 * Whether `target`'s dialogues refuse `actor`'s talk now, no policy of theirs holding or the actor
 * having a pending choice (one per actor): the GameView's check for every talk listed on the
 * target, since a cartridge action with command talk (an alias) is admitted on its own policy.
 */
export const talkRefused = (
  world: World,
  actor: CharacterId,
  target: EntityId | undefined,
  selected?: DefinitionRef,
  steps: Steps = { n: 0 },
) =>
  speaks(world, target) &&
  (!spokenBy(world, actor, target, steps, selected) || !!pending(world, actor));

/**
 * The talk of each dialogue whose speaker is in `actor`'s room, keyed by the dialogue's key: its
 * policy, the speaker its only target (commands/actions.ts accepts).
 */
export function talks(world: World, actor: CharacterId): [string, Offered][] {
  const here = world.state.containers[bodyOf(world, actor)!];
  return Object.values(world.cartridge.dialogues ?? {}).flatMap(({ key, npc, policy, label }) => {
    const speaker = world.entityIds[refString(npc)]!;
    if (!living(world, speaker) || world.state.containers[speaker] !== here) return [];
    const target = { kind: 'entity', scopes: ['room_occupants'] } as const;
    const talk = {
      key,
      label: label ?? ('action.talk' as TextKey),
      target,
      input: [],
      priority: 0,
      policy,
    };
    return [
      [
        key,
        {
          ...talk,
          command: 'talk' as Key,
          speaker,
          ...(label && {
            dialogue: {
              cartridge_id: world.cartridge.manifest.id,
              cartridge_version: world.cartridge.manifest.version,
              kind: 'dialogue',
              key,
            },
          }),
        },
      ],
    ];
  });
}

/** `actor`'s pending choice, if it has one (at most one: talk refuses a second). */
export const pending = (world: World, actor: CharacterId) =>
  Object.entries(world.state.choices ?? {}).find(
    ([, c]) => c.source.kind === 'dialogue' && c.status === 'pending' && c.actor_id === actor,
  ) as [ContinuationId, ChoiceRow] | undefined;
