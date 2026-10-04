import { ElapsedRecoveryError } from './elapsed-store.ts';
import type {
  GameSubscription,
  ElapsedStatus,
  Projection,
} from '../../packages/game-view/session.ts';
import type { Pulse } from './elapsed.ts';
// The local TypeScript implementation of GameSession (packages/game-view/session.ts): a bundled
// cartridge played through the real local authority. It allocates invocation ids and the actor,
// resends an unconfirmed attempt unchanged, and owns open and Start over. It says nothing in words:
// the app's presenter does, from the views, the replies and the cartridge text (docs/decisions/
// owner-decision-presenter-split-2026-10-02.md). It adds no mechanics.
import type { Key } from '../../../kernel/ts/src/contracts.gen.ts';
import { gameView, INSTALLED, loadCartridge, newWorld } from '../../../kernel/ts/src/index.ts';
export { KERNEL_ID } from '../../../kernel/ts/src/index.ts'; // the app names its build with it
import type { Cartridge } from '../../../kernel/ts/src/index.ts';
import type { Failed, Game, GameSession, Intent, Reply } from '../../packages/game-view/session.ts';
import { openStory, type Host } from './authority.ts';
import { corrupt, type Db } from './store.ts';
import {
  sessionInvoke,
  SESSION_ID_PREFIX as ID_PREFIX,
  type SessionAttempt,
} from './invocation.ts';

/** A cartridge fixture: its canonical JSON text and content hash. */
export type Bundled = { canonical: string; sha256: string };

// The release's own fresh world: the context and seed of every save made before c1-host (whose
// pin names no context).
const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const SEED = [1, 2, 3, 4];

// The build's commit, its random source (lineage.test.ts proves the app path passes it; tests
// without one play the template world), its ids and its clock.
type HostPart = Pick<Host, 'newId' | 'latency' | 'kernel_version' | 'random' | 'time'>;

function cartridgeOf(bundled: Bundled): Cartridge {
  const artifact = `{"cartridge":${bundled.canonical},"content_hash":"${bundled.sha256}"}`;
  const loaded = loadCartridge(new TextEncoder().encode(artifact), INSTALLED);
  if (!loaded.ok) throw new Error(`cartridge did not load: ${JSON.stringify(loaded)}`);
  return loaded.cartridge as Cartridge;
}

// Ids continue from the highest receipt in this allocator's own namespace (replies without a
// receipt leave no trace; a new game deletes the receipts, and its new scope starts again at 1).
// ponytail: reads the receipt table directly; openStory exposes none.
function lastId(db: Db): number {
  const last = db.getFirstSync<{ id: string | null }>(
    'SELECT max(invocation_id) AS id FROM receipt WHERE invocation_id LIKE ?',
    `${ID_PREFIX}%`,
  )!.id;
  return last ? parseInt(last.slice(-12), 16) : 0;
}

// The save does not open (and offers start over) on a corrupt file (untyped: replaced), or, as
// save_corrupt with the new game in place (the file is fine), a damaged receipt or a world whose
// first screen cannot be built, whatever row's shape stops it (ROADMAP SM2a), so both are read
// once here, not lazily. ponytail: later screens' reads are not checked; typed row validation is R12's.
function checked(story: Extract<ReturnType<typeof openStory>, { kind: 'open' }>) {
  const refusal = (e: unknown) =>
    Object.assign(new Error((e as Error).message), {
      cause: { kind: 'save_corrupt', newGame: story.newGame },
    });
  try {
    gameView(story.world());
  } catch (e) {
    throw refusal(e);
  }
  try {
    const last = story.narration();
    // a line that parses but is not text would throw in the presenter's draw, outside SaveError
    if (last?.lines.some((t) => typeof (t as { key?: unknown } | null)?.key !== 'string'))
      throw new Error('malformed JSON: a narration line without a key');
  } catch (e) {
    if (!/malformed JSON/.test(String(e))) throw e; // a full disk or I/O: the save may be intact
    throw refusal(e);
  }
}

/**
 * The game on the save in `db` (a new one if empty, its ids from `host.newId`, a random UUID each call)
 * of the bundled cartridge; open `db` once per process. A save that does not open throws, its
 * refusal (kind and newGame) as the error's cause.
 */
export function openGame(db: Db, bundled: Bundled, host: HostPart) {
  const cartridge = cartridgeOf(bundled);
  if (cartridge.manifest.time_policy && !host.time)
    throw Object.assign(new Error('elapsed clocks are required'), {
      cause: { kind: 'elapsed_clock_missing' },
    });
  const fresh = newWorld(cartridge, CONTEXT as never, SEED as never);
  const story = openStory(db, [{ content_hash: bundled.sha256, fresh }], host);
  if (story.kind !== 'open') throw Object.assign(new Error(story.kind), { cause: story });
  checked(story);
  return managedGame(story, cartridge, db);
}

function managedGame(
  story: Extract<ReturnType<typeof openStory>, { kind: 'open' }>,
  cartridge: Cartridge,
  db: Db,
) {
  const held: SessionAttempt = { catching: false, sent: lastId(db) };
  const listeners = new Set<(update: GameSubscription) => void>();
  const emit = (update: GameSubscription) => {
    for (const listener of listeners) listener(update);
  };
  const projection = (): Projection => ({ view: gameView(story.world()), token: story.token() });
  const terminal = (reply: Reply) => reply.kind !== 'pending' && reply.kind !== 'catching_up';
  const attempt = (): Reply => {
    const reply = attemptStory(story, held.invocation);
    held.catching = reply.kind === 'catching_up';
    if (terminal(reply)) held.invocation = undefined;
    return reply;
  };
  const pending = () => held.invocation;
  const before = (): Projection => ({
    view: gameView(story.beforeWorld()),
    token: story.beforeToken(),
  });
  const invoke = (intent: Intent) => sessionInvoke(held, story.world().character, intent, attempt);
  const game = sharedGame(story, cartridge, projection, listeners, pending, invoke);
  story.onAdvance((status) => emit({ kind: 'state', projection: projection(), status }));
  return Object.assign(game, {
    newGame: story.newGame,
    pulse: pulseOf(story, projection, before, emit, pending, attempt),
  });
}

function sharedGame(
  story: Extract<ReturnType<typeof openStory>, { kind: 'open' }>,
  cartridge: Cartridge,
  projection: () => Projection,
  listeners: Set<(update: GameSubscription) => void>,
  pending: () => { invocation_id: string } | undefined,
  invoke: (intent: Intent) => Reply,
): Game {
  const run = story.runId();
  return {
    view: projection,
    invoke: (intent) => (story.runId() === run ? invoke(intent) : { kind: 'stale_view' }),
    pending: () => !!pending(),
    pendingInvocation: () => pending()?.invocation_id,
    subscribe(listener) {
      listeners.add(listener);
      listener({ kind: 'state', projection: projection(), status: story.clockStatus() });
      return () => {
        listeners.delete(listener);
      };
    },
    text: (key) => cartridge.text[key as Key],
    lastNarration: story.narration,
  };
}

function pulseOf(
  story: Extract<ReturnType<typeof openStory>, { kind: 'open' }>,
  projection: () => Projection,
  before: () => Projection,
  emit: (update: GameSubscription) => void,
  pending: () => (Intent & { invocation_id: string }) | undefined,
  attempt: () => Reply,
) {
  const run = story.runId();
  return (mode: Pulse = 'active'): ElapsedStatus => {
    try {
      if (story.runId() !== run) return { kind: 'replaced' };
      const held = pending();
      // A retained player's receipt must replay before any new host sampling.
      if (held) {
        const reply = attempt();
        if (reply.kind !== 'pending' && reply.kind !== 'catching_up')
          emit({
            kind: 'completion',
            invocation_id: held.invocation_id,
            intent: held,
            before: before(),
            reply,
          });
        const status = statusOf(reply);
        emit({ kind: 'state', projection: projection(), status });
        return status;
      }
      const status = story.pulse(mode, run);
      emit({ kind: 'state', projection: projection(), status });
      return status;
    } catch (e) {
      const status = statusOfError(e);
      emit({ kind: 'state', projection: projection(), status });
      return status;
    }
  };
}

function attemptStory(
  story: Extract<ReturnType<typeof openStory>, { kind: 'open' }>,
  retry: unknown,
): Reply {
  try {
    return story.invoke(retry) as Reply;
  } catch (e) {
    if (!(e instanceof ElapsedRecoveryError)) throw e;
    return e.kind === 'stale_view'
      ? { kind: 'stale_view' }
      : { kind: 'save_corrupt', message: e.message };
  }
}
const statusOfError = (e: unknown): ElapsedStatus =>
  e instanceof ElapsedRecoveryError && e.kind === 'stale_view'
    ? { kind: 'replaced' }
    : {
        kind: 'error',
        message: (e as Error).message,
        ...(e instanceof ElapsedRecoveryError ? { reason: 'save_corrupt' as const } : {}),
      };

const statusOf = (reply: Reply): ElapsedStatus =>
  reply.kind === 'pending' || reply.kind === 'catching_up'
    ? { kind: reply.kind }
    : reply.kind === 'save_corrupt'
      ? { kind: 'error', reason: 'save_corrupt', message: reply.message }
      : reply.kind === 'stale_view'
        ? { kind: 'replaced' }
        : reply.kind === 'fault'
          ? reply
          : { kind: 'ready' };

/** The refusal and its start over options, as the authority keeps them beyond the shared Failed. */
type Local = Failed & { newGame?: () => { kind: string }; replace?: boolean };
type Why = Omit<Local, 'startOver'>;
const offered = (f?: Why): Local | undefined =>
  f && { ...f, startOver: !!(f.newGame || f.replace) }; // Start over is offered

/**
 * The game on the save file, or why it does not open, and start over (10 §31: the host has the
 * player confirm first). `open` opens the file (once per process); `remove` closes that handle
 * and deletes the file. Start over is the authority's new game where it offers one: it keeps the
 * file, so the old runs' trace and any pending report survive. A file it cannot repair (NOTADB, a
 * corrupt page: its new game throws as corrupt, or the open throws untyped as corrupt) is replaced.
 * Never started over: a newer app's save (`unsupported_save_format`, update the app, 10 §32) or an
 * open that failed for another reason (a full disk: the save may be intact). A start over that
 * fails otherwise keeps the game being played and returns why; one whose outcome is unknown does
 * not (its next press would settle the new game, then apply to it): `start_over_pending`, a
 * code only that outcome sets, so a failed retry shows its own error.
 */
export function localSession(open: () => Db, remove: () => void, items: Bundled, host: HostPart) {
  const s: { db?: Db; game?: ReturnType<typeof openGame>; failed?: Why } = {};
  const fail = (f: Why, code?: Failed['code']) => (s.failed = { ...f, code });
  const reopen = () => {
    try {
      s.game = openGame((s.db ??= open()), items, host);
      s.failed = undefined;
    } catch (e) {
      const { message, cause } = e as Error;
      s.game = undefined;
      fail({ ...(cause as Local), message, replace: corrupt(e) });
    }
  };
  reopen();
  return {
    game: () => s.game,
    failed: () => offered(s.failed),
    startOver(): string | undefined {
      const newGame = s.game?.newGame ?? s.failed?.newGame;
      if (!newGame && !s.failed?.replace) return;
      try {
        if (newGame?.().kind === 'pending') {
          s.game = undefined;
          return void fail({ ...s.failed, message: '', newGame }, 'start_over_pending');
        }
        if (newGame) return void reopen();
      } catch (e) {
        const { message } = e as Error;
        if (!corrupt(e)) return s.game ? message : void fail({ ...s.failed, message });
      }
      try {
        [s.game, s.db] = [undefined, undefined]; // the handle goes with the file
        remove();
        reopen();
      } catch (e) {
        fail({ message: (e as Error).message, replace: true });
      }
    },
  } satisfies GameSession & { failed: () => Local | undefined };
}
