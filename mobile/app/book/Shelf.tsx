// A shopkeeper's shelf, a child page of their NPC page (book-ui.md, NPC dialogue and action details).
import type { GameView } from '../../packages/game-view/session.ts';
import { cap, type group } from './model.ts';
import type { Button, presenter } from './presenter.ts';
import { ActionCard, Cards, PickLists } from './actions.tsx';
import { LogLines, Note } from './lines.tsx';
import { Control, Page } from './pages.tsx';
import { LABEL } from './labels.ts';
import { things } from './item-pages.ts';
import type { Row } from './pick.ts';
import { balance, buyReason, sellReason, shelfTitle } from './words.ts';
type Screen = ReturnType<ReturnType<typeof presenter>['screen']>;
type Say = (key: string) => string;
type Stock = NonNullable<GameView['entities'][number]['shop']>[number];

// ponytail: GameView has no currency field, so the purse is the resource keyed 'pennies'; name a
// cartridge currency in GameView if a second one appears.
export const purse = (v: GameView) =>
  v.resources?.find((r) => r.resource.key === 'pennies')?.current;

// A row's bare name, "Cob of bread", from the stocked thing's words, else its short name.
const bare = (v: GameView, o: Stock, text: Say) =>
  cap(text(things(v).find((e) => e.id === o.item_id)?.words?.bare ?? o.name));

// One Sell… row per thing the player may sell; stock the player does not hold is no row.
const sales = (v: GameView, shop: readonly Stock[], sells: Button[], text: Say): Row[] =>
  shop.flatMap((o): Row[] => {
    const label = `${bare(v, o, text)} — ${o.sell.price}p`;
    const b = sells.find((s) => s.target_ids[1] === o.item_id);
    if (b) return [{ b, label, name: label }];
    return o.sell.message ? [{ label, reason: sellReason(o.sell, text) }] : [];
  });

/**
 * A shopkeeper's shelf: the purse, one buy card per row, then the Sell… list (owner pick
 * mvlrlvappy4w, 2026-10-23).
 * - Use: the child page the NPC page's Buy or sell card opens; Leave returns to the person.
 * - Rules: the purse Note first; a buy card reads `Cob of bread — 4p`, refused as its Note form
 *   with a words.ts reason (`… — 4p: can't afford`); Sell… is a PickLists option, its rows the
 *   sellable things with their prices, and drawn only with a row. A buy or sale keeps the page:
 *   its line joins the person's visit history (shared with the NPC page) and the purse redraws. No status line (a detail page).
 * - States: buyable; refused; Sell… open; nothing to sell.
 * - Story: NpcPage.stories.tsx
 */
export function ShelfPage(p: {
  id: string;
  screen: Screen;
  g: ReturnType<typeof group>;
  press: (b: Button, detail?: string) => void;
  back: () => void;
}) {
  const { view, text } = p.screen;
  const npc = view.entities.find((e) => e.id === p.id);
  const shop = npc?.shop ?? [];
  const offered = p.g.on(p.id);
  // The person's visit history: the authority routes a sale's line to the NPC (narration.ts).
  const press = (b: Button) => p.press(b, p.id);
  const sell = sales(
    view,
    shop,
    offered.filter((b) => b.action_key === 'sell'),
    text,
  );
  const money = purse(view);
  return (
    <Page
      title={shelfTitle(cap(text(npc?.name ?? '')))}
      foot={<Control label={LABEL.leave} onPress={p.back} />}
    >
      {money !== undefined && <Note>{balance(money)}</Note>}
      <LogLines lines={p.screen.detail(p.id)} />
      <Cards>
        {shop.map((o) => {
          const label = `${bare(view, o, text)} — ${o.buy.price}p`;
          const b = offered.find((b) => b.action_key === 'buy' && b.target_ids[1] === o.item_id);
          return b ? (
            <ActionCard key={o.item_id} b={b} label={label} press={press} />
          ) : (
            <ActionCard key={o.item_id} label={label} reason={buyReason(o.buy.reason ?? '')} />
          );
        })}
      </Cards>
      {sell.length > 0 && (
        <PickLists
          page={`shelf:${p.id}`}
          view={view}
          lists={[{ label: LABEL.sell, rows: sell }]}
          text={text}
          press={press}
          pending={p.screen.pending}
        />
      )}
    </Page>
  );
}
