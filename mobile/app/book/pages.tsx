// The book's pages: room, a thing's page, and the Character / Journal / Carrying pages. Each is
// only drawing; what a tap does is passed in by Book.tsx.
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { Button, GameView } from '../../authority/local-story/smoke.ts';
import { plain } from './model.ts';
import { body, head, paper } from './paper.ts';

type Say = (key: string) => string;
export type Thing = GameView['entities'][number];

const prose = { fontFamily: body, fontSize: 18, lineHeight: 28, color: paper.fg };
const titleStyle = { fontFamily: head, fontSize: 26, color: paper.fg, paddingBottom: 10 };
const note = { ...prose, color: paper.dim, fontStyle: 'italic' as const };

function Tap(p: { label: string; onPress: () => void; children: ReactNode }) {
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

export function RoomPage(p: {
  view: GameView;
  text: Say;
  log: string[];
  look?: Button;
  press: (b: Button) => void;
  open: (id: string) => void;
}) {
  const title = (
    <Text style={{ ...titleStyle, textAlign: 'center' }}>{p.text(p.view.place.title.key)}</Text>
  );
  return (
    <ScrollView contentContainerStyle={{ padding: 24 }}>
      {p.look ? (
        <Tap label={`Look, ${p.text(p.view.place.title.key)}`} onPress={() => p.press(p.look!)}>
          {title}
        </Tap>
      ) : (
        title
      )}
      <Text style={prose}>{plain(p.text(p.view.place.description.key))}</Text>
      {p.view.entities.map((e) => {
        const name = p.text(e.name);
        return (
          <Tap key={e.id} label={`${name}, open`} onPress={() => p.open(e.id)}>
            <Text style={prose}>
              <Text style={{ fontWeight: '500', textDecorationLine: 'underline' }}>
                {name.charAt(0).toUpperCase() + name.slice(1)}
              </Text>{' '}
              is here.
            </Text>
          </Tap>
        );
      })}
      {p.log.length > 0 && <Text style={{ ...prose, marginTop: 12 }}>{p.log.join('\n')}</Text>}
    </ScrollView>
  );
}

function Sheet({ title, children }: { title: string; children: ReactNode }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 8 }}>
      <Text style={{ ...titleStyle, fontSize: 32 }} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </ScrollView>
  );
}

export function ThingPage(p: { name: string; actions: Button[]; press: (b: Button) => void }) {
  return (
    <Sheet title={p.name}>
      {p.actions.length === 0 && <Text style={note}>There is nothing to do with it.</Text>}
      {p.actions.map((b) => (
        <Tap key={b.label} label={b.label} onPress={() => p.press(b)}>
          <Text style={{ ...prose, color: paper.accent }}>{b.label}</Text>
        </Tap>
      ))}
    </Sheet>
  );
}

export function CharacterPage() {
  // GameView carries nothing about the character yet, so nothing is shown (real data only).
  return (
    <Sheet title="Character">
      <Text style={note}>Nothing is known about you yet.</Text>
    </Sheet>
  );
}

export function JournalPage({ view, text }: { view: GameView; text: Say }) {
  return (
    <Sheet title="Journal">
      {view.journal.length === 0 && <Text style={note}>Nothing written yet.</Text>}
      {view.journal.map((q) => (
        <View key={q.title} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={prose}>{text(q.title)}</Text>
          <Text style={note}>{String(q.state).replaceAll('_', ' ')}</Text>
        </View>
      ))}
    </Sheet>
  );
}

export function CarryingPage(p: {
  items: readonly Thing[];
  text: Say;
  open: (id: string) => void;
}) {
  return (
    <Sheet title="Carrying">
      {p.items.length === 0 && <Text style={note}>Your hands are empty.</Text>}
      {p.items.map((e) => (
        <Tap key={e.id} label={`${p.text(e.name)}, open`} onPress={() => p.open(e.id)}>
          <Text style={prose}>{p.text(e.name)}</Text>
        </Tap>
      ))}
    </Sheet>
  );
}
