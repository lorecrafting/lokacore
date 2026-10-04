// Command delivery shared by player invocation and the narrow trusted elapsed entry (M1-A).
// Changed rows and receipts still commit through save; no timer, wall clock or new store.
import { hash } from '../../../kernel/ts/src/foundation/canonical.ts';
import { elapsedCommandId } from '../../../kernel/ts/src/foundation/id_source.ts';
import type { Command, DecisionResult } from '../../../kernel/ts/src/contracts.gen.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import { stepElapsed } from '../../../kernel/ts/src/runtime/world.ts';
import type { Reply } from './authority.ts';
import { budget, ids, save, scope, settle, type Story, type Trace } from './save.ts';
import { receipt, type Captured } from './store.ts';
import { catchUp, observe, traceCommand, type CommitState } from './trace.ts';

export type Elapsed = { expected_run_id: string; from: number; until: number };
const ELAPSED_INTENT = 'loka-elapsed-intent-v1';

/** Run guard precedes receipts; matched-run replay precedes current-clock admission. */
export function elapsed(s: Story, evidence: Elapsed): Reply {
  if (fenced(s)) return { kind: 'pending' };
  if (evidence.expected_run_id !== s.meta.run_id) return { kind: 'stale_view' };
  const payload = {
    type: 'elapsed',
    actor_id: s.world.character,
    run_id: evidence.expected_run_id,
    from: evidence.from,
    until: evidence.until,
  };
  const errors = validate('CommandPayload', payload);
  if (errors.length) return { kind: 'invalid', errors };
  const command_id = elapsedCommandId(
    s.meta.run_id,
    s.world.context,
    evidence.from,
    evidence.until,
  );
  const command = { id: command_id, world_context_id: s.world.context, payload } as Command;
  const digest = hash(command as never);
  let old: ReturnType<typeof receipt>;
  try {
    old = receipt(s.db, scope(s), command_id);
  } catch (e) {
    if (e instanceof SyntaxError) return { kind: 'conflict' };
    throw e;
  }
  if (old) {
    if (
      old.intent_digest_version !== ELAPSED_INTENT ||
      old.intent_digest !== digest ||
      validate('DecisionResult', old.response).length
    )
      return { kind: 'conflict' };
    return { kind: 'saved', replay: true, revision: old.revision, decision: old.response };
  }
  return commitElapsed(s, command, digest);
}

function commitElapsed(s: Story, command: Command, digest: string): Reply {
  const next = stepElapsed(s.world, command, s.revision + 1);
  const d = next.decision;
  const trace: Trace = (at, ...states) => traceAfter(s, command, d, at, states);
  if (d.kind === 'fault') {
    trace(s.revision, 'unavailable');
    if (next.limit) observe(s.db, budget(s, command.id, next.limit));
    return { kind: 'fault', code: d.code };
  }
  if (d.kind === 'accepted' && d.effects.length) throw new Error('effect outbox not built');
  return save(s, next, trace, reached(s, d, s.revision + 1), {
    scope: scope(s),
    invocation_id: command.id,
    command_id: command.id,
    actor_id: s.world.character,
    intent_digest_version: ELAPSED_INTENT,
    intent_digest: digest,
    command: command as never,
    revision: d.kind === 'accepted' ? s.revision + 1 : s.revision,
    response: d as never,
  });
}

/** True while a fenced attempt's outcome is still unknown; otherwise settles it first. */
export function fenced(s: Story): boolean {
  try {
    if (s.fence) settle(s);
    return false;
  } catch {
    return true;
  }
}

/**
 * The pending reports of the story points an accepted decision reaches, its story_point_reached
 * events (23 §§3-5; 03 §26), each with its id allocated once here and committed with the
 * decision, its run, lineage, release and the run's binding. A receipt replay never comes here,
 * so it adds no second report. A report that is not a StoryPointReport (a bad host id) throws
 * before anything is stored.
 */
export function reached(s: Story, d: DecisionResult, observed_revision: number): Captured[] {
  if (d.kind !== 'accepted') return [];
  const { cartridge_id, cartridge_version, content_hash } = s.meta.pin;
  const release = { cartridge_id, cartridge_version, cartridge_hash: content_hash } as never;
  return d.events.flatMap(({ payload: p }) => {
    if (p.type !== 'story_point_reached') return [];
    const { lineage_id, run_id, binding } = s.meta;
    const m = { story_point: p.story_point.key, outcome: p.outcome };
    const report = { report_id: s.host.newId(), run_id, release, observed_revision, ...m };
    if (validate('StoryPointReport', report).length) throw new Error('not a StoryPointReport');
    return [{ lineage_id, binding, report: report as never }];
  });
}

/**
 * Traces a command after its commit. A trace that is behind catches up first (all but this
 * command), or this entry is skipped, so ordinals follow the commits (ADR-075 §4: the Commands by
 * ordinal replay); a skipped committed entry is caught up later from its receipt.
 */
export function traceAfter(
  s: Story,
  command: Command,
  d: DecisionResult,
  at: number,
  states: CommitState[],
) {
  if (s.behind && (s.behind = !catchUp(s.db, ids(s), s.fresh.context, command.id))) return;
  const written = traceCommand(s.db, ids(s), command, d, at, states);
  if (!written && states.includes('committed')) s.behind = true;
}
