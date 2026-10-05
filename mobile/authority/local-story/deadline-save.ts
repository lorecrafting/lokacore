// Reconcile a bound deadline against the original choices, due job, facts and conserved payment.
import type {
  Command,
  DecisionResult,
  DefinitionRef,
  DeltaOp,
  QuestDefinition,
} from '../../../kernel/ts/src/contracts.gen.ts';
import { key, same } from '../../../kernel/ts/src/foundation/compose.ts';
import { validOverrideRow } from '../../../kernel/ts/src/foundation/resource.ts';
import { elapsedCommandId, jobCommandId } from '../../../kernel/ts/src/foundation/id_source.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import { bind } from '../../../kernel/ts/src/mechanics/dialogue/shared.ts';
import { scopeOf, value } from '../../../kernel/ts/src/mechanics/fact.ts';
import { refString, type ChoiceRow, type World } from '../../../kernel/ts/src/runtime/decision.ts';
import { committedDialogue } from './dialogue-receipt.ts';
import type { Db, Meta } from './store.ts';

const invalid = (): never => {
  throw new SyntaxError('malformed JSON: inconsistent bound deadline');
};
const rowFor = (world: World, ref: DefinitionRef, entity_id: string) =>
  world.state.resources?.[key({ kind: 'resource', resource: ref, entity_id })];
type ReceiptRow = { command_id: string; actor_id: string; command: string; response: string };

export function deadlineSave(world: World, db: Db, meta: Meta) {
  const scope = `story/${meta.lineage_id}/${world.character}`;
  const choices = Object.entries(world.state.choices ?? {});
  for (const job of Object.values(world.state.jobs ?? {}))
    if (
      !job ||
      validate('DefinitionRef', job.job).length ||
      (job.quest_instance_id !== undefined &&
        (validate('QuestInstanceId', job.quest_instance_id).length ||
          validate('CharacterId', job.actor_id).length))
    )
      invalid();
  for (const [questRef, definition] of Object.entries(world.cartridge.quests ?? {})) {
    const deadline = definition.deadline;
    if (!deadline) continue;
    const offers = Object.values(world.cartridge.dialogues ?? {}).filter((d) =>
      Object.values(d.choices).some(
        (o) => o.accept && refString(o.accept) === questRef && o.receive,
      ),
    );
    if (offers.length !== 1) invalid();
    const offer = offers[0];
    const accepted = choices.filter(
      ([, row]) =>
        refString(row.source) === refString({ ...offer.npc, kind: 'dialogue', key: offer.key }) &&
        row.status === 'resolved' &&
        !!offer.choices[row.choice_id!]?.accept,
    );
    const instances = Object.entries(world.state.quests ?? {}).filter(
      ([, q]) => refString(q.quest) === questRef,
    );
    if (accepted.length > 1 || instances.length > 1 || accepted.length !== instances.length)
      invalid();
    const bound = bind(world, offer);
    const receive = Object.values(offer.choices).find((o) => o.receive)!.receive!;
    const ledger = bound.find((r) => r.role === receive.item)?.entity_id;
    const peg = bound.find((r) => r.role === receive.from)?.entity_id;
    const terminal =
      Object.values(world.cartridge.dialogues ?? {}).find(
        (d) => d.quest && refString(d.quest) === questRef,
      ) ?? invalid();
    if (!ledger || !peg) invalid();
    const item = ledger!,
      holder = world.state.containers[item];
    const jobs = Object.entries(world.state.jobs ?? {}).filter(
      ([, job]) => refString(job.job) === questRef,
    );
    const fact = value(world, world.character, deadline.fact);
    const trust = value(world, world.character, deadline.trust_fact);
    const funding = Object.values(terminal.choices).find((o) => o.payment)?.payment ?? invalid();
    const aldric = bound.find((r) => r.role === funding.from)?.entity_id;
    const resource = funding.resource;
    const spec = world.resourceSpecs[key(resource)];
    const start = world.cartridge.npcs?.[refString(terminal.npc)]?.resource_starts?.[resource.key];
    const actorBalance = rowFor(world, resource, world.body);
    const npcBalance = aldric && rowFor(world, resource, aldric);
    if (
      !aldric ||
      !spec ||
      start === undefined ||
      !validOverrideRow(actorBalance, spec, world.state.clock) ||
      !validOverrideRow(npcBalance, spec, world.state.clock)
    )
      invalid();
    const commerce = Object.values(world.cartridge.npcs ?? {}).some(
      (n) => n.shop && same(n.shop.resource, resource),
    );
    const [instance, q] = instances[0] ?? [];
    if (!q) {
      if (
        holder !== peg ||
        jobs.length ||
        fact !== world.factDefaults[key(deadline.fact)] ||
        trust !== world.factDefaults[key(deadline.trust_fact)] ||
        (!commerce && actorBalance!.value !== spec.start) ||
        npcBalance!.value !== start
      )
        invalid();
      continue;
    }
    const [choiceId, choice] = accepted[0];
    if (
      q.scope.kind !== 'player' ||
      q.scope.character_id !== world.character ||
      !same(q.bindings, bound) ||
      choice.actor_id !== world.character ||
      !same(choice.roles, bound) ||
      jobs.length !== 1
    )
      invalid();
    const [jobId, job] = jobs[0];
    if (
      job.quest_instance_id !== instance ||
      job.actor_id !== world.character ||
      job.due_time !== deadline.at ||
      (q.state === 'failed' && job.status !== 'completed') ||
      (q.state !== 'failed' && job.status === 'cancelled') ||
      (world.state.clock >= deadline.at && job.status !== 'completed') ||
      (world.state.clock < deadline.at && job.status !== 'pending') ||
      (world.state.clock >= deadline.at && ['active', 'objectives_complete'].includes(q.state))
    )
      invalid();
    const receipt = choiceReceipt(world, db, scope, choiceId);
    if (!within(receipt, offer.choices[choice.choice_id!]!.availability)) invalid();
    const activation = receipt.delta.ops.filter((o) => o.op === 'quest.activate');
    const scheduled = receipt.delta.ops.filter((o) => o.op === 'job.schedule');
    if (
      activation.length !== 1 ||
      activation[0].op !== 'quest.activate' ||
      activation[0].instance_id !== instance ||
      !same(activation[0].bindings, bound) ||
      scheduled.length !== 1 ||
      scheduled[0].op !== 'job.schedule' ||
      scheduled[0].job_id !== jobId ||
      scheduled[0].quest_instance_id !== instance ||
      scheduled[0].actor_id !== world.character ||
      scheduled[0].due_time !== deadline.at
    )
      invalid();
    committedDialogue(world, db, scope, choiceId);
    const onTime = Object.entries(terminal.choices).find(([, o]) => !!o.payment)?.[0];
    const complete = choices.filter(
      ([, row]) =>
        refString(row.source) ===
          refString({ ...terminal.npc, kind: 'dialogue', key: terminal.key }) &&
        row.status === 'resolved' &&
        row.choice_id &&
        Object.hasOwn(terminal.choices, row.choice_id),
    );
    if (complete.length > 1) invalid();
    const outcome = complete[0]?.[1].choice_id;
    const paid = q.state === 'resolved' && outcome === onTime;
    if (q.state === 'resolved') {
      if (!outcome || q.outcome !== outcome || fact !== outcome || holder !== aldric || trust !== 0)
        invalid();
      const terminalReceipt = choiceReceipt(world, db, scope, complete[0][0]);
      if (!within(terminalReceipt, terminal.choices[outcome!]!.availability)) invalid();
      committedDialogue(world, db, scope, complete[0][0]);
      const selected = terminal.choices[outcome!]!;
      const axis = selected.sequence?.filter((s) => s.op === 'fact.adjust') ?? [];
      if (axis.length !== 1 || !terminalAxis(world, terminalReceipt, axis[0])) invalid();
      if (paid && !commerce) {
        const transfers = terminalReceipt.delta.ops.filter((o) => o.op === 'resource.adjust');
        if (
          transfers.length !== 2 ||
          transfers[0].op !== 'resource.adjust' ||
          transfers[1].op !== 'resource.adjust' ||
          transfers[0].from !== start ||
          transfers[0].to !== npcBalance!.value ||
          transfers[1].from !== spec.start ||
          transfers[1].to !== actorBalance!.value
        )
          invalid();
      }
    } else if (q.state === 'failed') {
      if (
        outcome ||
        q.outcome !== deadline.outcome ||
        fact !== deadline.outcome ||
        trust !== deadline.trust_amount ||
        !expiryReceipt(world, db, scope, instance!, jobId, deadline)
      )
        invalid();
    } else if (
      !['active', 'objectives_complete'].includes(q.state) ||
      outcome ||
      fact !== 'pending' ||
      trust !== 0 ||
      world.entities[holder]?.kind === 'npc'
    )
      invalid();
    if (
      (!commerce && actorBalance!.value !== spec.start + (paid ? funding.amount : 0)) ||
      npcBalance!.value !== start! - (paid ? funding.amount : 0)
    )
      invalid();
  }
}

function terminalAxis(
  world: World,
  receipt: Extract<DecisionResult, { kind: 'accepted' }>,
  step: { fact: DefinitionRef; amount: number },
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
    op.expected !== world.factDefaults[key(step.fact)] ||
    op.value !==
      Math.min(type.maximum!, Math.max(type.minimum!, (op.expected as number) + step.amount)) ||
    op.value !== value(world, world.character, step.fact)
  )
    return false;
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

function within(
  decision: Extract<DecisionResult, { kind: 'accepted' }>,
  window?: { from?: number; through?: number },
) {
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

function choiceReceipt(
  world: World,
  db: Db,
  scope: string,
  continuation: string,
): Extract<DecisionResult, { kind: 'accepted' }> {
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
  return decision as Extract<DecisionResult, { kind: 'accepted' }>;
}

function expiryReceipt(
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
        return false;
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
        return false;
      const ops: readonly DeltaOp[] = decision.delta.ops;
      const fact = ops.filter((o) => o.op === 'fact.assign' && same(o.fact, deadline.fact));
      const trust = ops.filter((o) => o.op === 'fact.assign' && same(o.fact, deadline.trust_fact));
      const completed = ops.find((o) => o.op === 'job.complete' && o.job_id === job);
      const due = jobCommandId(job, deadline.at);
      const changed = (ref: DefinitionRef, old: string | number, next: string | number) =>
        decision.events.filter(
          (e) =>
            e.payload.type === 'fact_changed' &&
            same(e.payload.fact, ref) &&
            e.causation_id === due &&
            same(e.scope, scopeOf(world, world.character, ref)) &&
            same(e.payload, { type: 'fact_changed', fact: ref, old, new: next }),
        ).length === 1;
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
        changed(deadline.fact, 'pending', deadline.outcome) &&
        changed(deadline.trust_fact, 0, deadline.trust_amount)
      );
    });
}
