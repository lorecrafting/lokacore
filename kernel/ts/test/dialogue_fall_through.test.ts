import assert from 'node:assert/strict';
import { test } from 'node:test';
import { oneTalk, onward } from '../src/mechanics/dialogue/fall_through.ts';
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
  for (const op of ['skill.acquire', 'resource.adjust', 'item.move', 'fact.adjust'])
    assert.equal(ways({ steps: [{ op }] }), 0, op);
  for (const op of ['narrate', 'topic.grant', 'fact.assign'])
    assert.equal(ways({ steps: [{ op }] }), 1, op);
});

// Breaks: a named talk, a quest offer or an authored alias collapses into the speaker's one Talk.
test('one unnamed Talk per speaker, the first that opens; other rows stay', () => {
  const set = {
    shut: { command: 'talk', speaker: 'x' },
    open: { command: 'talk', speaker: 'x' },
    later: { command: 'talk', speaker: 'x' },
    named: { command: 'talk', speaker: 'x', dialogue: {} },
    quest: { command: 'accept_quest', speaker: 'x' },
    alias: { command: 'talk' },
  };
  const row = (action_key: string) => ({ action_key, available: action_key !== 'shut' });
  assert.deepEqual(
    oneTalk(set, Object.keys(set).map(row)).map((r) => r.action_key),
    ['open', 'named', 'quest', 'alias'],
  );
});
