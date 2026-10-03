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

/** A cartridge fixture: its canonical JSON text and content hash. */
export type Bundled = { canonical: string; sha256: string };

// The release's own fresh world: the context and seed of every save made before c1-host (whose
// pin names no context).
const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const SEED = [1, 2, 3, 4];
const ID_PREFIX = '00000000-0000-4000-8000-';

// The build's commit, its random source (lineage.test.ts proves the app path passes it; tests
// without one play the template world), its ids and its clock.
type HostPart = Pick<Host, 'newId' | 'latency' | 'kernel_version' | 'random'>;

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
  const fresh = newWorld(cartridge, CONTEXT as never, SEED as never);
  const story = openStory(db, [{ content_hash: bundled.sha256, fresh }], host);
  if (story.kind !== 'open') throw Object.assign(new Error(story.kind), { cause: story });
  checked(story);
  // The unconfirmed attempt, resent unchanged (same id, same intent) until it settles (03 §§14-15).
  let retry: object | undefined;
  let sent = lastId(db);
  const game: Game = {
    view: () => ({ view: gameView(story.world()), token: story.token() }),
    invoke(intent: Intent): Reply {
      // While unconfirmed any call resends that attempt, whatever the intent.
      retry ??= {
        ...intent,
        invocation_id: `${ID_PREFIX}${(++sent).toString(16).padStart(12, '0')}`,
        actor_id: story.world().character,
      };
      const reply = story.invoke(retry); // a throw may follow a durable commit: keep the attempt (03 §14)
      if (reply.kind !== 'pending') retry = undefined;
      return reply as Reply;
    },
    pending: () => !!retry,
    text: (key) => cartridge.text[key as Key],
    lastNarration: story.narration,
  };
  return Object.assign(game, { newGame: story.newGame });
}

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
