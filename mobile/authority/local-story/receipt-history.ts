// Debugging and tests replay a save's accepted receipts with the rules that produced them; a cold
// open reads only the newest (save.md, What reopen proves).
import type { Command, DecisionResult } from '../../../kernel/ts/src/contracts.gen.ts';
import { commandId } from '../../../kernel/ts/src/foundation/id_source.ts';
import { same } from '../../../kernel/ts/src/foundation/compose.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import { step, stepDev, stepElapsed } from '../../../kernel/ts/src/runtime/world.ts';
import type { World } from '../../../kernel/ts/src/runtime/decision.ts';
import type { Db, Meta } from './store.ts';

type Row = {
  invocation_id: string;
  command_id: string;
  actor_id: string;
  command: string;
  response: string;
  revision: number;
};
const invalid = (): never => {
  throw new SyntaxError('malformed JSON: inconsistent accepted history');
};

/** An elapsed decision whose only change is the clock: all a coalesced receipt may hold. */
export const onlyClock = (d: DecisionResult): d is Extract<DecisionResult, { kind: 'accepted' }> =>
  d.kind === 'accepted' &&
  d.outcome === 'elapsed' &&
  d.delta.ops.length === 1 &&
  d.delta.ops[0].op === 'time.advance' &&
  !d.events.length &&
  !d.effects.length &&
  !d.narration?.length;

export function receiptHistory(fresh: World, saved: World, db: Db, meta: Meta, revision: number) {
  if (!Number.isSafeInteger(revision) || revision < 0) invalid();
  let world = { ...fresh, state: { ...fresh.state, rng: meta.seed as World['state']['rng'] } },
    previous = 0;
  for (const row of db.getAllSync<Row>(
    `SELECT invocation_id,command_id,actor_id,command,response,revision FROM receipt WHERE scope=? AND json_extract(response,'$.kind')='accepted' ORDER BY revision`,
    `story/${meta.lineage_id}/${saved.character}`,
  )) {
    if (row.revision <= previous || row.revision > revision) invalid();
    const { command, decision } = acceptedReceipt(row, saved, meta);
    if (row.revision !== previous + 1 && !onlyClock(decision)) invalid(); // coalesced ticks' gap
    const replayed =
      command.payload.type === 'elapsed'
        ? stepElapsed(world, command, row.revision)
        : command.payload.type.startsWith('dev_')
          ? stepDev(world, command, row.revision)
          : step(world, command, row.revision);
    if (!same(replayed.decision, decision) || replayed.decision.kind !== 'accepted') invalid();
    world = replayed.world;
    previous = row.revision;
  }
  if (previous !== revision || !same(world.state, saved.state)) invalid();
}

/** Loaders read ops of every accepted receipt without a schema pass, which would slow the open. */
export function readableOps(ops: unknown) {
  return Array.isArray(ops) && ops.every((o) => typeof o?.op === 'string');
}

/** The head agrees with the newest receipt: what a cold open keeps of a replay, at the cost of one row.
 * A response that is no decision refuses here: its next reader would trip on it as if on a bug of ours. */
export function newestReceipt(world: World, db: Db, meta: Meta, revision: number) {
  const scope = `story/${meta.lineage_id}/${world.character}`;
  const newest = db.getFirstSync<{ revision: number | null }>(
    'SELECT MAX(revision) AS revision FROM receipt WHERE scope=?',
    scope,
  );
  if ((newest?.revision ?? 0) !== revision) invalid();
  const row = db.getFirstSync<Row>(
    `SELECT invocation_id,command_id,actor_id,command,response,revision FROM receipt WHERE scope=? AND json_extract(response,'$.kind')='accepted' ORDER BY revision DESC LIMIT 1`,
    scope,
  );
  if (!row) return;
  boundCommand(row, world, meta);
  const decision: DecisionResult = JSON.parse(row.response);
  if (validate('DecisionResult', decision).length) invalid();
  if (decision.kind !== 'accepted') return;
  const times = [
    ...decision.events.map((e) => e.logical_time),
    ...decision.delta.ops.flatMap((o) => (o.op === 'time.advance' ? [o.to] : [])),
  ];
  if (times.some((t) => t > world.state.clock)) invalid();
}

function boundCommand(row: Row, world: World, meta: Meta) {
  const command: Command = JSON.parse(row.command);
  if (
    validate('Command', command).length ||
    command.id !== row.command_id ||
    command.world_context_id !== world.context ||
    row.actor_id !== world.character ||
    !('actor_id' in command.payload) ||
    command.payload.actor_id !== world.character ||
    (command.payload.type === 'elapsed' && command.payload.run_id !== meta.run_id) ||
    (command.payload.type !== 'elapsed' &&
      (validate('InvocationId', row.invocation_id).length ||
        command.id !== commandId(`story/${meta.lineage_id}/${world.character}`, row.invocation_id)))
  )
    invalid();
  return command;
}

function acceptedReceipt(row: Row, world: World, meta: Meta) {
  const command = boundCommand(row, world, meta),
    decision: DecisionResult = JSON.parse(row.response);
  if (validate('DecisionResult', decision).length) invalid();
  return { command, decision };
}
