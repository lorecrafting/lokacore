// NPC/conversation and Contents views use the existing book controls.
import { useRef, useState } from 'react';
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
      {p.choice.riddle?.attempts && (
        <Text style={note}>
          {p.choice.riddle.attempts.count} / {p.choice.riddle.attempts.limit} wrong answers this
          sitting.
        </Text>
      )}
      {absent(p.view) !== '' && <Text style={note}>{absent(p.view)}</Text>}
      {p.choice.choices.map((o) => {
        const b = answer(o.choice_id);
        if (p.choice.riddle?.choice_id === o.choice_id)
          return b ? (
            <Riddle
              key={`${p.choice.continuation_id}:${p.choice.speaker_id}:${p.choice.riddle.bank.join('')}`}
              bank={p.choice.riddle.bank}
              button={b}
              press={p.press}
            />
          ) : (
            <Text key={o.choice_id} style={note}>{`${p.text(o.label)}: ${why(o, p.text)}`}</Text>
          );
        return b ? (
          <Act key={o.choice_id} b={b} press={p.press} />
        ) : (
          <Text key={o.choice_id} style={note}>{`${p.text(o.label)}: ${why(o, p.text)}`}</Text>
        );
      })}
    </View>
  );
}

// Tile indices preserve multiplicity; only the bounded submitted word crosses the session boundary.
// size: allow 45, bounded tile editing and submission share one local buffer
function Riddle(p: { bank: readonly string[]; button: Button; press: (b: Button) => void }) {
  const [selected, setSelected] = useState<number[]>([]);
  const answer = selected.map((i) => p.bank[i]).join('');
  return (
    <View>
      <Text style={prose}>{answer || 'Choose letters to answer.'}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {p.bank.map((letter, i) => (
          <View key={i}>
            {selected.includes(i) ? (
              <Text style={note}>{letter}</Text>
            ) : (
              <Tap
                label={`Letter ${letter}, tile ${i + 1}`}
                onPress={() => setSelected((s) => (s.includes(i) ? s : [...s, i]))}
              >
                <Text style={{ ...prose, color: paper.accent }}>{letter}</Text>
              </Tap>
            )}
          </View>
        ))}
      </View>
      {selected.length > 0 && (
        <View>
          <Tap label="Backspace" onPress={() => setSelected((s) => s.slice(0, -1))}>
            <Text style={prose}>Backspace</Text>
          </Tap>
          <Tap label="Clear" onPress={() => setSelected([])}>
            <Text style={prose}>Clear</Text>
          </Tap>
          <Act
            b={{ ...p.button, label: 'Submit', input: { ...p.button.input, answer } }}
            press={(b) => {
              p.press(b);
              setSelected([]);
            }}
          />
        </View>
      )}
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
      {p.view.skills
        ?.filter(
          (s) =>
            p.npc &&
            'lessons' in p.npc &&
            p.npc.lessons?.some(
              (r) =>
                r.cartridge_id === s.skill.cartridge_id &&
                r.cartridge_version === s.skill.cartridge_version &&
                r.kind === s.skill.kind &&
                r.key === s.skill.key,
            ),
        )
        .map((s) => (
          <Text key={s.skill.key} style={note}>
            {p.text(s.label)}: {s.acquired ? 'learned' : 'not learned'}; currently{' '}
            {s.qualified ? 'qualified' : 'unqualified'}. {p.text(s.requirement)}
          </Text>
        ))}
      {!choice && !actions.length && !p.log.length && <Text style={note}>Nothing to do here.</Text>}
      {!choice && <ShopOptions {...p} />}
      {choice && <Choice {...p} choice={choice} />}
      {actions
        .filter((b) => b.command !== 'use_service')
        .map((b) => (
          <Act key={b.label} b={b} press={p.press} />
        ))}
      <ServiceOptions {...p} actions={actions} />
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
  back?: () => void;
}) {
  const items = things(p.screen.view);
  const thing = items.find((e) => e.id === p.id);
  return (
    <ThingPage
      thing={thing}
      text={p.screen.text}
      actions={p.g.on(p.id)}
      log={p.screen.detail(p.id)}
      press={(b) => p.press(b, p.id)}
      contents={items.filter((e) => 'container_id' in e && e.container_id === p.id)}
      open={(id) => p.open({ kind: 'thing', id })}
      leave={p.world}
      back={thing && 'container_id' in thing ? p.back : undefined}
    />
  );
}

function ShopOptions(p: NpcProps) {
  return (
    <>
      {p.npc &&
        'shop' in p.npc &&
        p.npc.shop?.map((o) => (
          <Text key={o.item_id} style={note}>
            {p.text(o.name)}: Buy {o.buy.price}p
            {o.buy.available
              ? ''
              : ` (${o.buy.reason === 'not_owned' ? 'sold out' : o.buy.reason?.replaceAll('_', ' ')})`}
            ; Sell {o.sell.price}p
            {o.sell.available ? '' : ` (${o.sell.reason?.replaceAll('_', ' ')})`}.
          </Text>
        ))}
    </>
  );
}

function ServiceOptions(p: NpcProps & { actions: Button[] }) {
  const offers = p.npc && 'services' in p.npc ? p.npc.services : undefined;
  return offers?.map((s) => {
    const b = p.actions.find((b) => b.action_key === s.action.action_key);
    return b ? (
      <Act key={s.service.key} b={b} press={p.press} />
    ) : (
      <Text key={s.service.key} style={note}>
        {p.text(s.label)}: {s.price}p
        {s.benefit.kind === 'entitlement' ? '' : `; up to +${s.benefit.amount} MV, capped`}
        {!s.action.available && ` (${why(s.action, p.text)})`}
      </Text>
    );
  });
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
