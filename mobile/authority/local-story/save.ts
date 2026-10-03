// The local Story authority's in-memory story and the save of one NEW attempt (03 §§14-15):
// commit, then adopt, or fence an unknown COMMIT until the store settles it.
import type { DecisionResult, NarrationRecord } from '../../../kernel/ts/src/contracts.gen.ts';
import type { World } from '../../../kernel/ts/src/decision.ts';
import type { Host, Release, Reply } from './authority.ts';
import { commit, load, receipt, reconcile } from './store.ts';
import type { Captured, Db, Meta, Receipt } from './store.ts';
import type { CommitState, RunIds } from './trace.ts';

export type Trace = (at: number, ...states: CommitState[]) => void;
export type Story = {
  readonly db: Db;
  readonly releases: readonly [Release, ...Release[]];
  fresh: World; // the open save's release
  readonly host: Host;
  world: World;
  revision: number;
  meta: Meta; // undefined only on a corrupt save, until its new game is adopted
  // The fence of a new game whose COMMIT outcome is unknown, and its run.
  game?: { fence: () => undefined; run_id: string } | undefined;
  behind: boolean; // the trace misses a committed entry or its header; catch up before the next
  // Settles the attempt whose COMMIT outcome is unknown, throwing while it still is; no decision
  // runs until it has.
  fence?: (() => Receipt | undefined) | undefined;
};

/** Commits a NEW attempt's decision, then adopts it; the reply never claims an unknown save. */
export function save(
  s: Story,
  next: { world: World; decision: DecisionResult },
  trace: Trace,
  reports: Captured[],
  r: Receipt,
): Reply {
  const at = r.revision;
  let committed: boolean;
  try {
    committed = commit(s.db, next.world, next.decision, r, reports);
  } catch (e) {
    trace(at, 'failed');
    throw e;
  }
  if (committed) {
    [s.world, s.revision] = [next.world, at];
    trace(at, 'committed');
    return { kind: 'saved', replay: false, revision: at, decision: r.response };
  }
  s.fence = () => {
    const got = reconcile(s.db, () => receipt(s.db, r.scope, r.invocation_id));
    if (got) adopt(s);
    // Traced once settled, with its follow-up; a process that dies while fenced traces neither.
    trace(at, 'unknown', got ? 'committed' : 'failed');
    return got;
  };
  let settled: Receipt | undefined;
  try {
    settled = settle(s);
  } catch {
    return { kind: 'pending' };
  }
  if (!settled) throw new Error('COMMIT failed; nothing was saved');
  return { kind: 'saved', replay: false, revision: settled.revision, decision: settled.response };
}

/** The fenced attempt's receipt once settled from the store, undefined if not committed. */
export function settle(s: Story): Receipt | undefined {
  const r = s.fence!(); // throws while still unknown
  s.fence = undefined;
  return r;
}

/** Memory takes the saved head, identity and world, after a commit it did not write itself. */
export function adopt(s: Story) {
  const saved = load(s.db, s.fresh, () => {
    throw new Error('no save');
  });
  if (!saved) throw new Error('save corrupt');
  Object.assign(s, saved);
}

/**
 * The latest committed narration in this story's receipts, shown again on reopen after a crash
 * before display (06 §43): read from storage, never memory; no acknowledgement is stored. None
 * while a transaction is open (an unknown COMMIT whose ROLLBACK failed).
 */
export function narration(s: Story): NarrationRecord | undefined {
  if (s.db.isInTransactionSync()) return undefined; // its rows may be uncommitted (03 §15)
  const r = s.db.getFirstSync<{ command_id: string; lines: string }>(
    `SELECT command_id, response -> '$.narration' AS lines FROM receipt WHERE scope = ?
     AND json_array_length(response, '$.narration') > 0 ORDER BY revision DESC LIMIT 1`,
    scope(s),
  );
  return r
    ? ({ command_id: r.command_id, lines: JSON.parse(r.lines) } as NarrationRecord)
    : undefined;
}

// The run is in it, so an old run's token is never current again after newGame.
export const token = (s: Story) => `view:${s.meta.run_id}:${s.revision}`;
export const stale = (s: Story, view?: string) => !!view?.startsWith('view:') && view !== token(s);
export const scope = (s: Story) => `story/${s.meta.lineage_id}/${s.world.character}`;
export const ids = (s: Story): RunIds => ({
  content_hash: s.meta.pin.content_hash,
  kernel_version: s.host.kernel_version,
  seed: s.meta.seed as number[],
  run_id: s.meta.run_id,
});

/** A budget fault's evaluation.budget_exceeded (04 §5.4): the run's ids, its command and revision. */
export const budget = (s: Story, command_id: string, limit: string) => ({
  format: 'loka-obs-v1',
  event: 'evaluation.budget_exceeded',
  store: 'diagnostics',
  ids: { ...ids(s), command_id, revision: s.revision },
  data: { limit },
});
