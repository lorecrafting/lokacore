// The local Story authority (07 §§8-9; 03 §§14-15; ADR-072; 10 §§31-32): the world in memory,
// one SQLite save, and 03 §14's admission order. invoke is synchronous on one connection, so
// commands run one at a time, as WorldInstance serializes them online (07 §8).
import type { Json } from '../../../kernel/ts/src/canonical.ts';
import type {
  Command,
  DecisionResult,
  ErrorCode,
  HostKind,
} from '../../../kernel/ts/src/contracts.gen.ts';
import type { World } from '../../../kernel/ts/src/decision.ts';
import { identify, INTENT_DIGEST_VERSION, resolve } from '../../../kernel/ts/src/invocation.ts';
import type { Identified } from '../../../kernel/ts/src/invocation.ts';
import { validate } from '../../../kernel/ts/src/validate.ts';
import { newWorld, step } from '../../../kernel/ts/src/world.ts';
import { corrupt, identityOf, load, receipt, reconcile, replace } from './store.ts';
import type { Captured, Db, Meta } from './store.ts';
import { adopt, budget, ids, narration, save, scope, settle, stale, token } from './save.ts';
import type { Story, Trace } from './save.ts';
import { catchUp, observe, traceCommand, type CommitState } from './trace.ts';

/** A committed outcome, new or replayed (03 §14): the decision and the revision it left. */
export type Saved = { kind: 'saved'; replay: boolean; revision: number; decision: Json };

export type Reply =
  | Exclude<ReturnType<typeof identify>, { kind: 'identified' }>
  | { kind: 'conflict' }
  | { kind: 'fault'; code: ErrorCode }
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
  latency?: { host: HostKind; now: () => number }; // ms; each NEW decision's (11 §13), else none
  random?: (words: Uint32Array) => Uint32Array;
};
const SAVE_VERSION = 1;
const SAVE_FORMAT = `loka-save-v${SAVE_VERSION}`;

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
    const format = saved?.format; // a higher loka-save-vN: a newer app's; other than ours: corrupt
    if (Number(/^loka-save-v([1-9][0-9]*)$/.exec(format ?? '')?.[1]) > SAVE_VERSION)
      return { kind: 'unsupported_save_format' as const, format, supported: [SAVE_FORMAT] };
    if (saved && (format !== SAVE_FORMAT || !saved.pin))
      return refuse({ kind: 'save_corrupt' as const });
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
  } catch (e) {
    if (!corrupt(e)) throw e;
    return refuse({ kind: 'save_corrupt' as const }); // SQLite cannot read the file
  }
  s.behind = !catchUp(db, ids(s), s.fresh.context);
  // world() is not fenced: while `pending` it is the prior revision, which the UI shows as pending.
  return {
    kind: 'open' as const,
    world: () => s.world,
    invoke: (value: unknown) => invoke(s, value),
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
    const intact = !validate('DecisionResult', old.response).length; // never decided again
    if (!same || !intact || old.intent_digest !== intent_digest) return { kind: 'conflict' };
    return { kind: 'saved', replay: true, revision: old.revision, decision: old.response };
  }
  if (stale(s, i.view_freshness_token)) return { kind: 'stale_view' };
  const { command, next, timed } = decided(s, id);
  const d = next.decision;
  // A rejection before a Command existed has no trace entry: TraceEntry needs the Command.
  const trace: Trace = (at, ...states) => {
    if (!('kind' in command)) traceAfter(s, command, d, at, states);
  };
  if (d.kind === 'fault') {
    trace(s.revision, 'unavailable');
    if (next.limit) observe(s.db, budget(s, command_id, next.limit));
    return timed({ kind: 'fault', code: d.code });
  }
  // ponytail: no rule emits effects yet; the outbox (03 §16) comes with the first that does.
  if (d.kind === 'accepted' && d.effects.length) throw new Error('effect outbox not built');
  const r = { scope: scope(s), invocation_id: i.invocation_id, command_id, actor_id: i.actor_id };
  const reply = save(s, next, trace, reached(s, d, s.revision + 1), {
    ...r,
    intent_digest_version: INTENT_DIGEST_VERSION,
    intent_digest,
    command: 'kind' in command ? null : (command as never),
    revision: d.kind === 'accepted' ? s.revision + 1 : s.revision,
    response: d as never,
  });
  return timed(reply); // not if pending: the sink's transaction would roll back the open COMMIT
}

// A NEW invocation resolved and decided (03 §14); `timed` observes how long (11 §13) if clocked.
function decided(s: Story, id: Identified) {
  const t0 = s.host.latency?.now();
  const command = resolve(s.world, id);
  const next: ReturnType<typeof step> =
    'kind' in command
      ? { world: s.world, decision: command }
      : step(s.world, command, s.revision + 1, id.invocation.action_key);
  const value = s.host.latency && Math.round((s.host.latency.now() - t0!) * 1000);
  const { kernel_version, run_id } = ids(s);
  const head = { format: 'loka-obs-v1', event: 'kernel.decision_latency', store: 'operations' };
  const timed = (reply: Reply) => {
    if (s.host.latency && reply.kind !== 'pending')
      observe(s.db, {
        ...head,
        ids: { kernel_version, host: s.host.latency.host, run_id, command_id: id.command_id },
        data: { state: 'observed', value },
      });
    return reply;
  };
  return { command, next, timed };
}

/**
 * The pending reports of the story points an accepted decision reaches, its story_point_reached
 * events (23 §§3-5; 03 §26), each with its id allocated once here and committed with the
 * decision, its run, lineage, release and the run's binding. A receipt replay never comes here,
 * so it adds no second report. A report that is not a StoryPointReport (a bad host id) throws
 * before anything is stored.
 */
function reached(s: Story, d: DecisionResult, observed_revision: number): Captured[] {
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
  // old run's missed entries can be recovered only from them. ponytail: if this catch-up fails they
  // are lost with the run the player chose to abandon; a pre-write journal would make it authority.
  if (s.behind) s.behind = !catchUp(s.db, ids(s), s.fresh.context);
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
      s.behind = !catchUp(s.db, ids(s), s.fresh.context);
    }
    return undefined;
  };
  [s.fence, s.game] = [fence, { fence, run_id: next.run_id }];
  if (fenced(s)) return { kind: 'pending' } as const;
  if (s.meta?.run_id !== next.run_id) throw new Error('COMMIT failed; nothing was replaced');
  return { kind: 'replaced' } as const;
}
