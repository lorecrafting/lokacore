// The local authority's game trace (ADR-075 §4, placement as amended in R6 S2): trace.run headers,
// each followed by its trace.command entries, as canonical JSON rows in the save's trace table.
// Derived, never authority: written after the gameplay transaction, in its own, and a trace
// failure never reaches the game.
import { encode, hash } from '../../../kernel/ts/src/canonical.ts';
import type { Command, DecisionResult } from '../../../kernel/ts/src/contracts.gen.ts';
import { rollback, transaction, type Db } from './store.ts';

/** The run's ids (ADR-075 RunIds), from the host: kernel_version names the build's commit. */
export type RunIds = {
  content_hash: string;
  kernel_version: string;
  seed: readonly number[];
  run_id: string;
};
export type CommitState = 'committed' | 'failed' | 'unknown' | 'unavailable';

/**
 * Appends the entries of `command`, decided as `d` and stored (or meant to be) at revision `at`,
 * one per commit outcome in `states` (an unknown commit and its settled follow-up share one
 * ordinal, ADR-075 §4), in one transaction, under the cap (`room`). False when the write failed,
 * which is swallowed; 'capped' when the cap dropped them.
 */
export function traceCommand(
  db: Db,
  ids: RunIds,
  command: Command,
  d: DecisionResult,
  at: number,
  states: readonly CommitState[],
): boolean | 'capped' {
  let capped = false;
  try {
    const written = transaction(db, () => {
      if ((capped = !room(db, ids.run_id, states.length))) return;
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
    return written && capped ? 'capped' : written;
  } catch {
    return false;
  }
}

// ponytail: rows counted by their rowid span, O(1) per entry, which holds while rows are deleted
// only here, oldest first (no VACUUM); about 5 MB at the entry size measured in R6 S6a.
const CAP = 5000;
const runOf = (record: string) => JSON.parse(record).ids.run_id as string;
/** The trace's rows, by rowid span, and the run of its oldest row. */
function extent(db: Db) {
  const { n, first } = db.getFirstSync<{ n: number | null; first: string | null }>(
    `SELECT max(rowid) - min(rowid) + 1 AS n,
      (SELECT record FROM trace ORDER BY rowid LIMIT 1) AS first FROM trace`,
  )!;
  return { n: n ?? 0, oldest: first && runOf(first) };
}
/** True when `run_id`'s run alone fills the cap: its later entries are dropped. */
const full = (db: Db, run_id: string) => {
  const { n, oldest } = extent(db);
  return n >= CAP && oldest === run_id;
};
/**
 * Room for `rows` more of `run_id`'s under the phone cap (ADR-075 §2, amended R6 S6a): over it,
 * the oldest whole runs other than `run_id`'s are deleted; false when `run_id`'s run alone fills
 * it, so its later rows are dropped and its replayable prefix stays.
 */
function room(db: Db, run_id: string, rows: number): boolean {
  for (let e = extent(db); e.n + rows > CAP; e = extent(db)) {
    if (e.oldest === run_id) return false;
    type Head = { rowid: number; record: string };
    const heads = db.getAllSync<Head>(
      'SELECT rowid, record FROM trace WHERE ordinal = 0 ORDER BY rowid',
    );
    const next = heads.find((h) => runOf(h.record) !== e.oldest); // none: run_id's header is next
    db.runSync('DELETE FROM trace WHERE rowid < ?', next?.rowid ?? Number.MAX_SAFE_INTEGER);
  }
  return true;
}

/**
 * Brings the trace up to the store (ADR-075 §4): a fresh header for a new trace or a new game's
 * run; the committed entry of every receipted Command that has none but `skip`, in commit order,
 * under the ids of the header they were decided under; then, when `ids` differ from that header's
 * (an app or content update), a new header from the saved state. False, never a throw, unless all
 * was written.
 */
export function catchUp(db: Db, ids: RunIds, context: string, skip = ''): boolean {
  const header = (initial: object) =>
    transaction(db, () => {
      if (!room(db, ids.run_id, 1)) return; // a new kernel's header for a run alone at the cap
      const data = { world_context_id: context, initial_state: initial, fault_schedule: NONE };
      db.runSync(TRACE, 0, null, null, record('trace.run', ids, data));
    });
  try {
    // A transaction a failed ROLLBACK left open holds uncommitted rows: never read them as written.
    if (db.isInTransactionSync() && !rollback(db)) return false;
    type Head = { record: string };
    const last = db.getFirstSync<Head>(
      'SELECT record FROM trace WHERE ordinal = 0 ORDER BY rowid DESC LIMIT 1',
    );
    if (!last && !header(FRESH)) return false;
    // ponytail: receipts do not record the deciding ids, so if an updated process never wrote its
    // header, its missed entries land in the previous segment; rare, accepted in R6 S6a.
    const lastIds: RunIds = last ? JSON.parse(last.record).ids : ids;
    // A new run_id is a new game, whose receipts are the only ones left: its header comes first,
    // then they follow it (ADR-075 §4). ponytail: an imported fork (R12) is not a fresh world.
    const newRun = lastIds.run_id !== ids.run_id;
    if (newRun && !header(FRESH)) return false;
    const prior = newRun ? ids : lastIds;
    return (
      missed(db, prior, skip) && (encode(prior as never) === encode(ids as never) || header(SAVED))
    );
  } catch {
    return false;
  }
}

/**
 * Writes the committed entry of every receipted Command that has none but `skip`, in commit order,
 * under `ids`; stops at the first failure (false: a later entry never overtakes a missed one) or
 * at the cap (the rest are dropped).
 */
function missed(db: Db, ids: RunIds, skip: string): boolean {
  if (full(db, ids.run_id)) return true; // never read the receipts a capped run dropped
  type Row = { command: string; response: string; revision: number };
  const missing = db.getAllSync<Row>(
    `SELECT command, response, revision FROM receipt WHERE command != 'null' AND command_id != ?
      AND command_id NOT IN (SELECT command_id FROM trace WHERE commit_state = 'committed')
      ORDER BY rowid`,
    skip,
  );
  for (const r of missing) {
    const [command, d] = [JSON.parse(r.command), JSON.parse(r.response)];
    const written = traceCommand(db, ids, command, d, r.revision, ['committed']);
    if (written !== true) return !!written;
  }
  return true;
}

const TRACE = 'INSERT INTO trace VALUES (?, ?, ?, ?)';
const NONE = { state: 'unavailable', reason: 'not_applicable' };
const SAVED = { state: 'unavailable', reason: 'not_collected' }; // from the saved state (ADR-075)
const FRESH = { state: 'fresh' }; // from the world `context` starts with
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
