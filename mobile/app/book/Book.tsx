// The book: the room page, the pages opened from it, the status line and the footer, over the
// presenter (presenter.ts) over a Game. Real data only: it draws what GameView projects and nothing
// else. It uses React Native and the Game only; the shell (App.tsx) injects the rest.
import { useState } from 'react';
import { Pressable, SafeAreaView, Text, View } from 'react-native';
import type { Game } from '../../packages/game-view/session.ts';
import { Footer } from './Footer.tsx';
import {
  branch,
  group,
  pagesAfter,
  said,
  things,
  type Hint,
  type Page,
  type Pool,
} from './model.ts';
import { Menu, useMenu } from './Menu.tsx';
import { body, paper } from './paper.ts';
import { presenter, type Button } from './presenter.ts';
import {
  band,
  CarryingPage,
  CharacterPage,
  ChapterPage,
  JournalPage,
  MapPage,
  RoomPage,
  ScenePage,
  SettingsPage,
  ThingPage,
  type More,
} from './pages.tsx';
import { Turn } from './Turn.tsx';

type Presenter = ReturnType<typeof presenter>;

/** What the phone shell injects: its confirm step and its first-run store (react-native-web has none). */
export type Shell = { confirm: (go: () => void) => void; learned: Hint };

const small = { fontFamily: body, fontVariant: ['small-caps' as const], fontSize: 15 };

// Pressing turns to a fresh room page with the answer in the log; the log restarts at the new
// place's heading on a place change, not on the tapped button (a pending retry may run another
// action). A press that threw shows its fault with Start over.
type BookProps = {
  game: Game;
  shell: Shell;
  startOver: () => string | undefined; // a start over that failed and kept the game: why
};

export default function Book(p: BookProps) {
  const [pr] = useState(() => presenter(p.game));
  const [stack, setStack] = useState<Page[]>(() =>
    pr.screen().view.chapter ? [{ kind: 'chapter' }] : [],
  );
  const [flip, setFlip] = useState({ turn: 0, dir: 1 as 1 | -1 });
  const [, redraw] = useState(0);
  const screen = pr.screen();
  const { view, buttons } = screen;
  const menu = useMenu(view);
  const g = group(buttons);
  const go = (next: Page[], dir: 1 | -1) => {
    setStack(next);
    setFlip((f) => ({ turn: f.turn + 1, dir }));
  };
  const press = (b: Button) => {
    const placeId = view.place.id;
    const said = pr.press(b);
    const { log, view: now } = pr.screen(); // a new room's log starts at its heading
    if (now.place.id !== placeId) log.splice(0, log.length - 1);
    go(pagesAfter(stack, view, now), 1);
    return said; // the NPC menu shows it
  };
  const page = stack.at(-1);
  const open = (p: Page) => go([...stack, p], 1);
  const walk = (d: string) => press(g.exits.find((e) => e.direction === d)!.button);
  const refused = (line: string) => (screen.log.push(line), redraw((n) => n + 1)); // no page turn
  const startOver = () => p.shell.confirm(() => (pr.startOverFailed(p.startOver()), go([], 1)));
  const ctx = { screen, g, press, walk, refused, open, menu, startOver, shell: p.shell };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paper.bg }}>
      <Turn turn={flip.turn} dir={flip.dir}>
        <Body {...ctx} page={page} chapterDone={() => go([], 1)} />
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
  walk: (direction: string) => void;
  refused: (line: string) => void;
  open: (p: Page) => void;
  back?: () => void;
  startOver: () => void;
  shell: Shell;
}) {
  const { view, text, pending, fault } = p.screen;
  return (
    <View style={{ padding: 8 }}>
      {!view.scene &&
        (p.back ? (
          <Back onPress={p.back} />
        ) : (
          <Footer
            exits={view.exits}
            text={text}
            go={p.walk}
            refused={p.refused}
            learned={p.shell.learned}
            openMap={() => p.open({ kind: 'map' })}
          />
        ))}
      <Status
        time={view.time}
        resources={view.resources}
        position={view.position}
        text={text}
        locked={!!view.scene}
        pending={pending}
        open={() => p.open({ kind: 'character' })}
      />
      {fault && <Fault fault={fault} startOver={p.startOver} />}
    </View>
  );
}

// One line: the time as its earthly branch, then the character button, which shows the body's
// resources coloured by band when GameView carries them (the room-view status line, an owner-
// ruled departure) and opens the Character page, the way to Journal, Carrying and Settings.
type StatusProps = {
  time: number;
  resources?: readonly Pool[];
  position?: Screen['view']['position'];
  text: (key: string) => string;
  locked: boolean;
  pending: boolean;
  open: () => void;
};

function Status(p: StatusProps) {
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
      <Text style={{ ...small, color: paper.dim }} accessibilityLabel={branch(p.time).label}>
        {branch(p.time).glyph}
      </Text>
      {p.position && (
        <Text style={{ ...small, color: paper.dim }} accessibilityLabel={`Position, ${p.position}`}>
          {p.position}
        </Text>
      )}
      <Pressable
        disabled={p.locked}
        accessibilityRole="button"
        accessibilityLabel={p.resources ? said(p.resources, p.text) : 'character'}
        onPress={p.open}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <Text style={{ ...small, color: paper.accent }}>
          {p.resources ? shown(p.resources) : 'character'}
        </Text>
      </Pressable>
      {p.pending && (
        <Text style={{ ...small, color: paper.dim, width: '100%', textAlign: 'center' }}>
          save not confirmed
        </Text>
      )}
    </View>
  );
}

// The resources as the status line shows them (coloured by band); its label is model.ts `said`.
const shown = (rs: readonly Pool[]) =>
  rs.map((r, i) => (
    <Text key={r.resource.key} style={{ color: band(r.tone) }}>
      {`${i ? '  ' : ''}${r.resource.key} ${r.current}/${r.maximum}`}
    </Text>
  ));

type Screen = ReturnType<Presenter['screen']>;

// A press that threw (a damaged page, a full disk): its message, and Start over beside the retry
// that any press still sends (03 §14).
function Fault(p: { fault: string; startOver: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Start over"
      onPress={p.startOver}
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

type BodyProps = {
  page?: Page;
  screen: Screen;
  g: ReturnType<typeof group>;
  press: (b: Button) => string;
  open: (p: Page) => void;
  menu: ReturnType<typeof useMenu>;
  startOver: () => void;
  chapterDone: () => void;
};

function Body(p: BodyProps) {
  const { view, text, log } = p.screen;
  const { page } = p;
  if (view.scene)
    return <ScenePage scene={view.scene} text={text} next={p.g.continue} press={p.press} />;
  if (page?.kind === 'chapter' && view.chapter)
    return <ChapterPage title={text(view.chapter.title)} done={p.chapterDone} />;
  const openThing = (id: string) => p.open({ kind: 'thing', id });
  const tap = (id: string) =>
    view.entities.find((e) => e.id === id)?.kind === 'npc' ? p.menu.tap(id) : openThing(id);
  if (!page)
    return (
      <>
        <RoomPage view={view} text={text} log={log} g={p.g} press={p.press} open={tap} />
        <Menu view={view} text={text} g={p.g} press={p.press} menu={p.menu} />
      </>
    );
  if (page.kind === 'thing') return <Item {...p} id={page.id} />;
  if (page.kind === 'character')
    return (
      <CharacterPage
        resources={view.resources}
        position={view.position}
        text={text}
        actions={p.g.position}
        press={p.press}
        open={(kind: More) => p.open({ kind })}
      />
    );
  if (page.kind === 'map') return <MapPage view={view} text={text} g={p.g} press={p.press} />;
  if (page.kind === 'settings') return <SettingsPage startOver={p.startOver} />;
  if (page.kind === 'journal') return <JournalPage view={view} text={text} />;
  return (
    <CarryingPage items={view.inventory} equipment={view.equipment} text={text} open={openThing} />
  );
}

function Item(p: {
  id: string;
  screen: Screen;
  g: ReturnType<typeof group>;
  press: (b: Button) => void;
  open: (p: Page) => void;
}) {
  const items = things(p.screen.view);
  return (
    <ThingPage
      thing={items.find((e) => e.id === p.id)}
      text={p.screen.text}
      actions={p.g.on(p.id)}
      press={p.press}
      contents={items.filter((e) => 'container_id' in e && e.container_id === p.id)}
      open={(id) => p.open({ kind: 'thing', id })}
    />
  );
}
