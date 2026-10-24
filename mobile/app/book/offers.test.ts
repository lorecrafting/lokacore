import assert from 'node:assert/strict';
import { test } from 'node:test';
import { offerLabel, priceNote, serviceButtons, serviceOrder, talkOf } from './offers.ts';

const offer = (key: string, price: number, benefit: object) => ({
  service: { kind: 'service', key },
  label: `service.${key}`,
  price,
  benefit,
  action: { available: true, action_key: 'use_service', command: 'use_service', target_ids: [] },
});
const view = {
  entities: [
    {
      id: 'clerk',
      services: [
        offer('deposit', 1, { kind: 'deposit', account: {}, vault: {}, amount: 10 }),
        offer('withdraw', 1, { kind: 'withdraw', account: {}, vault: {}, amount: 10 }),
        offer('meal', 2, { kind: 'meal', amount: 4 }),
        offer('repair', 3, { kind: 'repair', amount: 5 }),
        offer('barter', 0, { kind: 'goods' }),
      ],
    },
  ],
};
const text = (k: string) => ({ 'service.deposit': 'Deposit ten pennies' })[k] ?? k;

// Breaks (PM ruling 2026-10-13): a bank or repair offer labelled with the meal's MV suffix, or a
// bank fee shown as a bare price; a price-0 barter labelled with " — 0p" or "(0p)" (hs-8).
test('Book service labels: a bank fee, the MV note only on a meal or drink', () => {
  assert.deepEqual(
    serviceButtons(view as never, text).map((b) => b.label),
    [
      'Deposit ten pennies — fee 1p',
      'service.withdraw — fee 1p',
      'service.meal — 2p; up to +4 MV, capped',
      'service.repair — 3p',
      'service.barter',
    ],
  );
  // The NPC page's unavailable card (Npc.tsx) wraps the note; a price-0 barter still shows none.
  const [meal, barter] = [2, 4].map((i) => view.entities[0]!.services[i] as never);
  const wrapped = (n: string) => ` (${n})`;
  assert.equal(offerLabel(meal, text, wrapped), 'service.meal (2p; up to +4 MV, capped)');
  assert.equal(offerLabel(barter, text, wrapped), 'service.barter');
  assert.equal(priceNote(view.entities[0]!.services[1] as never), 'fee 1p');
});

// Breaks: the commission stays beside an open order, claim and cancel show with no order (refused
// service.no_order) or leave the Your order group, or another service's order hides this one.
test('an open order hides its commission and groups claim and cancel', () => {
  const ref = (key: string) => ({ kind: 'service', key });
  const follow = (kind: string, of: string, no_order: boolean) => ({
    ...offer(`${kind}_${of}`, 0, { kind, service: ref(of) }),
    action: no_order
      ? { available: false, action_key: kind, reason: { message: { key: 'service.no_order' } } }
      : { available: true, action_key: kind },
  });
  const keys = (o: ReturnType<typeof serviceOrder>) =>
    [o.plain, o.order].map((l) => l.map((s) => s.service.key));
  const offers = (no_order: boolean) =>
    [
      offer('boots', 4, { kind: 'commission' }),
      follow('claim', 'boots', no_order),
      follow('cancel', 'boots', no_order),
      offer('ale', 1, { kind: 'entitlement' }),
    ] as never;
  assert.deepEqual(keys(serviceOrder(offers(false))), [['ale'], ['claim_boots', 'cancel_boots']]);
  assert.deepEqual(keys(serviceOrder(offers(true))), [['boots', 'ale'], []]);
});

// Breaks: two talk offers draw two Talk cards, an authored-label talk folds into Talk, or a
// talk button leaks into the person's other buttons.
test('several talks collapse into the first available; an authored talk stays apart', () => {
  const npc = {
    actions: [
      { action_key: 't1', label: 'action.talk' },
      { action_key: 't2', label: 'actions.talk' },
      { action_key: 'fine', label: 'dialogue.clerk_fine.open' },
    ],
  };
  const b = (action_key: string) => ({ action_key, label: action_key }) as never;
  const { talk, rest } = talkOf(npc, [b('t2'), b('take'), b('t1'), b('fine')]);
  assert.equal(talk?.action_key, 't2');
  assert.deepEqual(
    rest.map((r) => r.action_key),
    ['take', 'fine'],
  );
  assert.equal(talkOf(npc, [b('take')]).talk, undefined);
});
