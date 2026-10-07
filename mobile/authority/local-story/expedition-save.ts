import type { DeltaOp, ExpeditionAttempt } from '../../../kernel/ts/src/contracts.gen.ts';
import { key, same } from '../../../kernel/ts/src/foundation/compose.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import { refString, type World } from '../../../kernel/ts/src/runtime/decision.ts';
import { value } from '../../../kernel/ts/src/mechanics/fact.ts';
import { definition } from '../../../kernel/ts/src/mechanics/expedition/shared.ts';
import {
  invalid,
  checked,
  cause,
  exact,
  userAction,
  entered,
  completion,
  type Receipt,
} from './expedition-receipt.ts';
import type { Db, Meta } from './store.ts';

type Run = {
  attempt: ExpeditionAttempt | null;
  faction: unknown;
  completions: number;
  last: number;
};

/** Cold-open proof from accepted ordered transfers and the original Start command. */
export function expeditionSave(world: World, db: Db, meta: Meta, head: number) {
  if (!Object.values(world.cartridge.quests ?? {}).some((q) => q.expedition)) return;
  const { spec } = definition(world);
  if (Object.keys(world.state.expeditions ?? {}).length > 1) invalid();
  const run: Run = {
    attempt: null,
    faction: world.factDefaults[key(spec.faction)],
    completions: 0,
    last: 0,
  };
  const scope = `story/${meta.lineage_id}/${world.character}`;
  // ponytail: a cold reopen scans the private run's receipts; index per quest if runs grow large.
  for (const r of db.getAllSync<Receipt>(
    'SELECT command_id,actor_id,command,response,revision FROM receipt WHERE scope=? ORDER BY revision',
    scope,
  )) {
    if (r.command !== 'null') replay(world, r, run, head);
  }
  saved(world, run);
}

function replay(world: World, r: Receipt, run: Run, head: number) {
  const { command, decision } = checked(world, r, run.last, head);
  run.last = r.revision;
  if (decision.kind !== 'accepted') return;
  const { spec } = definition(world);
  const changes = decision.delta.ops.filter((op) => op.op === 'expedition.transition');
  if (changes.length > 1) invalid();
  const changed = changes[0];
  const why = cause(world, command, decision, run.attempt);
  const needed =
    command.payload.type === 'expedition' ||
    (run.attempt?.status === 'active' && (why.died || why.outside || why.next));
  if (!!needed !== !!changed) invalid();
  const prior = run.faction;
  run.faction = faction(world, decision.delta.ops, prior);
  if (!changed) return unchanged(world, decision.delta.ops);
  exact(world, command, changed, run.attempt, why);
  if (command.payload.type === 'expedition')
    userAction(world, command.payload, decision, changed, run.attempt);
  else if (!(why.died || why.outside)) {
    if (!why.next) invalid();
    entered(world, command, decision, why);
    if (changed.value.status === 'completed') {
      if (changed.value.cursor !== spec.route.length || ++run.completions !== 1) invalid();
      completion(world, command, decision, changed.value, prior);
    }
  }
  run.attempt = changed.value;
}

function faction(world: World, ops: Parameters<typeof unchanged>[1], prior: unknown) {
  const { spec } = definition(world);
  for (const op of ops)
    if (op.op === 'fact.assign' && same(op.fact, spec.faction)) {
      if (op.expected !== prior) invalid();
      prior = op.value;
    }
  return prior;
}

function unchanged(world: World, ops: readonly DeltaOp[]) {
  const { ref, spec } = definition(world);
  if (
    ops.some((op) => op.op === 'fact.assign' && same(op.fact, spec.survived_fact)) ||
    ops.some(
      (op) =>
        op.op === 'quest.transition' && world.state.quests?.[op.instance_id]?.quest.key === ref.key,
    )
  )
    invalid();
}

function saved(world: World, run: Run) {
  const { ref, spec } = definition(world);
  const [id, row] = Object.entries(world.state.expeditions ?? {})[0] ?? [];
  const attempt = run.attempt;
  if (
    !!row !== !!attempt ||
    (row &&
      (!same(row, attempt) ||
        id !== row.quest_instance_id ||
        validate('ExpeditionAttempt', row).length))
  )
    invalid();
  const quest = attempt && world.state.quests?.[attempt.quest_instance_id];
  if (
    attempt &&
    (!quest ||
      !same(quest.quest, ref) ||
      quest.state !== (attempt.status === 'completed' ? 'resolved' : 'active') ||
      (attempt.status === 'active' &&
        !spec.footprint.some(
          (room) => world.roomIds[refString(room)] === world.state.containers[world.body],
        )))
  )
    invalid();
  if (
    value(world, world.character, spec.survived_fact) !== (run.completions === 1) ||
    value(world, world.character, spec.faction) !== run.faction
  )
    invalid();
}
