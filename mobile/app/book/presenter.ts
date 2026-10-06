// The book's words and state over a Game (packages/game-view/session.ts): the offered actions as
// buttons, the log of what each press said, and who came or went. The engine returns structured
// results; every sentence here is the app's own (docs/decisions/owner-decision-presenter-split-
// 2026-10-02.md). Plain TypeScript, so any view can replace the React one. It adds no mechanics.
import type { Game, GameView, Reply, GameSubscription } from '../../packages/game-view/session.ts';
import { comings, replyLine, sayers } from './words.ts';
import { actionContext, buttonsOf, intentOf, things } from './model.ts';

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
  token?: string; // none: no freshness check (a test's hand-made button)
  context?: string; // only projected buttons can refresh across an unchanged live update
};

type Say = (key: string) => string;

export type { DetailLine } from './logs.ts';
import {
  narrationLines,
  pickupLine,
  restoredLogs,
  savedNarration,
  resetLogs,
  combatResult,
  type Logs,
} from './logs.ts';

function detailLines(s: Logs, id: string) {
  if (!s.details.has(id)) s.details.set(id, []);
  return s.details.get(id)!;
}

function journalChanged(was: GameView, now: GameView, detail: string) {
  if (
    !was.entities.some((e) => e.id === detail && e.kind === 'npc') &&
    !(was.choice && (was.choice.speaker_id ?? 'conversation') === detail)
  )
    return false;
  return (
    was.journal.length !== now.journal.length ||
    now.journal.some((q, i) => {
      const prior = was.journal[i];
      return (
        !prior ||
        q.state !== prior.state ||
        q.title !== prior.title ||
        q.journal !== prior.journal ||
        q.quest.key !== prior.quest.key ||
        q.quest.cartridge_id !== prior.quest.cartridge_id ||
        q.quest.cartridge_version !== prior.quest.cartridge_version
      );
    })
  );
}

// size: allow 55, receipt-specific Read/recipe routing joins existing item, combat and conversation histories
function received(game: Game, reply: Reply, was: GameView, s: Logs, text: Say): string {
  const attempt = s.retry!;
  const now = game.view().view;
  const accepted =
    reply.kind === 'saved' && reply.decision.kind === 'accepted' ? reply.decision : undefined;
  const itemChanged = !!accepted && ['taken', 'dropped'].includes(accepted.outcome);
  const moved = !!accepted && was.place.id !== now.place.id;
  resetLogs(s, now);
  const command_id =
    reply.kind === 'saved' ? (reply.command_id ?? accepted?.events[0]?.causation_id) : undefined;
  const retained =
    (accepted?.narration?.length || accepted?.outcome === 'taken') &&
    (command_id || accepted.outcome !== 'riddle_wrong')
      ? savedNarration(game, s, command_id)
      : undefined;
  const pickup = retained?.pickup_name ? retained.detail_id : undefined;
  s.returnDetail = pickup;
  s.returnWorld = (itemChanged && !pickup) || accepted?.outcome === 'choice_closed';
  const readableDetail = retained?.detail_id ?? attempt.button.detail_id;
  const detail =
    pickup ??
    readableDetail ??
    (accepted?.outcome === 'read' ? attempt.button.target_ids[0] : attempt.detail);
  s.confirmedRead = accepted?.outcome === 'read' ? detail : undefined;
  const lines =
    (was.combat || now.combat) && !accepted?.narration?.length
      ? s.combatLog
      : detail &&
          (!itemChanged || !!pickup) &&
          (!moved || accepted?.outcome === 'read' || readableDetail)
        ? detailLines(s, detail)
        : s.log;
  if (s.fault && combatResult(accepted)) return '';
  const repeated = retained && retained.command_id === s.narrationId;
  if (retained) s.narrationId = retained.command_id;
  const fallback =
    itemChanged && attempt.item
      ? `You ${accepted?.outcome === 'taken' ? 'pick up' : 'drop'} ${attempt.item}.`
      : accepted?.outcome === 'choice_closed'
        ? ''
        : undefined;
  const routed = retained ? narrationLines(retained, now, text) : undefined;
  const taken = pickupLine(retained, text);
  const line = repeated
    ? ''
    : taken || routed?.[0] || (routed?.[1] ? '' : replyLine(reply, text, now, fallback));
  if (line) lines.push(line);
  if (!repeated && routed?.[1]) s.combatLog.push(routed[1]);
  s.log.push(...comings(s.projection.view, now, text));
  if (accepted && attempt.detail && journalChanged(was, now, attempt.detail))
    detailLines(s, attempt.detail).push({ text: 'Journal updated', event: true });
  if (
    now.choice &&
    was.choice?.continuation_id !== now.choice.continuation_id &&
    !accepted?.narration?.some((line) => line.key === now.choice!.prompt.key)
  )
    detailLines(s, now.choice.speaker_id ?? 'conversation').push(text(now.choice.prompt.key));
  return line;
}

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
  s.log.push(...comings(was, now, text));
  s.projection = update.projection;
  let last: ReturnType<Game['lastNarration']>;
  try {
    last = game.lastNarration();
  } catch (e) {
    s.fault = (e as Error).message;
    return;
  }
  if (last && last.command_id !== s.narrationId) {
    const [narrated, combat] = narrationLines(last, now, text);
    const line = pickupLine(last, text) || narrated;
    if (combat) s.combatLog.push(combat);
    if (line)
      (last.detail_id
        ? detailLines(s, last.detail_id)
        : now.choice
          ? detailLines(s, now.choice.speaker_id ?? 'conversation')
          : s.log
      ).push(line);
    s.narrationId = last.command_id;
  }
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
  const line = s.fault ? '' : received(game, reply, was, s, text);
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
  s.returnDetail = undefined;
  s.confirmedRead = undefined;
  if (!game.pending() && b.action_key === 'give' && b.target_ids.length !== 2) return '';
  const was = game.view().view;
  const item = ['take', 'drop'].includes(b.action_key)
    ? things(was).find((e) => e.id === b.target_ids[0])
    : undefined;
  s.retry ??= {
    button: { ...b, target_ids: [...b.target_ids], input: { ...b.input } },
    detail,
    item: item && text(item.name),
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
    const line = replyLine(reply, text, game.view().view);
    if (line) (was.combat ? s.combatLog : detail ? detailLines(s, detail) : s.log).push(line);
    return line;
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
    return false;
  }
  if (!s.retry || update.invocation_id !== s.retry.invocation) return false;
  finished(game, update.reply, update.before.view, s, text);
  return true;
}

function screen(game: Game, s: Logs, label: Say, text: Say, generation: number) {
  s.log.splice(0, s.log.length - 200);
  s.combatLog.splice(0, s.combatLog.length - 200);
  for (const lines of s.details.values()) lines.splice(0, lines.length - 200);
  const { view, token } = game.view();
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
    detail: (id: string) => s.details.get(id) ?? [],
    pending: s.status.kind === 'pending' || (s.status.kind === 'error' && game.pending()),
    catchingUp: s.status.kind === 'catching_up',
    fault: s.fault,
    returnWorld: s.returnWorld,
    returnDetail: s.returnDetail,
    confirmedRead: s.confirmedRead,
  };
}

/** World/detail logs, buttons and presses for one game. */
export function presenter(game: Game) {
  const { text, label } = sayers(game);
  const s = restoredLogs(game, text);
  let generation = 0; // Player receipts invalidate old controls even if the context cycles back.
  return {
    screen: () => screen(game, s, label, text, generation),
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
    startOverFailed(why?: string) {
      if (why !== undefined) s.log.push(`(start over: ${why})`);
    },
  };
}
