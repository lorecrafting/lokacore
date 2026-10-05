// size: allow 325, established book pages with projected notice entries
// The book's pages: room, a thing's page, and the Character / Journal / Carrying pages. Each is
// only drawing; what a tap does is passed in by Book.tsx.
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { GameView } from '../../packages/game-view/session.ts';
import { bandPhrase, cap, plain, why, type group, type Pool, type Thing } from './model.ts';
import type { Button, DetailLine } from './presenter.ts';
import { body, head, paper } from './paper.ts';
import { reason } from './words.ts';

type Say = (key: string) => string;
type Grouped = ReturnType<typeof group>;
export type { Thing } from './model.ts';

// Tones are projected by the kernel from the cartridge's band table.
export const band = (tone: Pool['tone']): string =>
  ({ normal: paper.fg, warning: paper.mid, danger: paper.accent })[tone];

export const prose = { fontFamily: body, fontSize: 18, lineHeight: 28, color: paper.fg };
export const titleStyle = { fontFamily: head, fontSize: 26, color: paper.fg, paddingBottom: 10 };
export const note = { ...prose, color: paper.dim };
export const scrollPaper = { backgroundColor: paper.bg };

export function Tap(p: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={p.label}
      onPress={p.onPress}
      style={{ minHeight: 44, justifyContent: 'center' }}
    >
      {p.children}
    </Pressable>
  );
}

export function Act({ b, press }: { b: Button; press: (b: Button) => void }) {
  return (
    <Tap label={b.label} onPress={() => press(b)}>
      <Text style={{ ...prose, color: paper.accent }}>{b.label}</Text>
    </Tap>
  );
}

export function Leave(p: { leave: () => void }) {
  return (
    <Tap label="Leave" onPress={p.leave}>
      <Text style={{ ...prose, color: paper.accent }}>Leave</Text>
    </Tap>
  );
}

// The place: its title (a tap looks), description, who and what is here, its own actions (an
// offered quest among them) and the log. NPCs open full details, as items do.
// size: allow 50, room layout retains local detail entries and ordinary place actions
export function RoomPage(p: {
  view: GameView;
  text: Say;
  log: string[];
  g: Grouped;
  press: (b: Button) => void;
  open: (id: string) => void;
  openChoice: () => void;
  details: ReactNode;
}) {
  const title = (
    <Text style={{ ...titleStyle, textAlign: 'center' }}>{p.text(p.view.place.title.key)}</Text>
  );
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
        {p.g.look ? (
          <Tap label={`Look, ${p.text(p.view.place.title.key)}`} onPress={() => p.press(p.g.look!)}>
            {title}
          </Tap>
        ) : (
          title
        )}
      </View>
      <ScrollView style={[{ flex: 1 }, scrollPaper]} contentContainerStyle={{ padding: 24 }}>
        <Text style={prose}>{plain(p.text(p.view.place.description.key))}</Text>
        <Here view={p.view} text={p.text} open={p.open} />
        {p.view.choice && !p.view.entities.some((e) => e.id === p.view.choice!.speaker_id) && (
          <Tap label="Continue conversation" onPress={p.openChoice}>
            <Text style={{ ...prose, color: paper.accent }}>Continue conversation</Text>
          </Tap>
        )}
        {p.details}
        {p.g.place
          .filter(
            (b) =>
              ![
                ...(p.view.notices ?? []),
                ...(p.view.notice_boards ?? []).flatMap((board) => board.notices),
              ].some((n) => b.target_ids.includes(n.id)),
          )
          .map((b) => (
            <Act key={`${b.label}:${b.target_ids.join(',')}`} b={b} press={p.press} />
          ))}
        {p.log.length > 0 && <Text style={{ ...prose, marginTop: 12 }}>{p.log.join('\n')}</Text>}
      </ScrollView>
    </View>
  );
}

function Here(p: { view: GameView; text: Say; open: (id: string) => void }) {
  return p.view.entities.map((e) => {
    const name = p.text(e.name);
    return (
      <Tap key={e.id} label={`${name}, open`} onPress={() => p.open(e.id)}>
        <Text style={prose}>
          <Text style={{ fontWeight: '500', textDecorationLine: 'underline' }}>{cap(name)}</Text> is
          here.
        </Text>
      </Tap>
    );
  });
}

export function Sheet({ title, children }: { title: string; children: ReactNode }) {
  return (
    <ScrollView style={scrollPaper} contentContainerStyle={{ padding: 24, gap: 8 }}>
      <Text style={{ ...titleStyle, fontSize: 32 }} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </ScrollView>
  );
}

export function ThingPage(p: {
  thing?: Thing;
  text: Say;
  actions: Button[];
  log: DetailLine[];
  press: (b: Button) => void;
  contents: Thing[];
  open: (id: string) => void;
  leave: () => void;
}) {
  return (
    <Sheet title={p.thing ? cap(p.text(p.thing.name)) : 'Item'}>
      {p.thing?.description && <Text style={prose}>{plain(p.text(p.thing.description))}</Text>}
      {p.thing?.state && <Text style={note}>{cap(p.thing.state)}</Text>}
      {p.log.map((line, i) => (
        <Text key={i} style={typeof line === 'string' ? prose : { ...note, fontStyle: 'italic' }}>
          {typeof line === 'string' ? line : line.text}
        </Text>
      ))}
      {p.thing?.actions
        .filter((a) => !a.available && a.reason.code === 'too_heavy')
        .map((a) => (
          <Text key={a.action_key} style={note}>
            {p.text(a.label)}: {reason('too_heavy')}.
          </Text>
        ))}
      {!p.actions.length && !p.contents.length && <Text style={note}>Nothing to do here.</Text>}
      {p.actions.map((b) => (
        <Act key={`${b.label}:${b.target_ids.join(',')}`} b={b} press={p.press} />
      ))}
      <Leave leave={p.leave} />
      {p.contents.length > 0 && <Text style={titleStyle}>Inside</Text>}
      {p.contents.map((e) => (
        <Tap key={e.id} label={`${p.text(e.name)}, open`} onPress={() => p.open(e.id)}>
          <Text style={{ ...prose, color: paper.accent }}>{cap(p.text(e.name))}</Text>
        </Tap>
      ))}
    </Sheet>
  );
}

export function CharacterPage(p: {
  resources?: readonly Pool[];
  position?: GameView['position'];
  text: Say;
}) {
  // Real data only: the body's resources when GameView carries them; the phrase on hp only.
  const { resources = [] } = p;
  return (
    <Sheet title="Character">
      {resources.length === 0 && <Text style={note}>Nothing is known about you yet.</Text>}
      {p.position && <Text style={prose}>{cap(p.position)}</Text>}
      {resources.map((r) => (
        <Text key={r.resource.key} style={{ ...prose, color: band(r.tone) }}>
          {`${r.resource.key}  ${r.current} / ${r.maximum}${r.resource.key === 'hp' ? `, ${bandPhrase(r, p.text)}` : ''}`}
        </Text>
      ))}
    </Sheet>
  );
}

export function JournalPage({ view, text }: { view: GameView; text: Say }) {
  return (
    <Sheet title="Journal">
      {view.journal.length === 0 && <Text style={note}>Nothing written yet.</Text>}
      {view.journal.map((q) => (
        <View key={`${q.quest.cartridge_id}@${q.quest.cartridge_version}:${q.quest.key}`}>
          <Text style={prose}>{text(q.title)}</Text>
          <Text style={note}>{String(q.state).replaceAll('_', ' ')}</Text>
          {q.journal && <Text style={prose}>{plain(text(q.journal))}</Text>}
        </View>
      ))}
    </Sheet>
  );
}

export function CarryingPage(p: {
  items: readonly Thing[];
  equipment?: GameView['equipment'];
  text: Say;
  open: (id: string) => void;
}) {
  return (
    <Sheet title="Equipment & Inventory">
      <Text style={titleStyle}>Held</Text>
      {p.items.length === 0 && <Text style={note}>You are carrying nothing.</Text>}
      {p.items.map((e) => (
        <Tap key={e.id} label={`${p.text(e.name)}, open`} onPress={() => p.open(e.id)}>
          <Text style={prose}>{p.text(e.name)}</Text>
        </Tap>
      ))}
      {(p.equipment?.length ?? 0) > 0 && <Text style={titleStyle}>Worn</Text>}
      {p.equipment?.map(({ slot, item }) => (
        <View key={slot}>
          <Text style={note}>{cap(slot.replaceAll('_', ' '))}</Text>
          {item ? (
            <Tap label={`${p.text(item.name)}, open`} onPress={() => p.open(item.id)}>
              <Text style={{ ...prose, color: paper.accent }}>{p.text(item.name)}</Text>
            </Tap>
          ) : (
            <Text style={note}>Empty</Text>
          )}
        </View>
      ))}
    </Sheet>
  );
}

// Each exit's own controls, kept separate from movement; sight is read-only cartridge prose.
function Ways(p: { view: GameView; text: Say; g: Grouped; press: (b: Button) => void }) {
  return p.view.exits.map((e) => {
    const move = p.g.exits.find((x) => x.direction === e.direction)?.button;
    return (
      <View key={e.direction} style={{ marginTop: 12 }}>
        {move ? (
          <Act b={move} press={p.press} />
        ) : (
          <Text style={note}>
            {cap(e.direction)}
            {!e.available && `: ${why(e, p.text)}`}
          </Text>
        )}
        {e.door && (
          <Text style={prose}>
            {cap(p.text(e.door.name))}: {e.door.state}
          </Text>
        )}
        {p.g.door(e.direction).map((b) => (
          <Act key={b.action_key} b={b} press={p.press} />
        ))}
        {e.sight && (
          <Text style={note}>
            {`Beyond ${e.direction}: ${p.text(e.sight.title)}${
              e.sight.entities.length
                ? ` — ${e.sight.entities.map((x) => p.text(x.name)).join(', ')}`
                : ''
            }.`}
          </Text>
        )}
      </View>
    );
  });
}

// Map reuses the room's exit controls and lists the place's targetless actions.
export function MapPage(p: { view: GameView; text: Say; g: Grouped; press: (b: Button) => void }) {
  return (
    <Sheet title="Map">
      <Text style={prose}>{p.text(p.view.place.title.key)}</Text>
      {p.view.exits.length === 0 && <Text style={note}>No way out is known.</Text>}
      <Ways {...p} />
      {p.g.place.map((b) => (
        <Act key={`${b.label}:${b.target_ids.join(',')}`} b={b} press={p.press} />
      ))}
    </Sheet>
  );
}

// `startOver` asks first: it destroys the save (the shell's confirm). Nothing else lives here yet.
export function SettingsPage({ startOver }: { startOver: () => void }) {
  return (
    <Sheet title="Settings">
      <Tap label="Start over" onPress={startOver}>
        <Text style={{ ...prose, color: paper.accent }}>Start over</Text>
      </Tap>
    </Sheet>
  );
}

export function ChapterPage(p: { title: string; done: () => void }) {
  return (
    <Sheet title={p.title}>
      <Tap label="Continue" onPress={p.done}>
        <Text style={{ ...prose, color: paper.accent }}>Continue</Text>
      </Tap>
    </Sheet>
  );
}

export function ScenePage(p: {
  scene: NonNullable<GameView['scene']>;
  text: Say;
  next?: Button;
  press: (b: Button) => void;
}) {
  return (
    <Sheet title="">
      <Text style={prose}>{plain(p.text(p.scene.line))}</Text>
      {p.next && <Act b={p.next} press={p.press} />}
    </Sheet>
  );
}
