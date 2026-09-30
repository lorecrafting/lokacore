// The local Story authority (07 §8; 03 §§14-15; ADR-072): the world in memory, one SQLite
// save, and 03 §14's admission order. invoke is synchronous on one connection, so commands run
// one at a time, as WorldInstance serializes them online (07 §8).
import type { Json } from '../../../kernel/ts/src/canonical.ts';
import type { Command, DecisionResult, ErrorCode } from '../../../kernel/ts/src/contracts.gen.ts';
import type { World } from '../../../kernel/ts/src/decision.ts';
import { identify, INTENT_DIGEST_VERSION, resolve } from '../../../kernel/ts/src/invocation.ts';
import { step } from '../../../kernel/ts/src/world.ts';
import { commit, load, receipt, reconcile, type Db, type Receipt } from './store.ts';
import { catchUp, traceCommand, type CommitState, type RunIds } from './trace.ts';

/** A committed outcome, new or replayed (03 §14): the decision and the revision it left. */
export type Saved = { kind: 'saved'; replay: boolean; revision: number; decision: Json };

export type Reply =
  | Exclude<ReturnType<typeof identify>, { kind: 'identified' }>
  | { kind: 'conflict' }
  | { kind: 'fault'; code: ErrorCode }
  | { kind: 'pending' } // COMMIT outcome unknown: retry the same invocation later (03 §§14-15)
  | Saved;

/**
 * The story saved in `db` (or `fresh`, saved at revision 0) for the lineage/character scope
 * `scope`, trusted from the host; its actor is the world's character. `invoke` takes one
 * ActionInvocation: malformed or another actor's gets no receipt; a known invocation replays its
 * receipt (altered intent is a conflict) before anything is resolved against the current world;
 * a NEW one is resolved, decided once and committed before it is adopted. A fault discards its
 * proposal and gets no receipt (ADR-075 §4; 04 §5.2 step 7). A failed commit throws, with memory
 * and storage unchanged. A COMMIT whose outcome is unknown fences every call, answered `pending`,
 * until the store settles it (03 §15). Each command's game-trace entry follows its commit.
 */
export function openStory(db: Db, fresh: World, scope: string, ids: RunIds) {
  const s: Story = { db, fresh, scope, ids, ...load(db, fresh), behind: false };
  s.behind = !catchUp(db, ids, fresh.context);
  // world() is not fenced: while `pending` it is the prior revision, which the UI shows as pending.
  return { world: () => s.world, invoke: (value: unknown) => invoke(s, value) };
}

type Trace = (at: number, ...states: CommitState[]) => void;
type Story = {
  readonly db: Db;
  readonly fresh: World;
  readonly scope: string;
  readonly ids: RunIds;
  world: World;
  revision: number;
  behind: boolean; // the trace misses a committed entry or its header; catch up before the next
  // The attempt whose COMMIT outcome is unknown: no decision runs until it is settled.
  fence?: { invocation_id: string; trace: Trace; at: number } | undefined;
};

function invoke(s: Story, value: unknown): Reply {
  if (s.fence)
    try {
      settle(s);
    } catch {
      return { kind: 'pending' };
    }
  const id = identify(s.scope, s.world.character, value);
  if (id.kind !== 'identified') return id;
  const { invocation: i, command_id, intent_digest } = id;
  const old = receipt(s.db, s.scope, i.invocation_id);
  // ponytail: one digest version; a receipt of another fails closed until a second exists.
  const same = old?.intent_digest_version === INTENT_DIGEST_VERSION;
  if (old) {
    if (!same || old.intent_digest !== intent_digest) return { kind: 'conflict' };
    return { kind: 'saved', replay: true, revision: old.revision, decision: old.response };
  }
  const command = resolve(s.world, id);
  const next = 'kind' in command ? { world: s.world, decision: command } : step(s.world, command);
  const d = next.decision;
  // A rejection before a Command existed has no trace entry: TraceEntry needs the Command.
  const trace: Trace = (at, ...states) => {
    if (!('kind' in command)) traceAfter(s, command, d, at, states);
  };
  if (d.kind === 'fault') {
    trace(s.revision, 'unavailable');
    return { kind: 'fault', code: d.code };
  }
  // ponytail: no rule emits effects yet; the outbox (03 §16) comes with the first that does.
  if (d.kind === 'accepted' && d.effects.length) throw new Error('effect outbox not built');
  const r = { scope: s.scope, invocation_id: i.invocation_id, command_id, actor_id: i.actor_id };
  return save(s, next, trace, {
    ...r,
    intent_digest_version: INTENT_DIGEST_VERSION,
    intent_digest,
    command: 'kind' in command ? null : (command as never),
    revision: d.kind === 'accepted' ? s.revision + 1 : s.revision,
    response: d as never,
  });
}

/** Commits a NEW attempt's decision, then adopts it; the reply never claims an unknown save. */
function save(
  s: Story,
  next: { world: World; decision: DecisionResult },
  trace: Trace,
  r: Receipt,
): Reply {
  const at = r.revision;
  let committed: boolean;
  try {
    committed = commit(s.db, next.world, next.decision, r);
  } catch (e) {
    trace(at, 'failed');
    throw e;
  }
  if (committed) {
    [s.world, s.revision] = [next.world, at];
    trace(at, 'committed');
    return { kind: 'saved', replay: false, revision: at, decision: r.response };
  }
  s.fence = { invocation_id: r.invocation_id, trace, at };
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
function settle(s: Story): Receipt | undefined {
  const f = s.fence!;
  const r = reconcile(s.db, s.scope, f.invocation_id); // throws while still unknown
  if (r) Object.assign(s, load(s.db, s.fresh));
  s.fence = undefined;
  // Traced once settled, with its follow-up; a process that dies while fenced traces neither.
  f.trace(f.at, 'unknown', r ? 'committed' : 'failed');
  return r;
}

/**
 * Traces a command after its commit. A trace that is behind catches up first (all but this
 * command), or this entry is skipped, so ordinals follow the commits (ADR-075 §4: the Commands by
 * ordinal replay); a skipped committed entry is caught up later from its receipt.
 */
function traceAfter(
  s: Story,
  command: Command,
  d: DecisionResult,
  at: number,
  states: CommitState[],
) {
  if (s.behind && (s.behind = !catchUp(s.db, s.ids, s.fresh.context, command.id))) return;
  const written = traceCommand(s.db, s.ids, command, d, at, states);
  if (!written && states.includes('committed')) s.behind = true;
}
