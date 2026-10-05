// Dialogue detail routing is derived from a committed command and its retained bound row.
import type {
  Command,
  DecisionResult,
  DeltaOp,
  DomainEvent,
  DialogueDefinition,
  DialogueChoice,
} from '../../../kernel/ts/src/contracts.gen.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import { same } from '../../../kernel/ts/src/foundation/compose.ts';
import {
  bodyOf,
  refString,
  type ChoiceRow,
  type World,
} from '../../../kernel/ts/src/runtime/decision.ts';
import { answerFits, bind, choiceIds } from '../../../kernel/ts/src/mechanics/dialogue/shared.ts';
import { scopeOf } from '../../../kernel/ts/src/mechanics/fact.ts';
import { questOf } from '../../../kernel/ts/src/mechanics/lookups.ts';
import type { Story } from './save.ts';
import type { Db } from './store.ts';

// size: allow 60, one trust boundary checks original command, binding and narration identity
export function dialogueDetail(
  s: Story,
  command_id: string,
  command: Command,
  d: Extract<DecisionResult, { kind: 'accepted' }>,
) {
  const invalid = () => {
    throw new SyntaxError('malformed JSON: invalid committed dialogue answer');
  };
  if (
    validate('Command', command).length ||
    validate('DecisionResult', d).length ||
    command.id !== command_id ||
    command.world_context_id !== s.world.context ||
    command.payload.type !== 'choose'
  )
    return invalid();
  const p = command.payload;
  const row = s.world.state.choices?.[p.continuation_id];
  if (row && validate('DefinitionRef', row.source).length) return invalid();
  const source = row && s.world.cartridge.dialogues?.[refString(row.source)];
  const option = source?.choices[p.choice_id];
  if (
    !source?.riddle &&
    !option?.escort &&
    !transferDetail(s, source, option) &&
    p.answer === undefined &&
    d.outcome !== 'riddle_wrong'
  )
    return;
  if (
    !row ||
    !source ||
    !option ||
    row.actor_id !== p.actor_id ||
    row.beat !== source.key ||
    !same(
      row.roles.filter((r) => !option.exchange || !/^(outgoing|incoming)_\d{2}$/.test(r.role)),
      bind(s.world, source),
    ) ||
    !same(row.choice_ids, choiceIds(source))
  )
    return invalid();
  const speaker = Object.entries(source.roles).find(
    ([, r]) => r.role === 'npc' && same(r.npc, source.npc),
  )?.[0];
  const detail = row.roles.find((r) => r.role === speaker)?.entity_id;
  const participants = Object.fromEntries([
    ['actor', bodyOf(s.world, p.actor_id)],
    ...row.roles.map((r) => [r.role, r.entity_id]),
  ]);
  const riddle = source.riddle?.choice_id === p.choice_id ? source.riddle : undefined;
  if (
    riddle ? p.answer === undefined || !answerFits(riddle.bank, p.answer) : p.answer !== undefined
  )
    return invalid();
  const wrong = riddle && p.answer!.toLowerCase() !== riddle.answer;
  const key = wrong ? riddle.wrong : option.narration;
  if (!detail || !same(d.narration?.[0], { key, participants })) return invalid();
  if (!evidence(d, { ...command, payload: p }, row, !!wrong)) return invalid();
  if (!wrong && !consequences(s, command, d, row, source, option)) return invalid();
  return detail;
}
function evidence(
  d: Extract<DecisionResult, { kind: 'accepted' }>,
  command: Command & { payload: Extract<Command['payload'], { type: 'choose' }> },
  row: ChoiceRow,
  wrong: boolean,
) {
  if (wrong)
    return (
      d.outcome === 'riddle_wrong' &&
      !d.delta.ops.length &&
      !d.events.length &&
      !d.effects.length &&
      d.narration?.length === 1
    );
  const p = command.payload;
  const resolved = d.delta.ops.filter((o) => o.op === 'choice.resolve' && o.writer_group === 0);
  const events = d.events.filter(
    (e) => e.causation_id === (command.id as string) && e.payload.type === 'choice_resolved',
  );
  const event = events[0];
  return (
    d.outcome === p.choice_id &&
    row.status === 'resolved' &&
    row.choice_id === p.choice_id &&
    resolved.length === 1 &&
    same(resolved[0], {
      op: 'choice.resolve',
      writer_group: 0,
      continuation_id: p.continuation_id,
      choice_id: p.choice_id,
      expected_revision: row.opened_revision,
    }) &&
    events.length === 1 &&
    event.actor_id === p.actor_id &&
    event.payload.type === 'choice_resolved' &&
    event.payload.continuation_id === p.continuation_id &&
    event.payload.choice_id === p.choice_id
  );
}

// Check the authored transfer/consequences in this receipt, not current possession or latest narration.
function consequences(
  s: Story,
  command: Command,
  d: Extract<DecisionResult, { kind: 'accepted' }>,
  row: ChoiceRow,
  source: DialogueDefinition,
  option: DialogueChoice,
) {
  const actor = row.actor_id;
  const ops = d.delta.ops.filter((o) => o.writer_group === 0);
  const events = d.events.filter((e) => e.causation_id === (command.id as string));
  if (!transferEvidence(s, row, option, ops, events)) return false;
  if (!assignmentEvidence(s, row, option, ops, events)) return false;
  if (option.payment) {
    const from = row.roles.find((r) => r.role === option.payment!.from)?.entity_id;
    const paid = ops.filter((o) => o.op === 'resource.adjust');
    if (
      paid.length !== 2 ||
      paid[0].op !== 'resource.adjust' ||
      paid[1].op !== 'resource.adjust' ||
      !from ||
      paid[0].entity_id !== from ||
      paid[1].entity_id !== bodyOf(s.world, actor) ||
      !same(paid[0].resource, option.payment.resource) ||
      !same(paid[1].resource, option.payment.resource) ||
      paid[0].from - paid[0].to !== option.payment.amount ||
      paid[1].to - paid[1].from !== option.payment.amount
    )
      return false;
  }
  if (!escortEvidence(s, command, row, option, ops)) return false;
  if (!source.quest) return true;
  if (option.exchange) {
    const resolved = ops.filter((o) => o.op === 'quest.transition' && o.to === 'resolved');
    return (
      resolved.length === 1 &&
      resolved[0].op === 'quest.transition' &&
      resolved[0].instance_id === row.quest_instance_id &&
      resolved[0].outcome === row.choice_id &&
      events.some(
        (e) =>
          e.payload.type === 'quest_resolved' &&
          e.payload.instance_id === row.quest_instance_id &&
          same(e.payload.quest, source.quest) &&
          e.payload.outcome === row.choice_id,
      )
    );
  }
  const q = questOf(s.world, actor, source.quest);
  const transitions = ops.filter((o) => o.op === 'quest.transition' && o.to === 'resolved');
  const resolved = events.filter((e) => e.payload.type === 'quest_resolved');
  return (
    !!q &&
    q[1].state === 'resolved' &&
    q[1].outcome === row.choice_id &&
    transitions.length === 1 &&
    transitions[0].op === 'quest.transition' &&
    transitions[0].instance_id === q[0] &&
    transitions[0].outcome === row.choice_id &&
    resolved.length === 1 &&
    resolved[0].actor_id === actor &&
    same(resolved[0].payload, {
      type: 'quest_resolved',
      quest: source.quest,
      instance_id: q[0],
      outcome: row.choice_id,
    })
  );
}

// size: allow 42, exact authored transition binds original identity and receipt effect
function escortEvidence(
  s: Story,
  command: Command,
  row: ChoiceRow,
  option: DialogueChoice,
  ops: readonly DeltaOp[],
) {
  const effect = option.escort;
  if (!effect) return true;
  const escort = s.world.state.escorts?.[row.actor_id];
  const quest = questOf(s.world, row.actor_id, effect.quest);
  if (
    !escort ||
    !quest ||
    command.payload.type !== 'choose' ||
    escort.actor_id !== row.actor_id ||
    escort.body_id !== bodyOf(s.world, row.actor_id) ||
    escort.npc_id !== row.roles.find((r) => r.role === effect.npc)?.entity_id ||
    escort.quest_instance_id !== quest[0]
  )
    return false;
  const start = effect.transition === 'start';
  if (
    start &&
    (escort.continuation_id !== command.payload.continuation_id ||
      escort.choice_id !== command.payload.choice_id)
  )
    return false;
  const transitions = ops.filter((o) => o.op === 'escort.transition');
  return (
    transitions.length === 1 &&
    same(transitions[0], {
      op: 'escort.transition',
      writer_group: 0,
      actor_id: row.actor_id,
      expected: start
        ? null
        : { ...escort, status: effect.transition === 'rejoin' ? 'separated' : 'following' },
      value: { ...escort, status: effect.transition === 'complete' ? 'completed' : 'following' },
    })
  );
}
function transferEvidence(
  s: Story,
  row: ChoiceRow,
  option: DialogueChoice,
  ops: readonly DeltaOp[],
  events: readonly DomainEvent[],
) {
  const transfer = option.receive ?? option.hand_over;
  if (!transfer) return true;
  const body = bodyOf(s.world, row.actor_id);
  const bound = (role: string) => row.roles.find((r) => r.role === role)?.entity_id;
  const item = bound(transfer.item);
  const from = option.receive ? bound(option.receive.from) : body;
  const to = option.receive ? body : bound(option.hand_over!.to);
  const transfers = ops.filter((o) => o.op === 'entity.transfer');
  const acquired = events.filter((e) => e.payload.type === 'item_acquired');
  return (
    transfers.length === 1 &&
    same(transfers[0], {
      op: 'entity.transfer',
      writer_group: 0,
      entity_id: item,
      source_id: from,
      destination_id: to,
    }) &&
    acquired.length === 1 &&
    acquired[0].actor_id === row.actor_id &&
    same(acquired[0].payload, { type: 'item_acquired', item_id: item, holder_id: to })
  );
}
function assignmentEvidence(
  s: Story,
  row: ChoiceRow,
  option: DialogueChoice,
  ops: readonly DeltaOp[],
  events: readonly DomainEvent[],
) {
  for (const step of option.sequence ?? []) {
    if (step.op !== 'fact.assign') continue;
    const matching = ops.filter((o) => o.op === 'fact.assign' && same(o.fact, step.fact));
    const op = matching[0];
    if (
      matching.length !== 1 ||
      op.op !== 'fact.assign' ||
      !same(op.value, step.value) ||
      !same(op.scope, scopeOf(s.world, row.actor_id, step.fact))
    )
      return false;
    const changed = events.filter(
      (e) => e.payload.type === 'fact_changed' && same(e.payload.fact, step.fact),
    );
    if (same(op.expected, op.value)) {
      if (changed.length) return false;
    } else if (
      changed.length !== 1 ||
      changed[0].actor_id !== row.actor_id ||
      !same(changed[0].scope, op.scope) ||
      !same(changed[0].payload, {
        type: 'fact_changed',
        fact: step.fact,
        old: op.expected,
        new: step.value,
      })
    )
      return false;
  }
  return true;
}

// Legacy terminal rewards retain their routing; recover the new authored custody path.
function transferDetail(s: Story, source?: DialogueDefinition, option?: DialogueChoice) {
  if (option?.exchange) return true;
  if (option?.receive && !source?.quest) return true;
  if (source?.quest && s.world.cartridge.quests?.[refString(source.quest)]?.deadline) return true;
  const transfer = option?.receive ?? option?.hand_over;
  const role = transfer && source?.roles[transfer.item];
  const entity = role?.role === 'item' && s.world.entities[s.world.entityIds[refString(role.item)]];
  return entity && entity.kind === 'item' && entity.give_allowed === false;
}

export function committedDialogue(world: World, db: Db, scope: string, continuation: string) {
  const receipts = db.getAllSync<{ command_id: string; command: string; response: string }>(
    `SELECT command_id,command,response FROM receipt WHERE scope=?
     AND json_extract(command,'$.payload.type')='choose'
     AND json_extract(command,'$.payload.continuation_id')=?
     AND json_extract(response,'$.kind')='accepted'
     AND json_extract(response,'$.outcome')!='riddle_wrong'`,
    scope,
    continuation,
  );
  if (receipts.length !== 1) throw new SyntaxError('malformed JSON: missing committed dialogue');
  const r = receipts[0];
  if (
    !dialogueDetail({ world } as Story, r.command_id, JSON.parse(r.command), JSON.parse(r.response))
  )
    throw new SyntaxError('malformed JSON: missing committed dialogue');
}
