import type { GameView } from '../../packages/game-view/session.ts';
import type { Page, Thing } from './model.ts';

export const things = (v: GameView): Thing[] =>
  [
    ...v.entities,
    ...v.inventory,
    ...(v.equipment ?? []).flatMap((s) => (s.item ? [s.item] : [])),
  ].flatMap((e) => [e, ...(e.contents ?? [])]);

export function restoredItemPages(
  view: GameView,
  detail: (id: string) => unknown[],
  confirmedRead?: string,
): Page[] {
  if (view.combat || view.scene) return [];
  const items = things(view);
  const book = items.find(
    (e) =>
      (confirmedRead ? e.id === confirmedRead : detail(e.id).length) &&
      e.actions.some((a) => (a.command ?? a.action_key) === 'read'),
  );
  if (!book) return [];
  const parents: Page[] = [];
  let at: Thing | undefined = book;
  while (at && 'container_id' in at) {
    const parent: string = at.container_id;
    at = items.find((e) => e.id === parent);
    if (at) parents.unshift({ kind: 'thing', id: at.id });
  }
  return [{ kind: 'carrying' }, ...parents, { kind: 'thing', id: book.id }];
}
