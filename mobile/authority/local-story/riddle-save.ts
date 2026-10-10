import type { Command, DecisionResult } from '../../../kernel/ts/src/contracts.gen.ts';
import { same } from '../../../kernel/ts/src/foundation/compose.ts';
import { id as minted } from '../../../kernel/ts/src/foundation/id_source.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import { refString, type ChoiceRow, type World } from '../../../kernel/ts/src/runtime/decision.ts';
import { questOf } from '../../../kernel/ts/src/mechanics/lookups.ts';
import { dialogueDetail } from './dialogue-receipt.ts';
import { checkRow } from './dialogue-save.ts';
import type { Db, Meta } from './store.ts';
import type { Story } from './save.ts';

type Receipt = { command_id: string; command: string; response: string; revision: number };
export function invalidRiddle(): never {
  throw new SyntaxError('malformed JSON: inconsistent bounded sitting');
}

export function riddleSave(world: World, db: Db, meta: Meta) {
  if (
    !Object.values(world.cartridge.dialogues ?? {}).some((d) => d.riddle?.wrong_limit !== undefined)
  )
    return;
  const scope = `story/${meta.lineage_id}/${world.character}`;
  for (const [id, row] of Object.entries(world.state.choices ?? {})) {
    if (!row || validate('DefinitionRef', row.source).length) invalidRiddle();
    const d = world.cartridge.dialogues?.[refString(row.source)];
    if (d?.riddle?.wrong_limit === undefined) {
      if (row.attempts !== undefined) invalidRiddle();
      continue;
    }
    checkRow(world, id, row);
    if (!d.quest || row.quest_instance_id !== questOf(world, row.actor_id, d.quest)?.[0])
      invalidRiddle();
    attempts(world, db, scope, id, row);
  }
}

function attempts(world: World, db: Db, scope: string, id: string, row: ChoiceRow) {
  const receipts = db.getAllSync<Receipt>(
    `SELECT command_id,command,response,revision FROM receipt
    WHERE scope=? AND json_extract(response,'$.kind')='accepted' AND
    (json_extract(command,'$.payload.continuation_id')=? OR EXISTS (SELECT 1 FROM
    json_each(response,'$.delta.ops') WHERE json_extract(value,'$.op')='choice.close' AND
    json_extract(value,'$.continuation_id')=?)) ORDER BY revision LIMIT ?`,
    scope,
    id,
    id,
    row.attempts!.limit + 2,
  );
  let count = 0,
    status: ChoiceRow['status'] = 'pending',
    prior = row.opened_revision;
  for (const r of receipts) {
    const command = JSON.parse(r.command) as Command,
      decision = JSON.parse(r.response) as Extract<DecisionResult, { kind: 'accepted' }>;
    const p = command.payload;
    if (
      !receiptValid(world, r, command, decision) ||
      !('actor_id' in p) ||
      p.actor_id !== row.actor_id ||
      status !== 'pending' ||
      r.revision <= prior
    )
      invalidRiddle();
    prior = r.revision;
    const next = answerEvidence(world, id, row, r, command, decision, count);
    count = next.count;
    status = next.status;
  }
  if (row.attempts!.count !== count || row.status !== status) invalidRiddle();
}

// A talk's choice.open, after the Leave of the conversation it ends, if any (dialogue@1).
const opened = (decision: Extract<DecisionResult, { kind: 'accepted' }>) =>
  decision.delta.ops.find((o) => o.op === 'choice.open');

function openEvidence(
  world: World,
  id: string,
  row: ChoiceRow,
  r: Receipt,
  command: Command,
  decision: Extract<DecisionResult, { kind: 'accepted' }>,
) {
  const p = command.payload,
    op = opened(decision);
  const d = world.cartridge.dialogues![refString(row.source)];
  if (
    !receiptValid(world, r, command, decision) ||
    p.type !== 'talk' ||
    p.actor_id !== row.actor_id ||
    p.target_id !== world.entityIds[refString(d.npc)] ||
    (p.dialogue !== undefined && !same(p.dialogue, row.source)) ||
    r.revision !== row.opened_revision ||
    minted(world.context, command.id, 0) !== id ||
    decision.outcome !== 'choice_opened' ||
    !openedEvent(world, id, row, command, decision) ||
    decision.delta.ops.some(
      (o) => o !== op && (o.op !== 'choice.close' || o.continuation_id === id),
    ) ||
    op?.op !== 'choice.open' ||
    !same(op, {
      op: 'choice.open',
      writer_group: 0,
      continuation_id: id,
      actor_id: row.actor_id,
      source: row.source,
      beat: row.beat,
      roles: row.roles,
      choice_ids: row.choice_ids,
      ...(row.quest_instance_id && { quest_instance_id: row.quest_instance_id }),
      ...(row.attempts && { attempts: { count: 0, limit: row.attempts.limit } }),
    })
  )
    invalidRiddle();
}

function answerEvidence(
  world: World,
  id: string,
  row: ChoiceRow,
  r: Receipt,
  command: Command,
  decision: Extract<DecisionResult, { kind: 'accepted' }>,
  count: number,
) {
  const p = command.payload;
  // dialogue@1: a talk to another speaker or the dream's Continue leaves the riddle first.
  if (p.type === 'talk' || p.type === 'continue') {
    if (!decision.delta.ops.some((o) => o.op === 'choice.close' && o.continuation_id === id))
      invalidRiddle();
    return { count, status: 'closed' as const };
  }
  if (p.type === 'close_choice') {
    if (
      !same(decision.delta.ops, [{ op: 'choice.close', writer_group: 0, continuation_id: id }]) ||
      decision.outcome !== 'choice_closed' ||
      decision.events.length ||
      decision.effects.length
    )
      invalidRiddle();
    return { count, status: 'closed' as const };
  } else if (p.type === 'choose') {
    if (!dialogueDetail({ world } as Story, r.command_id, command, decision)) invalidRiddle();
    if (decision.outcome === 'riddle_wrong') {
      const op = decision.delta.ops[0];
      if (op.op !== 'choice.attempt' || op.prior_count !== count) invalidRiddle();
      count++;
      return {
        count,
        status: count === row.attempts!.limit ? ('closed' as const) : ('pending' as const),
      };
    } else return { count, status: 'resolved' as const };
  } else invalidRiddle();
}

function openedEvent(
  world: World,
  id: string,
  row: ChoiceRow,
  command: Command,
  decision: Extract<DecisionResult, { kind: 'accepted' }>,
) {
  const e = decision.events[0];
  return (
    decision.events.length === 1 &&
    decision.effects.length === 0 &&
    !!e &&
    e.id === minted(world.context, command.id, 1) &&
    e.actor_id === row.actor_id &&
    e.causation_id === (command.id as string) &&
    e.correlation_id === (command.id as string) &&
    e.world_context_id === world.context &&
    same(e.scope, { kind: 'player', character_id: row.actor_id }) &&
    same(e.payload, { type: 'choice_opened', continuation_id: id })
  );
}

export function selectorSave(world: World, db: Db, meta: Meta) {
  const scope = `story/${meta.lineage_id}/${world.character}`;
  const receipts = db.getAllSync<Receipt>(
    `SELECT command_id,command,response,revision FROM receipt
    WHERE scope=? AND json_extract(command,'$.payload.type')='talk' AND
    json_extract(response,'$.kind')='accepted'`,
    scope,
  );
  for (const r of receipts) {
    const command = JSON.parse(r.command) as Command,
      decision = JSON.parse(r.response) as Extract<DecisionResult, { kind: 'accepted' }>;
    if (!receiptValid(world, r, command, decision)) invalidRiddle();
    const op = opened(decision),
      row = op?.op === 'choice.open' && world.state.choices?.[op.continuation_id];
    if (!row || op.op !== 'choice.open') invalidRiddle();
    checkRow(world, op.continuation_id, row);
    openEvidence(world, op.continuation_id, row, r, command, decision);
  }
}

function receiptValid(world: World, r: Receipt, command: Command, decision: DecisionResult) {
  return (
    !validate('Command', command).length &&
    !validate('DecisionResult', decision).length &&
    command.id === r.command_id &&
    command.world_context_id === world.context
  );
}
