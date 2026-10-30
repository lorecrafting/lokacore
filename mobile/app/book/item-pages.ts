import type { GameView } from '../../packages/game-view/session.ts';
import type { Page, Thing } from './model.ts';

export const things = (v: GameView): Thing[] =>
  [
    ...v.entities,
    ...v.inventory,
    ...(v.equipment ?? []).flatMap((s) => (s.item ? [s.item] : [])),
  ].flatMap((e) => [e, ...(e.contents ?? [])]);
// The things directly inside a container (or held by a person).
export const within = (v: GameView, id: string) =>
  things(v).filter((e) => 'container_id' in e && e.container_id === id);
// Its contents are reachable: an open lid, or contents the GameView lists (book-ui.md, Item details).
export const opens = (v: GameView, thing: Thing) =>
  thing.state === 'open' || within(v, thing.id).length > 0;

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
    // a person's Held list stays on their page (Npc.tsx); a container's goes through its Inside page
    if (at)
      parents.unshift(
        { kind: 'thing', id: at.id },
        ...(at.kind === 'npc' ? [] : [{ kind: 'inside', id: at.id } as const]),
      );
  }
  return [{ kind: 'carrying' }, ...parents, { kind: 'thing', id: book.id }];
}
