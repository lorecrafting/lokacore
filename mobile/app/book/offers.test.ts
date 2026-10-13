import assert from 'node:assert/strict';
import { test } from 'node:test';
import { priceNote, serviceButtons } from './offers.ts';

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
      ],
    },
  ],
};
const text = (k: string) => ({ 'service.deposit': 'Deposit ten pennies' })[k] ?? k;

// Breaks (PM ruling 2026-10-13): a bank or repair offer labelled with the meal's MV suffix, or a
// bank fee shown as a bare price. Npc.tsx shows the same priceNote in parentheses.
test('Book service labels: a bank fee, the MV note only on a meal or drink', () => {
  assert.deepEqual(
    serviceButtons(view as never, text).map((b) => b.label),
    [
      'Deposit ten pennies — fee 1p',
      'service.withdraw — fee 1p',
      'service.meal — 2p; up to +4 MV, capped',
      'service.repair — 3p',
    ],
  );
  assert.equal(priceNote(view.entities[0]!.services[1] as never), 'fee 1p');
});
