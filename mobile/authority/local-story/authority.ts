import type { identify } from '../../../kernel/ts/src/commands/invocation.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
// The local Story authority (07 §§8-9; 03 §§14-15; ADR-072; 10 §§31-32): the world in memory,
// one SQLite save, and 03 §14's admission order. invoke is synchronous on one connection, so
// commands run one at a time, as WorldInstance serializes them online (07 §8).
import type { Json } from '../../../kernel/ts/src/foundation/canonical.ts';
import type { ErrorCode, HostKind } from '../../../kernel/ts/src/contracts.gen.ts';
import type { World } from '../../../kernel/ts/src/runtime/decision.ts';
import { newWorld } from '../../../kernel/ts/src/runtime/world.ts';
import { corrupt, identityOf, load, reconcile, replace } from './store.ts';
import type { Db, Meta } from './store.ts';
import { adopt, ids, narration, token } from './save.ts';
import type { Story } from './save.ts';
import type { ElapsedStatus } from '../../packages/game-view/session.ts';
import { ClockDriver, type Clocks, type Pulse } from './elapsed.ts';
import { ElapsedRecoveryError, changedRun, formatProblem } from './elapsed-store.ts';
import { invoke, cancel } from './invocation.ts';
import { catchUp } from './trace.ts';
import { elapsed, fenced, type Elapsed } from './delivery.ts';

/** A committed outcome, new or replayed (03 §14): the decision and the revision it left. */
export type Saved = { kind: 'saved'; replay: boolean; revision: number; decision: Json };

export type Reply =
  | Exclude<ReturnType<typeof identify>, { kind: 'identified' }>
  | { kind: 'conflict' }
  | { kind: 'fault'; code: ErrorCode }
  | { kind: 'catching_up'; invocation_id: string }
  | { kind: 'pending' } // COMMIT outcome unknown: retry the same invocation later (03 §§14-15)
  | { kind: 'stale_view' } // a NEW invocation made against an older view (04 §16): no receipt
  | Saved;

/** An installed release (10 §16); the app bundles them newest first and downloads none (PREP-03). */
export type Release = { content_hash: string; fresh: World };

/**
 * What the host supplies besides the releases: the build's kernel version (ADR-075 RunIds) and a
 * fresh random UUID per call, for each new save's lineage and run ids and each story point report's
 * id; `binding` is the signed-in account/profile, read once when a run starts, which binds it
 * (23 §§4-5, §11; null, the default: a guest). `random`, shaped like getRandomValues, draws each new
 * lineage's world context and RNG seed (ADR-075 §§3-4); without it a new lineage takes the
 * release's own fresh world.
 */
export type Host = {
  kernel_version: string;
  newId: () => string;
  binding?: () => string | null;
  time?: Clocks;
  latency?: { host: HostKind; now: () => number }; // ms; each NEW decision's (11 §13), else none
  random?: (words: Uint32Array) => Uint32Array;
};
const SAVE_FORMAT = 'loka-save-v2';

/**
 * The story saved in `db`, on the installed release its pin names (10 §32, OFF-11), or the newest
 * release's fresh world saved at revision 0 as a new save pinning it. Its idempotency scope is
 * the save's lineage and the world's character; its actor is the character. Not opened, nothing
 * written: a newer format (`unsupported_save_format`, checked first; the player updates the app,
 * 10 §§31-32), and, offering only the player's new game (settled as any; reopen once `replaced`),
 * an uninstalled pin (`pinned_release_missing`, 10 §32) or a corrupt save (`save_corrupt`, OFF-07). `invoke` takes one ActionInvocation: malformed or
 * another actor's gets no receipt; a known invocation replays its receipt (altered intent, or a
 * response that is not a DecisionResult, is a conflict) before anything is resolved against the current world; a NEW one with a host view
 * token (`view:<run>:<revision>`) other than `token()` is `stale_view` (04 §16; other tokens are only admission
 * metadata, 03 §14); else it is resolved, decided once and committed before it is adopted. A fault discards its proposal and gets no receipt
 * (ADR-075 §4; 04 §5.2 step 7); a budget fault's limit is observed (trace.ts observe, 04 §5.4).
 * A failed commit throws, with memory and storage unchanged. A COMMIT whose outcome is unknown
 * fences every call, answered `pending`, until the store settles it (03 §15). Each command's game-trace entry follows its commit. `newGame`: below.
 */
export function openStory(db: Db, releases: readonly [Release, ...Release[]], host: Host) {
  const { fresh } = releases[0]; // meta stays undefined until a save is loaded or replaced
  const s = { db, releases, fresh, host, world: fresh, revision: 0, behind: false } as Story;
  const refuse = <T>(r: T) => ({ ...r, newGame: () => newGame(s) }); // ponytail: no migration yet
  try {
    const saved = identityOf(db);
    if (saved?.format === SAVE_FORMAT || (host.time && fresh.cartridge.manifest.time_policy))
      s.recoveryHeader = saved ? { format: saved.format, run_id: saved.run_id } : null;
    const format = saved?.format; // a higher loka-save-vN: a newer app's; other than ours: corrupt
    const problem = formatProblem(format);
    if (problem === 'unsupported_save_format')
      return {
        kind: 'unsupported_save_format' as const,
        format,
        supported: ['loka-save-v1', SAVE_FORMAT],
      };
    if (saved && (problem || !saved.pin)) return refuse({ kind: 'save_corrupt' as const });
    const release = saved
      ? releases.find((r) => r.content_hash === saved.pin!.content_hash)
      : releases[0]; // no save row: a new save, or half a save that load reports corrupt
    const installed = releases.map((r) => r.content_hash);
    if (!release)
      return refuse({ kind: 'pinned_release_missing' as const, pinned: saved!.pin!, installed });
    const base = saved ? pinned(release, saved.pin!) : drawn(release, host);
    const loaded = base && load(db, base, () => first(release.content_hash, base, host));
    if (!loaded) return refuse({ kind: 'save_corrupt' as const });
    Object.assign(s, { fresh: base, ...loaded });
    s.recoveryHeader = undefined;
  } catch (e) {
    if (!(e instanceof ElapsedRecoveryError) && !corrupt(e)) throw e;
    s.corruptFile = !(e instanceof ElapsedRecoveryError) && corrupt(e);
    return refuse({ kind: 'save_corrupt' as const }); // SQLite cannot read the file
  }
  return opened(s);
}

function opened(s: Story) {
  let changed = (_status: ElapsedStatus) => {};
  const driver =
    s.world.cartridge.manifest.time_policy && s.host.time
      ? new ClockDriver(s, s.host.time, (status) => changed(status))
      : undefined;
  driver?.pulse('resume', s.meta.run_id);
  s.behind = !catchUp(s.db, ids(s), s.fresh.context);
  // world() is not fenced: while `pending` it is the prior revision, which the UI shows as pending.
  return {
    kind: 'open' as const,
    world: () => s.world,
    beforeWorld: () => s.beforeWorld ?? s.world,
    beforeToken: () => s.beforeToken ?? token(s),
    clockStatus: () => driver?.state() ?? { kind: 'ready' as const },
    invoke: (value: unknown) => invoke(s, value, driver),
    onAdvance: (listener: typeof changed) => {
      changed = listener;
    },
    requestResume: (expected: string) => driver?.requestResume(expected),
    pulse: (mode: Pulse, expected: string) =>
      driver?.pulse(mode, expected) ?? { kind: 'ready' as const },
    elapsed: (evidence: Elapsed) => elapsed(s, evidence),
    runId: () => s.meta.run_id,
    newGame: () => newGame(s),
    narration: () => narration(s),
    token: () => token(s), // the view freshness token of the world() now shown
  };
}

/**
 * A new lineage's initial world (ADR-075 §§3-4): with `random`, the release's cartridge under a
 * drawn v4 UUID context and a drawn seed (redrawn while all zero: RngState); else the release's.
 */
function drawn({ fresh }: Release, { random }: Host): World {
  if (!random) return fresh;
  let seed: number[];
  do seed = [...random(new Uint32Array(4))];
  while (seed.every((w) => w === 0));
  const w = random(new Uint32Array(4));
  [w[1], w[2]] = [(w[1]! & 0xffff0fff) | 0x4000, (w[2]! & 0x3fffffff) | 0x80000000]; // v4, variant 10
  const h = [...w].map((x) => x.toString(16).padStart(8, '0')).join('');
  const context = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  return newWorld(fresh.cartridge, context as never, seed as never);
}

/**
 * A saved lineage's initial world: the release's cartridge under its pinned context (ADR-075 §4
 * A4), or the release's own when the pin has none (a save from before c1-host); its rng is the
 * head's once loaded. Undefined for a context that is not a WorldContextId (corrupt).
 */
function pinned({ fresh }: Release, { world_context_id: context }: Meta['pin']) {
  if (context === undefined || context === fresh.context) return fresh;
  if (validate('WorldContextId', context).length) return undefined;
  return newWorld(fresh.cartridge, context as never, fresh.state.rng);
}

/** A new save's identity: no parent, its initial RNG and context, the release it pins (10 §32), its binding. */
function first(content_hash: string, fresh: World, host: Host): Meta {
  const { id, version, requires } = fresh.cartridge.manifest;
  const pin = {
    cartridge_id: id,
    cartridge_version: version,
    content_hash,
    capability_lock: fresh.cartridge.lock,
    rule_ir: requires.rule_ir,
    world_context_id: fresh.context,
    numeric_profile: null, // ponytail: neither kernel exports a profile version yet
    rng_profile: null,
  };
  const [lineage_id, run_id] = [host.newId(), host.newId()];
  const seed = fresh.state.rng as never;
  const binding = host.binding?.() ?? null;
  return { format: 'loka-save-v1', lineage_id, run_id, parent: null, seed, pin, binding };
}

function replaceable(s: Story) {
  try {
    if (fenced(s)) return 'pending' as const;
  } catch (e) {
    if (!(e instanceof ElapsedRecoveryError)) throw e;
  }
  const expected =
    s.recoveryHeader !== undefined
      ? s.recoveryHeader
      : s.meta && (s.elapsed || (s.host.time && s.world.cartridge.manifest.time_policy))
        ? { format: s.meta.format, run_id: s.meta.run_id }
        : undefined;
  if (expected === undefined && !s.corruptFile) return 'ready' as const;
  try {
    return reconcile(s.db, () => {
      const current = identityOf(s.db);
      const problem = current && formatProblem(current.format);
      if (problem === 'unsupported_save_format') return problem;
      if (
        (!current && expected === null) ||
        (current &&
          expected &&
          (current.format === expected.format ||
            (s.recoveryHeader === undefined &&
              expected.format === 'loka-save-v1' &&
              current.format === SAVE_FORMAT)) &&
          current.run_id === expected.run_id)
      )
        return 'ready' as const;
      const kind = problem ?? changedRun(current, expected?.run_id)?.kind ?? 'save_corrupt';
      s.blocked = new ElapsedRecoveryError(kind, 'save header changed; reopen before recovery');
      return kind;
    });
  } catch (e) {
    if (s.corruptFile && corrupt(e)) throw e; // closed and still corrupt: confirmed host file recovery
    return 'pending' as const; // the header or transaction closure remains unknown
  }
}

function newGame(s: Story) {
  const retried = s.fence && s.fence === s.game?.fence ? s.game.run_id : undefined;
  const recovery = replaceable(s);
  if (recovery !== 'ready') return { kind: recovery };
  if (s.blocked?.kind === 'stale_view') return { kind: 'stale_view' } as const;
  s.blocked = undefined;
  s.fence = undefined;
  if (retried && s.meta?.run_id === retried) return { kind: 'replaced' } as const; // not twice
  // Best effort before its receipts go (the trace is derived and never blocks the player): the
  // old run's missed entries can be recovered only from them. ponytail: if this catch-up fails they
  // are lost with the run the player chose to abandon; a pre-write journal would make it authority.
  if (s.behind) s.behind = !catchUp(s.db, ids(s), s.fresh.context);
  cancel(s);
  const newest = s.releases[0];
  const world = drawn(newest, s.host);
  const next = first(newest.content_hash, world, s.host);
  const replaced = replace(s.db, world, next); // throws on a definite failure: none written
  // Settled like an unknown COMMIT even when committed, so memory never serves the old run after
  // the new one is saved: a failed read while adopting it fences every call until it is adopted.
  const fence = () => {
    const run = () => identityOf(s.db)?.run_id; // a rolled-back repair may leave no save table
    if (replaced || reconcile(s.db, run) === next.run_id) {
      s.fresh = world;
      adopt(s);
      s.recoveryHeader = undefined;
      s.corruptFile = undefined;
      s.behind = !catchUp(s.db, ids(s), s.fresh.context);
    }
    return undefined;
  };
  [s.fence, s.game] = [fence, { fence, run_id: next.run_id }];
  if (fenced(s)) return { kind: 'pending' } as const;
  if (s.meta?.run_id !== next.run_id) throw new Error('COMMIT failed; nothing was replaced');
  return { kind: 'replaced' } as const;
}
