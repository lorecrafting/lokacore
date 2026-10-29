import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validate } from '../src/foundation/validate.ts';

const ref = (kind: string, key: string) => ({
  cartridge_id: 'quest_sampler',
  cartridge_version: '0.0.1',
  kind,
  key,
});
// Compiled-form literals; each test first checks its literal validates unchanged.
const quest = {
  key: 'find_key',
  name: 'quest.find_key.title',
  objective: { evidence: 'post_activation_event', item_acquired: ref('item', 'key') },
  deadline: { after: 120000, outcome: 'late' },
};
const choice = {
  label: 'dialogue.pay.label',
  narration: 'narration.pay',
  payment: { from: 'payer', resource: ref('resource', 'pennies'), amount: 10 },
};
const npc = {
  key: 'payer',
  keywords: ['payer'],
  name: 'npc.payer.short',
  room_line: 'npc.payer.room',
  description: 'npc.payer.description',
  room: ref('room', 'hall'),
  resource_starts: { pennies: 10 },
};

// Break: a deadline without its outcome validates. Since row W24 the schema requires only the
// outcome; a legacy deadline missing its time, fact or trust fields is the loader's
// SCHEMA_VIOLATION (test/quest_deadline.test.ts).
test('deadline requires its outcome', () => {
  assert.deepEqual(validate('QuestDefinition', quest), []);
  const changed = structuredClone(quest) as any;
  delete changed.deadline.outcome;
  assert.ok(validate('QuestDefinition', changed).length);
});

// Breaks: dropping a payment field or positive amount bound admits an unpayable turn-in.
test('payment requires an explicit payer, resource and positive amount', () => {
  assert.deepEqual(validate('DialogueChoice', choice), []);
  for (const field of ['from', 'resource', 'amount']) {
    const changed = structuredClone(choice) as any;
    delete changed.payment[field];
    assert.ok(validate('DialogueChoice', changed).length, field);
  }
  for (const amount of [0, 2147483648]) {
    const changed = structuredClone(choice);
    changed.payment.amount = amount;
    assert.ok(validate('DialogueChoice', changed).length, String(amount));
  }
});

// Breaks: malformed NPC funding keys or values become fresh-world resource rows.
test('NPC resource starts retain bounded values and key grammar', () => {
  assert.deepEqual(validate('NpcDefinition', npc), []);
  for (const resource_starts of [{ Pennies: 10 }, { pennies: 2147483648 }]) {
    const changed = { ...npc, resource_starts };
    assert.ok(validate('NpcDefinition', changed).length, JSON.stringify(resource_starts));
  }
});
