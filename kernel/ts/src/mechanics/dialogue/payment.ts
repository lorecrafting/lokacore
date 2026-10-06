import type { DialogueChoice, EntityId } from '../../contracts.gen.ts';
import { type World, type ChoiceRow } from '../../runtime/decision.ts';
import { transfer } from '../resource.ts';

export function choicePayment(
  world: World,
  row: ChoiceRow,
  option: DialogueChoice,
  body: EntityId,
) {
  const lesson = option.lesson_payment;
  const payment = lesson ?? option.payment;
  if (!payment) return;
  const role = lesson ? lesson.to : option.payment!.from;
  const teacher = row.roles.find((r) => r.role === role)?.entity_id;
  if (!teacher) return;
  return transfer(
    world,
    lesson ? body : teacher,
    lesson ? teacher : body,
    payment.resource,
    payment.amount,
  );
}
