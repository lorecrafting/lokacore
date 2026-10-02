// The book's pages: room, a thing's page, and the Character / Journal / Carrying pages. Each is
// only drawing; what a tap does is passed in by Book.tsx.
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { Button, GameView } from '../../authority/local-story/smoke.ts';
import { plain, why } from './model.ts';
import { body, head, paper } from './paper.ts';
import { confirmStartOver } from '../SaveError.tsx';

type Say = (key: string) => string;
export type Thing = GameView['entities'][number];
export type Pool = NonNullable<GameView['resources']>[number];

// Each condition band's colour and hp phrase (04 §15 bands). The colour tiers by the band's cut
// as the mock does: from 80 up none, from 40 up mid, below that accent.
export const bands: Record<Pool['band'], [colour: string, phrase: string]> = {
  perfect_health: [paper.fg, 'is in perfect health'],
  slightly_scratched: [paper.fg, 'is slightly scratched'],
  few_bruises: [paper.fg, 'has a few bruises'],
  some_cuts: [paper.mid, 'has some cuts'],
  several_wounds: [paper.mid, 'has several wounds'],
  many_nasty_wounds: [paper.mid, 'has many nasty wounds'],
  bleeding_freely: [paper.mid, 'is bleeding freely'],
  covered_in_blood: [paper.accent, 'is covered in blood'],
  leaking_guts: [paper.accent, 'is leaking guts'],
  almost_dead: [paper.accent, 'is almost dead'],
  dying: [paper.accent, 'is DYING'],
};

const prose = { fontFamily: body, fontSize: 18, lineHeight: 28, color: paper.fg };
const titleStyle = { fontFamily: head, fontSize: 26, color: paper.fg, paddingBottom: 10 };
const note = { ...prose, color: paper.dim };

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
      {p.actions.length === 0 && <Text style={note}>Nothing to do here.</Text>}
      {p.actions.map((b) => (
        <Tap key={b.label} label={b.label} onPress={() => p.press(b)}>
          <Text style={{ ...prose, color: paper.accent }}>{b.label}</Text>
        </Tap>
      ))}
    </Sheet>
  );
}

export function CharacterPage({ resources = [] }: { resources?: readonly Pool[] }) {
  // Real data only: the body's resources when GameView carries them; the phrase on hp only.
  return (
    <Sheet title="Character">
      {resources.length === 0 && <Text style={note}>Nothing is known about you yet.</Text>}
      {resources.map(({ resource: { key }, current, maximum, band }) => (
        <Text key={key} style={prose}>
          {`${key}  ${current} / ${maximum}${key === 'hp' ? `, ${bands[band][1]}` : ''}`}
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

// The current room's title and its exits in words (a closed one with its reason), and the place's
// own actions without a target (scan, 00 §4.10's Map row, and any other the footer used to list).
export function MapPage(p: {
  view: GameView;
  text: Say;
  place: Button[];
  press: (b: Button) => void;
  walk: (direction: string) => void;
}) {
  return (
    <Sheet title="Map">
      <Text style={prose}>{p.text(p.view.place.title.key)}</Text>
      {p.view.exits.length === 0 && <Text style={note}>No way out is known.</Text>}
      {p.view.exits.map((e) => {
        const name = e.direction.charAt(0).toUpperCase() + e.direction.slice(1);
        return e.available ? (
          <Tap key={e.direction} label={`Go ${e.direction}`} onPress={() => p.walk(e.direction)}>
            <Text style={prose}>{name}</Text>
          </Tap>
        ) : (
          <Text key={e.direction} style={note}>
            {name}: {why(e, p.text)}
          </Text>
        );
      })}
      {p.place.map((b) => (
        <Tap key={b.label} label={b.label} onPress={() => p.press(b)}>
          <Text style={{ ...prose, color: paper.accent }}>{b.label}</Text>
        </Tap>
      ))}
    </Sheet>
  );
}

// Start over destroys the save: the confirm step says so (SaveError.tsx). Nothing else lives here yet.
export function SettingsPage({ startOver }: { startOver: () => void }) {
  return (
    <Sheet title="Settings">
      <Tap label="Start over" onPress={() => confirmStartOver(startOver)}>
        <Text style={{ ...prose, color: paper.accent }}>Start over</Text>
      </Tap>
    </Sheet>
  );
}
