// The Book's live updates: each GameView update redraws its pages, restores a remounted pending
// Read or corpse Take, and turns the page on a terminal result.
import { useEffect } from 'react';
import type { Game, GameSubscription } from '../../packages/game-view/session.ts';
import type { BookProps } from './Book.tsx';
import { pagesAfter, restoredItemPages, type Page } from './model.ts';
import type { presenter } from './presenter.ts';

export type Presenter = ReturnType<typeof presenter>;
type Screen = ReturnType<Presenter['screen']>;

export type BookState = {
  restoreInvocation: { current: string | undefined };
  current: { current: { stack: Page[]; view: ReturnType<Presenter['screen']>['view'] } };
  setStack: (stack: Page[]) => void;
  setFlip: (next: (f: { turn: number; dir: 1 | -1 }) => { turn: number; dir: 1 | -1 }) => void;
  redraw: (next: (n: number) => number) => void;
};

export function resultPages(next: Page[], screen: ReturnType<Presenter['screen']>) {
  if (screen.returnWorld && !screen.view.combat) return [];
  if (!screen.returnDetail) return next;
  const index = next.findIndex((p) => p.kind === 'thing' && p.id === screen.returnDetail);
  if (index >= 0) return next.slice(0, index + 1);
  const corpse: Page[] = [{ kind: 'thing', id: screen.returnDetail }];
  return pagesAfter(corpse, screen.view, screen.view);
}
export function useUpdates(p: BookProps, pr: Presenter, s: BookState) {
  useEffect(() => {
    let live = true;
    const unsubscribe = p.game.subscribe((update) => {
      if (live) applyUpdate(p, pr, s, update);
    });
    return () => {
      live = false;
      unsubscribe();
    };
  }, [p.game, pr, p.shell.recovered]);
}

function applyUpdate(p: BookProps, pr: Presenter, s: BookState, update: GameSubscription) {
  const { current, setStack, setFlip, redraw } = s;
  const before = current.current;
  const terminal = pr.update(update);
  const after = pr.screen();
  let next = pagesAfter(before.stack, before.view, after.view);
  next = restoredCompletion(p, s, update, after, next);
  if (terminal) next = resultPages(next, after);
  current.current = { stack: next, view: after.view };
  setStack(next);
  if (terminal && next !== before.stack) setFlip((f) => ({ turn: f.turn + 1, dir: 1 }));
  redraw((n) => n + 1);
  if (after.pending || after.fault) p.shell.recovered?.(false);
  else if (pr.recovered()) p.shell.recovered?.(true);
}

// A remounted pending Read or corpse Take has no local retry context.
function restoredCompletion(
  p: BookProps,
  s: BookState,
  update: GameSubscription,
  after: Screen,
  next: Page[],
) {
  if (update.kind !== 'completion' || update.invocation_id !== s.restoreInvocation.current)
    return next;
  s.restoreInvocation.current = undefined;
  if (
    update.reply.kind === 'saved' &&
    update.reply.decision.kind === 'accepted' &&
    update.reply.decision.outcome === 'read'
  )
    next = [...restoredItemPages(after.view, after.detail, update.intent.target_ids[0]), ...next];
  if (
    update.reply.kind === 'saved' &&
    update.reply.decision.kind === 'accepted' &&
    update.reply.decision.outcome === 'taken'
  )
    next = takenPages(p, update.reply.command_id, after, next);
  return next;
}

// A restored corpse Take returns to the corpse's page once its receipt names the pickup.
function takenPages(p: BookProps, command_id: string | undefined, after: Screen, next: Page[]) {
  let receipt: ReturnType<Game['lastNarration']>;
  try {
    receipt = p.game.lastNarration(command_id);
  } catch {
    receipt = undefined; // presenter owns the storage fault shown to the player
  }
  if (receipt && receipt.command_id === command_id && receipt.pickup_name && receipt.detail_id)
    return resultPages(next, { ...after, returnDetail: receipt.detail_id, returnWorld: false });
  return next;
}
