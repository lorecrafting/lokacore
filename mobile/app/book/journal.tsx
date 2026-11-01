// The Journal page: the projected quests, the lore (toolbox row 46), then the Chronicle (row FD6).
// Only drawing; what a tap does is passed in by Book.tsx.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from './Text.tsx';
import type { GameView } from '../../packages/game-view/session.ts';
import { plain, timeLeft, why } from './model.ts';
import { expeditionLine } from './words.ts';
import type { Button } from './presenter.ts';
import { note, prose, usePalette, useType } from './palette.ts';
import { ActionCard } from './actions.tsx';
import { onCue } from './cues.ts';
import { GiltLine } from './GiltLine.tsx';
import { AwayRecap, Note } from './lines.tsx';
import { Control, home, Page, SectionTitle } from './pages.tsx';
import { LABEL } from './labels.ts';
import type { ChronicleDay } from './chronicle.ts';

// Quests resolved since the Journal was last open: it is not live, so its gilt waits for the visit.
let resolved: string[] = [];
onCue((cue) => {
  if (cue.name === 'quest_resolved') resolved = [...resolved, ...(cue.ids ?? [])];
});

// Read once as the Journal opens, then spent: a later visit is plain.
function useResolved() {
  const [gilt] = useState(() => resolved);
  useEffect(() => void (resolved = []), []);
  return gilt;
}

const QuestTitle = (p: { gilt: boolean; style: { color: string }; children: string }) =>
  p.gilt ? (
    <GiltLine style={p.style}>{p.children}</GiltLine>
  ) : (
    <Text style={p.style}>{p.children}</Text>
  );

type JournalProps = Parameters<typeof LoreDetails>[0] & {
  world: () => void;
  contents?: () => void;
  chronicle: () => readonly ChronicleDay[];
};

/**
 * The Journal: projected quests, the lore, then the Chronicle (book-ui.md, Chronicle details).
 * - Use: the Contents Journal section; it shows no running head (it lists the same text).
 * - Rules: Chronicle days are AwayRecap headings "Day N", the latest day open; its look is approved
 *   by the designer (loka-kgd.143).
 * - States: one day; two days, earlier collapsed, a milestone.
 * - Story: SectionPages.stories.tsx
 */
export function JournalPage(p: JournalProps) {
  const { view, text } = p;
  const c = usePalette();
  const t = useType();
  const [days] = useState(p.chronicle); // read once as the Journal opens, never live
  const gilt = useResolved();
  return (
    <Page title={LABEL.journal} foot={home(p)}>
      {!view.journal.length && !view.topics?.length && !days.length && (
        <Note>{LABEL.nothingWritten}</Note>
      )}
      {view.journal.map((q) => (
        <View key={`${q.quest.cartridge_id}@${q.quest.cartridge_version}:${q.quest.key}`}>
          <QuestTitle gilt={gilt.includes(q.quest.key)} style={prose(c, t)}>
            {text(q.title)}
          </QuestTitle>
          <Text style={note(c, t)}>{String(q.state).replaceAll('_', ' ')}</Text>
          {q.patrol && (
            <Text style={prose(c, t)}>
              {LABEL.patrolProgress(q.patrol.credit, q.patrol.required, q.patrol.status)}{' '}
              {LABEL.patrolAt(text(q.patrol.leader_name), text(q.patrol.room_title))}{' '}
              {patrolNext(q.patrol, text)}
            </Text>
          )}
          {q.expedition && (
            <Text style={note(c, t)}>
              {LABEL.expeditionProgress(q.expedition.cursor, q.expedition.required)}{' '}
              {expeditionLine(q.expedition, text)} {q.expedition.sheltered ? LABEL.shelterUsed : ''}
            </Text>
          )}
          {q.journal && <Text style={prose(c, t)}>{plain(text(q.journal))}</Text>}
          {q.hint && <Text style={note(c, t)}>{LABEL.hint(plain(text(q.hint)))}</Text>}
          {q.remaining !== undefined && <Text style={note(c, t)}>{timeLeft(q.remaining)}</Text>}
        </View>
      ))}
      <LoreDetails {...p} />
      <Chronicle days={days} />
    </Page>
  );
}

/** The Journal's lore (toolbox row 46; wording pending designer, loka-x6t.14): the known topics, then
 * each deduction's topics and its card: refused with the view's reason when listed here but unavailable,
 * "You can't do that here." when this place does not list it. */
function LoreDetails(p: {
  view: GameView;
  text: (key: string) => string;
  buttons?: Button[];
  press?: (b: Button) => void;
}) {
  const c = usePalette();
  const t = useType();
  if (!p.view.topics?.length) return null;
  return (
    <>
      <SectionTitle>{LABEL.lore}</SectionTitle>
      {p.view.topics.map((k) => (
        <Text key={k.topic.key} style={prose(c, t)}>
          {p.text(k.label)}
        </Text>
      ))}
      {p.view.deductions?.map((d) => {
        const b = p.buttons?.find((x) => x.action_key === d.action);
        const offer = p.view.actions.find((a) => a.action_key === d.action);
        return (
          <View key={d.action}>
            <Text style={note(c, t)}>{d.from.map(p.text).join(' + ')}</Text>
            {b ? (
              <ActionCard b={b} press={p.press!} />
            ) : (
              <ActionCard
                label={p.text(d.label)}
                reason={offer ? why(offer, p.text) : LABEL.notHere}
              />
            )}
          </View>
        );
      })}
    </>
  );
}

type Patrol = NonNullable<GameView['journal'][number]['patrol']>;
const patrolNext = (p: Patrol, text: (t: Patrol['leader_name']) => string) =>
  p.status === 'awaiting'
    ? LABEL.patrolWalk(p.direction)
    : p.status === 'paused'
      ? LABEL.patrolRejoin(text(p.leader_name))
      : p.status === 'failed'
        ? LABEL.patrolRestart(text(p.leader_name))
        : p.status === 'together'
          ? LABEL.patrolNext(text(p.next_title))
          : '';

/** The Chronicle (book-ui.md, Chronicle details). */
function Chronicle({ days }: { days: readonly ChronicleDay[] }) {
  if (!days.length) return null;
  return (
    <>
      <SectionTitle>{LABEL.chronicle}</SectionTitle>
      {days.map((d, i) => (
        <AwayRecap
          key={d.day}
          heading={`${LABEL.day} ${d.day}`}
          open={i === days.length - 1}
          lines={d.lines}
          milestone={(line) => d.milestones.has(line)}
        />
      ))}
    </>
  );
}
