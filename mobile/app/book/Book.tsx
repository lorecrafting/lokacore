// size: allow 320, the exported components' doc comments (BOOK-UI-COMPONENTS.md, Component catalogue)
// The Book draws GameView through its presenter; App injects the shell.
import { useEffect, useRef, useState } from 'react';
import { SafeAreaView, View } from 'react-native';
import { Text } from './Text.tsx';
import type { Game } from '../../packages/game-view/session.ts';
import { Combat } from './Combat.tsx';
import { Footer } from './Footer.tsx';
import { StatusLine } from './Status.tsx';
import {
  group,
  POSITION_ACTIONS,
  pagesAfter,
  restoredItemPages,
  npcPage,
  detailPage,
  nextPosition,
  type Hint,
  type Page,
} from './model.ts';
import { usePaletteCurve } from './fade.ts';
import {
  PaletteContext,
  paletteOf,
  TypeContext,
  useBookPalette,
  usePalette,
  useType,
  type Palette,
} from './palette.ts';
import type { Effects, Reading } from './reading.ts';
import { onCue, useCues } from './cues.ts';
import { playCue } from './cueSounds.ts';
import { useSettings, type SettingStores } from './useSettings.ts';
import { color, size, space } from './tokens.ts';
import { Fault, Heard } from './lines.tsx';
import { presenter, type Button, type DetailLine } from './presenter.ts';
import { Body } from './Body.tsx';
import { NightSky } from './NightSky.tsx';
import { LABEL } from './labels.ts';
import { HapticPulse } from './HapticPulse.tsx';
import { PageTurn } from './PageTurn.tsx';
import {
  firstPages,
  resultPages,
  useUpdates,
  wordTurn,
  openTurn,
  type BookState,
  type Presenter,
} from './updates.ts';

/** What the phone shell injects: its confirm step and its first-run store (react-native-web has none). */
export type Shell = SettingStores & {
  confirm: (go: () => void) => void;
  learned: Hint;
  recovered?: (healthy: boolean) => void;
  subscribed?: (on: boolean) => void; // whether the Book sees every update (the away recap waits)
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
  next = wordTurn(next, b.action_key, before.view, after.view);
  next = openTurn(next, b.target_ids[0], before.view, after.view);
  s.current.current = { stack: next, view: after.view };
  if (after.pending || after.fault) p.shell.recovered?.(false);
  else if (pr.recovered()) p.shell.recovered?.(true);
  const inline =
    npcPage(before.stack.at(-1), before.view) ||
    ['shelf', 'sale'].includes(before.stack.at(-1)?.kind ?? '') ||
    POSITION_ACTIONS.includes(b.command ?? b.action_key);
  if (next === before.stack && inline && !before.view.scene && !after.view.scene)
    s.redraw((n) => n + 1);
  else {
    s.setStack(next);
    s.setFlip((f) => ({ turn: f.turn + 1, dir: 1 }));
  }
}

/**
 * The Book: draws GameView through its presenter; App injects the shell.
 * - Use: the app root.
 * - Story: Live.stories.tsx
 */
export default function Book(p: BookProps) {
  const [pr] = useState(() => presenter(p.game));
  const [stack, setStack] = useState(() => firstPages(pr.screen()));
  const [flip, setFlip] = useState({ turn: 0, dir: 1 as 1 | -1 });
  const [, redraw] = useState(0);
  const [talkingOn, talkOn] = useState<Page>();
  const screen = pr.screen();
  const restoreInvocation = useRef(p.game.pendingInvocation());
  const current = useRef({ stack, view: screen.view });
  current.current = { stack, view: screen.view };
  const state = { current, restoreInvocation, setStack, setFlip, redraw };
  const go = (next: Page[], dir: 1 | -1) => {
    pr.leaveCombat(); // every turn leaves an ended Combat page (its foot is the only one shown)
    const view = pr.screen().view;
    next = pagesAfter(next, view, view);
    current.current = { stack: next, view };
    setStack(next);
    setFlip((f) => ({ turn: f.turn + 1, dir }));
  };
  const press = (b: Button, detail?: string) => pressBook(p, pr, state, b, detail);
  const refused = (line: DetailLine) => (screen.log.push(line), redraw((n) => n + 1));
  const startOver = () => p.shell.confirm(() => (pr.startOverFailed(p.startOver()), go([], 1)));
  return (
    <BookView
      palette={useBookPalette(paletteOf(screen.view.calendar_status?.solar), usePaletteCurve())}
      screen={screen}
      stack={stack}
      flip={flip}
      go={go}
      press={press}
      refused={refused}
      startOver={startOver}
      shell={p.shell}
      talkingOn={talkingOn}
      talkOn={talkOn}
      {...useSettings(p.shell)}
      {...useUpdates(p, pr, state)}
    />
  );
}

type ViewProps = {
  palette: Palette;
  screen: Screen;
  stack: Page[];
  flip: { turn: number; dir: 1 | -1 };
  resumes?: number; // returns from the background so far: the view that settles one plays no cues
  go: (pages: Page[], dir: 1 | -1) => void;
  press: (b: Button, detail?: string) => void;
  refused: (line: DetailLine) => void;
  startOver: () => void;
  shell: Shell;
  talkingOn?: Page; // Body's conversation latch (Body.tsx), held above PageTurn's remount
  talkOn?: (page?: Page) => void;
  reading?: Reading; // none: the Storybook's Reading global (the TypeContext above)
  effects?: Effects;
};

// A wide screen centres the page column, at most size.column, on the paper (book-ui.md, Page column).
const frame = { flex: 1, flexDirection: 'row', justifyContent: 'center' } as const;
/**
 * The Book's frame: page turn, body, footer, status icons and status line, and the fault, pending
 * and catching-up states.
 * - Use: Book, and the stories' screen helper.
 * - Rules: recovery pages are the Page's centred variant with Notes and Controls (book-ui.md,
 *   Chapters, scenes and recovery).
 * - States: fault; pending; catching up.
 * - Story: RecoveryPages.stories.tsx
 */
export function BookView(p: ViewProps) {
  useCueSounds(p);
  const shown = useType();
  const g = group(p.screen.buttons);
  const page = p.stack.at(-1);
  const ctx = {
    ...p,
    g,
    open: (page: Page) => p.go([...p.stack, page], 1),
    walk: (d: string) => p.press(g.exits.find((e) => e.direction === d)!.button),
    world: () => p.go([], -1),
    back: () => p.go(p.stack.slice(0, -1), -1),
  };
  return (
    <PaletteContext value={p.palette}>
      <TypeContext value={p.reading?.type ?? shown}>
        <SafeAreaView style={{ ...frame, backgroundColor: p.palette.bg }}>
          <View style={{ flex: 1, maxWidth: size.column }}>
            <PageTurn turn={p.flip.turn} dir={p.flip.dir} paper={p.palette.bg}>
              {p.screen.view.combat || p.screen.ended ? (
                <Combat screen={p.screen} g={g} press={p.press} world={ctx.world} />
              ) : (
                <Body
                  {...ctx}
                  page={page}
                  talkOn={p.talkOn ?? (() => {})}
                  chapterDone={() => p.go(p.stack.slice(0, -1), 1)}
                />
              )}
            </PageTurn>
            <Bottom {...ctx} page={page} />
            <Heard said={p.screen.said} />
            <HapticPulse />
          </View>
          {p.palette.bg === color.dark.bg && <NightSky />}
        </SafeAreaView>
      </TypeContext>
    </PaletteContext>
  );
}

function useCueSounds(p: ViewProps) {
  useEffect(() => onCue(playCue), []); // before useCues: heard from its first cue
  useCues(p.screen.view, p.screen.catchingUp, p.flip.turn, p.resumes);
}

// The footer (on the world), the status line and a press's fault.
type BottomProps = {
  screen: Screen;
  g: ReturnType<typeof group>;
  press: (b: Button) => void;
  walk: (direction: string) => void;
  refused: (line: DetailLine) => void;
  open: (p: Page) => void;
  page?: Page;
  startOver: () => void;
  shell: Shell;
};

function Bottom(p: BottomProps) {
  const [c, t] = [usePalette(), useType()];
  const { view, text, pending, fault, ended } = p.screen;
  const shut = !!view.combat || !!ended;
  const nav = !p.page && !view.ancestry_choices && !view.scene && !shut;
  const detail = !shut && detailPage(p.page);
  if (detail && !pending && !p.screen.catchingUp && !fault) return null;
  return (
    <View
      style={{
        paddingTop: space.sm,
        paddingHorizontal: space.xl,
        paddingBottom: space.lg,
        // The footer's own flanking rules divide it from the page (owner, mvl8dz3dy36l).
        borderTopWidth: nav || detail ? 0 : size.rule, // a detail's PageFoot draws the rule
        borderTopColor: c.line,
      }}
    >
      {nav && navigation(p)}
      {!view.ancestry_choices && !detail && statusLine(p)}
      {detail && pending && (
        <Text style={{ ...t.small, color: c.dim }}>{LABEL.saveNotConfirmed}</Text>
      )}
      {p.screen.catchingUp && <Text style={{ ...t.small, color: c.dim }}>Catching up…</Text>}
      {fault && <Fault fault={fault} startOver={p.startOver} />}
    </View>
  );
}

// The status line under the footer.
function statusLine(p: BottomProps) {
  const { view, text, pending, ended } = p.screen;
  // A tap on the position line acts only on the open World page.
  const position = !p.page && !view.scene && !ended && nextPosition(view.position, p.g.position);
  return (
    <StatusLine
      time={view.time}
      calendar={view.calendar_status}
      resources={view.resources}
      bleeding={view.bleeding}
      conditions={view.conditions}
      position={view.position}
      text={text}
      locked={!!view.scene || !!view.combat || !!ended || p.page?.kind === 'chapter'}
      openPosition={position ? () => p.press(position) : undefined}
      pending={pending}
      open={() => p.open({ kind: 'contents' })}
      openCharacter={() => p.open({ kind: 'character' })}
    />
  );
}

// On the world, the footer; a page's returns sit in its own foot (PageFoot).
function navigation(p: BottomProps) {
  const { view, text, pending, fault } = p.screen;
  return (
    <Footer
      keyboardEnabled={!pending && !fault && !p.screen.catchingUp}
      exits={view.exits}
      text={text}
      go={p.walk}
      door={p.g.door}
      press={p.press}
      refused={p.refused}
      learned={p.shell.learned}
      openMap={() => p.open({ kind: 'map' })}
    />
  );
}

type Screen = ReturnType<Presenter['screen']>;
