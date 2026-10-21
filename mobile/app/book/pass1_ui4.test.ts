// Pass-1 UI4 (book-ui.md, Detail-page order; NPC details): an item page's option groups (UR), Lift
// on an item an NPC holds (E14), no empty Note beside a refusal (UH3), the purse beside a price (E15).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import type { Game, GameView } from '../../packages/game-view/session.ts';
import { validate } from '../../authority/local-story/__tests__/validate.ts';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import { nodes, words } from './__tests__/polish-book.test.ts';
import { group } from './model.ts';
import { presenter } from './presenter.ts';

const pin = JSON.parse(
  readFileSync(
    new URL('../../../protocol/fixtures/missing_child_v018_hash.json', import.meta.url),
    'utf8',
  ),
);
// Peg's shop in missing_child, the player holding 20 pennies (a real, schema-valid view).
const pegView = () => {
  const a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, pin);
  a.game.invoke({ action_key: 'move', target_ids: [], input: { direction: 'north' } } as never);
  a.game.invoke({ action_key: 'move', target_ids: [], input: { direction: 'west' } } as never);
  return a.game.view().view;
};
const screenOf = (view: GameView) => {
  assert.deepEqual(validate('GameView', view), []);
  const game = {
    view: () => ({ view, token: 'view:t' }),
    pending: () => false,
    subscribe: () => () => {},
    text: () => undefined,
    lastNarration: () => undefined,
  } as unknown as Game;
  return presenter(game).screen();
};
const shown = (drawn: unknown) =>
  nodes(drawn as never)
    .filter((n) => n.type === 'Text')
    .map(words);
const page = async (view: GameView, id: string) => {
  const { Item } = await import('./Menu.tsx');
  const screen = screenOf(view);
  const g = group(screen.buttons);
  return shown(Item({ id, screen, g, press() {}, open() {}, world() {} } as never));
};
const action = (action_key: string, more = {}) => ({
  available: true,
  action_key,
  label: `action.${action_key}`,
  target: { kind: 'entity', scopes: ['room_contents'] },
  input: [],
  ...more,
});
const thing = (id: keyof typeof ID, actions: object[], more = {}) => ({
  id: ID[id],
  name: `item.${id}`,
  kind: 'item',
  actions,
  ...more,
});
const ID = {
  box: '00000000-0000-4000-8000-000000000001',
  coin: '00000000-0000-4000-8000-000000000002',
  corpse: '00000000-0000-4000-8000-000000000003',
  book: '00000000-0000-4000-8000-000000000004',
  purse: '00000000-0000-4000-8000-000000000005',
  pebble: '00000000-0000-4000-8000-000000000006',
};

// Breaks: Take keeps its name on an NPC's item, drops the holder Note or puts it after the card;
// a refused theft still reads Take; or a box's (or the floor's) item shows Lift or the holder Note (E14).
test('an item an NPC holds reads Lift after the holder Note; a box item reads Take', async () => {
  const v = pegView();
  const peg = v.entities.find((e) => e.shop)!;
  const held = (id: keyof typeof ID, holder: string) =>
    thing(id, [action('take')], { container_id: holder });
  const no = action('take', { available: false, reason: { code: 'permission_denied' } });
  const refusedHeld = thing('book', [no], { container_id: peg.id });
  const view = {
    ...v,
    entities: [
      ...v.entities.map((e) =>
        e.id === peg.id ? { ...e, contents: [held('purse', peg.id), refusedHeld] } : e,
      ),
      thing('box', [], { contents: [held('coin', ID.box)] }),
      thing('pebble', [action('take')]),
    ],
  } as GameView;
  const purse = await page(view, ID.purse);
  assert.deepEqual(purse.slice(-3), ['Npc.peg.short is holding it.', 'Lift', 'Leave']);
  assert.ok((await page(view, ID.book)).includes('Lift: not yours.'));
  for (const id of ['coin', 'pebble'] as const) {
    const lines = await page(view, ID[id]);
    assert.ok(lines.includes(`Take item.${id}`), JSON.stringify(lines));
    assert.ok(
      !lines.some((l) => l === 'Lift' || l.endsWith('is holding it.')),
      JSON.stringify(lines),
    );
  }
});

// Breaks: a detail page lists its options in GameView order instead of act, move, store (UR):
// a corpse's Put into before its Take, a book's Take before its Read.
test('detail options: act on it, then move it, then store it', async () => {
  const v = pegView();
  const view = {
    ...v,
    entities: [
      ...v.entities,
      thing('coin', []),
      thing('corpse', [action('put', { target_ids: [ID.coin, ID.corpse] }), action('take')]),
      thing('book', [action('take'), action('read')]),
    ],
  } as GameView;
  const corpse = await page(view, ID.corpse);
  const take = corpse.indexOf('Take item.corpse');
  const put = corpse.findIndex((l) => l.startsWith('Put'));
  assert.ok(take >= 0 && put > take, JSON.stringify(corpse));
  const book = await page(view, ID.book);
  const read = book.indexOf('Read item.book');
  assert.ok(read >= 0 && book.indexOf('Take item.book') > read, JSON.stringify(book));
});

// Breaks: "Nothing to do here." draws beside a "not yours" note (UH3), or no longer draws on a
// page with neither notes, actions nor contents.
test('the empty Note only when nothing, not even a refusal, shows', async () => {
  const v = pegView();
  const refused = action('take', { available: false, reason: { code: 'permission_denied' } });
  const view = {
    ...v,
    entities: [...v.entities, thing('coin', [refused]), thing('pebble', [])],
  } as GameView;
  const coin = await page(view, ID.coin);
  assert.ok(coin.includes('action.take: not yours.'), JSON.stringify(coin));
  assert.ok(!coin.includes('Nothing to do here.'), JSON.stringify(coin));
  assert.ok((await page(view, ID.pebble)).includes('Nothing to do here.'));
});

// Breaks: the balance Note is missing beside a shelf or a priced service (the bank's fee is 1p),
// sits after the shelf rows, repeats, or shows beside a free service or no offer at all (E15).
test('one balance Note after the description on a page with a priced offer', async () => {
  const { NpcPage } = await import('./Npc.tsx');
  const v = pegView();
  const peg = v.entities.find((e) => e.shop)!;
  const service = (price: number) => ({
    service: { ...v.resources![0]!.resource, kind: 'service', key: 'fee' },
    label: 'service.fee',
    price,
    benefit: {
      kind: 'entitlement',
      fact: { ...v.resources![0]!.resource, kind: 'fact', key: 'paid' },
    },
    action: { ...action('use_service'), command: 'use_service', target_ids: [peg.id] },
  });
  const draw = (npc: object) => {
    const view = { ...v, entities: v.entities.map((e) => (e.id === peg.id ? npc : e)) } as GameView;
    const s = screenOf(view);
    const at = s.view.entities.find((e) => e.id === peg.id);
    return shown(
      NpcPage({ ...s, npc: at, g: group(s.buttons), press() {}, leave() {}, open() {} } as never),
    );
  };
  const { shop: _shop, ...bare } = peg;
  const shelf = draw(peg);
  assert.deepEqual(shelf.slice(1, 4), [
    'npc.peg.description',
    'You have 20p.',
    'item.torch.short: Buy 3p; Sell 1p (you are not holding it).',
  ]);
  assert.equal(shelf.filter((l) => l === 'You have 20p.').length, 1);
  assert.ok(draw({ ...bare, services: [service(1)] }).includes('You have 20p.'));
  assert.ok(!draw({ ...bare, services: [service(0)] }).includes('You have 20p.'));
  assert.ok(!draw(bare).some((l) => l.startsWith('You have')));
});
