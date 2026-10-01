// The book: the room page, the pages opened from it, the status line and the footer, over the
// smoke controller (smoke.ts). Real data only: it draws what GameView projects and nothing else.
import { useState } from 'react';
import { Pressable, SafeAreaView, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import type { Button, openSmoke } from '../../authority/local-story/smoke.ts';
import { Footer } from './Footer.tsx';
import { group } from './model.ts';
import { body, fonts, paper } from './paper.ts';
import { CarryingPage, CharacterPage, JournalPage, RoomPage, ThingPage } from './pages.tsx';
import { Turn } from './Turn.tsx';

type Page = { kind: 'character' | 'journal' | 'carrying' } | { kind: 'thing'; id: string };
type Smoke = ReturnType<typeof openSmoke>;

const small = { fontFamily: body, fontVariant: ['small-caps' as const], fontSize: 15 };

export default function Book({ smoke }: { smoke: Smoke }) {
  const [loaded, fontError] = useFonts(fonts);
  const [stack, setStack] = useState<Page[]>([]);
  // `turn` counts page turns (a new page animates in); `dir` is 1 going on, -1 going back.
  const [flip, setFlip] = useState({ turn: 0, dir: 1 as 1 | -1 });
  // Where the room's event log starts: the log length just before the last move.
  const [from, setFrom] = useState(0);
  if (!loaded && !fontError) return null;

  const screen = smoke.screen();
  const { view, buttons, pending } = screen;
  const g = group(buttons);
  const go = (next: Page[], dir: 1 | -1) => {
    setStack(next);
    setFlip((f) => ({ turn: f.turn + 1, dir }));
  };
  // Pressing an action turns to a fresh room page, where its answer is in the log.
  const press: Parameters<typeof Footer>[0]['press'] = (b) => {
    if (b.action_key === 'move') setFrom(screen.log.length);
    smoke.press(b);
    go([], 1);
  };
  const page = stack.at(-1);
  const open = (p: Page) => go([...stack, p], 1);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paper.bg }}>
      <Turn turn={flip.turn} dir={flip.dir}>
        <Body page={page} screen={screen} g={g} from={from} press={press} open={open} />
      </Turn>
      <View style={{ borderTopWidth: 1, borderColor: paper.line, padding: 8 }}>
        {page ? (
          <Back onPress={() => go(stack.slice(0, -1), -1)} />
        ) : (
          <Footer exits={g.exits} place={g.place} press={press} />
        )}
        <Status time={view.time} pending={pending} open={(kind) => open({ kind })} />
      </View>
    </SafeAreaView>
  );
}

// One line: the time, then the way into each page. ponytail: the time is the plain logical value;
// no clock-face mapping is specified (07 §10 only says play_time advances by explicit actions).
function Status(p: {
  time: number;
  pending: boolean;
  open: (k: 'character' | 'journal' | 'carrying') => void;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 14 }}>
      <Text style={{ ...small, color: paper.dim }}>time {p.time}</Text>
      {(['character', 'journal', 'carrying'] as const).map((k) => (
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
      {p.pending && <Text style={{ ...small, color: paper.dim }}>not saved</Text>}
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
  if (page.kind === 'journal') return <JournalPage view={view} text={text} />;
  return <CarryingPage items={view.inventory} text={text} open={openThing} />;
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
