import type { GameView } from '../../packages/game-view/session.ts';
import type { Page, Thing } from './model.ts';

export const things = (v: GameView): Thing[] =>
  [
    ...v.entities,
    ...v.inventory,
    ...(v.equipment ?? []).flatMap((s) => (s.item ? [s.item] : [])),
  ].flatMap((e) => [e, ...(e.contents ?? []), ...worn(e)]);
// What a person wears that the theft lane does not also list (loka-oc5i). Its take stays refused
// (not_present), which no item page draws (book-ui.md, Item details and Take/Drop).
const worn = (e: Thing) =>
  'worn' in e ? (e.worn ?? []).filter((w) => !e.contents?.some((c) => c.id === w.id)) : [];
// The things directly inside a container (or held by a person).
export const within = (v: GameView, id: string) =>
  things(v).filter((e) => 'container_id' in e && e.container_id === id);
// What a living NPC carries (its Look page, InsidePage): Take on one is the steal (row 33). Shop
// stock is the shop page's and worn items the worn sentence's, not carried.
export const held = (v: GameView, npc: Thing) => {
  const shown = [
    ...('shop' in npc ? (npc.shop ?? []).map((o) => o.item_id) : []),
    ...('worn' in npc ? (npc.worn ?? []).map((w) => w.id) : []),
  ];
  return within(v, npc.id).filter((e) => !shown.includes(e.id));
};
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
    // through the container's Inside page, or the person's Look page
    if (at) parents.unshift({ kind: 'thing', id: at.id }, { kind: 'inside', id: at.id });
  }
  return [{ kind: 'contents' }, { kind: 'carrying' }, ...parents, { kind: 'thing', id: book.id }];
}
