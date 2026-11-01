// A NEW press's reply as the book's lines: its narration routed to the world, a detail page or
// the combat log, plus who came or went and a conversation's journal and prompt changes.
import type { Game, GameView, Reply } from '../../packages/game-view/session.ts';
import { cast, comings, lineText, lineWords, replyLine, spoken, used } from './words.ts';
import { things } from './item-pages.ts';
import {
  arrived,
  closing,
  combatResult,
  detailLines,
  logLines,
  narrationLines,
  quietOf,
  resetLogs,
  savedNarration,
  type DetailLine,
  type Logs,
} from './logs.ts';
import type { Button } from './presenter.ts';
import { commandOf } from './buttons.ts';

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

// Outcomes that send the reader back to World; an accepted Pick list row does too (book-ui.md,
// Pick a second thing).
const CHANGED = ['taken', 'dropped', 'given', 'eaten', 'bandaged'];

export function received(game: Game, reply: Reply, was: GameView, s: Logs, text: Say): string {
  const attempt = s.retry!;
  const now = game.view().view;
  const accepted =
    reply.kind === 'saved' && reply.decision.kind === 'accepted' ? reply.decision : undefined;
  const itemChanged = !!accepted && (!!attempt.button.pick || CHANGED.includes(accepted.outcome));
  const moved = !!accepted && was.place.id !== now.place.id;
  resetLogs(s, now);
  const retained = retainedNarration(game, s, reply, accepted);
  const { pickup, readableDetail, detail } = detailRoute(
    s,
    attempt,
    retained,
    accepted,
    itemChanged,
    now,
  );
  // Every line goes to the room log; a fight or detail page also keeps its own (book-ui.md).
  const page =
    (was.combat || now.combat) && !accepted?.narration?.length
      ? s.combatLog
      : detail &&
          (!itemChanged || !!pickup) &&
          (!moved || accepted?.outcome === 'read' || readableDetail)
        ? detailLines(s, detail)
        : undefined;
  if (s.fault && combatResult(accepted)) return '';
  const repeated = retained && retained.command_id === s.narrationId;
  if (retained) s.narrationId = retained.command_id;
  const routed = retained ? routedLines(retained, was, now, attempt.button, text) : undefined;
  // Empty routed combat narration deliberately stays out of World after escape.
  const fallback = fallbackLine(accepted, attempt);
  const said = routed?.[0] ?? replyLine(reply, text, now, fallback, was);
  if (!repeated) place(s, said, page, accepted, attempt.button.target_ids, detail);
  if (!repeated && routed) s.combatLog.push(...routed[1]);
  if (!repeated && routed) s.log.push(...routed[2]);
  s.log.push(...comings(s.projection.view, now, text, accepted?.events));
  const taught = conversationLines(s, was, now, accepted, attempt.detail, text);
  return repeated ? '' : [...said, ...taught].map(lineText).join(' ');
}

// The narration routed to its logs; a cast in a fight sends its lines to the combat log.
// Read text stays on its page, never in the room log (book-ui.md Notice-board details).
const place = (
  s: Logs,
  said: DetailLine[],
  page: DetailLine[] | undefined,
  accepted: Accepted | undefined,
  target: unknown,
  detail?: string,
) =>
  accepted?.outcome === 'read' && page
    ? page.push(...said)
    : logLines(
        s,
        said,
        page,
        page === s.combatLog ? undefined : quietOf(s, accepted?.narration, target, detail),
      );

const routedLines = (
  retained: Parameters<typeof closing>[0],
  was: GameView,
  now: GameView,
  b: Button,
  text: Say,
) => {
  const lines = (r: typeof retained) =>
    narrationLines(closing(r, was, now, commandOf(b) === 'cast'), now, text, false, was);
  // The room reached logs the lines from its arrival on; the fight page keeps the rest (loka-glj8).
  return [...lines(retained), lines(arrived(retained))[1]] as const;
};

type Accepted = Extract<Extract<Reply, { kind: 'saved' }>['decision'], { kind: 'accepted' }>;

export const telling = ({ payload: e }: Accepted['events'][number]) =>
  (e.type === 'entity_died' && !e.victim_definition) ||
  e.type === 'action_completed' ||
  e.type === 'attack_result' ||
  e.type === 'barrier_changed' ||
  (e.type === 'custom_event' && e.event.key === 'lever');

// The receipt's retained narration, read back from storage when the reply carried any.
export function retainedNarration(game: Game, s: Logs, reply: Reply, accepted?: Accepted) {
  const command_id =
    reply.kind === 'saved' ? (reply.command_id ?? accepted?.events[0]?.causation_id) : undefined;
  const lines = !!accepted?.narration?.length;
  // A death may have no line, and so no retained narration; the Book still falls (book-ui.md, Falling).
  // So may a miss or an opened latch: read for its record's deed only.
  const last =
    lines || accepted?.events.some(telling) ? savedNarration(game, s, command_id) : undefined;
  if (last?.died) s.died = last.command_id;
  if (last?.lever || last?.opened || last?.missed) s.deed = last;
  return lines && (command_id || accepted.outcome !== 'riddle_wrong') ? last : undefined;
}

// A press's item and listener names, for its fallback line (fallbackLine below).
export function named(b: Button, was: GameView) {
  const name = (id?: string) => things(was).find((t) => t.id === id)?.name;
  return b.pick
    ? b.target_ids.map(name)
    : b.action_key === 'whisper'
      ? [undefined, name(b.target_ids[0])] // the speech echo's listener
      : [];
}

const fallbackLine = (
  accepted: Accepted | undefined,
  { item, to, button }: NonNullable<Logs['retry']>,
) =>
  accepted?.outcome === 'spoken'
    ? spoken(button.action_key, (button.input as { word?: unknown }).word, to)
    : button.pick
      ? item && (to ? used(button.label, item, to) : cast(button.label, item))
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
    detailLines(s, detail).push({ text: 'You make a note in your journal.', event: true });
  if (
    now.choice &&
    was.choice?.continuation_id !== now.choice.continuation_id &&
    !accepted?.narration?.some((line) => line.key === now.choice!.prompt.key)
  )
    detailLines(s, now.choice.speaker_id ?? 'conversation').push(
      lineWords(
        { key: now.choice.prompt.key, participants: { speaker: now.choice.speaker_id } },
        text,
        now,
      ),
    );
  const taught = accepted ? skillEvents(was, now, text) : [];
  if (taught.length) logLines(s, taught, detail ? detailLines(s, detail) : undefined);
  return taught; // the reply's own sentence carries them too
}

// A skill the reply taught or raised narrates itself (book-ui.md Line placement, loka-lsqi).
export const skillEvents = (was: GameView, now: GameView, text: Say): DetailLine[] =>
  (was.skills ? (now.skills ?? []) : []).flatMap((n): DetailLine[] => {
    const w = was.skills!.find((k) => k.skill.key === n.skill.key && k.skill.kind === n.skill.kind);
    const name = text(n.label);
    if (n.acquired && !w?.acquired)
      return [{ text: `You learn ${name}.`, event: true, gilt: true }];
    if (w?.acquired && (n.level ?? 0) > (w.level ?? 0))
      return [{ text: `Your ${name} improves.`, event: true, gilt: true }];
    return [];
  });

// Where the reply's lines go: a corpse pickup, the receipt's or button's detail, or a Read target.
function detailRoute(
  s: Logs,
  attempt: NonNullable<Logs['retry']>,
  retained: ReturnType<typeof savedNarration>,
  accepted: Accepted | undefined,
  itemChanged: boolean,
  now: GameView,
) {
  const pickup = retained?.pickup_name ? retained.detail_id : undefined;
  s.returnDetail = pickup;
  // Leaving a present NPC's conversation returns to that NPC's page; an absent speaker's, to World.
  const closed =
    accepted?.outcome === 'choice_closed' && !now.entities.some((e) => e.id === attempt.detail);
  // A Drop keeps a Contents section open (loka-8lpm); other item results go to World.
  s.returnWorld =
    itemChanged && !pickup && accepted?.outcome === 'dropped'
      ? 'section'
      : (itemChanged && !pickup) || closed;
  const readableDetail = retained?.detail_id ?? attempt.button.detail_id;
  const detail =
    pickup ??
    readableDetail ??
    (accepted?.outcome === 'read' ? attempt.button.target_ids[0] : attempt.detail);
  s.confirmedRead = accepted?.outcome === 'read' ? detail : undefined;
  return { pickup, readableDetail, detail };
}
