// The local authority's game trace (ADR-075 §4): one trace.run header, then trace.command
// entries, as canonical JSON rows in the save's trace table. Derived, never authority: written
// after the gameplay transaction, in its own, so a trace failure never changes the game.
import { encode, hash } from '../../../kernel/ts/src/canonical.ts';
import type { Command, DecisionResult } from '../../../kernel/ts/src/contracts.gen.ts';
import { transaction, type Db } from './store.ts';

/** The run's ids (ADR-075 RunIds), from the host: kernel_version names the build's commit. */
export type RunIds = {
  content_hash: string;
  kernel_version: string;
  seed: readonly number[];
  run_id: string;
};
export type CommitState = 'committed' | 'failed' | 'unknown' | 'unavailable';

// ponytail: the trace grows with the save; the phone cap ADR-075 leaves to R6 is not set yet.
/**
 * Appends the entry of `command`, decided as `d` and stored (or meant to be) at revision `at`,
 * with its commit outcome, at `ordinal` (default the next; the follow-up of an unknown commit
 * repeats it). Returns the ordinal, or undefined when the write failed: that is swallowed, and
 * `recover` rewrites a committed entry it missed.
 */
export function traceCommand(
  db: Db,
  ids: RunIds,
  command: Command,
  d: DecisionResult,
  at: number,
  state: CommitState,
  ordinal?: number,
): number | undefined {
  const record = (event: string, ids: object, data: object) =>
    encode({ format: 'loka-obs-v1', event, store: 'game_trace', ids, data } as never);
  try {
    const written = transaction(db, () => {
      // The last row holds the highest ordinal (a follow-up repeats it); rowid keeps this O(1).
      const last = db.getFirstSync<{ n: number }>(
        'SELECT ordinal AS n FROM trace ORDER BY rowid DESC LIMIT 1',
      )?.n;
      if (last === undefined) {
        const header = {
          world_context_id: command.world_context_id,
          initial_state: { state: 'fresh' },
          fault_schedule: { state: 'unavailable', reason: 'not_applicable' },
        };
        db.runSync(TRACE, 0, null, null, record('trace.run', ids, header));
      }
      ordinal ??= (last ?? 0) + 1;
      const revision = d.kind === 'accepted' ? at - 1 : at; // the one it was decided against
      const data = { ordinal, command, decision: traced(d), commit: outcome(d, at, state) };
      const entry = record('trace.command', { ...ids, command_id: command.id, revision }, data);
      db.runSync(TRACE, ordinal, command.id, state, entry);
    });
    if (written) return ordinal;
    db.execSync('ROLLBACK'); // its COMMIT failed: leave no transaction open
  } catch {}
  return undefined;
}

/** Appends the committed entry of every receipted Command that has none, in commit order. */
export function recover(db: Db, ids: RunIds): void {
  type Row = { command: string; response: string; revision: number };
  const missing = db.getAllSync<Row>(
    `SELECT command, response, revision FROM receipt WHERE command != 'null' AND command_id NOT IN
      (SELECT command_id FROM trace WHERE commit_state = 'committed') ORDER BY rowid`,
  );
  for (const r of missing)
    traceCommand(db, ids, JSON.parse(r.command), JSON.parse(r.response), r.revision, 'committed');
}

const TRACE = 'INSERT INTO trace VALUES (?, ?, ?, ?)';

/** The decision as a TraceDecision: accepted compacted to its outcome, digests and RNG. */
const traced = (d: DecisionResult) =>
  d.kind === 'accepted'
    ? {
        kind: d.kind,
        outcome: d.outcome,
        delta_digest: hash(d.delta as never),
        rng: { state: 'unavailable', reason: 'not_collected' },
        rng_state: d.rng,
      }
    : d;

/** The CommitOutcome of `state`; committed at revision `at` with the decision's events. */
function outcome(d: DecisionResult, at: number, state: CommitState) {
  const events = d.kind === 'accepted' ? d.events : [];
  return {
    committed: {
      state,
      revision: at,
      events: events.map((event) => ({ committed_revision: at, event })),
      effect_ids: [],
    },
    failed: { state, cause: 'storage_error' },
    unknown: { state, cause: 'no_outcome' },
    unavailable: { state, reason: 'not_applicable' },
  }[state];
}
