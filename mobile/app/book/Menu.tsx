// NPC/conversation, position and Contents views use the existing book controls.
import { ScrollView, Text, View } from 'react-native';
import type { GameView } from '../../packages/game-view/session.ts';
import { absent, cap, why, type group } from './model.ts';
import type { Button } from './presenter.ts';
import { Act, Leave, note, prose, Sheet, Tap, titleStyle, type Thing } from './pages.tsx';
import { paper } from './paper.ts';
type Say = (key: string) => string;
type Grouped = ReturnType<typeof group>;

// The pending choice (06 §43): the prompt, each answer (an unavailable one with its reason, not
// pressable) and Close, inside the full NPC/conversation detail page.
function Choice(p: {
  view: GameView;
  choice: NonNullable<GameView['choice']>;
  text: Say;
  g: Grouped;
  press: (b: Button) => void;
}) {
  const answer = (id: string) =>
    p.g.choice.find((b) => (b.input as { choice_id?: string }).choice_id === id);
  const close = p.g.choice.find((b) => b.action_key === 'close_choice');
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
      {close && <Act b={close} press={p.press} />}
    </View>
  );
}

export function NpcPage(p: {
  view: GameView;
  npc?: Thing;
  text: Say;
  g: Grouped;
  press: (b: Button) => void;
  log: string[];
  leave: () => void;
}) {
  const choice =
    p.view.choice && (!p.npc || p.npc.id === p.view.choice.speaker_id) ? p.view.choice : undefined;
  const actions = p.npc ? p.g.on(p.npc.id) : [];
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ ...titleStyle, fontSize: 32, padding: 24 }} accessibilityRole="header">
        {p.npc ? cap(p.text(p.npc.name)) : 'Conversation'}
      </Text>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24 }}>
        {p.log.length > 0 && <Text style={prose}>{p.log.join('\n')}</Text>}
        {!choice && !actions.length && !p.log.length && (
          <Text style={note}>Nothing to do here.</Text>
        )}
      </ScrollView>
      <View style={{ padding: 24 }}>
        {choice && <Choice {...p} choice={choice} />}
        {actions.map((b) => (
          <Act key={b.label} b={b} press={p.press} />
        ))}
        <Leave leave={p.leave} />
      </View>
    </View>
  );
}

export function PositionPage(p: {
  current?: GameView['position'];
  actions: Button[];
  press: (b: Button) => void;
}) {
  return (
    <Sheet title="Position">
      {p.current && <Text style={prose}>{cap(p.current)}</Text>}
      {p.actions.map((b) => (
        <Act key={b.action_key} b={b} press={p.press} />
      ))}
    </Sheet>
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
