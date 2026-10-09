// The Book draws GameView through its presenter; App injects the shell.
import { useRef, useState } from 'react';
import { Pressable, SafeAreaView, Text, View } from 'react-native';
import type { Game } from '../../packages/game-view/session.ts';
import { Combat } from './Combat.tsx';
import { Footer, Status } from './Footer.tsx';
import {
  group,
  POSITION_ACTIONS,
  pagesAfter,
  initialPages,
  restoredItemPages,
  npcPage,
  nextPosition,
  type Hint,
  type Page,
} from './model.ts';
import { usePaletteCurve } from './fade.ts';
import { PaletteContext, paletteOf, usePalette, useShownPalette, type Palette } from './palette.ts';
import { type } from './tokens.ts';
import { presenter, type Button } from './presenter.ts';
import { restoredNoticePages } from './notices.tsx';
import { Body } from './Body.tsx';
import { PageTurn } from './PageTurn.tsx';
import { resultPages, useUpdates, type BookState, type Presenter } from './updates.ts';

/** What the phone shell injects: its confirm step and its first-run store (react-native-web has none). */
export type Shell = {
  confirm: (go: () => void) => void;
  learned: Hint;
  recovered?: (healthy: boolean) => void;
};

// Actions retain valid detail pages; leaving a room closes them. A pending retry keeps its
// original presentation context, and a throw shows its fault beside Start over.
export type BookProps = {
  game: Game;
  shell: Shell;
  startOver: () => string | undefined; // a start over that failed and kept the game: why
};

function pressBook(p: BookProps, pr: Presenter, s: BookState, b: Button, detail?: string) {
  const restoring =
    s.restoreInvocation.current === p.game.pendingInvocation()
      ? s.restoreInvocation.current
      : undefined;
  const stale = !!b.token && !p.game.pending() && b.token !== p.game.view().token;
  pr.press(b, detail);
  if (stale && !pr.recovered()) return s.redraw((n) => n + 1);
  const after = pr.screen(),
    before = s.current.current;
  let next = pagesAfter(before.stack, before.view, after.view);
  if (
    restoring &&
    s.restoreInvocation.current === restoring &&
    !p.game.pending() &&
    pr.recovered()
  ) {
    s.restoreInvocation.current = undefined;
    if (after.confirmedRead)
      next = [...restoredItemPages(after.view, after.detail, after.confirmedRead), ...next];
  }
  next = resultPages(next, after);
  s.current.current = { stack: next, view: after.view };
  if (after.pending || after.fault) p.shell.recovered?.(false);
  else if (pr.recovered()) p.shell.recovered?.(true);
  const inline =
    npcPage(before.stack.at(-1), before.view) ||
    POSITION_ACTIONS.includes(b.command ?? b.action_key);
  if (next === before.stack && inline && !before.view.scene && !after.view.scene)
    s.redraw((n) => n + 1);
  else {
    s.setStack(next);
    s.setFlip((f) => ({ turn: f.turn + 1, dir: 1 }));
  }
}

export default function Book(p: BookProps) {
  const [pr] = useState(() => presenter(p.game));
  const [stack, setStack] = useState<Page[]>(() => [
    ...restoredNoticePages(pr.screen()),
    ...restoredItemPages(pr.screen().view, pr.screen().detail),
    ...initialPages(pr.screen().view),
  ]);
  const [flip, setFlip] = useState({ turn: 0, dir: 1 as 1 | -1 });
  const [, redraw] = useState(0);
  const screen = pr.screen();
  const { view } = screen;
  const restoreInvocation = useRef(p.game.pendingInvocation());
  const current = useRef({ stack, view });
  current.current = { stack, view };
  const state = { current, restoreInvocation, setStack, setFlip, redraw };
  useUpdates(p, pr, state);
  // Confirmed GameView only (game.view() never shows a pending attempt): its solar phase's palette.
  const palette = useShownPalette(paletteOf(view.calendar_status?.solar), usePaletteCurve());
  const go = (next: Page[], dir: 1 | -1) => {
    const view = pr.screen().view;
    next = pagesAfter(next, view, view);
    current.current = { stack: next, view };
    setStack(next);
    setFlip((f) => ({ turn: f.turn + 1, dir }));
  };
  const press = (b: Button, detail?: string) => pressBook(p, pr, state, b, detail);
  const refused = (line: string) => (screen.log.push(line), redraw((n) => n + 1));
  const startOver = () => p.shell.confirm(() => (pr.startOverFailed(p.startOver()), go([], 1)));
  return (
    <BookView
      palette={palette}
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
  palette: Palette;
  screen: Screen;
  stack: Page[];
  flip: { turn: number; dir: 1 | -1 };
  go: (pages: Page[], dir: 1 | -1) => void;
  press: (b: Button, detail?: string) => void;
  refused: (line: string) => void;
  startOver: () => void;
  shell: Shell;
};

export function BookView(p: ViewProps) {
  const c = p.palette;
  const g = group(p.screen.buttons);
  const page = p.stack.at(-1);
  const open = (page: Page) => p.go([...p.stack, page], 1);
  const walk = (d: string) => p.press(g.exits.find((e) => e.direction === d)!.button);
  const ctx = {
    ...p,
    g,
    open,
    walk,
    world: () => p.go([], -1),
    back: () => p.go(p.stack.slice(0, -1), -1),
  };
  return (
    <PaletteContext value={c}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <PageTurn turn={p.flip.turn} dir={p.flip.dir} paper={c.bg}>
          {p.screen.view.combat ? (
            <Combat screen={p.screen} g={g} press={p.press} />
          ) : (
            <Body {...ctx} page={page} chapterDone={() => p.go(p.stack.slice(0, -1), 1)} />
          )}
        </PageTurn>
        <Bottom {...ctx} page={page} />
      </SafeAreaView>
    </PaletteContext>
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
  back: () => void;
  startOver: () => void;
  shell: Shell;
};

function Bottom(p: BottomProps) {
  const c = usePalette();
  const { view, text, pending, fault } = p.screen;
  const position = nextPosition(view.position, p.g.position);
  return (
    <View style={{ padding: 8 }}>
      {!view.ancestry_choices && !view.scene && !view.combat && navigation(p)}
      {!view.ancestry_choices && (
        <Status
          time={view.time}
          calendar={view.calendar_status}
          resources={view.resources}
          bleeding={view.bleeding}
          position={view.position}
          text={text}
          locked={!!view.scene || !!view.combat || p.page?.kind === 'chapter'}
          openPosition={!p.page && !view.scene && position ? () => p.press(position) : undefined}
          pending={pending}
          open={() => p.open({ kind: 'contents' })}
        />
      )}
      {p.screen.catchingUp && <Text style={{ ...type.small, color: c.dim }}>Catching up…</Text>}
      {fault && <Fault fault={fault} startOver={p.startOver} />}
    </View>
  );
}

// On a page, its Back (detail, dialogue, dream and open notice pages keep their own Leave; the
// chapter title page has only its Continue); on the world, the footer.
function navigation(p: BottomProps) {
  const { view, text, pending, fault } = p.screen;
  const notice = p.page?.kind === 'notice' ? p.page.id : undefined;
  return p.page ? (
    p.page.kind === 'thing' ||
    p.page.kind === 'dialogue' ||
    p.page.kind === 'dream' ||
    p.page.kind === 'chapter' ||
    (notice && view.notices?.some((n) => n.id === notice)) ? null : (
      <Back
        label={p.page.kind === 'notice' ? 'Back to board' : 'Back to World'}
        onPress={p.page.kind === 'notice' || p.page.kind === 'board' ? p.back : p.world}
      />
    )
  ) : (
    <Footer
      keyboardEnabled={!pending && !fault && !p.screen.catchingUp}
      exits={view.exits}
      text={text}
      go={p.walk}
      refused={p.refused}
      learned={p.shell.learned}
      openMap={() => p.open({ kind: 'map' })}
    />
  );
}

type Screen = ReturnType<Presenter['screen']>;

// A press that threw (a damaged page, a full disk): its message, and Start over beside the retry
// that any press still sends (03 §14).
// The message sits outside the button: its accessibilityLabel replaces the children it reads.
function Fault(p: { fault: string; startOver: () => void }) {
  const c = usePalette();
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ ...type.small, color: c.dim }}>{p.fault}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Start over"
        onPress={p.startOver}
        style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
      >
        <Text style={{ ...type.small, color: c.action }}>start over</Text>
      </Pressable>
    </View>
  );
}

function Back({ onPress, label }: { onPress: () => void; label: string }) {
  const c = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
    >
      <Text
        style={{
          ...type.small,
          // ast-grep-ignore: mobile-book-raw-values (one-off for the designer: Back's 17)
          fontSize: 17,
          color: c.fg,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
