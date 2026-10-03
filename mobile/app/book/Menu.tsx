// The NPC context menu (U5): a panel over the room page that holds the NPC's actions and, once
// talk is pressed, the pending choice. Book.tsx decides when it is open (model.ts `menuOpen`).
import { useState } from 'react';
import { Text, View } from 'react-native';
import type { GameView } from '../../packages/game-view/session.ts';
import { absent, cap, menuOpen, why, type group } from './model.ts';
import type { Button } from './presenter.ts';
import { paper } from './paper.ts';
import { Act, note, prose, Tap, titleStyle, type Thing } from './pages.tsx';

type Say = (key: string) => string;
type Grouped = ReturnType<typeof group>;

// The pending choice (06 §43): the prompt, each answer (an unavailable one with its reason, not
// pressable) and Close. It blocks nothing: the footer stays usable.
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
      <Text style={prose}>{p.text(p.choice.prompt.key)}</Text>
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

// The menu's state: who was tapped, the choice whose menu was dismissed, and the last answer.
export function useMenu(view: GameView) {
  const [tapped, setTapped] = useState<string>();
  const [dismissed, setDismissed] = useState<string>();
  const [said, say] = useState('');
  return {
    said,
    say,
    open: menuOpen(view, tapped, dismissed),
    npc: view.entities.find((e) => e.id === tapped),
    tap: (id: string) => (setTapped(id), say('')),
    // Hides the menu; a pending choice stays pending (only Close sends close_choice).
    dismiss: () => (setTapped(undefined), setDismissed(view.choice?.continuation_id), say('')),
  };
}

const PANEL = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: paper.bg,
  borderTopWidth: 1,
  borderColor: paper.line,
  padding: 24,
} as const;

// `said`: the last press's answer, kept until dismissed.
// ponytail: no scroll. An iOS 27 ScrollView here blurred its text (the scroll edge effect); a choice
// too long for the screen would need one.
export function Menu(p: {
  view: GameView;
  text: Say;
  g: Grouped;
  press: (b: Button) => string; // what the press said
  menu: ReturnType<typeof useMenu>;
}) {
  const { said, dismiss } = p.menu;
  if (!p.menu.open) return null;
  const { view, text } = p;
  const press = (b: Button) => p.menu.say(p.press(b)); // its answer shows in the menu until dismissed
  // The tapped NPC, else the pending choice's speaker if here (a restored choice has no tap).
  const npc = p.menu.npc ?? view.entities.find((e) => e.id === view.choice?.speaker_id);
  const acts = npc ? p.g.on(npc.id) : [];
  return (
    <View style={PANEL}>
      {npc && (
        <Text style={titleStyle} accessibilityRole="header">
          {cap(text(npc.name))}
        </Text>
      )}
      {said !== '' && <Text style={prose}>{said}</Text>}
      {view.choice && <Choice {...p} choice={view.choice} press={press} />}
      {acts.map((b) => (
        <Act key={b.label} b={b} press={press} />
      ))}
      {!view.choice && acts.length === 0 && said === '' && (
        <Text style={note}>Nothing to do here.</Text>
      )}
      <Tap label="Done" onPress={dismiss}>
        <Text style={{ ...prose, color: paper.dim }}>Done</Text>
      </Tap>
    </View>
  );
}
