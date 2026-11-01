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
import { same } from '../../foundation/compose.ts';
import { holds } from '../policy.ts';
import { living } from '../death/shared.ts';
import { disposition } from '../disposition.ts';
import { concealed } from '../skills.ts';

/** The dialogues `d`'s answers lead to. */
const links = (d: DialogueDefinition) =>
  Object.values(d.choices)
    .flatMap((c) => [c.then, c.then_failed] as (string | undefined)[])
    .filter((k): k is string => !!k);

/**
 * The dialogues a talk can open: those nothing leads to, then the first by key of each cycle left
 * (a nested answer returns to its parent, so a root may be named too); everything an entry reaches
 * is reached only by that answer.
 */
const entries = (world: World) => {
  const all = Object.values(world.cartridge.dialogues ?? {}).sort((a, b) => cmp(a.key, b.key));
  const next = new Map<string, string[]>(all.map((d) => [d.key, links(d)]));
  const named = new Set(all.flatMap(links));
  const reached = new Set<string>();
  const walk = (key: string) => {
    if (reached.has(key)) return;
    reached.add(key);
    next.get(key)?.forEach(walk);
  };
  return [...all.filter((d) => !named.has(d.key)), ...all].filter((d) => {
    if (reached.has(d.key)) return false;
    walk(d.key);
    return true;
  });
};

/** Whether some answer's `then` or `then_failed` names `d`: such a dialogue never reopens itself. */
export const linked = (world: World, d: Pick<DialogueDefinition, 'key'>) =>
  Object.values(world.cartridge.dialogues ?? {}).some((o) => links(o).includes(d.key));

/** The dialogues whose speaker is `target`, in key order (a speaker may have several). */
const spoken = (world: World, target: EntityId | undefined) =>
  entries(world)
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

/** The ids of `d`'s choices, in key order. */
export const choiceIds = (d: DialogueDefinition) => Object.keys(d.choices).sort(cmp) as Key[];

/** Whether choice `id` of `d` teaches a skill for which `p` holds (Homestead hs-14). */
const teaches = (d: DialogueDefinition, id: Key, p: (skill: DefinitionRef) => boolean) =>
  !!d.choices[id]!.steps?.some((s) => s.op === 'skill.acquire' && p(s.skill));

/** `d`'s choice ids less those that teach a skill concealed from `actor` (Homestead hs-14). */
export const offered = (world: World, actor: CharacterId, d: DialogueDefinition, steps: Steps) =>
  choiceIds(d).filter((id) => !teaches(d, id, (k) => concealed(world, actor, k, steps)));

/**
 * Whether a saved row's `ids` are ones an opening of `d` can write: `choiceIds(d)` in order, never
 * empty, less only choices that `skill.acquire` a hidden skill with a prerequisite (hs-14; the save
 * checks, static because the actor has moved on since the opening).
 */
export const openable = (world: World, d: DialogueDefinition, ids: unknown) =>
  Array.isArray(ids) &&
  ids.length > 0 &&
  same(
    ids,
    choiceIds(d).filter(
      (id) =>
        ids.includes(id) ||
        !teaches(d, id, (k) => {
          // as `concealed` (skills.ts): a hidden skill with no prerequisite is never left out
          const skill = world.cartridge.skills?.[refString(k)];
          return !!skill?.hidden && !!skill.prerequisite;
        }),
    ),
  );

/** An option's `asked` mark: never a refusal, only what the view says while its policy holds. */
export const asked = (
  world: World,
  actor: CharacterId,
  option: DialogueDefinition['choices'][string],
  target: EntityId | undefined,
  steps: Steps,
) =>
  option.asked_when && holds(world, actor, option.asked_when, { target, steps })
    ? { asked: true as const }
    : {};

/** Those of `ids` whose own policy holds: the rest stay on the row and are not drawn (dialogue@1). */
export const shown = (
  world: World,
  actor: CharacterId,
  d: DialogueDefinition,
  ids: readonly Key[],
  target: EntityId | undefined,
  steps: Steps,
) => ids.filter((id) => holds(world, actor, d.choices[id]!.policy, { target, steps }));

/**
 * The dialogue `actor`'s talk to `target` opens: the first of `target`'s dialogues, in key order,
 * whose own policy holds and that offers a choice (hs-14), if any; none while `target` is hostile
 * to `actor` (toolbox row G11).
 * A talk never opens a keyword dialogue; a say or whisper of `word` opens only one keyed by it
 * (speech@1, row G9). Each policy leaf it evaluates adds one to `steps` (04 §5.4).
 */
export const spokenBy = (
  world: World,
  actor: CharacterId,
  target: EntityId | undefined,
  steps: Steps = { n: 0 },
  selected?: DefinitionRef,
  word?: string,
) =>
  disposition(world, actor, target, steps) === 'hostile'
    ? undefined
    : spoken(world, target).find(
        (d) =>
          d.keyword === word &&
          (!selected || world.cartridge.dialogues?.[refString(selected)] === d) &&
          holds(world, actor, d.policy, { target, steps }) &&
          shown(world, actor, d, offered(world, actor, d, steps), target, steps).length > 0,
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
  const talked = entries(world).filter((d) => !d.keyword); // row G9
  return talked.flatMap(({ key, npc, policy, name: label }) => {
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
 * no riddle and has several choices or a choice that leads on (the hub, its separation close and the compiler's once-only check).
 */
export const reopens = (d: Pick<DialogueDefinition, 'quest' | 'riddle' | 'choices'>) =>
  !d.quest &&
  !d.riddle &&
  (Object.keys(d.choices).length > 1 ||
    Object.values(d.choices).some((c) => c.then || c.then_failed));

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
        (reopens(dialogue(world, c)) || linked(world, dialogue(world, c))) &&
        apart(world, speaker(world, c), bodyOf(world, c.actor_id)),
    )
    .map(([id]) => id as ContinuationId)
    .sort(cmp);
