import assert from 'node:assert/strict';
import { test } from 'node:test';
import { onward } from '../src/mechanics/dialogue/fall_through.ts';
import type { World } from '../src/runtime/decision.ts';

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
  for (const gate of [
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
  ])
    assert.equal(ways({ [gate]: {} }), 0, gate);
  assert.equal(ways({ steps: [{ op: 'skill.acquire' }] }), 0);
});
