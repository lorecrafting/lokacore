// The book: the room page, the pages opened from it, the status line and the footer, over the
// presenter (presenter.ts) over a Game. Real data only: it draws what GameView projects and nothing
// else. It uses React Native and the Game only; the shell (App.tsx) injects the rest.
import { useState } from 'react';
import { Pressable, SafeAreaView, Text, View } from 'react-native';
import type { Game } from '../../packages/game-view/session.ts';
import { Footer, Status } from './Footer.tsx';
import {
  group,
  pagesAfter,
  things,
  conversation,
  initialPages,
  npcPage,
  nextPosition,
  type Hint,
  type Page,
} from './model.ts';
import { ContentsPage, NpcPage, type Section } from './Menu.tsx';
import { body, paper } from './paper.ts';
import { presenter, type Button } from './presenter.ts';
import {
  CarryingPage,
  CharacterPage,
  ChapterPage,
  JournalPage,
  MapPage,
  RoomPage,
  ScenePage,
  SettingsPage,
  ThingPage,
} from './pages.tsx';
import { Turn } from './Turn.tsx';

type Presenter = ReturnType<typeof presenter>;

/** What the phone shell injects: its confirm step and its first-run store (react-native-web has none). */
export type Shell = { confirm: (go: () => void) => void; learned: Hint };

const small = { fontFamily: body, fontVariant: ['small-caps' as const], fontSize: 15 };

// Actions retain valid detail pages; leaving a room closes them. A pending retry keeps its
// original presentation context, and a throw shows its fault beside Start over.
type BookProps = {
  game: Game;
  shell: Shell;
  startOver: () => string | undefined; // a start over that failed and kept the game: why
};

export default function Book(p: BookProps) {
  const [pr] = useState(() => presenter(p.game));
  const [stack, setStack] = useState<Page[]>(() => initialPages(pr.screen().view));
  const [flip, setFlip] = useState({ turn: 0, dir: 1 as 1 | -1 });
  const [, redraw] = useState(0);
  const screen = pr.screen();
  const { view } = screen;
  const go = (next: Page[], dir: 1 | -1) => {
    setStack(next);
    setFlip((f) => ({ turn: f.turn + 1, dir }));
  };
  const press = (b: Button, detail?: string) => {
    const stale = !!b.token && !p.game.pending() && b.token !== p.game.view().token;
    pr.press(b, detail);
    if (stale) return redraw((n) => n + 1);
    const after = pr.screen();
    let next = pagesAfter(stack, view, after.view);
    if (after.returnWorld && next === stack) next = [];
    const inline = npcPage(stack.at(-1), view) || group([b]).position.length > 0;
    if (next === stack && inline && !view.scene && !after.view.scene) redraw((n) => n + 1);
    else go(next, 1);
  };
  const refused = (line: string) => (screen.log.push(line), redraw((n) => n + 1));
  const startOver = () => p.shell.confirm(() => (pr.startOverFailed(p.startOver()), go([], 1)));
  return (
    <BookView
      screen={screen}
      stack={stack}
      flip={flip}
      go={go}
      press={press}
      refused={refused}
      startOver={startOver}
      shell={p.shell}
    />
  );
}

type ViewProps = {
  screen: Screen;
  stack: Page[];
  flip: { turn: number; dir: 1 | -1 };
  go: (pages: Page[], dir: 1 | -1) => void;
  press: (b: Button, detail?: string) => void;
  refused: (line: string) => void;
  startOver: () => void;
  shell: Shell;
};

// The drawing and route callbacks stay separate from the shell's React state and animation.
export function BookView(p: ViewProps) {
  const g = group(p.screen.buttons);
  const page = p.stack.at(-1);
  const open = (page: Page) => p.go([...p.stack, page], 1);
  const walk = (d: string) => p.press(g.exits.find((e) => e.direction === d)!.button);
  const ctx = { ...p, g, open, walk, world: () => p.go([], -1) };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paper.bg }}>
      <Turn turn={p.flip.turn} dir={p.flip.dir}>
        <Body {...ctx} page={page} chapterDone={() => p.go([], 1)} />
      </Turn>
      <Bottom {...ctx} page={page} />
    </SafeAreaView>
  );
}

// The footer (or Back on a page), the status line and a press's fault.
type BottomProps = {
  screen: Screen;
  g: ReturnType<typeof group>;
  press: (b: Button) => void;
  walk: (direction: string) => void;
  refused: (line: string) => void;
  open: (p: Page) => void;
  page?: Page;
  world: () => void;
  startOver: () => void;
  shell: Shell;
};

function Bottom(p: BottomProps) {
  const { view, text, pending, fault } = p.screen;
  const position = nextPosition(view.position, p.g.position);
  return (
    <View style={{ padding: 8 }}>
      {!view.scene &&
        (p.page ? (
          p.page.kind === 'thing' || p.page.kind === 'dialogue' ? null : (
            <Back onPress={p.world} />
          )
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
        openPosition={!p.page && !view.scene && position ? () => p.press(position) : undefined}
        pending={pending}
        open={() => p.open({ kind: 'contents' })}
      />
      {fault && <Fault fault={fault} startOver={p.startOver} />}
    </View>
  );
}

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
      accessibilityLabel="Back to World"
      onPress={onPress}
      style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
    >
      <Text style={{ ...small, fontSize: 17, color: paper.fg }}>Back to World</Text>
    </Pressable>
  );
}

type BodyProps = {
  page?: Page;
  screen: Screen;
  g: ReturnType<typeof group>;
  press: (b: Button, detail?: string) => void;
  open: (p: Page) => void;
  startOver: () => void;
  chapterDone: () => void;
  world: () => void;
};

function Body(p: BodyProps) {
  const { view, text, log } = p.screen;
  const { page } = p;
  if (view.scene)
    return <ScenePage scene={view.scene} text={text} next={p.g.continue} press={p.press} />;
  if (page?.kind === 'chapter' && view.chapter)
    return <ChapterPage title={text(view.chapter.title)} done={p.chapterDone} />;
  const openThing = (id: string) => p.open({ kind: 'thing', id });
  if (!page)
    return (
      <RoomPage
        view={view}
        text={text}
        log={log}
        g={p.g}
        press={p.press}
        open={openThing}
        openChoice={() => p.open(conversation(view))}
      />
    );
  if (page.kind === 'dialogue') return <NpcDetail {...p} speaker={page.speaker} />;
  if (page.kind === 'thing') return <Item {...p} id={page.id} />;
  if (page.kind === 'contents') return <ContentsPage open={(kind: Section) => p.open({ kind })} />;
  if (page.kind === 'character')
    return <CharacterPage resources={view.resources} position={view.position} text={text} />;
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
  press: (b: Button, detail?: string) => void;
  open: (p: Page) => void;
  world: () => void;
}) {
  const items = things(p.screen.view);
  const thing = items.find((e) => e.id === p.id);
  if (thing?.kind === 'npc') return <NpcDetail {...p} npc={thing} />;
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

function NpcDetail(p: {
  screen: Screen;
  g: ReturnType<typeof group>;
  press: (b: Button, detail?: string) => void;
  npc?: ReturnType<typeof things>[number];
  speaker?: string;
  world: () => void;
}) {
  const { view, text } = p.screen;
  const npc = p.npc ?? view.entities.find((e) => e.id === (p.speaker ?? view.choice?.speaker_id));
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
