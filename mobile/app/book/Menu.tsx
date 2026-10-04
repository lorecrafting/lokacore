// NPC/conversation and Contents views use the existing book controls.
import { useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { GameView } from '../../packages/game-view/session.ts';
import { absent, cap, plain, things, why, type group, type Page } from './model.ts';
import type { Button, DetailLine, presenter } from './presenter.ts';
import {
  Act,
  Leave,
  note,
  prose,
  Sheet,
  Tap,
  ThingPage,
  titleStyle,
  type Thing,
} from './pages.tsx';
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

type Screen = ReturnType<ReturnType<typeof presenter>['screen']>;

export function Item(p: {
  id: string;
  screen: Screen;
  g: ReturnType<typeof group>;
  press: (b: Button, detail?: string) => void;
  open: (p: Page) => void;
  world: () => void;
}) {
  const items = things(p.screen.view);
  const thing = items.find((e) => e.id === p.id);
  return (
    <ThingPage
      thing={thing}
      text={p.screen.text}
      actions={p.g.on(p.id)}
      press={p.press}
      contents={items.filter((e) => 'container_id' in e && e.container_id === p.id)}
      open={(id) => p.open({ kind: 'thing', id })}
      leave={p.world}
    />
  );
}

export function NpcDetail(p: {
  screen: Screen;
  g: ReturnType<typeof group>;
  press: (b: Button, detail?: string) => void;
  speaker?: string;
  world: () => void;
}) {
  const { view, text } = p.screen;
  const npc = view.entities.find((e) => e.id === (p.speaker ?? view.choice?.speaker_id));
  const id = npc?.id ?? p.speaker ?? view.choice?.speaker_id ?? 'conversation';
  return (
    <NpcPage
      view={view}
      npc={npc}
      text={text}
      g={p.g}
      log={p.screen.detail(id)}
      press={(b) => p.press(b, id)}
      leave={p.world}
    />
  );
}
