// A dialogue choice's consequences (dialogue@1): its check (toolbox row 14), then its sequence:
// topic grants, skill acquisitions and fact assignments in order after `start` (the check's run)
// or the bound transfers, then an exchange's contribution.
import type {
  CharacterId,
  DefinitionRef,
  DialogueChoice,
  DialogueDefinition,
  EntityId,
  EventPayload,
} from '../../contracts.gen.ts';
import { same } from '../../foundation/compose.ts';
import {
  accepted,
  event,
  type ChoiceRow,
  type Mint,
  type Rule,
  type World,
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
) {
  let run: Assigned = start ?? {
    ops: [],
    position: boundReceive ? 2 : option.receive || option.hand_over ? 1 : 0,
    facts: {},
  };
  for (const step of option.sequence ?? []) {
    const next =
      step.op === 'topic.grant'
        ? grant(world, actor, run, step.topic)
        : step.op === 'skill.acquire'
          ? acquire(world, actor, run, step.skill)
          : step.op === 'fact.adjust'
            ? adjusted(world, actor, run, step)
            : assigned(world, actor, run, step);
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

// A dialogue choice's opposed check (toolbox row 14; mechanics.md dialogue skill checks): read at
// the choose like a recipe's (skills.ts opposed; no RNG), its check event at position 1 with the
// speaker as subject, then one use of a skill with growth. A pass returns that start for the
// choice's own sequence; a failure is the whole decision: the actor reads the check's failure,
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
  const speaker = row.roles.find((r) => {
    const role = d.roles[r.role];
    return role?.role === 'npc' && same(role.npc, d.npc);
  })!.entity_id;
  const passed = opposed(world, actor_id, check, check.rating!);
  const { id: cartridge_id, version: cartridge_version } = world.cartridge.manifest;
  const payload: Extract<EventPayload, { type: 'check_passed' | 'check_failed' }> = {
    type: passed ? 'check_passed' : 'check_failed',
    check: { cartridge_id, cartridge_version, kind: 'check', key: check.key },
    subject_id: speaker,
  };
  const run = practised(world, actor_id, { ops: [], position: 1, facts: {} }, check);
  const events = [event(world, command, mint, 1, payload)];
  if (passed) return { run, events };
  const close = { op: 'choice.close', writer_group: 0, continuation_id } as const;
  return accepted(world, 'check_failed', [...run.ops, close], events, [
    { key: check.failure, participants },
  ]);
}
