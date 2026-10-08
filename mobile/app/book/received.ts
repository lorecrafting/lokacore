// A NEW press's reply as the book's lines: its narration routed to the world, a detail page or
// the combat log, plus who came or went and a conversation's journal and prompt changes.
import type { Game, GameView, Reply } from '../../packages/game-view/session.ts';
import { comings, replyLine } from './words.ts';
import {
  combatResult,
  detailLines,
  narrationLines,
  pickupLine,
  resetLogs,
  savedNarration,
  type Logs,
} from './logs.ts';

type Say = (key: string) => string;

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

export function received(game: Game, reply: Reply, was: GameView, s: Logs, text: Say): string {
  const attempt = s.retry!;
  const now = game.view().view;
  const accepted =
    reply.kind === 'saved' && reply.decision.kind === 'accepted' ? reply.decision : undefined;
  const itemChanged =
    !!accepted && ['taken', 'dropped', 'eaten', 'bandaged'].includes(accepted.outcome);
  const moved = !!accepted && was.place.id !== now.place.id;
  resetLogs(s, now);
  const retained = retainedNarration(game, s, reply, accepted);
  const { pickup, readableDetail, detail } = detailRoute(
    s,
    attempt,
    retained,
    accepted,
    itemChanged,
  );
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
  const routed = retained ? narrationLines(retained, now, text) : undefined;
  const taken = pickupLine(retained, text);
  // Empty routed combat narration deliberately stays out of World after escape.
  const fallback = fallbackLine(itemChanged, accepted, attempt.item);
  const line = repeated ? '' : taken || (routed?.[0] ?? replyLine(reply, text, now, fallback));
  if (line) lines.push(line);
  if (!repeated && routed?.[1]) s.combatLog.push(routed[1]);
  s.log.push(...comings(s.projection.view, now, text));
  conversationLines(s, was, now, accepted, attempt.detail, text);
  return line;
}

type Accepted = Extract<Extract<Reply, { kind: 'saved' }>['decision'], { kind: 'accepted' }>;

// The receipt's retained narration, read back from storage when the reply carried any.
function retainedNarration(game: Game, s: Logs, reply: Reply, accepted?: Accepted) {
  const command_id =
    reply.kind === 'saved' ? (reply.command_id ?? accepted?.events[0]?.causation_id) : undefined;
  return (accepted?.narration?.length || accepted?.outcome === 'taken') &&
    (command_id || accepted.outcome !== 'riddle_wrong')
    ? savedNarration(game, s, command_id)
    : undefined;
}

const fallbackLine = (itemChanged: boolean, accepted?: Accepted, item?: string) =>
  itemChanged && accepted?.outcome !== 'eaten' && item
    ? `You ${accepted?.outcome === 'taken' ? 'pick up' : 'drop'} ${item}.`
    : accepted?.outcome === 'choice_closed'
      ? ''
      : undefined;

// A changed journal notes itself on the speaker's page; a new choice prompt joins its speaker's.
function conversationLines(
  s: Logs,
  was: GameView,
  now: GameView,
  accepted: Accepted | undefined,
  detail: string | undefined,
  text: Say,
) {
  if (accepted && detail && journalChanged(was, now, detail))
    detailLines(s, detail).push({ text: 'Journal updated', event: true });
  if (
    now.choice &&
    was.choice?.continuation_id !== now.choice.continuation_id &&
    !accepted?.narration?.some((line) => line.key === now.choice!.prompt.key)
  )
    detailLines(s, now.choice.speaker_id ?? 'conversation').push(text(now.choice.prompt.key));
}

// Where the reply's lines go: a corpse pickup, the receipt's or button's detail, or a Read target.
function detailRoute(
  s: Logs,
  attempt: NonNullable<Logs['retry']>,
  retained: ReturnType<typeof savedNarration>,
  accepted: Accepted | undefined,
  itemChanged: boolean,
) {
  const pickup = retained?.pickup_name ? retained.detail_id : undefined;
  s.returnDetail = pickup;
  s.returnWorld = (itemChanged && !pickup) || accepted?.outcome === 'choice_closed';
  const readableDetail = retained?.detail_id ?? attempt.button.detail_id;
  const detail =
    pickup ??
    readableDetail ??
    (accepted?.outcome === 'read' ? attempt.button.target_ids[0] : attempt.detail);
  s.confirmedRead = accepted?.outcome === 'read' ? detail : undefined;
  return { pickup, readableDetail, detail };
}
