// dialogue@1 (capability_registry.json; 06 §17, §33, §37, §43; 04 §5.3): what the dialogue rule
// (rules/dialogue.ts), admission (actions.ts) and the GameView (view.ts) share: a dialogue's
// definition, its talk's bound roles, the actor's pending choice, and why a choice of it cannot be
// made now. A choice's durable occurrence is a row of State.choices (decision.ts ChoiceRow), keyed
// by the ContinuationId its talk minted.
import type { ActionSet, Offered } from './actions.ts';
import type {
  ActionInputParameter,
  CharacterId,
  ContinuationId,
  DefinitionRef,
  DialogueDefinition,
  EntityId,
  Key,
  PendingChoice,
  RoleBinding,
  TextKey,
  VersionedPolicy,
} from './contracts.gen.ts';
import { same } from './compose.ts';
import { bodyOf, refString, type ChoiceRow, type Mint, type World } from './decision.ts';
import { holds } from './policy.ts';
import { cmp } from './validate.ts';

/** The cartridge's definition the row's source names (the loader resolves every dialogue). */
export const definition = (world: World, source: DefinitionRef): DialogueDefinition =>
  world.cartridge.dialogues![refString(source)]!;

/** A new ContinuationId from the decision's IdSource allocator: the choice's occurrence id. */
export const continuationId = (mint: Mint) => mint() as ContinuationId;

/**
 * Each role of `d` bound to the EntityId of the NPC or item it names, in role-name order (06 §33,
 * §43: bound once at talk; a choice reads the binding, never a name).
 */
export const bind = (world: World, d: DialogueDefinition): RoleBinding[] =>
  Object.keys(d.roles)
    .sort(cmp)
    .map((role) => {
      const r = d.roles[role]!;
      return { role, entity_id: world.entityIds[refString(r.role === 'npc' ? r.npc : r.item)]! };
    }) as RoleBinding[];

/** The ids of `d`'s choices, in key order. */
export const choiceIds = (d: DialogueDefinition) => Object.keys(d.choices).sort(cmp) as Key[];

/** `actor`'s pending choice, if it has one (at most one: talk refuses a second). */
export const pending = (world: World, actor: CharacterId) =>
  Object.entries(world.state.choices ?? {}).find(
    ([, c]) => c.status === 'pending' && c.actor_id === actor,
  ) as [ContinuationId, ChoiceRow] | undefined;

/**
 * Why no option of `row` can be chosen now (06 §43: a NEW choice revalidates actual custody and
 * presence): not_present while a bound NPC is not in the actor's room, else not_owned while a
 * bound item is not held by the actor's body; choose and the GameView both ask this.
 */
export function blocked(world: World, row: ChoiceRow): 'not_present' | 'not_owned' | undefined {
  const body = bodyOf(world, row.actor_id);
  const at = (r: RoleBinding) => world.state.containers[r.entity_id];
  const of = (kind: string) => row.roles.filter((r) => world.entities[r.entity_id]?.kind === kind);
  if (of('npc').some((r) => at(r) !== world.state.containers[body!])) return 'not_present';
  if (of('item').some((r) => at(r) !== body)) return 'not_owned';
}

/**
 * `actor`'s PendingChoice for the GameView (04 §14), if it has one: the dialogue's prompt, its
 * speaker's bound EntityId (from the row, never a name lookup), closable (06 §37), and each option
 * in the row's order, unavailable with blocked's code while it holds.
 */
export function choiceView(world: World, actor: CharacterId): PendingChoice | undefined {
  const found = pending(world, actor);
  if (!found) return undefined;
  const [continuation_id, row] = found;
  const d = definition(world, row.source);
  const speaker = Object.keys(d.roles).find((n) => {
    const r = d.roles[n]!;
    return r.role === 'npc' && same(r.npc, d.npc);
  });
  const code = blocked(world, row);
  return {
    continuation_id,
    prompt: { key: d.prompt },
    speaker_id: row.roles.find((r) => r.role === speaker)!.entity_id,
    closable: true,
    choices: row.choice_ids.map((choice_id) => {
      const label = d.choices[choice_id]!.label;
      return code
        ? { available: false, choice_id, label, reason: { code } }
        : { available: true, choice_id, label };
    }),
  };
}

/** The dialogue whose speaker is `target`, if any (the loader allows one per speaker). */
export const spokenBy = (world: World, target: EntityId | undefined) =>
  Object.values(world.cartridge.dialogues ?? {}).find(
    (d) => world.entityIds[refString(d.npc)] === target,
  );

/**
 * Whether `target`'s dialogue refuses `actor`'s talk now, its policy failing or the actor having a
 * pending choice (one per actor): the talk rule's check after admission, and the GameView's for
 * every talk listed on the target, since a cartridge action with command talk (an alias) is
 * admitted on its own policy.
 */
export function talkRefused(world: World, actor: CharacterId, target: EntityId | undefined) {
  const d = spokenBy(world, target);
  const ctx = { target, steps: { n: 0 } };
  return d !== undefined && (!holds(world, actor, d.policy.root, ctx) || !!pending(world, actor));
}

/**
 * The talk of each dialogue whose speaker is in `actor`'s room, keyed by the dialogue's key: its
 * policy, the speaker its only target (actions.ts accepts).
 */
export function talks(world: World, actor: CharacterId): [string, Offered][] {
  const here = world.state.containers[bodyOf(world, actor)!];
  return Object.values(world.cartridge.dialogues ?? {}).flatMap(({ key, npc, policy }) => {
    const speaker = world.entityIds[refString(npc)]!;
    if (world.state.containers[speaker] !== here) return [];
    const target = { kind: 'entity', scopes: ['room_occupants'] } as const;
    const talk = { key, label: 'action.talk' as TextKey, target, input: [], priority: 0, policy };
    return [[key, { ...talk, command: 'talk' as Key, speaker }]];
  });
}

export const ALWAYS: VersionedPolicy = { policy_version: 1, root: { op: 'all', items: [] } };
/** The commands that answer a pending choice: its view is the PendingChoice, never a list. */
export const MODAL: readonly string[] = ['choose', 'close_choice'];

/**
 * The answers to a pending choice (actions.ts resolved): choose while the cartridge locks
 * dialogue@1, always available, its rule revalidating the continuation, custody and presence
 * with their own codes; and close_choice of the actor's pending continuation while it has one.
 */
export function modal(world: World, actor: CharacterId): ActionSet {
  if (!Object.hasOwn(world.cartridge.lock.capabilities, 'dialogue')) return {};
  const answer = (command: string, input: ActionInputParameter[]) => ({
    key: command as Key,
    label: `action.${command}` as TextKey,
    target: { kind: 'none' } as const,
    input,
    priority: 0,
    policy: ALWAYS,
    command: command as Key,
  });
  const open = pending(world, actor);
  return {
    choose: answer('choose', ['choice_id', 'continuation_id']),
    ...(open && { close_choice: { ...answer('close_choice', []), continuation: open[0] } }),
  };
}
