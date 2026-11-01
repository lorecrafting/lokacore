import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { onward } from '../src/mechanics/dialogue/fall_through.ts';
import type { World } from '../src/runtime/decision.ts';

const gates = [
  'accept',
  'availability',
  'check',
  'escort',
  'exchange',
  'hand_over',
  'lesson_payment',
  'patrol',
  'payment',
  'receive',
];
const notGates = [
  'asked_when',
  'label',
  'narration',
  'narration_variants',
  'policy',
  'steps',
  'then',
  'then_failed',
];

const npc = { cartridge_id: 'c', cartridge_version: '0.0.1', kind: 'npc', key: 'guard' };

// Breaks: a Talk falls through a choice that can refuse or charge when taken, for free.
test('a gated choice is no way on for a fall-through', () => {
  const hub = { key: 'hub', npc, choices: {} };
  const world = { cartridge: { dialogues: { hub } } } as unknown as World;
  const ways = (choice: object) =>
    onward(world, {
      key: 'g',
      npc,
      choices: { go: { then: 'hub', ...choice } },
    } as unknown as Parameters<typeof onward>[1]).length;
  assert.equal(ways({}), 1);
  for (const gate of gates) assert.equal(ways({ [gate]: {} }), 0, gate);
  for (const op of ['skill.acquire', 'resource.adjust', 'item.move', 'fact.adjust'])
    assert.equal(ways({ steps: [{ op }] }), 0, op);
  for (const op of ['narrate', 'topic.grant', 'fact.assign'])
    assert.equal(ways({ steps: [{ op }] }), 1, op);
});

// Breaks: a field added to DialogueChoice that can refuse or charge is left out of GATES, so a
// fall-through takes it for free; the new field must be classified here.
test('every DialogueChoice field is a gate or a known non-gate', () => {
  const schema = JSON.parse(
    readFileSync(new URL('../../../protocol/dialogue.schema.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(
    Object.keys(schema.$defs.DialogueChoice.properties).sort(),
    [...gates, ...notGates].sort(),
  );
});
