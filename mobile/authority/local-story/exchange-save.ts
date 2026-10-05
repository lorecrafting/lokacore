// Existing receipts prove repeated exchanges and custody-independent fuel at their original revisions.
import type { Command, DecisionResult } from '../../../kernel/ts/src/contracts.gen.ts';
import { same } from '../../../kernel/ts/src/foundation/compose.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import { step, stepElapsed } from '../../../kernel/ts/src/runtime/world.ts';
import type { World } from '../../../kernel/ts/src/runtime/decision.ts';
import type { Db, Meta } from './store.ts';

// ponytail: cold recovery replays existing accepted receipts linearly; index only if measured reopen needs it.
/** Reuse the kernel's exact admission/lowering at each original revision, including unrelated custody/faction changes. */
// size: allow 50, revision-correct replay validates conserved custody and repeated occurrences together
export function exchangeSave(
  fresh: World,
  saved: World,
  db: Db,
  meta: Meta,
  revision: number,
): boolean {
  if (
    !Object.values(saved.cartridge.quests ?? {}).some((q) => q.exchange) &&
    !Object.keys(fresh.fuelSpecs).length
  )
    return false;
  const invalid = (): never => {
    throw new SyntaxError('malformed JSON: inconsistent exchange history');
  };
  type Row = {
    command_id: string;
    actor_id: string;
    command: string;
    response: string;
    revision: number;
  };
  let world = { ...fresh, state: { ...fresh.state, rng: meta.seed as World['state']['rng'] } },
    previous = 0;
  for (const row of db.getAllSync<Row>(
    `SELECT command_id,actor_id,command,response,revision FROM receipt WHERE scope=? AND json_extract(response,'$.kind')='accepted' ORDER BY revision`,
    `story/${meta.lineage_id}/${saved.character}`,
  )) {
    const command: Command = JSON.parse(row.command),
      decision: DecisionResult = JSON.parse(row.response);
    if (
      row.revision !== previous + 1 ||
      row.revision > revision ||
      validate('Command', command).length ||
      validate('DecisionResult', decision).length ||
      command.id !== row.command_id ||
      command.world_context_id !== saved.context ||
      row.actor_id !== saved.character ||
      ('actor_id' in command.payload && command.payload.actor_id !== saved.character)
    )
      invalid();
    if (command.payload.type === 'elapsed' && command.payload.run_id !== meta.run_id) invalid();
    const replayed =
      command.payload.type === 'elapsed'
        ? stepElapsed(world, command, row.revision)
        : step(world, command, row.revision);
    if (!same(replayed.decision, decision) || replayed.decision.kind !== 'accepted') invalid();
    world = replayed.world;
    previous = row.revision;
  }
  if (previous !== revision || !same(world.state, saved.state)) invalid();
  return true;
}
