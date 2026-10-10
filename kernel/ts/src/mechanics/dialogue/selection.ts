import type {
  CharacterId,
  DialogueDefinition,
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
 * already in conversation with `target` (a talk to another speaker leaves the open one first): the GameView's check for every talk listed on the
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
  (!spokenBy(world, actor, target, steps, selected) || talking(world, actor, target));

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

const open = (c: ChoiceRow) => c.source.kind === 'dialogue' && c.status === 'pending';

/** `actor`'s pending choice, if it has one (at most one: talk leaves the open one first). */
export const pending = (world: World, actor: CharacterId) =>
  Object.entries(world.state.choices ?? {}).find(([, c]) => open(c) && c.actor_id === actor) as
    [ContinuationId, ChoiceRow] | undefined;

/** Whether any actor has a pending dialogue choice. */
export const anyPending = (world: World) => Object.values(world.state.choices ?? {}).some(open);

/** Whether `npc` cannot speak with `body` now: dead, or not in the same room (blocked's not_present). */
export const apart = (world: World, npc: EntityId, body: EntityId | undefined) =>
  !body || !living(world, npc) || world.state.containers[npc] !== world.state.containers[body];

/**
 * Whether a dialogue returns to its hub after an answer (dialogue@1): it resolves no quest, declares
 * no riddle and has several choices (the hub, its separation close and the loader's once-only check).
 */
export const reopens = (d: Pick<DialogueDefinition, 'quest' | 'riddle' | 'choices'>) =>
  !d.quest && !d.riddle && Object.keys(d.choices).length > 1;

const dialogue = (world: World, row: ChoiceRow) =>
  world.cartridge.dialogues![refString(row.source)]!;
const speaker = (world: World, row: ChoiceRow) =>
  world.entityIds[refString(dialogue(world, row).npc)]!;

/** Whether `actor` is in conversation with `target` already (its talk is refused). */
export const talking = (world: World, actor: CharacterId, target: EntityId | undefined) => {
  const row = pending(world, actor);
  return !!row && speaker(world, row[1]) === target;
};

/**
 * The Leave of `actor`'s open conversation, if any (dialogue@1): a talk to another speaker or the
 * dream's Continue ends it first, in the same decision.
 */
export const leave = (world: World, actor: CharacterId) => {
  const row = pending(world, actor);
  return row ? [{ op: 'choice.close', writer_group: 0, continuation_id: row[0] } as const] : [];
};

/**
 * The open hub conversations whose actor and speaker no longer share a room, in id order: the
 * proposal closes them as Leave would (dialogue@1; runtime/proposal.ts). A one-shot dialogue's
 * row stays (adverse-cases.json walked-away-rejects-new-choice: choose is not_present).
 */
export const parted = (world: World) =>
  Object.entries(world.state.choices ?? {})
    .filter(
      ([, c]) =>
        open(c) &&
        reopens(dialogue(world, c)) &&
        apart(world, speaker(world, c), bodyOf(world, c.actor_id)),
    )
    .map(([id]) => id as ContinuationId)
    .sort(cmp);
