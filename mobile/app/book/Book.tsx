// The book: the room page, the pages opened from it, the status line and the footer, over the
// smoke controller (smoke.ts). Real data only: it draws what GameView projects and nothing else.
import { useState } from 'react';
import { Pressable, SafeAreaView, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import type { Button, openSmoke } from '../../authority/local-story/smoke.ts';
import { Footer } from './Footer.tsx';
import { group } from './model.ts';
import { body, fonts, paper } from './paper.ts';
import { confirmStartOver } from '../SaveError.tsx';
import {
  CarryingPage,
  CharacterPage,
  JournalPage,
  MapPage,
  RoomPage,
  SettingsPage,
  ThingPage,
} from './pages.tsx';
import { Turn } from './Turn.tsx';

type Kind = 'character' | 'journal' | 'carrying' | 'map' | 'settings';
type Page = { kind: Kind } | { kind: 'thing'; id: string };
type Smoke = ReturnType<typeof openSmoke>;

const small = { fontFamily: body, fontVariant: ['small-caps' as const], fontSize: 15 };

// Pressing turns to a fresh room page with the answer in the log; the log restarts on a place
// change, not on the tapped button (a pending retry may run another action). A press that threw
// shows its fault with Start over.
export default function Book({ smoke, startOver }: { smoke: Smoke; startOver: () => void }) {
  const [loaded, fontError] = useFonts(fonts);
  const [stack, setStack] = useState<Page[]>([]);
  const [flip, setFlip] = useState({ turn: 0, dir: 1 as 1 | -1 });
  const [from, setFrom] = useState(0); // the room log starts here: log length at the last place change
  if (!loaded && !fontError) return null;

  const screen = smoke.screen();
  const { view, buttons } = screen;
  const g = group(buttons);
  const go = (next: Page[], dir: 1 | -1) => {
    setStack(next);
    setFlip((f) => ({ turn: f.turn + 1, dir }));
  };
  const press = (b: Button) => {
    const [placeId, logLength] = [view.place.id, screen.log.length];
    smoke.press(b);
    if (smoke.screen().view.place.id !== placeId) setFrom(logLength);
    go([], 1);
  };
  const page = stack.at(-1);
  const open = (p: Page) => go([...stack, p], 1);
  // a start over that failed shows its message in the room page's log
  const ctx = { screen, g, press, open, startOver: () => (startOver(), go([], 1)) };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paper.bg }}>
      <Turn turn={flip.turn} dir={flip.dir}>
        <Body {...ctx} page={page} from={from} />
      </Turn>
      <Bottom {...ctx} back={page && (() => go(stack.slice(0, -1), -1))} />
    </SafeAreaView>
  );
}

// The footer (or Back on a page), the status line and a press's fault.
function Bottom(p: {
  screen: Screen;
  g: ReturnType<typeof group>;
  press: (b: Button) => void;
  open: (p: Page) => void;
  back?: () => void;
  startOver: () => void;
}) {
  const { view, text, pending, fault } = p.screen;
  return (
    <View style={{ borderTopWidth: 1, borderColor: paper.line, padding: 8 }}>
      {p.back ? (
        <Back onPress={p.back} />
      ) : (
        <Footer
          exits={view.exits}
          text={text}
          go={(d) => p.press(p.g.exits.find((e) => e.direction === d)!.button)}
          openMap={() => p.open({ kind: 'map' })}
        />
      )}
      <Status time={view.time} pending={pending} open={(kind) => p.open({ kind })} />
      {fault && <Fault fault={fault} startOver={p.startOver} />}
    </View>
  );
}

// One line: the time, then the way into each page. ponytail: the time is the plain logical value;
// no clock-face mapping is specified (07 §10 only says play_time advances by explicit actions).
function Status(p: {
  time: number;
  pending: boolean;
  open: (k: 'character' | 'journal' | 'carrying' | 'settings') => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        columnGap: 14,
      }}
    >
      <Text style={{ ...small, color: paper.dim }}>time {p.time}</Text>
      {(['character', 'journal', 'carrying', 'settings'] as const).map((k) => (
        <Pressable
          key={k}
          accessibilityRole="button"
          accessibilityLabel={k}
          onPress={() => p.open(k)}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={{ ...small, color: paper.accent }}>{k}</Text>
        </Pressable>
      ))}
      {p.pending && (
        <Text style={{ ...small, color: paper.dim, width: '100%', textAlign: 'center' }}>
          save not confirmed
        </Text>
      )}
    </View>
  );
}

type Screen = ReturnType<Smoke['screen']>;

function Body(p: {
  page?: Page;
  screen: Screen;
  g: ReturnType<typeof group>;
  from: number;
  press: (b: Button) => void;
  open: (p: Page) => void;
  startOver: () => void;
}) {
  const { view, text, log } = p.screen;
  const { page } = p;
  const openThing = (id: string) => p.open({ kind: 'thing', id });
  if (!page)
    return (
      <RoomPage
        view={view}
        text={text}
        log={log.slice(p.from)}
        look={p.g.look}
        press={p.press}
        open={openThing}
      />
    );
  if (page.kind === 'thing') {
    const t = [...view.entities, ...view.inventory].find((e) => e.id === page.id);
    return <ThingPage name={t ? text(t.name) : ''} actions={p.g.on(page.id)} press={p.press} />;
  }
  if (page.kind === 'character') return <CharacterPage />;
  if (page.kind === 'map')
    return <MapPage view={view} text={text} place={p.g.place} press={p.press} />;
  if (page.kind === 'settings') return <SettingsPage startOver={p.startOver} />;
  if (page.kind === 'journal') return <JournalPage view={view} text={text} />;
  return <CarryingPage items={view.inventory} text={text} open={openThing} />;
}

// A press that threw (a damaged page, a full disk): its message, and Start over beside the retry
// that any press still sends (03 §14).
function Fault(p: { fault: string; startOver: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Start over"
      onPress={() => confirmStartOver(p.startOver)}
      style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
    >
      <Text style={{ ...small, color: paper.dim }}>{p.fault}</Text>
      <Text style={{ ...small, color: paper.accent }}>start over</Text>
    </Pressable>
  );
}

function Back({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={onPress}
      style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
    >
      <Text style={{ ...small, fontSize: 17, color: paper.fg }}>back</Text>
    </Pressable>
  );
}
