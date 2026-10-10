import * as patrol from '../patrol/shared.ts';
import { apart, pending } from './selection.ts';
import { validAttempts } from './behavior.ts';
import { membership } from '../skills.ts';
import { exchangeBlocked } from './exchange.ts';
import { refused as escortRefused } from '../escort/shared.ts';
// dialogue@1 (capability_registry.json; 06 §17, §33, §37, §43; 04 §5.3): what the dialogue rule
// (mechanics/dialogue/rule.ts), admission (commands/actions.ts) and the GameView (view/view.ts) share: a dialogue's
// definition, its talk's bound roles, the actor's pending choice, and why a choice of it cannot be
// made now. A choice's durable occurrence is a row of State.choices (runtime/decision.ts ChoiceRow), keyed
// by the ContinuationId its talk minted.
import { refusal } from '../../commands/actions.ts';
import type { ActionSet, Offered } from '../../commands/actions.ts';
import type {
  ActionInputParameter,
  CharacterId,
  ContinuationId,
  DefinitionRef,
  DialogueDefinition,
  DialogueChoice,
  EntityId,
  Key,
  PendingChoice,
  PatrolDraw,
  RoleBinding,
  TextKey,
  VersionedPolicy,
} from '../../contracts.gen.ts';
import { same } from '../../foundation/compose.ts';
import {
  bodyOf,
  refString,
  type ChoiceRow,
  type Mint,
  type Steps,
  type World,
} from '../../runtime/decision.ts';
import { holds } from '../policy.ts';
import { carrying } from '../containment/shared.ts';
import { acceptRefused, resolution } from '../quest/lifecycle.ts';
import { cmp } from '../../foundation/validate.ts';
import { questOf } from '../lookups.ts';
import { choicePayment } from './payment.ts';

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

/** Bounded ASCII input consumes each authored tile at most once, including duplicate letters. */
export function answerFits(bank: readonly string[], answer: string): boolean {
  if (!answer.length || answer.length > 32 || /[^a-zA-Z]/.test(answer)) return false;
  const remaining = [...bank];
  for (const letter of answer.toUpperCase()) {
    const at = remaining.indexOf(letter);
    if (at < 0) return false;
    remaining.splice(at, 1);
  }
  return true;
}

/** The ids of `d`'s choices, in key order. */
export const choiceIds = (d: DialogueDefinition) => Object.keys(d.choices).sort(cmp) as Key[];

/**
 * Why no option of `row` can be chosen now: invalid_state when the pinned policy no longer
 * holds; then revalidate actual custody and presence (06 §43): not_present while a bound NPC is not in the actor's room, else not_owned while a
 * bound item is not held by the actor body (or the selected receive NPC); Choose and GameView agree.
 */
// size: allow 55, dialogue availability and bound custody share one admission check
export function blocked(
  world: World,
  row: ChoiceRow,
  option: DialogueChoice,
  steps: Steps,
  draw?: PatrolDraw,
) {
  const body = bodyOf(world, row.actor_id);
  const d = definition(world, row.source);
  if (!d || row.beat !== d.key || !boundSitting(world, row, d, option))
    return 'invalid_state' as const;
  const target = speakerOf(d, row);
  if (!holds(world, row.actor_id, d.policy.root, { target, steps }))
    return 'invalid_state' as const;
  const window = option.availability;
  if (
    window &&
    ((window.from !== undefined && world.state.clock < window.from) ||
      (window.through !== undefined && world.state.clock > window.through))
  )
    return 'invalid_state' as const;
  const bound = (role: string) => row.roles.find((r) => r.role === role)?.entity_id;
  const allRolesNeeded = !!d.quest || !Object.values(d.choices).some((c) => c.receive);
  const prior = d.quest && questOf(world, row.actor_id, d.quest)?.[1];
  if (
    prior?.bindings &&
    [option.hand_over?.item, option.hand_over?.to].some(
      (role) => role && prior.bindings?.some((r) => r.role === role && r.entity_id !== bound(role)),
    )
  )
    return 'invalid_state' as const;
  const roles = roleBlocked(world, row, d, option, body!, allRolesNeeded);
  if (option.exchange && d.quest) return roles ?? exchangeBlocked(world, row, d.quest, steps);
  if (roles) return roles;
  const watched = patrol.refused(world, row, option, draw, steps);
  if (watched) return watched;
  const escort = escortRefused(world, row, option);
  if (escort) return escort;
  for (const step of option.sequence ?? [])
    if (step.op === 'skill.acquire' && membership(world, row.actor_id, step.skill) !== false)
      return 'invalid_state' as const;
  if (
    (option.payment || option.lesson_payment) &&
    (!body || !choicePayment(world, row, option, body))
  )
    return 'insufficient_resource' as const;
  if (option.receive) {
    const item = bound(option.receive.item);
    if (!body || !item) return 'not_owned' as const;
    return carrying(world, body, steps)(item);
  }
}

function boundSitting(world: World, row: ChoiceRow, d: DialogueDefinition, option: DialogueChoice) {
  const names = row.roles
    .filter((r) => !option.exchange || !/^(outgoing|incoming)_\d{2}$/.test(r.role))
    .map((r) => r.role)
    .sort(cmp);
  if (!same(names, Object.keys(d.roles).sort(cmp))) return false;
  return (
    validAttempts(row, d) &&
    (d.riddle?.wrong_limit === undefined ||
      (!!d.quest && row.quest_instance_id === questOf(world, row.actor_id, d.quest)?.[0]))
  );
}

function roleBlocked(
  world: World,
  row: ChoiceRow,
  d: DialogueDefinition,
  option: DialogueChoice,
  body: EntityId,
  allRolesNeeded: boolean,
) {
  const bound = (role: string) => row.roles.find((r) => r.role === role)?.entity_id;
  for (const r of row.roles) {
    const expected = d.roles[r.role];
    if (option.exchange && /^(outgoing|incoming)_\d{2}$/.test(r.role)) continue;
    const entity = world.entities[r.entity_id];
    if (!expected || entity?.kind !== expected.role) return 'not_owned' as const;
    if (entity.key !== (expected.role === 'npc' ? expected.npc : expected.item).key)
      return 'invalid_state' as const;
    const needed =
      allRolesNeeded ||
      r.role ===
        Object.keys(d.roles).find((name) => {
          const role = d.roles[name];
          return role?.role === 'npc' && same(role.npc, d.npc);
        }) ||
      [option.receive?.from, option.hand_over?.to, option.payment?.from].includes(r.role);
    if (expected.role === 'npc' && needed && apart(world, r.entity_id, body))
      return 'not_present' as const;
    if (
      expected.role === 'item' &&
      (allRolesNeeded || option.receive?.item === r.role || !!option.hand_over)
    ) {
      const holder = option.receive?.item === r.role ? bound(option.receive.from) : body;
      if (!holder || world.state.containers[r.entity_id] !== holder) return 'not_owned' as const;
    }
  }
}

/**
 * `actor`'s PendingChoice for the GameView (04 §14), if it has one: the dialogue's prompt, its
 * speaker's bound EntityId (from the row, never a name lookup), closable (06 §37), and each option
 * in the row's order, unavailable with blocked's code while it holds, else an accept with
 * acceptRefused's (choose refuses both).
 */
// size: allow 55, exact drawn choice input shares keyed admission and mechanic eligibility
export function choiceView(
  world: World,
  actor: CharacterId,
  steps = { n: 0 },
): PendingChoice | undefined {
  const found = pending(world, actor);
  if (!found) return undefined;
  const [continuation_id, row] = found;
  const d = definition(world, row.source);
  const speaker = Object.keys(d.roles).find((n) => {
    const r = d.roles[n]!;
    return r.role === 'npc' && same(r.npc, d.npc);
  });
  return {
    continuation_id,
    prompt: { key: d.prompt },
    speaker_id: row.roles.find((r) => r.role === speaker)!.entity_id,
    closable: true,
    ...(d.riddle && {
      riddle: {
        choice_id: d.riddle.choice_id,
        bank: d.riddle.bank,
        ...(row.attempts && { attempts: row.attempts }),
      },
    }),
    choices: row.choice_ids.map((choice_id) => {
      const option = d.choices[choice_id]!;
      const q = option.patrol && questOf(world, actor, option.patrol.quest);
      const saved = q && world.state.patrols?.[q[0]];
      const draw = saved && patrol.drawn(saved);
      const code =
        refusal(
          world,
          {
            type: 'choose',
            actor_id: actor,
            continuation_id,
            choice_id,
            ...(draw && { patrol: draw }),
          },
          steps,
          'choose' as Key,
        ) ?? blocked(world, row, option, steps, draw);
      const state = draw ? { patrol: draw } : {};
      const quest = !code && d.quest && resolution(world, actor, d.quest, choice_id, 0, steps);
      const why =
        code ??
        (typeof quest === 'string' ? quest : undefined) ??
        (option.accept && acceptRefused(world, actor, option.accept, steps));
      return why
        ? { ...state, available: false, choice_id, label: option.label, reason: { code: why } }
        : { ...state, available: true, choice_id, label: option.label };
    }),
  };
}

export { speaks, spokenBy, talkRefused, talks, pending, talking, leave } from './selection.ts';

export const ALWAYS: VersionedPolicy = { policy_version: 1, root: { op: 'all', items: [] } };
/** The commands that answer a pending choice: its view is the PendingChoice, never a list. */
export const MODAL: readonly string[] = ['choose', 'close_choice'];

/**
 * The answers to a pending choice (commands/actions.ts resolved): choose while the cartridge locks
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

/** The speaker's bound EntityId: the row's binding of the npc role that is the dialogue's npc. */
export const speakerOf = (d: DialogueDefinition, row: ChoiceRow) =>
  row.roles.find((r) => {
    const role = d.roles[r.role];
    return role?.role === 'npc' && same(role.npc, d.npc);
  })?.entity_id;
