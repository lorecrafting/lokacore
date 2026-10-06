// Validate saved truth with the same pure rules that produced its accepted receipts.
import type { Command, DecisionResult } from '../../../kernel/ts/src/contracts.gen.ts';
import { commandId } from '../../../kernel/ts/src/foundation/id_source.ts';
import { same } from '../../../kernel/ts/src/foundation/compose.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import { step, stepElapsed } from '../../../kernel/ts/src/runtime/world.ts';
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

// ponytail: cold recovery replays existing accepted receipts linearly; index only after measuring reopen.
export function receiptHistory(fresh: World, saved: World, db: Db, meta: Meta, revision: number) {
  if (!Number.isSafeInteger(revision) || revision < 0) invalid();
  let world = { ...fresh, state: { ...fresh.state, rng: meta.seed as World['state']['rng'] } },
    previous = 0;
  for (const row of db.getAllSync<Row>(
    `SELECT invocation_id,command_id,actor_id,command,response,revision FROM receipt WHERE scope=? AND json_extract(response,'$.kind')='accepted' ORDER BY revision`,
    `story/${meta.lineage_id}/${saved.character}`,
  )) {
    if (row.revision !== previous + 1 || row.revision > revision) invalid();
    const { command, decision } = acceptedReceipt(row, saved, meta);
    const replayed =
      command.payload.type === 'elapsed'
        ? stepElapsed(world, command, row.revision)
        : step(world, command, row.revision);
    if (!same(replayed.decision, decision) || replayed.decision.kind !== 'accepted') invalid();
    world = replayed.world;
    previous = row.revision;
  }
  if (previous !== revision || !same(world.state, saved.state)) invalid();
}

function acceptedReceipt(row: Row, world: World, meta: Meta) {
  const command: Command = JSON.parse(row.command),
    decision: DecisionResult = JSON.parse(row.response);
  if (
    validate('Command', command).length ||
    validate('DecisionResult', decision).length ||
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
  return { command, decision };
}
