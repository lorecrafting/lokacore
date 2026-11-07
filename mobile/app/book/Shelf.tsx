// A shopkeeper's buy and sell pages, child pages of their NPC page (book-ui.md, NPC dialogue and action details).
import { View } from 'react-native';
import { ItemPop } from './ItemPop.tsx';
import type { GameView } from '../../packages/game-view/session.ts';
import { cap, type group, type Page as Route } from './model.ts';
import type { Button, presenter } from './presenter.ts';
import { ActionCard, Cards, useFocus } from './actions.tsx';
import { LogLines, Note } from './lines.tsx';
import { space } from './tokens.ts';
import { Control, Page } from './pages.tsx';
import { LABEL } from './labels.ts';
import { things } from './item-pages.ts';
import { balance, buyReason, buysTitle, sellReason, sellsTitle } from './words.ts';
type Screen = ReturnType<ReturnType<typeof presenter>['screen']>;
type Say = (key: string) => string;
type Stock = NonNullable<GameView['entities'][number]['shop']>[number];

// ponytail: GameView has no currency field, so the purse is the resource keyed 'pennies'; name a
// cartridge currency in GameView if a second one appears.
export const purse = (v: GameView) =>
  v.resources?.find((r) => r.resource.key === 'pennies')?.current;

// One shop line: shown "A cob of bread, 4p.", its noun the link, named "A cob of bread, 4p. Buy for 4 pennies.".
type Line = { label: string; link: string; name: string } & ({ b: Button } | { reason: string });
const line = (v: GameView, o: Stock, text: Say, price: number, verb: (n: number) => string) => {
  const w = things(v).find((e) => e.id === o.item_id)?.words;
  const noun = text(w?.bare ?? o.name);
  const link = w?.article ? noun : cap(noun);
  const label = LABEL.shopLine(w?.article ? `${cap(w.article)} ${link}` : link, price);
  return { label, link, name: `${label} ${verb(price)}` };
};

// One sell-page line per thing the player may sell; stock the player does not hold is no line.
const sales = (v: GameView, shop: readonly Stock[], sells: Button[], text: Say): Line[] =>
  shop.flatMap((o): Line[] => {
    const l = line(v, o, text, o.sell.price, LABEL.sellFor);
    const b = sells.find((s) => s.target_ids[1] === o.item_id);
    if (b) return [{ ...l, b }];
    return o.sell.message ? [{ ...l, reason: sellReason(o.sell, text) }] : [];
  });

// One buy-page line per stock row; a refused one keeps its words.ts reason.
const buys = (v: GameView, shop: readonly Stock[], offered: Button[], text: Say): Line[] =>
  shop.map((o) => {
    const l = line(v, o, text, o.buy.price, LABEL.buyFor);
    const b = offered.find((b) => b.action_key === 'buy' && b.target_ids[1] === o.item_id);
    return b ? { ...l, b } : { ...l, reason: buyReason(o.buy.reason ?? '') };
  });

// A pressed line that goes (the last one sold, or sold out) moves focus to the page title.
function ShopLines(p: { view: GameView; rows: Line[]; press: (b: Button) => void }) {
  const { sent } = useFocus(
    undefined,
    p.view,
    p.rows.filter((r) => 'b' in r),
  );
  return (
    <Cards lines>
      {p.rows.map((r) =>
        'b' in r ? (
          <ActionCard
            key={r.label}
            {...r}
            press={(b) => {
              sent.current = r.label;
              p.press(b);
            }}
          />
        ) : (
          <ActionCard key={r.label} {...r} />
        ),
      )}
    </Cards>
  );
}

// The pop's anchor: a buy writes no line here (book-ui.md, quiet), so it may hang from the balance.
function Bought(
  p: {
    money?: number;
    lines: Parameters<typeof LogLines>[0]['lines'];
  } & Parameters<typeof ItemPop>[0], // mutate-skip: type
) {
  if (p.money === undefined && !p.lines.length) return null;
  return (
    // The pop hangs below this block: room for its line beside the block gap, clear of the card under it.
    <View style={{ gap: space.xl, paddingBottom: space.xs }}>
      {p.money !== undefined && <Note>{balance(p.money)}</Note>}
      {!!p.lines.length && <LogLines lines={p.lines} />}
      <ItemPop view={p.view} text={p.text} />
    </View>
  );
}

/**
 * A shopkeeper's shop, two child pages of their NPC page (owner picks mvlrlvappy4w, mvlymuams73l,
 * mvlynyikyw57, 2026-10-23).
 * - Use: the buy page the NPC page's Trade card opens, and the sell page its Sell card opens;
 *   Leave returns one page.
 * - Rules: the buy page, titled `<Name> can sell you…`, draws one shop line per stock row
 *   (ActionCard's line form, book-ui.md Shop lines: `A cob of bread, 4p.`, the noun the
 *   link, named `A cob of bread, 4p. Buy for 4 pennies.`; refused, the same line, its press graying it with
 *   `You can't afford it.`), the purse Note, this visit's history, then the Sell card, drawn only
 *   with a line. The sell page, titled `<Name> will buy…`, draws one line per thing the player may
 *   sell (`… Sell for N pennies.`), then the purse and history. A buy or sale keeps its page, no page turn (owner,
 *   2026-10-23): its line joins the person's visit history (shared with the NPC page), the purse
 *   and the list redraw (sold out takes the refused form; a thing sold leaves the sell list), and
 *   a line that goes moves focus to the page title. No status line (a detail page).
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
      <ShopLines view={view} rows={rows} press={press} />
      <Bought money={money} lines={p.screen.detail(p.id)} view={view} text={text} />
      {!p.sale && sell.length > 0 && (
        <Cards>
          <ActionCard label={LABEL.sell} onPress={() => p.open({ kind: 'sale', id: p.id })} />
        </Cards>
      )}
    </Page>
  );
}
