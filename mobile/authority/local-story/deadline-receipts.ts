// The original choose and elapsed receipts that bind a deadline's terminal facts.
import type {
  Command,
  DecisionResult,
  DefinitionRef,
  DeltaOp,
  QuestDefinition,
} from '../../../kernel/ts/src/contracts.gen.ts';
import { key, same } from '../../../kernel/ts/src/foundation/compose.ts';
import { elapsedCommandId, jobCommandId } from '../../../kernel/ts/src/foundation/id_source.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import { scopeOf, value } from '../../../kernel/ts/src/mechanics/fact.ts';
import { refString, type World } from '../../../kernel/ts/src/runtime/decision.ts';
import type { Db } from './store.ts';

export const invalid = (): never => {
  throw new SyntaxError('malformed JSON: inconsistent bound deadline');
};
type ReceiptRow = { command_id: string; actor_id: string; command: string; response: string };
type Accepted = Extract<DecisionResult, { kind: 'accepted' }>;

export function terminalAxis(
  world: World,
  receipt: Accepted,
  step: { fact: DefinitionRef; amount: number },
  exchanges: boolean,
) {
  const type = world.cartridge.facts[refString(step.fact)]?.value_type;
  const scope = scopeOf(world, world.character, step.fact);
  const ops = receipt.delta.ops.filter((o) => o.op === 'fact.assign' && same(o.fact, step.fact));
  const op = ops[0];
  if (
    type?.type !== 'int' ||
    ops.length !== 1 ||
    op.op !== 'fact.assign' ||
    op.writer_group !== 0 ||
    !same(op.scope, scope) ||
    typeof op.expected !== 'number' ||
    (!exchanges && op.expected !== world.factDefaults[key(step.fact)]) ||
    op.value !==
      Math.min(type.maximum!, Math.max(type.minimum!, (op.expected as number) + step.amount)) ||
    (!exchanges && op.value !== value(world, world.character, step.fact))
  )
    return false;
  return axisEvent(world, receipt, step, op, scope);
}

function axisEvent(
  world: World,
  receipt: Accepted,
  step: { fact: DefinitionRef },
  op: Extract<DeltaOp, { op: 'fact.assign' }>,
  scope: ReturnType<typeof scopeOf>,
) {
  const events = receipt.events.filter(
    (e) => e.payload.type === 'fact_changed' && same(e.payload.fact, step.fact),
  );
  const choice = receipt.events.find((e) => e.payload.type === 'choice_resolved');
  return (
    events.length === 1 &&
    !!choice &&
    events[0].actor_id === world.character &&
    events[0].causation_id === choice.causation_id &&
    events[0].logical_time === choice.logical_time &&
    same(events[0].scope, scope) &&
    same(events[0].payload, {
      type: 'fact_changed',
      fact: step.fact,
      old: op.expected,
      new: op.value,
    })
  );
}

export function within(decision: Accepted, window?: { from?: number; through?: number }) {
  const times = decision.events
    .filter((e) => e.payload.type === 'choice_resolved')
    .map((e) => e.logical_time);
  return (
    times.length === 1 &&
    (!window ||
      ((window.from === undefined || times[0] >= window.from) &&
        (window.through === undefined || times[0] <= window.through)))
  );
}

export function choiceReceipt(world: World, db: Db, scope: string, continuation: string): Accepted {
  const rows = db.getAllSync<ReceiptRow>(
    `SELECT command_id,actor_id,command,response FROM receipt WHERE scope=?
    AND json_extract(command,'$.payload.type')='choose'
    AND json_extract(command,'$.payload.continuation_id')=?
    AND json_extract(response,'$.kind')='accepted'`,
    scope,
    continuation,
  );
  if (rows.length !== 1 || rows[0].actor_id !== world.character) invalid();
  const command: Command = JSON.parse(rows[0].command),
    decision: DecisionResult = JSON.parse(rows[0].response);
  if (
    validate('Command', command).length ||
    validate('DecisionResult', decision).length ||
    command.id !== rows[0].command_id ||
    command.payload.type !== 'choose' ||
    command.payload.actor_id !== world.character ||
    command.world_context_id !== world.context ||
    decision.kind !== 'accepted'
  )
    invalid();
  return decision as Accepted;
}

export function expiryReceipt(
  world: World,
  db: Db,
  scope: string,
  instance: string,
  job: string,
  deadline: NonNullable<QuestDefinition['deadline']>,
) {
  const rows = db.getAllSync<ReceiptRow>(
    'SELECT command_id,actor_id,command,response FROM receipt WHERE scope=?',
    scope,
  );
  return rows
    .filter((r) => r.actor_id === world.character)
    .some((r) => {
      const decision = dueElapsed(world, r, deadline);
      return !!decision && expires(world, decision, instance, job, deadline);
    });
}

function dueElapsed(
  world: World,
  r: ReceiptRow,
  deadline: NonNullable<QuestDefinition['deadline']>,
): Accepted | undefined {
  const command: Command = JSON.parse(r.command),
    decision: DecisionResult = JSON.parse(r.response);
  if (
    validate('Command', command).length ||
    validate('DecisionResult', decision).length ||
    command.payload.type !== 'elapsed' ||
    command.payload.actor_id !== world.character ||
    command.id !== r.command_id ||
    command.world_context_id !== world.context ||
    decision.kind !== 'accepted'
  )
    return undefined;
  if (
    command.id !==
      elapsedCommandId(
        command.payload.run_id,
        world.context,
        command.payload.from,
        command.payload.until,
      ) ||
    command.payload.from >= deadline.at ||
    command.payload.until < deadline.at
  )
    return undefined;
  return decision;
}

const changed = (
  world: World,
  decision: Accepted,
  due: string,
  ref: DefinitionRef,
  old: string | number,
  next: string | number,
) =>
  decision.events.filter(
    (e) =>
      e.payload.type === 'fact_changed' &&
      same(e.payload.fact, ref) &&
      e.causation_id === due &&
      same(e.scope, scopeOf(world, world.character, ref)) &&
      same(e.payload, { type: 'fact_changed', fact: ref, old, new: next }),
  ).length === 1;

function expires(
  world: World,
  decision: Accepted,
  instance: string,
  job: string,
  deadline: NonNullable<QuestDefinition['deadline']>,
) {
  const ops: readonly DeltaOp[] = decision.delta.ops;
  const fact = ops.filter((o) => o.op === 'fact.assign' && same(o.fact, deadline.fact));
  const trust = ops.filter((o) => o.op === 'fact.assign' && same(o.fact, deadline.trust_fact));
  const completed = ops.find((o) => o.op === 'job.complete' && o.job_id === job);
  const due = jobCommandId(job, deadline.at);
  return (
    completed?.op === 'job.complete' &&
    completed.writer_group > 0 &&
    ops.some(
      (o) =>
        o.op === 'quest.transition' &&
        o.instance_id === instance &&
        o.to === 'failed' &&
        o.outcome === deadline.outcome &&
        o.writer_group === completed.writer_group,
    ) &&
    fact.length === 1 &&
    fact[0].op === 'fact.assign' &&
    fact[0].writer_group === completed.writer_group &&
    same(fact[0].scope, scopeOf(world, world.character, deadline.fact)) &&
    fact[0].expected === 'pending' &&
    fact[0].value === deadline.outcome &&
    trust.length === 1 &&
    trust[0].op === 'fact.assign' &&
    trust[0].writer_group === completed.writer_group &&
    same(trust[0].scope, scopeOf(world, world.character, deadline.trust_fact)) &&
    trust[0].expected === 0 &&
    trust[0].value === deadline.trust_amount &&
    changed(world, decision, due, deadline.fact, 'pending', deadline.outcome) &&
    changed(world, decision, due, deadline.trust_fact, 0, deadline.trust_amount)
  );
}
