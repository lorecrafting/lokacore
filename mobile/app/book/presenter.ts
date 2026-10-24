// The book's words and state over a Game (packages/game-view/session.ts): the offered actions as
// buttons, the log of what each press said, and who came or went. The engine returns structured
// results; every sentence here is the app's own (docs/decisions/owner-decision-presenter-split-
// 2026-10-02.md). Plain TypeScript, so any view can replace the React one. It adds no mechanics.
import type {
  Game,
  GameView,
  Reply,
  GameSubscription,
  NarrationRecord,
} from '../../packages/game-view/session.ts';
import { comings, lineText, replyLine, sayers } from './words.ts';
import { actionContext, buttonsOf, intentOf } from './model.ts';

/**
 * A tappable action: its text and the intent it sends (the session adds id and actor), with the
 * drawn freshness token and action context, revalidated before a fresh press (Book UI).
 */
export type Button = {
  label: string;
  action_key: string;
  command?: string; // semantic display metadata; invocation retains its authored key
  target_ids: string[];
  input: object;
  detail_id?: string; // UI owner only; concrete participants retain their wire target contract
  place?: true; // a concrete target offered among GameView's place actions
  pick?: { reason?: string }; // a row of a Pick list (pick.ts); with a reason, its unavailable form
  token?: string; // none: no freshness check (a test's hand-made button)
  context?: string; // only projected buttons can refresh across an unchanged live update
};

/** A card's identity, its React key: two offers that share a label (two Talk dialogues) stay two. */
export const cardKey = (b: Button) =>
  [b.action_key, b.target_ids.join(','), JSON.stringify(b.input)].join(':');

type Say = (key: string) => string;

export type { DetailLine } from './logs.ts';
import {
  cueLines,
  closedLog,
  closing,
  detailLines,
  visit,
  leaveLog,
  logLines,
  narrationLines,
  resetLogs,
  restoredLogs,
  type Logs,
} from './logs.ts';
import { named, received } from './received.ts';
import { days } from './chronicle.ts';
import { grouped, holding, pressedAway, settle } from './recap.ts';

function background(
  game: Game,
  update: Extract<GameSubscription, { kind: 'state' }>,
  s: Logs,
  text: Say,
) {
  s.status = update.status;
  s.returnWorld = false;
  s.returnDetail = undefined;
  if (update.status.kind === 'error') s.fault = update.status.message;
  if (update.status.kind === 'fault') s.fault = `Time stopped: ${update.status.code}`;
  if (update.status.kind === 'replaced') s.fault = 'This game has been replaced; reopen it.';
  if (s.projection.token === update.projection.token) return;
  const was = s.projection.view,
    now = update.projection.view;
  resetLogs(s, now);
  const away = holding(s, was, now);
  world(s, away, comings(was, now, text));
  s.projection = update.projection;
  let last: ReturnType<Game['lastNarration']>;
  try {
    last = game.lastNarration();
  } catch (e) {
    s.fault = (e as Error).message;
    return;
  }
  if (last && last.command_id !== s.narrationId)
    narrate(s, closing(last, was, now), was, now, away, text);
}

// World entries: to the log, or held by the open settlement (book-ui.md, Away recap).
function world(s: Logs, away: Logs['away'], lines: string[]) {
  (away?.log ?? s.log).push(...lines);
}

// A new receipt's lines: World (or the open settlement's lines), and its detail or conversation.
function narrate(
  s: Logs,
  last: NarrationRecord,
  was: GameView,
  now: GameView,
  away: Logs['away'],
  text: Say,
) {
  const [lines, combat] = narrationLines(last, now, text, false, was);
  s.combatLog.push(...combat);
  s.narrationId = last.command_id;
  if (!last.read) world(s, away, [...lines, ...combat]); // Read text: its page only
  if (!lines.length) return;
  const to = last.detail_id
    ? detailLines(s, last.detail_id)
    : now.choice && detailLines(s, now.choice.speaker_id ?? 'conversation');
  to?.push(...lines);
}

const confirmed = (reply: Reply) =>
  reply.kind === 'saved' && ['accepted', 'rejected'].includes(reply.decision.kind);

function finished(game: Game, reply: Reply, was: GameView, s: Logs, text: Say) {
  s.fault =
    reply.kind === 'save_corrupt'
      ? reply.message
      : reply.kind === 'fault'
        ? `Time stopped: ${reply.code}`
        : reply.kind === 'saved' && reply.decision.kind === 'fault'
          ? `Time stopped: ${reply.decision.code}`
          : undefined;
  closedLog(s, reply.kind === 'saved' && reply.decision.kind === 'accepted');
  const line = s.fault ? '' : received(game, reply, was, s, text);
  if (!s.fault) s.log.push(...cueLines(s, game.view().view, text));
  if (s.fault) {
    s.returnWorld = false;
    s.returnDetail = undefined;
  }
  s.projection = game.view();
  s.status =
    reply.kind === 'save_corrupt'
      ? { kind: 'error', reason: 'save_corrupt', message: reply.message }
      : reply.kind === 'fault'
        ? reply
        : reply.kind === 'saved' && reply.decision.kind === 'fault'
          ? { kind: 'fault', code: reply.decision.code }
          : { kind: 'ready' };
  s.recovered = confirmed(reply) && !s.fault;
  s.retry = undefined;
  return line;
}

function liveButton(game: Game, b: Button, label: Say, text: Say, generation: number): Button {
  const { view, token } = game.view();
  return b.token &&
    b.token !== token &&
    !game.pending() &&
    b.context &&
    b.context === actionContext(view, b, generation) &&
    buttonsOf(view, label, text).some(
      (offered) => actionContext(view, offered, generation) === b.context,
    )
    ? { ...b, token }
    : b;
}

function pressed(game: Game, b: Button, detail: string | undefined, s: Logs, text: Say): string {
  s.returnWorld = s.recovered = false;
  pressedAway(s); // the recap opens the page after an absence and goes with the next press
  s.returnDetail = s.confirmedRead = undefined;
  if (!game.pending() && b.action_key === 'give' && b.target_ids.length !== 2) return '';
  const was = game.view().view;
  const [item, to] = named(b, was);
  s.retry ??= {
    button: { ...b, target_ids: [...b.target_ids], input: { ...b.input } },
    detail,
    item: item && text(item),
    to: to && text(to),
  };
  let reply: Reply;
  try {
    reply = game.invoke(intentOf(b));
  } catch (e) {
    s.fault = (e as Error).message;
    s.status = { kind: 'error', message: s.fault };
    s.retry.invocation = game.pendingInvocation();
    return '';
  }
  if (game.pending() && reply.kind !== 'pending' && reply.kind !== 'catching_up') {
    const lines = replyLine(reply, text, game.view().view, undefined, was);
    logLines(s, lines, was.combat ? s.combatLog : detail ? detailLines(s, detail) : undefined);
    return lines.map(lineText).join(' ');
  }
  if (reply.kind === 'pending' || reply.kind === 'catching_up') {
    s.retry.invocation =
      reply.kind === 'catching_up' ? reply.invocation_id : game.pendingInvocation();
    s.recovered = reply.kind === 'catching_up' && ['ready', 'catching_up'].includes(s.status.kind);
    s.status = { kind: reply.kind };
    if (s.recovered) s.fault = undefined;
    return '';
  }
  // Prerequisite state notifications have already consumed ambient changes at the settled frame.
  return finished(game, reply, s.projection.view, s, text);
}

function updated(game: Game, update: GameSubscription, s: Logs, text: Say): boolean {
  s.recovered = false;
  if (update.kind === 'state') {
    background(game, update, s, text);
    settle(s);
    // Cues are present tense: never held for the away recap; they log once it settles.
    if (!s.away) s.log.push(...cueLines(s, s.projection.view, text));
    return false;
  }
  if (!s.retry || update.invocation_id !== s.retry.invocation) return false;
  finished(game, update.reply, update.before.view, s, text);
  return true;
}

// What the live region reads (loka-x6t.43, book-ui.md Announcements): the room log's lines new
// since the last screen, never history or another log; `key` changes per batch, so a repeated
// line is read again, and a quiet line merged into the last one is read in full each time.
type Said = { log: number; place: string; key: number; text: string };
function heard(s: Logs, view: GameView, was: Said | undefined): Said {
  const now = { log: s.log.length, place: view.place.id };
  was ??= { ...now, key: 0, text: '' };
  // A room change empties its log first (resetLogs), so all of it is new.
  const fresh = [...(s.merged ?? []), ...s.log.slice(now.place === was.place ? was.log : 0)].map(
    (l) =>
      typeof l === 'string'
        ? l
        : 'reason' in l
          ? `${l.reason}, ${l.text}`
          : 'plain' in l
            ? l.plain
            : l.text,
  );
  s.merged = undefined;
  return fresh.length ? { ...now, key: was.key + 1, text: fresh.join(' ') } : { ...was, ...now };
}

function screen(game: Game, s: Logs, label: Say, text: Say, generation: number, was?: Said) {
  const { view, token } = game.view();
  const said = heard(s, view, was); // before the trim, which drops lines from the front
  s.log.splice(0, s.log.length - 200);
  s.combatLog.splice(0, s.combatLog.length - 200);
  for (const lines of s.details.values()) lines.splice(0, lines.length - 200);
  said.log = s.log.length;
  const buttons: Button[] = buttonsOf(view, label, text).map((b) => ({
    ...b,
    token,
    context: actionContext(view, b, generation),
  }));
  return {
    view,
    text,
    label,
    buttons,
    log: s.log,
    combatLog: s.combatLog,
    said,
    recap: s.recap && grouped(s.recap),
    chronicle: () => days(game.chronicle(), view, text), // read when the Journal opens
    detail: (id: string) => s.details.get(id) ?? [],
    leave: (id: string) => leaveLog(s, id, game.view().view.choice?.speaker_id === id),
    pending: s.status.kind === 'pending' || (s.status.kind === 'error' && game.pending()),
    catchingUp: s.status.kind === 'catching_up',
    fault: s.fault,
    returnWorld: s.returnWorld,
    returnDetail: s.returnDetail,
    confirmedRead: s.confirmedRead,
    ended: s.ended,
  };
}

/** World/detail logs, buttons and presses for one game. */
export function presenter(game: Game) {
  const { text, label } = sayers(game);
  const s = restoredLogs(game, text);
  let generation = 0; // Player receipts invalidate old controls even if the context cycles back.
  let said: Said | undefined;
  return {
    screen: () => {
      const shown = screen(game, s, label, text, generation, said);
      said = shown.said;
      return shown;
    },
    update: (update: GameSubscription) => {
      const terminal = updated(game, update, s, text);
      if (terminal && s.recovered) generation++;
      return terminal;
    },
    recovered: () => !!s.recovered,
    // A pending retry keeps the original detail, even when retried from the world.
    press: (b: Button, detail?: string) => {
      const line = pressed(game, liveButton(game, b, label, text, generation), detail, s, text);
      if (s.recovered) generation++;
      return line;
    },
    leaveCombat: () => (s.ended = undefined),
    visit: (open: (string | undefined)[]) => visit(s, open),
    startOverFailed(why?: string) {
      if (why !== undefined) s.log.push(`(start over: ${why})`);
    },
  };
}
