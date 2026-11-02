// Pass-1 UI4 (book-ui.md, Detail-page order; NPC details): an item page's option groups (UR), Lift
// on an item an NPC holds (E14), no filler line on an empty page (mvlyb5x2m9i3), the purse beside a price (E15).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import type { Game, GameView } from '../../packages/game-view/session.ts';
import { compiled } from '../../authority/local-story/__tests__/compiled.ts';
import { validate } from '../../authority/local-story/__tests__/validate.ts';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import { book, nodes, words } from './__tests__/polish-book.test.ts';
import { LABEL } from './labels.ts';
import { group } from './model.ts';
import { reason, replyLine } from './words.ts';
import { presenter } from './presenter.ts';

// Nell's shop on the showcase's village green, the player holding 10 pennies (resources.json start;
// a real, schema-valid view).
const nellView = () => {
  const a = elapsedHost(
    ':memory:',
    { wall: 10000, mono: 0 },
    compiled('cartridges/toolbox_showcase') as never,
  );
  a.game.invoke({ action_key: 'move', target_ids: [], input: { direction: 'south' } } as never);
  return a.game.view().view;
};
const screenOf = (view: GameView, text: (k: string) => string | undefined = () => undefined) => {
  assert.deepEqual(validate('GameView', view), []);
  const game = {
    view: () => ({ view, token: 'view:t' }),
    pending: () => false,
    subscribe: () => () => {},
    text,
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
  return shown(Item({ id, screen, g, press() {}, open() {}, world() {}, back() {} } as never));
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

// Breaks: Take keeps its name on an NPC's item, drops the holder Note or puts it after the card,
// or its foot reads Back to container for a person (loka-x6t.68);
// a refused theft still reads Take or reads before the holder Note; or a box's (or the floor's) item shows Lift or the holder Note (E14).
test('an item an NPC holds reads Lift after the holder Note; a box item reads Take', async () => {
  const v = nellView();
  const nell = v.entities.find((e) => e.shop)!;
  const held = (id: keyof typeof ID, holder: string) =>
    thing(id, [action('take')], { container_id: holder });
  const [read, take] = [action('read'), action('take')];
  const no = action('take', { available: false, reason: { code: 'permission_denied' } });
  const refusedHeld = thing('book', [no], { container_id: nell.id });
  const view = {
    ...v,
    entities: [
      ...v.entities.map((e) =>
        e.id === nell.id
          ? { ...e, contents: [{ ...held('purse', nell.id), actions: [read, take] }, refusedHeld] }
          : e,
      ),
      thing('box', [], { contents: [held('coin', ID.box)] }),
      thing('pebble', [action('take')]),
    ],
  } as GameView;
  const purse = await page(view, ID.purse);
  assert.deepEqual(purse.slice(-4), [
    'Npc.nell.short is holding it.',
    'Read item.purse',
    'Lift',
    'Leave',
  ]);
  const book = await page(view, ID.book);
  const [holder, lift] = ['Npc.nell.short is holding it.', 'Lift'].map((l) => book.indexOf(l));
  assert.ok(holder >= 0 && lift > holder, JSON.stringify(book)); // book-ui.md: holder Note first
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
// a corpse's Put into before its Take, a book's Take before its Read; or hands after asks and
// services or before an act, or asks and services leave GameView order among themselves.
test('detail options: act on it, then move it, then store it', async () => {
  const v = nellView();
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
  const on = (action_key: string) => ({ action_key, target_ids: [ID.coin], input: {} });
  const order = group([on('use_service'), on('give'), on('read'), on('ask')] as never).on(ID.coin);
  assert.deepEqual(
    order.map((b) => b.action_key),
    ['read', 'give', 'use_service', 'ask'],
  );
});

// Breaks: a refused two-target offer that is no use pair (a Put resting, cooldown) is let through
// as a use pair would be and draws as an available card, or goes missing as a use pair's Pick
// list row would.
test('a resting Put draws as its unavailable card', async () => {
  const v = nellView();
  const resting = {
    available: false,
    reason: { code: 'cooldown' },
    target_ids: [ID.coin, ID.corpse],
  };
  const view = {
    ...v,
    entities: [...v.entities, thing('coin', []), thing('corpse', [action('put', resting)])],
  } as GameView;
  const corpse = await page(view, ID.corpse);
  assert.deepEqual(
    corpse.filter((l) => l.startsWith('Put')),
    ['Put'],
  );
});

// Breaks: an item page with no actions, contents or notes draws a filler line instead of title,
// description, Leave (owner pick mvlyb5x2m9i3); or a cartridge without action label text prints the
// refusal's raw key, "action.take" (loka-x6t.53).
test('a refusal reads its word; an empty item page draws no filler', async () => {
  const v = nellView();
  const refused = action('take', { available: false, reason: { code: 'permission_denied' } });
  const view = {
    ...v,
    entities: [...v.entities, thing('coin', [refused]), thing('pebble', [])],
  } as GameView;
  const coin = await page(view, ID.coin);
  assert.ok(coin.includes('Take'), JSON.stringify(coin)); // its plain verb; the reason waits for a press
  const pebble = await page(view, ID.pebble);
  assert.equal(pebble.at(-1), LABEL.leave, JSON.stringify(pebble));
  assert.ok(!pebble.includes('Nothing to do here.'), JSON.stringify(pebble));
});

// Breaks: the balance Note is missing beside a priced service (the bank's fee is 1p), sits away
// from the description, repeats, or shows beside a shop alone (the shelf page has it), a free
// service or no offer at all (E15; owner pick mvlrlvappy4w).
test('one balance Note after the description on a page with a priced service', async () => {
  const { NpcPage } = await import('./Npc.tsx');
  (globalThis as any)[Symbol.for('loka-book-test-state')] ??= (v: unknown) => [v, () => {}]; // no Book harness here
  const v = nellView();
  const nell = v.entities.find((e) => e.shop)!;
  const service = (price: number) => ({
    service: { ...v.resources![0]!.resource, kind: 'service', key: 'fee' },
    label: 'service.fee',
    price,
    benefit: {
      op: 'entitlement',
      fact: { ...v.resources![0]!.resource, kind: 'fact', key: 'paid' },
    },
    action: { ...action('use_service'), command: 'use_service', target_ids: [nell.id] },
  });
  const draw = (npc: object, talking = false) => {
    const view = {
      ...v,
      entities: v.entities.map((e) => (e.id === nell.id ? npc : e)),
    } as GameView;
    const s = screenOf(view);
    const at = s.view.entities.find((e) => e.id === nell.id);
    return shown(
      NpcPage({
        ...s,
        npc: at,
        g: group(s.buttons),
        talking,
        press() {},
        leave() {},
        open() {},
      } as never),
    );
  };
  const { shop: _shop, ...bare } = nell;
  assert.ok(!draw(nell).some((l) => l.startsWith('You have')));
  const priced = draw({ ...bare, services: [service(1)] });
  assert.deepEqual(priced.slice(1, 3), ['npc.nell.description', 'You have 10p.']);
  assert.equal(priced.filter((l) => l === 'You have 10p.').length, 1);
  assert.ok(!draw({ ...bare, services: [service(1)] }, true).includes('You have 10p.')); // a conversation hides it
  assert.ok(!draw({ ...bare, services: [service(0)] }).includes('You have 10p.'));
  assert.ok(!draw(bare).some((l) => l.startsWith('You have')));
});

// Breaks: a permanent refusal (cannot_be_hurt; loka-3751) draws a grayed card, or the hidden list
// swallows a refusal the player could change (book-ui.md, Unavailable actions).
test('an unavailable card hides for a permanent refusal and shows for a changeable one', async () => {
  const { ActionCard } = await import('./actions.tsx');
  const card = (reason: string) => ActionCard({ label: 'Attack', reason });
  assert.equal(card('cannot be hurt'), null);
  assert.notEqual(card(reason('sanctuary', 'sanctuary')), null); // the exception: it teaches a rule
  assert.notEqual(card('too heavy'), null);
});

// Breaks: the NPC page drops a sanctuary's grey Attack or its sentence, widens grey to an ordinary
// refusal, or draws a card for one who cannot be hurt; or the logged refusal loses the sentence.
test('an Attack in a sanctuary is grey with its one sentence, on the page and in the log', async () => {
  const { NpcPage } = await import('./Npc.tsx');
  (globalThis as any)[Symbol.for('loka-book-test-state')] ??= (v: unknown) => [v, () => {}];
  const v = nellView();
  const nell = v.entities.find((e) => e.shop)!;
  const text = (k: string) => (k === 'combat.sanctuary' ? 'Placeholder sentence.' : k);
  const attackOf = (reason: object, npcFields: object = {}) => {
    const offer = { ...action('attack', { available: false, reason }), target_ids: [nell.id] };
    const view = {
      ...v,
      entities: v.entities.map((e) => (e === nell ? { ...e, ...npcFields, actions: [offer] } : e)),
    } as GameView;
    const s = screenOf(view, text);
    const npc = s.view.entities.find((e) => e.id === nell.id);
    const page = { ...s, text, npc, g: group(s.buttons), press() {}, leave() {}, open() {} };
    return nodes(NpcPage(page as never) as never)
      .map((n) => (n.props as { accessibilityHint?: string }).accessibilityHint)
      .filter(Boolean);
  };
  const message = { key: 'combat.sanctuary' };
  const sanctuary = { code: 'invalid_state', cause: 'sanctuary', message };
  assert.deepEqual(attackOf(sanctuary), ['Placeholder sentence.']);
  assert.deepEqual(attackOf(sanctuary, { hostile: true }), ['Placeholder sentence.']);
  assert.deepEqual(attackOf({ code: 'invalid_state' }), []);
  assert.deepEqual(attackOf({ code: 'invalid_target', cause: 'cannot_be_hurt' }), []);
  const reply = { kind: 'saved', decision: { kind: 'rejected', error: sanctuary } } as const;
  assert.deepEqual(replyLine(reply as never, text, v), [
    { kind: 'refused', reason: 'sanctuary', text: 'Placeholder sentence.' },
  ]);
});

// Breaks: the card reads its label key, or a press stays silent, or touches the world; or a cartridge
// with no line shows the raw key on the card or in the log.
test('a press on a sanctuary Attack logs its line and changes nothing; no line reads Not here', () => {
  const run = (keep: boolean) => {
    const c = JSON.parse(compiled('cartridges/cellar_sampler').canonical);
    for (const r of Object.values<any>(c.rooms)) r.sanctuary = true;
    c.entry.key = 'lantern_cellar';
    if (!keep) delete c.text['combat.sanctuary'];
    const canonical = JSON.stringify(c);
    const sha256 = createHash('sha256').update(canonical).digest('hex');
    const b = book({ canonical, sha256 } as never);
    const s = b.p.screen();
    const attack = s.buttons.find((x) => x.action_key === 'attack')!;
    const id = attack.target_ids[0]!;
    const hp = () => b.p.screen().view.entities.find((e) => e.id === id);
    const before = JSON.stringify(hp());
    b.p.press(attack, id);
    const log = b.p.screen().detail(id).at(-1) as { text: string };
    assert.equal(JSON.stringify(hp()), before);
    b.sql.close();
    return [attack.label, attack.refused, log.text];
  };
  const line = 'Placeholder for combat.sanctuary.';
  assert.deepEqual(run(true), ['Attack', line, line]);
  assert.deepEqual(run(false), ['Attack', LABEL.notHere, LABEL.notHere]);
});

// Breaks: the World log's refused line brings back its boxed reason chip (a Text of its own), or
// drops the reason from what a screen reader hears (owner pick mvlyp3gphp2t, 2026-10-23).
test('a refused World line is one prose Text; its reason stays in the accessible name', () => {
  const b = book(compiled('cartridges/toolbox_showcase') as never);
  b.p.screen().log.push({ kind: 'refused', reason: 'locked', text: 'The way west is locked.' });
  const line = b.draw().filter((n) => n.type === 'Text' && words(n) === 'The way west is locked.');
  assert.equal(line.length, 1);
  assert.equal(line[0].props.accessibilityLabel, 'locked, The way west is locked.');
  assert.ok(!b.text().includes('locked'), JSON.stringify(b.text()));
  b.sql.close();
});
