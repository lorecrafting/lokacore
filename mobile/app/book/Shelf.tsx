// A shopkeeper's buy and sell pages, child pages of their NPC page (book-ui.md, NPC dialogue and action details).
import type { GameView } from '../../packages/game-view/session.ts';
import { cap, type group, type Page as Route } from './model.ts';
import type { Button, presenter } from './presenter.ts';
import { ActionCard, Cards, useFocus } from './actions.tsx';
import { LogLines, Note } from './lines.tsx';
import { Control, Page } from './pages.tsx';
import { LABEL } from './labels.ts';
import { things } from './item-pages.ts';
import type { Row } from './pick.ts';
import { balance, buyReason, buysTitle, sellReason, sellsTitle } from './words.ts';
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

// One sell-page row per thing the player may sell; stock the player does not hold is no row.
const sales = (v: GameView, shop: readonly Stock[], sells: Button[], text: Say): Row[] =>
  shop.flatMap((o): Row[] => {
    const label = `${bare(v, o, text)} — ${o.sell.price}p`;
    const b = sells.find((s) => s.target_ids[1] === o.item_id);
    if (b) return [{ b, label, name: label }];
    return o.sell.message ? [{ label, reason: sellReason(o.sell, text) }] : [];
  });

// One buy-page row per stock row; a refused one keeps its words.ts reason.
const buys = (v: GameView, shop: readonly Stock[], offered: Button[], text: Say): Row[] =>
  shop.map((o) => {
    const label = `${bare(v, o, text)} — ${o.buy.price}p`;
    const b = offered.find((b) => b.action_key === 'buy' && b.target_ids[1] === o.item_id);
    return b ? { b, label, name: label } : { label, reason: buyReason(o.buy.reason ?? '') };
  });

// A pressed row that goes (the last one sold, or sold out) moves focus to the page title.
function ShopCards(p: { view: GameView; rows: Row[]; press: (b: Button) => void }) {
  const { sent } = useFocus(
    undefined,
    p.view,
    p.rows.filter((r) => 'b' in r),
  );
  return (
    <Cards>
      {p.rows.map((r) =>
        'b' in r ? (
          <ActionCard
            key={r.label}
            b={r.b}
            label={r.label}
            press={(b) => {
              sent.current = r.label;
              p.press(b);
            }}
          />
        ) : (
          <ActionCard key={r.label} label={r.label} reason={r.reason} />
        ),
      )}
    </Cards>
  );
}

/**
 * A shopkeeper's shop, two child pages of their NPC page (owner picks mvlrlvappy4w, mvlymuams73l,
 * mvlynyikyw57, 2026-10-23).
 * - Use: the buy page the NPC page's Trade card opens, and the sell page its Sell card opens;
 *   Leave returns one page.
 * - Rules: the buy page, titled `<Name> can sell you…`, draws one buy card per stock row
 *   (`Cob of bread — 4p`, refused as its Note form with a words.ts reason, `… — 4p: can't
 *   afford`), the purse Note, this visit's history, then the Sell card, drawn only with a row.
 *   The sell page, titled `<Name> will buy…`, draws one card per thing the player may sell with
 *   its price, then the purse and history. A buy or sale keeps its page: its line joins the
 *   person's visit history (shared with the NPC page) and the purse redraws; a row that goes moves
 *   focus to the page title. No status line (a detail page).
 * - States: buyable; refused; sell page; nothing to sell.
 * - Story: NpcPage.stories.tsx
 */
export function ShelfPage(p: {
  id: string;
  sale?: boolean; // the sell page
  screen: Screen;
  g: ReturnType<typeof group>;
  press: (b: Button, detail?: string) => void;
  open: (page: Route) => void;
  back: () => void;
}) {
  const { view, text } = p.screen;
  const npc = view.entities.find((e) => e.id === p.id);
  const shop = npc?.shop ?? [];
  const offered = p.g.on(p.id);
  const sell = sales(
    view,
    shop,
    offered.filter((b) => b.action_key === 'sell'),
    text,
  );
  const money = purse(view);
  const name = cap(text(npc?.name ?? ''));
  const rows = p.sale ? sell : buys(view, shop, offered, text);
  // The person's visit history: the authority routes a sale's line to the NPC (narration.ts).
  const press = (b: Button) => p.press(b, p.id);
  return (
    <Page
      title={p.sale ? buysTitle(name) : sellsTitle(name)}
      foot={<Control label={LABEL.leave} onPress={p.back} />}
    >
      <ShopCards view={view} rows={rows} press={press} />
      {money !== undefined && <Note>{balance(money)}</Note>}
      <LogLines lines={p.screen.detail(p.id)} />
      {!p.sale && sell.length > 0 && (
        <Cards>
          <ActionCard label={LABEL.sell} onPress={() => p.open({ kind: 'sale', id: p.id })} />
        </Cards>
      )}
    </Page>
  );
}
