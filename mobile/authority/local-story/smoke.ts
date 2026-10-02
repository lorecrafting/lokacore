// The phone smoke screen's logic (R6 SM, wiring proof for the UI slice): a bundled cartridge played
// through the real local authority, plain so any view can replace the React one. It exposes the
// current GameView, its text, the offered actions as buttons and a log; it adds no mechanics.
import type { GameView, Key, NarrationRecord } from '../../../kernel/ts/src/contracts.gen.ts';
import {
  gameView,
  INSTALLED,
  KERNEL_ID,
  loadCartridge,
  newWorld,
} from '../../../kernel/ts/src/index.ts';
import type { Cartridge } from '../../../kernel/ts/src/index.ts';
import { openStory, type Host, type Reply } from './authority.ts';
import { corrupt, type Db } from './store.ts';
import { OUTCOME, reason } from './words.ts';

export type { GameView };
/**
 * A tappable action: its text and the invocation it sends (id and actor are added on press), with
 * the view freshness token of the screen it was drawn from (04 §16), never the token at the press.
 */
export type Button = {
  label: string;
  action_key: string;
  target_ids: string[];
  input: object;
  token?: string; // none: no freshness check (a test's hand-made button)
};
/** A cartridge fixture: its canonical JSON text and content hash. */
export type Bundled = { canonical: string; sha256: string };

// ponytail: one fixed world context and seed; a real start draws them per lineage (R6P).
const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const SEED = [1, 2, 3, 4];
// ponytail: no build commit on the phone yet, so the kernel version is marked dirty and no phone
// trace counts as evidence until it comes from the build (ROADMAP R6 SM).
const KERNEL_VERSION = `${KERNEL_ID}@${'0'.repeat(40)}-dirty`;
const ID_PREFIX = '00000000-0000-4000-8000-';

type Say = (key: string) => string;
type Latency = Host['latency'];
type HostPart = Pick<Host, 'newId' | 'latency'>; // its ids and its clock
type Press = Omit<Button, 'token'>;

// The pending choice's available answers and its Close (06 §43: never a trap).
function asked(v: GameView, label: Say): Press[] {
  const c = v.choice;
  const answer = (o: { choice_id: string; label: string }) => ({
    label: label(o.label),
    action_key: 'choose',
    target_ids: [],
    input: { choice_id: o.choice_id, continuation_id: c!.continuation_id },
  });
  return [
    ...(c?.choices.filter((o) => o.available) ?? []).map(answer),
    ...(c?.closable
      ? [{ label: 'Close', action_key: 'close_choice', target_ids: [], input: {} }]
      : []),
  ];
}

// The view's available actions as buttons: place actions that need no input, each open exit as a
// move, each entity's or held item's actions aimed at it, then the pending choice's.
function buttonsOf(v: GameView, label: Say, text: Say): Press[] {
  const button = (a: { action_key: string; label: string }, name: string, id?: string) => ({
    label: `${label(a.label)}${name}`,
    action_key: a.action_key,
    target_ids: id ? [id] : [],
    input: {},
  });
  const place = v.actions.filter((a) => a.available && !a.input.length && a.target.kind === 'none');
  const moves = v.exits.filter((e) => e.available);
  const held = [...v.entities, ...v.inventory].flatMap((e) =>
    e.actions.filter((a) => a.available).map((a) => button(a, ` ${text(e.name)}`, e.id)),
  );
  return [
    ...place.map((a) => button(a, '')),
    ...moves.map((e) => ({
      label: `Go ${e.direction}`,
      action_key: 'move',
      target_ids: [],
      input: { direction: e.direction },
    })),
    ...held,
    ...asked(v, label),
  ];
}

// What one press answers: the narration or the outcome's words (words.ts; none: '') of an accepted
// command, else the refusal in words. Never a raw outcome code.
function said(r: Reply, text: Say): string {
  if (r.kind === 'pending') return '(pending: not confirmed saved; press any button to retry it)';
  if (r.kind === 'stale_view') return 'The page had changed; here it is again.';
  if (r.kind !== 'saved') return `(${r.kind}${'code' in r ? ` ${r.code}` : ''})`;
  const d = r.decision as { kind: string; outcome?: string; narration?: { key: string }[] };
  if (d.kind === 'rejected')
    return `You can't do that: ${reason((r.decision as { error: { code: string } }).error.code)}.`;
  return d.narration?.map((t) => text(t.key)).join(' ') || (OUTCOME[d.outcome!] ?? '');
}

// The log after a press's echo: its answer if it has words, then the new place's name or who came
// or went. A look is a
// read: its fresh page is the answer, so its echo goes too. ponytail: a look that settles a shown
// pending leaves that pending line above (the status line's "save not confirmed" still clears).
function answer(log: string[], reply: Reply, text: Say, comings: string[]) {
  const line = said(reply, text);
  const read =
    reply.kind === 'saved' && (reply.decision as { outcome?: string }).outcome === 'looked';
  if (read) log.pop();
  else if (line) log.push(line);
  log.push(...comings);
}

// After a move, the new place's name: its room log's heading. Else the NPCs that left or arrived
// while the player stayed put. ponytail: inferred from the view; kernel schedule narration replaces it.
function comings(was: GameView, now: GameView, text: Say): string[] {
  if (was.place.id !== now.place.id) return [text(now.place.title.key)];
  const gone = (a: GameView, b: GameView) =>
    a.entities.filter((e) => e.kind === 'npc' && !b.entities.some((f) => f.id === e.id));
  return [
    ...gone(was, now).map((e) => `${text(e.name)} leaves.`),
    ...gone(now, was).map((e) => `${text(e.name)} arrives.`),
  ];
}

// A text key's words, and an action label's. ponytail: the cartridge has no text for most action
// labels yet, so a label shows the key's last word, capitalised as the texted labels are.
const sayers = (c: Cartridge): { text: Say; label: Say } => ({
  text: (key) => c.text[key as Key] ?? key,
  label: (key) =>
    c.text[key as Key] ??
    key
      .replace(/^actions?\./, '')
      .replaceAll('_', ' ')
      .replace(/^./, (a) => a.toUpperCase()),
});

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

function invocationOf(b: Button, n: number, actor: string) {
  const invocation_id = `${ID_PREFIX}${n.toString(16).padStart(12, '0')}`;
  return {
    invocation_id,
    action_key: b.action_key,
    actor_id: actor,
    target_ids: b.target_ids,
    input: b.input,
    ...(b.token && { view_freshness_token: b.token }),
  };
}

// The log's start: the last committed narration again, so a reopen (a crash before display too)
// shows it (06 §43). A corrupt read throws, so the save does not open (and offers start over): a
// corrupt file untyped (replaced), a damaged receipt in an intact file with the new game in place.
type Reread = { narration: () => NarrationRecord | undefined; newGame: () => { kind: string } };
function reread(story: Reread, text: Say): string[] {
  try {
    const last = story.narration();
    return last ? [last.lines.map((t) => text(t.key)).join(' ')] : [];
  } catch (e) {
    if (corrupt(e)) throw e;
    const cause = { kind: 'save_corrupt', newGame: story.newGame };
    throw Object.assign(new Error((e as Error).message), { cause });
  }
}

/**
 * The save in `db` (a new one if empty, its ids from `newId`, a random UUID each call) of the
 * bundled cartridge; open `db` once per process. A save that does not open throws, its refusal
 * (kind and newGame) as the error's cause.
 */
export function openSmoke(db: Db, bundled: Bundled, newId: () => string, latency?: Latency) {
  const cartridge = cartridgeOf(bundled);
  const fresh = newWorld(cartridge, CONTEXT as never, SEED as never);
  const host = { kernel_version: KERNEL_VERSION, newId, latency };
  const story = openStory(db, [{ content_hash: bundled.sha256, fresh }], host);
  if (story.kind !== 'open') throw Object.assign(new Error(story.kind), { cause: story });
  // The unconfirmed attempt, resent unchanged (same id, same intent) until it settles (03 §§14-15).
  let retry: { label: string; invocation: object } | undefined;
  let fault: string | undefined; // the last press's throw, shown with start over beside the retry
  let sent = lastId(db);
  const { text, label } = sayers(cartridge);
  const log = reread(story, text);
  return {
    screen: () => {
      const [view, token] = [gameView(story.world()), story.token()];
      const buttons: Button[] = buttonsOf(view, label, text).map((b) => ({ ...b, token }));
      return { view, text, buttons, log, pending: !!retry, fault };
    },
    press(b: Button): void {
      // While unconfirmed any press retries that attempt, whatever button it was.
      const was = gameView(story.world()); // the view before, for who came or went
      retry ??= { label: b.label, invocation: invocationOf(b, ++sent, story.world().character) };
      log.push(`> ${retry.label}`);
      let reply: Reply;
      try {
        reply = story.invoke(retry.invocation);
      } catch (e) {
        // A throw may follow a durable commit: keep the attempt; a resend replays it (03 §14).
        fault = (e as Error).message;
        log.push(`(not confirmed: ${fault}; the next press retries ${retry.label})`);
        return;
      }
      fault = undefined;
      if (reply.kind !== 'pending') retry = undefined; // before said(): it may throw
      answer(log, reply, text, comings(was, gameView(story.world()), text));
      log.splice(0, log.length - 200); // ponytail: keeps the last 200 lines; the presenter split owns the log
    },
    newGame: story.newGame,
  };
}

/**
 * Why the save is not playable, or why start over failed: the refusal's kind (none for an untyped
 * throw), its message, and how start over may proceed: the refusal's new game, or `replace` the
 * file (a corrupt file, or one whose replacing failed). Neither: no start over.
 */
export type Failed = {
  kind?: string;
  message: string;
  newGame?: () => { kind: string };
  replace?: boolean;
};

/**
 * The game on the save file, or why it does not open, and start over (10 §31: the host has the
 * player confirm first). `open` opens the file (once per process); `remove` closes that handle
 * and deletes the file. Start over is the authority's new game where it offers one: it keeps the
 * file, so the old runs' trace and any pending report survive. A file it cannot repair (NOTADB, a
 * corrupt page: its new game throws as corrupt, or the open throws untyped as corrupt) is replaced.
 * Never started over: a newer app's save (`unsupported_save_format`, update the app, 10 §32) or an
 * open that failed for another reason (a full disk: the save may be intact). A start over that
 * fails otherwise keeps the game being played and says so in its log; one whose outcome is
 * unknown does not (its next press would settle the new game, then apply to it).
 */
export function playSmoke(open: () => Db, remove: () => void, items: Bundled, host: HostPart) {
  const s: { db?: Db; game?: ReturnType<typeof openSmoke>; failed?: Failed } = {};
  const reopen = () => {
    try {
      s.game = openSmoke((s.db ??= open()), items, host.newId, host.latency);
      s.failed = undefined;
    } catch (e) {
      const { message, cause } = e as Error;
      [s.game, s.failed] = [undefined, { ...(cause as Failed), message, replace: corrupt(e) }];
    }
  };
  reopen();
  return {
    game: () => s.game,
    failed: () => s.failed,
    startOver(): void {
      const newGame = s.game?.newGame ?? s.failed?.newGame;
      if (!newGame && !s.failed?.replace) return;
      try {
        if (newGame?.().kind === 'pending') {
          s.game = undefined;
          return void (s.failed = { ...s.failed, message: 'start over not confirmed', newGame });
        }
        if (newGame) return reopen();
      } catch (e) {
        const { message } = e as Error; // in play, logged once: no message outlives the game's state
        if (!corrupt(e) && s.game) return void s.game.screen().log.push(`(start over: ${message})`);
        if (!corrupt(e)) return void (s.failed = { ...s.failed, message });
      }
      try {
        [s.game, s.db] = [undefined, undefined]; // the handle goes with the file
        remove();
        reopen();
      } catch (e) {
        s.failed = { message: (e as Error).message, replace: true };
      }
    },
  };
}
