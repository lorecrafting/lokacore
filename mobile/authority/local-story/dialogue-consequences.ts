import type { DialogueChoice, DeltaOp, DomainEvent } from '../../../kernel/ts/src/contracts.gen.ts';
import { same } from '../../../kernel/ts/src/foundation/compose.ts';
import { acquisition } from '../../../kernel/ts/src/mechanics/skills.ts';
import { scopeOf } from '../../../kernel/ts/src/mechanics/fact.ts';
import { bodyOf, type ChoiceRow } from '../../../kernel/ts/src/runtime/decision.ts';
import type { Story } from './save.ts';

export function paymentEvidence(
  s: Story,
  row: ChoiceRow,
  option: DialogueChoice,
  ops: readonly DeltaOp[],
) {
  const lesson = option.lesson_payment;
  const payment = lesson ?? option.payment;
  if (!payment) return true;
  const role = lesson ? lesson.to : option.payment!.from;
  const teacher = row.roles.find((r) => r.role === role)?.entity_id;
  const body = bodyOf(s.world, row.actor_id);
  const paid = ops.filter((o) => o.op === 'resource.adjust');
  return (
    paid.length === 2 &&
    !!teacher &&
    paid[0].op === 'resource.adjust' &&
    paid[1].op === 'resource.adjust' &&
    paid[0].entity_id === (lesson ? body : teacher) &&
    paid[1].entity_id === (lesson ? teacher : body) &&
    same(paid[0].resource, payment.resource) &&
    same(paid[1].resource, payment.resource) &&
    paid[0].from - paid[0].to === payment.amount &&
    paid[1].to - paid[1].from === payment.amount
  );
}

export function assignmentEvidence(
  s: Story,
  row: ChoiceRow,
  option: DialogueChoice,
  ops: readonly DeltaOp[],
  events: readonly DomainEvent[],
) {
  for (const step of option.sequence ?? []) {
    if (step.op === 'fact.adjust') continue;
    const assignment =
      step.op === 'skill.acquire' ? { fact: acquisition(step.skill), value: true } : step;
    const matching = ops.filter((o) => o.op === 'fact.assign' && same(o.fact, assignment.fact));
    const op = matching[0];
    if (
      matching.length !== 1 ||
      op.op !== 'fact.assign' ||
      !same(op.value, assignment.value) ||
      (step.op === 'skill.acquire' && op.expected !== false) ||
      !same(op.scope, scopeOf(s.world, row.actor_id, assignment.fact))
    )
      return false;
    const changed = events.filter(
      (e) => e.payload.type === 'fact_changed' && same(e.payload.fact, assignment.fact),
    );
    if (same(op.expected, op.value)) {
      if (changed.length) return false;
    } else if (
      changed.length !== 1 ||
      changed[0].actor_id !== row.actor_id ||
      changed[0].world_context_id !== s.world.context ||
      String(changed[0].correlation_id) !== String(changed[0].causation_id) ||
      !same(changed[0].scope, op.scope) ||
      !same(changed[0].payload, {
        type: 'fact_changed',
        fact: assignment.fact,
        old: op.expected,
        new: assignment.value,
      })
    )
      return false;
  }
  return true;
}
