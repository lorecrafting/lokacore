// The local Story authority (07 §§8-9; 03 §§14-15; ADR-072; 10 §§31-32): the world in memory,
// one SQLite save, and 03 §14's admission order. invoke is synchronous on one connection, so
// commands run one at a time, as WorldInstance serializes them online (07 §8).
import type { Json } from '../../../kernel/ts/src/canonical.ts';
import type { Command, DecisionResult, ErrorCode } from '../../../kernel/ts/src/contracts.gen.ts';
import type { World } from '../../../kernel/ts/src/decision.ts';
import { identify, INTENT_DIGEST_VERSION, resolve } from '../../../kernel/ts/src/invocation.ts';
import { validate } from '../../../kernel/ts/src/validate.ts';
import { step } from '../../../kernel/ts/src/world.ts';
import { commit, identityOf, load, receipt, reconcile, replace } from './store.ts';
import type { Captured, Db, Meta, Receipt } from './store.ts';
import { catchUp, traceCommand, type CommitState, type RunIds } from './trace.ts';

/** A committed outcome, new or replayed (03 §14): the decision and the revision it left. */
export type Saved = { kind: 'saved'; replay: boolean; revision: number; decision: Json };

export type Reply =
  | Exclude<ReturnType<typeof identify>, { kind: 'identified' }>
  | { kind: 'conflict' }
  | { kind: 'fault'; code: ErrorCode }
  | { kind: 'pending' } // COMMIT outcome unknown: retry the same invocation later (03 §§14-15)
  | Saved;

/** An installed release (10 §16); the app bundles them newest first and downloads none (PREP-03). */
export type Release = { content_hash: string; fresh: World };

/**
 * What the host supplies besides the releases: the build's kernel version (ADR-075 RunIds) and a
 * fresh random UUID per call, for each new save's lineage and run ids and each milestone report's
 * id. `milestones` maps a `custom_event` key to the milestone and outcome its commit reaches (none
 * by default); `binding` is the signed-in account/profile, read once when a run starts, which
 * binds it (23 §§4-5, §11; null, the default: a guest).
 */
export type Host = {
  kernel_version: string;
  newId: () => string;
  // ponytail: stands in for the cartridge's own milestone declaration and the typed
  // story.milestone_reached event (23 §3), which freeze with the R7 feature schema.
  milestones?: ReadonlyMap<string, { milestone: string; outcome: string }>;
  binding?: () => string | null;
};
const SAVE_FORMAT = 'loka-save-v1';

/**
 * The story saved in `db`, on the installed release its pin names (10 §32, OFF-11), or the newest
 * release's fresh world saved at revision 0 as a new save pinning it. Its idempotency scope is
 * the save's lineage and the world's character; its actor is the character. Not opened, nothing
 * written: a save of another format (`unsupported_save_format`, checked first; the player updates
 * the app, no new game discards it, 10 §§31-32), and, offering only the player's new game (settled
 * as any; reopen once `replaced`), an uninstalled pin (`pinned_release_missing`, 10 §32) or a save
 * that does not parse (`save_corrupt`, OFF-07). `invoke` takes one ActionInvocation: malformed or
 * another actor's gets no receipt; a known invocation replays its receipt (altered intent is a
 * conflict) before anything is resolved against the current world; a NEW one is resolved, decided
 * once and committed before it is adopted. A fault discards its proposal and gets no receipt
 * (ADR-075 §4; 04 §5.2 step 7). A failed commit throws, with memory and storage unchanged. A
 * COMMIT whose outcome is unknown fences every call, answered `pending`, until the store settles
 * it (03 §15). Each command's game-trace entry follows its commit. `newGame`: below.
 */
export function openStory(db: Db, releases: readonly [Release, ...Release[]], host: Host) {
  const saved = identityOf(db);
  const { fresh } = releases[0]; // meta stays undefined until a save is loaded or replaced
  const s = { db, releases, fresh, host, world: fresh, revision: 0, behind: false } as Story;
  // ponytail: no migration or recovery copy yet (owner-decision-s3b-scope-2026-09-30.md).
  const refuse = <T>(r: T) => ({ ...r, newGame: () => newGame(s) });
  const format = saved?.format;
  if (saved && format !== SAVE_FORMAT)
    return { kind: 'unsupported_save_format' as const, format, supported: [SAVE_FORMAT] };
  if (saved && !saved.pin) return refuse({ kind: 'save_corrupt' as const });
  const release = saved
    ? releases.find((r) => r.content_hash === saved.pin!.content_hash)
    : releases[0]; // no save row: a new save, or half a save that load reports corrupt
  const installed = releases.map((r) => r.content_hash);
  if (!release)
    return refuse({ kind: 'pinned_release_missing' as const, pinned: saved!.pin!, installed });
  const loaded = load(db, release.fresh, () => first(release, host));
  if (!loaded) return refuse({ kind: 'save_corrupt' as const });
  Object.assign(s, { fresh: release.fresh, ...loaded });
  s.behind = !catchUp(db, ids(s), s.fresh.context);
  // world() is not fenced: while `pending` it is the prior revision, which the UI shows as pending.
  return {
    kind: 'open' as const,
    world: () => s.world,
    invoke: (value: unknown) => invoke(s, value),
    newGame: () => newGame(s),
  };
}

type Trace = (at: number, ...states: CommitState[]) => void;
type Story = {
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

const scope = (s: Story) => `story/${s.meta.lineage_id}/${s.world.character}`;
const ids = (s: Story): RunIds => ({
  content_hash: s.meta.pin.content_hash,
  kernel_version: s.host.kernel_version,
  seed: s.meta.seed as number[],
  run_id: s.meta.run_id,
});

/** A new save's identity: no parent, its initial RNG, the release it pins (10 §32), its binding. */
function first({ content_hash, fresh }: Release, host: Host): Meta {
  const { id, version, requires } = fresh.cartridge.manifest;
  const pin = {
    cartridge_id: id,
    cartridge_version: version,
    content_hash,
    capability_lock: fresh.cartridge.lock,
    rule_ir: requires.rule_ir,
    numeric_profile: null, // ponytail: neither kernel exports a profile version yet
    rng_profile: null,
  };
  const [lineage_id, run_id] = [host.newId(), host.newId()];
  const seed = fresh.state.rng as never;
  const binding = host.binding?.() ?? null;
  return { format: SAVE_FORMAT, lineage_id, run_id, parent: null, seed, pin, binding };
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
  return save(s, next, trace, reached(s, d, s.revision + 1), {
    ...r,
    intent_digest_version: INTENT_DIGEST_VERSION,
    intent_digest,
    command: 'kind' in command ? null : (command as never),
    revision: d.kind === 'accepted' ? s.revision + 1 : s.revision,
    response: d as never,
  });
}

/**
 * The pending reports of the milestones an accepted decision reaches (23 §§4-5; 03 §26), each
 * with its id allocated once here and committed with the decision, its run, lineage, release and
 * the run's binding. A receipt replay never comes here, so it adds no second report. A report
 * that is not a MilestoneReport (a bad host key) throws before anything is stored.
 */
function reached(s: Story, d: DecisionResult, observed_revision: number): Captured[] {
  if (d.kind !== 'accepted') return [];
  const { cartridge_id, cartridge_version, content_hash } = s.meta.pin;
  const release = { cartridge_id, cartridge_version, cartridge_hash: content_hash } as never;
  return d.events.flatMap(({ payload: p }) => {
    const m = p.type === 'custom_event' ? s.host.milestones?.get(p.event.key) : undefined;
    if (!m) return [];
    const { lineage_id, run_id, binding = null } = s.meta;
    const report = { report_id: s.host.newId(), run_id, release, observed_revision, ...m };
    if (validate('MilestoneReport', report).length) throw new Error('not a MilestoneReport');
    return [{ lineage_id, binding, report: report as never }];
  });
}

/** Commits a NEW attempt's decision, then adopts it; the reply never claims an unknown save. */
function save(
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

/**
 * Replaces the save with a new game (10 §31, one save per story; the host has the player confirm
 * first): after settling any fenced attempt, in one transaction, the fresh world at revision 0, a
 * new lineage and run with no parent pinned to the newest release (10 §32), and no receipts (the
 * old lineage's would otherwise answer its invocation ids). Memory adopts it only after the commit,
 * and the new run's trace opens with its header. An unknown COMMIT fences like an invocation's.
 */
function newGame(s: Story) {
  const retried = s.fence && s.fence === s.game?.fence ? s.game.run_id : undefined;
  if (fenced(s)) return { kind: 'pending' } as const;
  if (retried && s.meta?.run_id === retried) return { kind: 'replaced' } as const; // not twice
  // Best effort before its receipts go (the trace is derived and never blocks the player): the
  // old run's missed entries can be recovered only from them.
  if (s.behind) s.behind = !catchUp(s.db, ids(s), s.fresh.context);
  const newest = s.releases[0];
  const next = first(newest, s.host);
  const replaced = replace(s.db, newest.fresh, next); // throws on a definite failure: none written
  // Settled like an unknown COMMIT even when committed, so memory never serves the old run after
  // the new one is saved: a failed read while adopting it fences every call until it is adopted.
  const fence = () => {
    const run = () => s.db.getFirstSync<{ run_id: string }>('SELECT run_id FROM save')?.run_id;
    if (replaced || reconcile(s.db, run) === next.run_id) {
      s.fresh = newest.fresh;
      adopt(s);
      s.behind = !catchUp(s.db, ids(s), s.fresh.context);
    }
    return undefined;
  };
  [s.fence, s.game] = [fence, { fence, run_id: next.run_id }];
  if (fenced(s)) return { kind: 'pending' } as const;
  if (s.meta?.run_id !== next.run_id) throw new Error('COMMIT failed; nothing was replaced');
  return { kind: 'replaced' } as const;
}
