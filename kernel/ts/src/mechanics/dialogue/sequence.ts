// A dialogue choice's consequences (dialogue@1): its check (toolbox row 14), then its steps:
// topic grants, skill acquisitions and fact assignments in order after `start` (the check's run)
// or the bound transfers, then an exchange's contribution.
import type {
  CharacterId,
  DefinitionRef,
  DialogueChoice,
  DialogueDefinition,
  EntityId,
  EventPayload,
  Step,
} from '../../contracts.gen.ts';
import { KernelError } from '../../foundation/error.ts';
import { same } from '../../foundation/compose.ts';
import {
  accepted,
  event,
  type ChoiceRow,
  type Mint,
  type Rule,
  type World,
  refString,
} from '../../runtime/decision.ts';
import { grant } from '../topics/shared.ts';
import { acquire, opposed, practised } from '../skills.ts';
import { assigned, adjusted, type Assigned } from '../fact.ts';
import { contribution, exchangeDefinition } from './exchange.ts';

export function sequence(
  world: World,
  actor: CharacterId,
  option: DialogueChoice,
  boundReceive: boolean,
  quest?: DefinitionRef,
  start?: Assigned,
  speaker?: EntityId,
) {
  let run: Assigned = start ?? {
    ops: [],
    position: boundReceive ? 2 : option.receive || option.hand_over ? 1 : 0,
    facts: {},
  };
  for (const step of option.steps ?? []) {
    const next = choiceStep(world, actor, run, step, speaker);
    if (!next) return undefined;
    run = next;
  }
  return option.exchange && quest
    ? contribution(world, actor, quest, {
        ...run,
        position: exchangeDefinition(world, quest)!.quantity * 2,
      })
    : run;
}

// One choice step; an op outside the choice context (steps.ex) is a malformed definition.
function choiceStep(
  world: World,
  actor: CharacterId,
  run: Assigned,
  step: Step,
  speaker?: EntityId,
) {
  switch (step.op) {
    case 'topic.grant':
      return grant(world, actor, run, step.topic);
    case 'skill.acquire':
      return acquire(world, actor, run, step.skill);
    case 'fact.adjust': // an entity or pair fact's subject is the speaker (row W2)
      return adjusted(world, actor, run, { ...step, subject: speaker });
    case 'fact.assign':
      return assigned(world, actor, run, { ...step, subject: speaker });
    default:
      throw new KernelError('precondition_failed');
  }
}

// A dialogue choice's opposed check (toolbox row 14; mechanics.md dialogue skill checks): read at
// the choose like a scripted action's (skills.ts opposed; no RNG), its check event at position 1 with the
// named NPC, else the speaker, as subject, then one use of a skill with growth. A pass returns that start for the
// choice's own steps; a failure is the whole decision: the actor reads the check's failure,
// nothing else of the choice applies and the conversation closes (the retry rule: a new talk
// offers the choice again, so a later check passes only once the actor's value has risen).
type Choose = Omit<Parameters<Rule<'dialogue'>>[1], 'payload'> & {
  readonly payload: Extract<Parameters<Rule<'dialogue'>>[1]['payload'], { type: 'choose' }>;
};

export function checked(
  world: World,
  command: Choose,
  mint: Mint,
  row: ChoiceRow,
  d: DialogueDefinition,
  participants: Record<string, EntityId>,
) {
  const { actor_id, continuation_id, choice_id } = command.payload;
  const check = d.choices[choice_id]!.check!;
  // check_kinds.ex: a choice's check is opposed and has a failure.
  if (check.kind !== 'opposed' || check.failure === undefined)
    throw new KernelError('precondition_failed');
  const subject_id = check.npc
    ? world.entityIds[refString(check.npc)]!
    : row.roles.find((r) => {
        const role = d.roles[r.role];
        return role?.role === 'npc' && same(role.npc, d.npc);
      })!.entity_id;
  const passed = opposed(world, actor_id, check, check.rating!);
  const { id: cartridge_id, version: cartridge_version } = world.cartridge.manifest;
  const payload: Extract<EventPayload, { type: 'check_passed' | 'check_failed' }> = {
    type: passed ? 'check_passed' : 'check_failed',
    check: { cartridge_id, cartridge_version, kind: 'check', key: check.key },
    subject_id,
  };
  const run = practised(world, actor_id, { ops: [], position: 1, facts: {} }, check);
  const events = [event(world, command, mint, 1, payload)];
  if (passed) return { run, events };
  const close = { op: 'choice.close', writer_group: 0, continuation_id } as const;
  return accepted(world, 'check_failed', [...run.ops, close], events, [
    { key: check.failure, participants },
  ]);
}
