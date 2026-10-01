// The local authority's game trace (ADR-075 §4, placement as amended in R6 S2): trace.run headers,
// each followed by its trace.command entries, as canonical JSON rows in the save's trace table.
// Derived, never authority: written after the gameplay transaction, in its own, and a trace
// failure never reaches the game.
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

// ponytail: the trace grows with the save; R6 S6 sets the phone cap (ROADMAP).
/**
 * Appends the entries of `command`, decided as `d` and stored (or meant to be) at revision `at`,
 * one per commit outcome in `states` (an unknown commit and its settled follow-up share one
 * ordinal, ADR-075 §4), in one transaction. False when the write failed, which is swallowed.
 */
export function traceCommand(
  db: Db,
  ids: RunIds,
  command: Command,
  d: DecisionResult,
  at: number,
  states: readonly CommitState[],
): boolean {
  try {
    return transaction(db, () => {
      // The last row, an entry or its header (0), holds the run's highest ordinal; rowid: O(1).
      const last = db.getFirstSync<{ n: number }>(
        'SELECT ordinal AS n FROM trace ORDER BY rowid DESC LIMIT 1',
      )!.n;
      const ordinal = last + 1;
      const revision = d.kind === 'accepted' ? at - 1 : at; // the one it was decided against
      for (const state of states) {
        const data = { ordinal, command, decision: traced(d), commit: outcome(d, at, state) };
        const entry = record('trace.command', { ...ids, command_id: command.id, revision }, data);
        db.runSync(TRACE, ordinal, command.id, state, entry);
      }
    });
  } catch {
    return false;
  }
}

/**
 * Brings the trace up to the store (ADR-075 §4): a header for a new trace; the committed entry of
 * every receipted Command that has none but `skip`, in commit order, under the ids of the header
 * they were decided under; then, when `ids` differ from that header's (an app or content update),
 * a new run header starting from the saved state. False, never a throw, unless all was written.
 */
export function catchUp(db: Db, ids: RunIds, context: string, skip = ''): boolean {
  const header = (initial: object) =>
    transaction(db, () => {
      const data = { world_context_id: context, initial_state: initial, fault_schedule: NONE };
      db.runSync(TRACE, 0, null, null, record('trace.run', ids, data));
    });
  try {
    type Head = { record: string };
    const last = db.getFirstSync<Head>(
      'SELECT record FROM trace WHERE ordinal = 0 ORDER BY rowid DESC LIMIT 1',
    );
    if (!last && !header({ state: 'fresh' })) return false;
    // ponytail: receipts do not record the deciding ids, so if an updated process never wrote its
    // header, its missed entries land in the previous segment; rare, R6 S6 owns it (ROADMAP).
    const prior: RunIds = last ? JSON.parse(last.record).ids : ids;
    type Row = { command: string; response: string; revision: number };
    const missing = db.getAllSync<Row>(
      `SELECT command, response, revision FROM receipt WHERE command != 'null' AND command_id != ?
        AND command_id NOT IN (SELECT command_id FROM trace WHERE commit_state = 'committed')
        ORDER BY rowid`,
      skip,
    );
    // Stops at the first failure: a later entry never overtakes a missed one.
    for (const r of missing)
      if (
        !traceCommand(db, prior, JSON.parse(r.command), JSON.parse(r.response), r.revision, [
          'committed',
        ])
      )
        return false;
    return encode(prior as never) === encode(ids as never) || header(SAVED);
  } catch {
    return false;
  }
}

const TRACE = 'INSERT INTO trace VALUES (?, ?, ?, ?)';
const NONE = { state: 'unavailable', reason: 'not_applicable' };
const SAVED = { state: 'unavailable', reason: 'not_collected' }; // from the saved state (ADR-075)
const record = (event: string, ids: object, data: object) =>
  encode({ format: 'loka-obs-v1', event, store: 'game_trace', ids, data } as never);

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
