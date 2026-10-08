import type { World } from '../src/index.ts';
import type { Command, DecisionResult, DialogueChoice } from '../src/contracts.gen.ts';
import { same } from '../src/foundation/compose.ts';
import { refString } from '../src/runtime/decision.ts';
import { scopeOf, value } from '../src/mechanics/fact.ts';
import { acquisition } from '../src/mechanics/skills.ts';

// ponytail: only selected dialogue membership grants; other knowledge paths stay pending.
export function knowledgeChoiceStep(
  before: World,
  after: World,
  command: Command,
  decision: DecisionResult,
  step: NonNullable<DialogueChoice['sequence']>[number],
): boolean {
  const p = command.payload;
  if (p.type !== 'choose' || decision.kind !== 'accepted') return false;
  const prior = before.state.choices?.[p.continuation_id];
  const next = after.state.choices?.[p.continuation_id];
  if (
    prior?.status !== 'pending' ||
    prior.actor_id !== p.actor_id ||
    next?.status !== 'resolved' ||
    next.choice_id !== p.choice_id ||
    next.actor_id !== p.actor_id ||
    !same(prior.source, next.source)
  )
    return false;
  const fact =
    step.op === 'skill.acquire' && before.cartridge.skills?.[refString(step.skill)]
      ? acquisition(step.skill)
      : step.op === 'topic.grant'
        ? before.cartridge.topics?.[refString(step.topic)]?.fact
        : undefined;
  if (!fact || value(before, p.actor_id, fact) !== false || value(after, p.actor_id, fact) !== true)
    return false;
  return decision.events.some(
    (event) =>
      event.payload.type === 'fact_changed' &&
      same(event.payload.fact, fact) &&
      event.payload.old === false &&
      event.payload.new === true &&
      event.actor_id === p.actor_id &&
      event.world_context_id === command.world_context_id &&
      String(event.causation_id) === command.id &&
      String(event.correlation_id) === command.id &&
      same(event.scope, scopeOf(before, p.actor_id, fact)),
  );
}
