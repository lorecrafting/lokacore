// The Journal page: the projected quests, the lore (toolbox row 46), then the Chronicle (row FD6).
// Only drawing; what a tap does is passed in by Book.tsx.
import { useState } from 'react';
import { Text, View } from 'react-native';
import type { GameView } from '../../packages/game-view/session.ts';
import { expeditionLine, plain, timeLeft, why } from './model.ts';
import type { Button } from './presenter.ts';
import { note, prose, usePalette } from './palette.ts';
import { ActionCard } from './actions.tsx';
import { AwayRecap, Note } from './lines.tsx';
import { Control, Page, SectionTitle } from './pages.tsx';
import { LABEL } from './labels.ts';
import type { ChronicleDay } from './chronicle.ts';

export function JournalPage(
  p: Parameters<typeof LoreDetails>[0] & {
    world: () => void;
    chronicle: () => readonly ChronicleDay[];
  },
) {
  const { view, text } = p;
  const c = usePalette();
  return (
    <Page title="Journal" foot={<Control label={LABEL.backToWorld} onPress={p.world} />}>
      {view.journal.length === 0 && !view.topics?.length && <Note>Nothing written yet.</Note>}
      {view.journal.map((q) => (
        <View key={`${q.quest.cartridge_id}@${q.quest.cartridge_version}:${q.quest.key}`}>
          <Text style={prose(c)}>{text(q.title)}</Text>
          <Text style={note(c)}>{String(q.state).replaceAll('_', ' ')}</Text>
          {q.patrol && (
            <Text style={prose(c)}>
              {q.patrol.credit} of {q.patrol.required} checkpoints. {q.patrol.status}.{' '}
              {text(q.patrol.leader_name)} is at {text(q.patrol.room_title)}.{' '}
              {q.patrol.status === 'awaiting'
                ? `Walk ${q.patrol.direction} to join him.`
                : q.patrol.status === 'paused'
                  ? `Return to ${text(q.patrol.leader_name)} and choose Rejoin.`
                  : q.patrol.status === 'failed'
                    ? `Return to ${text(q.patrol.leader_name)} and choose Restart now.`
                    : q.patrol.status === 'together'
                      ? `Next: ${text(q.patrol.next_title)}.`
                      : ''}
            </Text>
          )}
          {q.expedition && (
            <Text style={note(c)}>
              {q.expedition.cursor} of {q.expedition.required} entries.{' '}
              {expeditionLine(q.expedition, text)} {q.expedition.sheltered ? 'Shelter used.' : ''}
            </Text>
          )}
          {q.journal && <Text style={prose(c)}>{plain(text(q.journal))}</Text>}
          {q.hint && <Text style={note(c)}>Hint: {plain(text(q.hint))}</Text>}
          {q.remaining !== undefined && <Text style={note(c)}>{timeLeft(q.remaining)}</Text>}
        </View>
      ))}
      <LoreDetails {...p} />
      <Chronicle chronicle={p.chronicle} />
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
  if (!p.view.topics?.length) return null;
  return (
    <>
      <SectionTitle>{LABEL.lore}</SectionTitle>
      {p.view.topics.map((t) => (
        <Text key={t.topic.key} style={prose(c)}>
          {p.text(t.label)}
        </Text>
      ))}
      {p.view.deductions?.map((d) => {
        const b = p.buttons?.find((x) => x.action_key === d.action);
        const offer = p.view.actions.find((a) => a.action_key === d.action);
        return (
          <View key={d.action}>
            <Text style={note(c)}>{d.from.map(p.text).join(' + ')}</Text>
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

/** The Chronicle (book-ui.md, Chronicle details): read once as the Journal opens, never live. */
function Chronicle(p: { chronicle: () => readonly ChronicleDay[] }) {
  const [days] = useState(p.chronicle);
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
          ink={(line) => d.milestones.has(line)}
        />
      ))}
    </>
  );
}
