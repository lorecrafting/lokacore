// NPC/conversation and Contents views use the existing book controls.
import { useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { GameView } from '../../packages/game-view/session.ts';
import { absent, cap, plain, why, type group } from './model.ts';
import type { Button, DetailLine } from './presenter.ts';
import { Act, Leave, note, prose, Sheet, Tap, titleStyle, type Thing } from './pages.tsx';
import { paper } from './paper.ts';
type Say = (key: string) => string;
type Grouped = ReturnType<typeof group>;

// The pending choice (06 §43): the prompt, each answer (an unavailable one with its reason, not
// pressable), inside the full NPC/conversation detail page.
function Choice(p: {
  view: GameView;
  choice: NonNullable<GameView['choice']>;
  text: Say;
  g: Grouped;
  press: (b: Button) => void;
}) {
  const answer = (id: string) =>
    p.g.choice.find((b) => (b.input as { choice_id?: string }).choice_id === id);
  return (
    <View style={{ marginTop: 12 }}>
      {absent(p.view) !== '' && <Text style={note}>{absent(p.view)}</Text>}
      {p.choice.choices.map((o) => {
        const b = answer(o.choice_id);
        return b ? (
          <Act key={o.choice_id} b={b} press={p.press} />
        ) : (
          <Text key={o.choice_id} style={note}>{`${p.text(o.label)}: ${why(o, p.text)}`}</Text>
        );
      })}
    </View>
  );
}

type NpcProps = {
  view: GameView;
  npc?: Thing;
  text: Say;
  g: Grouped;
  press: (b: Button) => void;
  log: DetailLine[];
  leave: () => void;
};

export function NpcPage(p: NpcProps) {
  const choice =
    p.view.choice && (!p.npc || p.npc.id === p.view.choice.speaker_id) ? p.view.choice : undefined;
  const actions = p.npc ? p.g.on(p.npc.id) : [];
  const close = choice && p.g.choice.find((b) => b.action_key === 'close_choice');
  const scroll = useRef<ScrollView>(null);
  const description = p.npc?.description;
  return (
    <ScrollView
      ref={scroll}
      style={{ flex: 1, backgroundColor: paper.bg }}
      contentContainerStyle={{ padding: 24 }}
      onContentSizeChange={() => {
        if (p.log.length) scroll.current?.scrollToEnd({ animated: false });
      }}
    >
      <Text style={{ ...titleStyle, fontSize: 32 }} accessibilityRole="header">
        {p.npc ? cap(p.text(p.npc.name)) : 'Conversation'}
      </Text>
      {description && <Text style={prose}>{plain(p.text(description))}</Text>}
      {p.log.map((line, i) => (
        <Text key={i} style={typeof line === 'string' ? prose : { ...note, fontStyle: 'italic' }}>
          {typeof line === 'string' ? line : line.text}
        </Text>
      ))}
      {!choice && !actions.length && !p.log.length && <Text style={note}>Nothing to do here.</Text>}
      {choice && <Choice {...p} choice={choice} />}
      {actions.map((b) => (
        <Act key={b.label} b={b} press={p.press} />
      ))}
      <Leave leave={close ? () => p.press({ ...close, label: 'Leave' }) : p.leave} />
    </ScrollView>
  );
}

export type Section = 'character' | 'carrying' | 'map' | 'journal' | 'settings';
const SECTIONS: [Section, string][] = [
  ['character', 'Character'],
  ['carrying', 'Equipment & Inventory'],
  ['map', 'Map'],
  ['journal', 'Journal'],
  ['settings', 'Settings'],
];
export function ContentsPage(p: { open: (section: Section) => void }) {
  return (
    <Sheet title="Contents">
      {SECTIONS.map(([kind, label]) => (
        <Tap key={kind} label={label} onPress={() => p.open(kind)}>
          <Text style={{ ...prose, color: paper.accent }}>{label}</Text>
        </Tap>
      ))}
    </Sheet>
  );
}
