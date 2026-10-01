// The local Story authority (07 §§8-9; 03 §§14-15; ADR-072; 10 §§31-32): the world in memory,
// one SQLite save, and 03 §14's admission order. invoke is synchronous on one connection, so
// commands run one at a time, as WorldInstance serializes them online (07 §8).
import type { Json } from '../../../kernel/ts/src/canonical.ts';
import type { Command, DecisionResult, ErrorCode } from '../../../kernel/ts/src/contracts.gen.ts';
import type { World } from '../../../kernel/ts/src/decision.ts';
import { identify, INTENT_DIGEST_VERSION, resolve } from '../../../kernel/ts/src/invocation.ts';
import { step } from '../../../kernel/ts/src/world.ts';
import { bytesOf, occupied, restoreFrom, verifying, writeBookmark, type Kind } from './saves.ts';
import { commit, load, receipt, reconcile, type Db, type Meta, type Receipt } from './store.ts';
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
 * What the host supplies: the bundled cartridge's content hash, the build's kernel version
 * (ADR-075 RunIds) and a fresh random UUID per call, for a new save's and each fork's ids.
 */
export type Host = { content_hash: string; kernel_version: string; newId: () => string };
const SAVE_FORMAT = 'loka-save-v1';

/**
 * The story saved in `db`, or `fresh` saved at revision 0 as a new save that pins `fresh`'s
 * release. Its idempotency scope is the save's lineage and the world's character; its actor is
 * the character. A save whose pinned content hash is not the host's is not opened
 * (`pinned_release_missing`), nor is one that does not parse (`save_corrupt`, OFF-07), and the
 * head is left as it was. `invoke` takes one ActionInvocation: malformed or another actor's gets
 * no receipt; a known invocation replays its receipt (altered intent is a conflict) before
 * anything is resolved against the current world; a NEW one is resolved, decided once and
 * committed before it is adopted. A fault discards its proposal and gets no receipt (ADR-075 §4;
 * 04 §5.2 step 7). A failed commit throws, with memory and storage unchanged. A COMMIT whose
 * outcome is unknown fences every call, answered `pending`, until the store settles it (03 §15).
 * Each command's game-trace entry follows its commit. `bookmark` and `restore`: below.
 */
export function openStory(db: Db, fresh: World, host: Host) {
  const loaded = load(db, fresh, () => first(fresh, host));
  if (!loaded) return corrupt(db, fresh, host);
  const { pin } = loaded.meta;
  if (pin.content_hash !== host.content_hash)
    return { kind: 'pinned_release_missing' as const, pinned: pin, offered: host.content_hash };
  const s: Story = { db, fresh, host, ...loaded, behind: false };
  s.behind = !catchUp(db, ids(s), fresh.context);
  // world() is not fenced: while `pending` it is the prior revision, which the UI shows as pending.
  return {
    kind: 'open' as const,
    world: () => s.world,
    invoke: (value: unknown) => invoke(s, value),
    bookmark: (slot: number, label: unknown, replace = false) => bookmark(s, slot, label, replace),
    restore: (kind: Kind, slot: number) => restore(s, kind, slot),
  };
}

type Trace = (at: number, ...states: CommitState[]) => void;
type Story = {
  readonly db: Db;
  readonly fresh: World;
  readonly host: Host;
  world: World;
  revision: number;
  meta: Meta;
  behind: boolean; // the trace misses a committed entry or its header; catch up before the next
  // Settles the attempt whose COMMIT outcome is unknown, throwing while it still is; no decision
  // runs until it has.
  fence?: (() => Receipt | undefined) | undefined;
};

const fork = (host: Host) => ({ lineage_id: host.newId(), run_id: host.newId() });
const scope = (s: Story) => `story/${s.meta.lineage_id}/${s.world.character}`;
const ids = (s: Story): RunIds => ({
  content_hash: s.host.content_hash,
  kernel_version: s.host.kernel_version,
  seed: s.meta.seed as number[],
  run_id: s.meta.run_id,
});

/** A new save's identity: no parent, its initial RNG, and the release it pins (10 §32). */
function first(fresh: World, host: Host): Meta {
  const { id, version, requires } = fresh.cartridge.manifest;
  const pin = {
    cartridge_id: id,
    cartridge_version: version,
    content_hash: host.content_hash,
    capability_lock: fresh.cartridge.lock,
    rule_ir: requires.rule_ir,
    numeric_profile: null, // ponytail: neither kernel exports a profile version yet
    rng_profile: null,
  };
  return { format: SAVE_FORMAT, ...fork(host), parent: null, seed: fresh.state.rng as never, pin };
}

/** OFF-07: the snapshots that verify, for the player to pick; reopen the story after one. */
function corrupt(db: Db, fresh: World, host: Host) {
  return {
    kind: 'save_corrupt' as const,
    snapshots: verifying(db),
    // ponytail: no recovery copy of a head that does not parse. The identity is rewritten whole,
    // pinned to the bundled release, since the old one may be what does not parse.
    restore: (kind: Kind, slot: number) => {
      const r = restoreFrom(db, kind, slot, first(fresh, host));
      return { kind: r === true ? 'restored' : r || 'pending' } as const;
    },
  };
}

/** True while a fenced attempt's outcome is still unknown; otherwise settles it first. */
function fenced(s: Story): boolean {
  try {
    if (s.fence) settle(s);
    return false;
  } catch {
    return true;
  }
}

function invoke(s: Story, value: unknown): Reply {
  if (fenced(s)) return { kind: 'pending' };
  const id = identify(scope(s), s.world.character, value);
  if (id.kind !== 'identified') return id;
  const { invocation: i, command_id, intent_digest } = id;
  const old = receipt(s.db, scope(s), i.invocation_id);
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
  const r = { scope: scope(s), invocation_id: i.invocation_id, command_id, actor_id: i.actor_id };
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
function settle(s: Story): Receipt | undefined {
  const r = s.fence!(); // throws while still unknown
  s.fence = undefined;
  return r;
}

/** Memory takes the saved head, identity and world, after a commit it did not write itself. */
function adopt(s: Story) {
  const saved = load(s.db, s.fresh, () => {
    throw new Error('no save');
  });
  if (!saved) throw new Error('save corrupt');
  Object.assign(s, saved);
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
  if (s.behind && (s.behind = !catchUp(s.db, ids(s), s.fresh.context, command.id))) return;
  const written = traceCommand(s.db, ids(s), command, d, at, states);
  if (!written && states.includes('committed')) s.behind = true;
}

/** The head as a snapshot: the whole state at the current revision of this run. */
const here = ({ meta, revision, world }: Story) =>
  bytesOf({ lineage_id: meta.lineage_id, run_id: meta.run_id, revision, state: world.state });

/**
 * Keeps the current state as bookmark `slot` (1 to 3) named `label` (10 §31), after settling any
 * fenced attempt; never on the action path. A label is trimmed, then 1 to 40 characters (code
 * points); an occupied slot is overwritten only when `replace` says so.
 */
function bookmark(s: Story, slot: number, label: unknown, replace: boolean) {
  if (fenced(s)) return { kind: 'pending' } as const;
  const name = typeof label === 'string' ? label.trim() : '';
  if (![1, 2, 3].includes(slot) || !name || [...name].length > 40)
    return { kind: 'invalid_bookmark' } as const;
  if (!replace && occupied(s.db, slot)) return { kind: 'occupied' } as const;
  // Unknown COMMIT: the bookmark may or may not exist; nothing in play depends on it.
  return { kind: writeBookmark(s.db, slot, name, here(s)) ? 'bookmarked' : 'pending' } as const;
}

/**
 * Restores snapshot `kind` `slot` (10 §31) after settling any fenced attempt, so no pending
 * invocation crosses branches: in one transaction the head being left becomes a recovery
 * checkpoint and the snapshot's state, clock, RNG and revision become the head of a new lineage
 * and run whose parent is the snapshot's run at its revision. Memory adopts it only after the
 * commit, and the new run's trace opens with its header. A snapshot that fails its sha256 is
 * `save_corrupt` with nothing written. An unknown COMMIT fences like an invocation's.
 */
function restore(s: Story, kind: Kind, slot: number) {
  if (fenced(s)) return { kind: 'pending' } as const;
  const next = { ...s.meta, ...fork(s.host) };
  const r = restoreFrom(s.db, kind, slot, next, here(s)); // throws on a definite failure
  if (r === 'save_corrupt') return { kind: r, snapshots: verifying(s.db) } as const;
  if (r === 'missing') return { kind: 'missing' } as const;
  const restored = () => {
    adopt(s);
    s.behind = !catchUp(s.db, ids(s), s.fresh.context);
  };
  if (r) restored();
  else {
    s.fence = () => {
      const run = () => s.db.getFirstSync<{ run_id: string }>('SELECT run_id FROM save')?.run_id;
      if (reconcile(s.db, run) === next.run_id) restored();
      return undefined;
    };
    if (fenced(s)) return { kind: 'pending' } as const;
    if (s.meta.run_id !== next.run_id) throw new Error('COMMIT failed; nothing was restored');
  }
  return { kind: 'restored', revision: s.revision } as const;
}
