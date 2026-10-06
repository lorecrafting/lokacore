// The Book draws GameView through its presenter; App injects the shell.
import { useEffect, useRef, useState } from 'react';
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
import { body, paper } from './paper.ts';
import { presenter, type Button } from './presenter.ts';
import { restoredNoticePages } from './notices.tsx';
import { Body } from './Body.tsx';
import { Turn } from './Turn.tsx';

type Presenter = ReturnType<typeof presenter>;

/** What the phone shell injects: its confirm step and its first-run store (react-native-web has none). */
export type Shell = {
  confirm: (go: () => void) => void;
  learned: Hint;
  recovered?: (healthy: boolean) => void;
};

const small = { fontFamily: body, fontVariant: ['small-caps' as const], fontSize: 15 };

// Actions retain valid detail pages; leaving a room closes them. A pending retry keeps its
// original presentation context, and a throw shows its fault beside Start over.
type BookProps = {
  game: Game;
  shell: Shell;
  startOver: () => string | undefined; // a start over that failed and kept the game: why
};

type BookState = {
  restoreInvocation: { current: string | undefined };
  current: { current: { stack: Page[]; view: ReturnType<Presenter['screen']>['view'] } };
  setStack: (stack: Page[]) => void;
  setFlip: (next: (f: { turn: number; dir: 1 | -1 }) => { turn: number; dir: 1 | -1 }) => void;
  redraw: (next: (n: number) => number) => void;
};

function resultPages(next: Page[], screen: ReturnType<Presenter['screen']>) {
  if (screen.returnWorld && !screen.view.combat) return [];
  if (!screen.returnDetail) return next;
  const index = next.findIndex((p) => p.kind === 'thing' && p.id === screen.returnDetail);
  if (index >= 0) return next.slice(0, index + 1);
  const corpse: Page[] = [{ kind: 'thing', id: screen.returnDetail }];
  return pagesAfter(corpse, screen.view, screen.view);
}
function useUpdates(p: BookProps, pr: Presenter, s: BookState) {
  const { current, restoreInvocation, setStack, setFlip, redraw } = s;
  useEffect(() => {
    let live = true;
    const unsubscribe = p.game.subscribe((update) => {
      if (!live) return;
      const before = current.current;
      const terminal = pr.update(update);
      const after = pr.screen();
      let next = pagesAfter(before.stack, before.view, after.view);
      // A remounted pending Read or corpse Take has no local retry context.
      if (update.kind === 'completion' && update.invocation_id === restoreInvocation.current) {
        restoreInvocation.current = undefined;
        if (
          update.reply.kind === 'saved' &&
          update.reply.decision.kind === 'accepted' &&
          update.reply.decision.outcome === 'read'
        )
          next = [
            ...restoredItemPages(after.view, after.detail, update.intent.target_ids[0]),
            ...next,
          ];
        if (
          update.reply.kind === 'saved' &&
          update.reply.decision.kind === 'accepted' &&
          update.reply.decision.outcome === 'taken'
        ) {
          let receipt: ReturnType<Game['lastNarration']>;
          try {
            receipt = p.game.lastNarration(update.reply.command_id);
          } catch {
            receipt = undefined; // presenter owns the storage fault shown to the player
          }
          if (
            receipt &&
            receipt.command_id === update.reply.command_id &&
            receipt.pickup_name &&
            receipt.detail_id
          )
            next = resultPages(next, {
              ...after,
              returnDetail: receipt.detail_id,
              returnWorld: false,
            });
        }
      }
      if (terminal) next = resultPages(next, after);
      current.current = { stack: next, view: after.view };
      setStack(next);
      if (terminal && next !== before.stack) setFlip((f) => ({ turn: f.turn + 1, dir: 1 }));
      redraw((n) => n + 1);
      if (after.pending || after.fault) p.shell.recovered?.(false);
      else if (pr.recovered()) p.shell.recovered?.(true);
    });
    return () => {
      live = false;
      unsubscribe();
    };
  }, [p.game, pr, p.shell.recovered]);
}

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

export function BookView(p: ViewProps) {
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
    <SafeAreaView style={{ flex: 1, backgroundColor: paper.bg }}>
      <Turn turn={p.flip.turn} dir={p.flip.dir}>
        {p.screen.view.combat ? (
          <Combat screen={p.screen} g={g} press={p.press} />
        ) : (
          <Body {...ctx} page={page} chapterDone={() => p.go(p.stack.slice(0, -1), 1)} />
        )}
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
  back: () => void;
  startOver: () => void;
  shell: Shell;
};

// size: allow 45, footer keeps standalone Leave and nested Back alongside status and faults
function Bottom(p: BottomProps) {
  const { view, text, pending, fault } = p.screen;
  const position = nextPosition(view.position, p.g.position);
  const notice = p.page?.kind === 'notice' ? p.page.id : undefined;
  return (
    <View style={{ padding: 8 }}>
      {!view.ancestry_choices &&
        !view.scene &&
        !view.combat &&
        (p.page ? (
          p.page.kind === 'thing' ||
          p.page.kind === 'dialogue' ||
          p.page.kind === 'dream' ||
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
        ))}
      {!view.ancestry_choices && (
        <Status
          time={view.time}
          calendar={view.calendar_status}
          resources={view.resources}
          bleeding={view.bleeding}
          position={view.position}
          text={text}
          locked={!!view.scene || !!view.combat}
          openPosition={!p.page && !view.scene && position ? () => p.press(position) : undefined}
          pending={pending}
          open={() => p.open({ kind: 'contents' })}
        />
      )}
      {p.screen.catchingUp && <Text style={{ ...small, color: paper.dim }}>Catching up…</Text>}
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

function Back({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
    >
      <Text style={{ ...small, fontSize: 17, color: paper.fg }}>{label}</Text>
    </Pressable>
  );
}
