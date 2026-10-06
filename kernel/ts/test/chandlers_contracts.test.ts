import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validate } from '../src/foundation/validate.ts';
import { read } from './read.ts';

const chapter = read('protocol/fixtures/missing_child_v016_hash.json').value;
const quest = chapter.quests['ashmere_missing_child@0.0.16:quest/chandlers_debt'];
const choice =
  chapter.dialogues['ashmere_missing_child@0.0.16:dialogue/a_aldric_debt'].choices.on_time;
const aldric = chapter.npcs['ashmere_missing_child@0.0.16:npc/aldric'];

// Breaks: dropping a deadline required field lets a quest schedule or settle without its authority.
test('deadline requires its time, outcome, fact and trust fields', () => {
  for (const field of ['at', 'outcome', 'fact', 'trust_fact', 'trust_amount']) {
    const changed = structuredClone(quest);
    delete changed.deadline[field];
    assert.ok(validate('QuestDefinition', changed).length, field);
  }
});

// Breaks: dropping a payment field or positive amount bound admits an unpayable turn-in.
test('payment requires an explicit payer, resource and positive amount', () => {
  for (const field of ['from', 'resource', 'amount']) {
    const changed = structuredClone(choice);
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
  for (const resource_starts of [{ Pennies: 10 }, { pennies: 2147483648 }]) {
    const changed = { ...aldric, resource_starts };
    assert.ok(validate('NpcDefinition', changed).length, JSON.stringify(resource_starts));
  }
});
