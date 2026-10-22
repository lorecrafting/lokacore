// The Journal page: the projected quests, the lore (toolbox row 46), then the Chronicle (row FD6).
// Only drawing; what a tap does is passed in by Book.tsx.
import { useState } from 'react';
import { View } from 'react-native';
import { Text } from './Text.tsx';
import type { GameView } from '../../packages/game-view/session.ts';
import { expeditionLine, plain, timeLeft, why } from './model.ts';
import type { Button } from './presenter.ts';
import { note, prose, usePalette, useType } from './palette.ts';
import { ActionCard } from './actions.tsx';
import { AwayRecap, Note } from './lines.tsx';
import { Control, Page, SectionTitle } from './pages.tsx';
import { LABEL } from './labels.ts';
import type { ChronicleDay } from './chronicle.ts';

type JournalProps = Parameters<typeof LoreDetails>[0] & {
  world: () => void;
  chronicle: () => readonly ChronicleDay[];
};

/**
 * The Journal: projected quests, the lore, then the Chronicle (book-ui.md, Chronicle details).
 * - Use: the Contents Journal section; it shows no running head (it lists the same text).
 * - Rules: Chronicle days are AwayRecap headings "Day N", the latest day open.
 * - States: one day; two days, earlier collapsed, a milestone.
 * - Story: SectionPages.stories.tsx
 */
export function JournalPage(p: JournalProps) {
  const { view, text } = p;
  const c = usePalette();
  const t = useType();
  const [days] = useState(p.chronicle); // read once as the Journal opens, never live
  return (
    <Page title="Journal" foot={<Control label={LABEL.backToWorld} onPress={p.world} />}>
      {!view.journal.length && !view.topics?.length && !days.length && (
        <Note>Nothing written yet.</Note>
      )}
      {view.journal.map((q) => (
        <View key={`${q.quest.cartridge_id}@${q.quest.cartridge_version}:${q.quest.key}`}>
          <Text style={prose(c, t)}>{text(q.title)}</Text>
          <Text style={note(c, t)}>{String(q.state).replaceAll('_', ' ')}</Text>
          {q.patrol && (
            <Text style={prose(c, t)}>
              {q.patrol.credit} of {q.patrol.required} checkpoints. {q.patrol.status}.{' '}
              {text(q.patrol.leader_name)} is at {text(q.patrol.room_title)}.{' '}
              {patrolNext(q.patrol, text)}
            </Text>
          )}
          {q.expedition && (
            <Text style={note(c, t)}>
              {q.expedition.cursor} of {q.expedition.required} entries.{' '}
              {expeditionLine(q.expedition, text)} {q.expedition.sheltered ? 'Shelter used.' : ''}
            </Text>
          )}
          {q.journal && <Text style={prose(c, t)}>{plain(text(q.journal))}</Text>}
          {q.hint && <Text style={note(c, t)}>Hint: {plain(text(q.hint))}</Text>}
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
 * "Not here" when this place does not list it. */
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
    ? `Walk ${p.direction} to join him.`
    : p.status === 'paused'
      ? `Return to ${text(p.leader_name)} and choose Rejoin.`
      : p.status === 'failed'
        ? `Return to ${text(p.leader_name)} and choose Restart now.`
        : p.status === 'together'
          ? `Next: ${text(p.next_title)}.`
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
