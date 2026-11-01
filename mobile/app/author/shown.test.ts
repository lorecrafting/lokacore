// The author panel's State and Why read (docs/system/cartridge.md#author-preview).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GameView } from '../../packages/game-view/session.ts';
import { shown, type Canon } from './shown.ts';

const ref = (kind: string, key: string) => ({
  cartridge_id: 'c',
  cartridge_version: '1',
  kind,
  key,
});
const view = {
  place: { id: 'r1', title: { key: 'room.t' } },
  entities: [
    { id: 'n1', kind: 'npc', name: 'npc.maud' },
    { id: 'i1', kind: 'item', name: 'item.stone' },
  ],
  inventory: [{ id: 'i2', kind: 'item', name: 'item.lamp' }],
  resources: [
    {
      resource: { key: 'health' },
      current: 3,
      maximum: 9,
      band: 'hurt',
      tone: 'warn',
    },
  ],
  conditions: [{ label: 'status.cold', resource: 'cold', ends_at: 40 }],
  time: { label: 'dusk' },
  choice: {
    prompt: { key: 'choice.p' },
    choices: [{ choice_id: 'a', label: 'choice.a', available: true }],
  },
} as unknown as GameView;
const canon: Canon = {
  scripted_actions: {
    a: { key: 'here', target: { kind: 'detail', room: ref('room', 'r') } },
    b: { key: 'there', target: { kind: 'detail', room: ref('room', 'other') } },
    c: { key: 'tool', target: { kind: 'use' } },
  },
  dialogues: {
    d: { key: 'with_maud', npc: ref('npc', 'maud') },
    e: { key: 'with_bram', npc: ref('npc', 'bram') },
  },
};
const rooms = {
  'c@1:room/r': 'r1',
  'c@1:room/other': 'r2',
};
const ids = {
  'c@1:npc/maud': 'n1',
  'c@1:npc/bram': 'n2',
};
const words: Record<string, string> = { 'room.t': 'Cellar', 'npc.maud': 'Maud', 'choice.a': 'Yes' };

// Breaks: an item listed among the people; a key shown where its words exist; a key with no words lost.
test('the view reads with its words, a key standing in for a line with none', () => {
  const { offers: _, ...state } = shown(view, (k) => words[k], canon, ids, rooms);
  assert.deepEqual(state, {
    room: 'Cellar',
    people: ['Maud'],
    held: ['item.lamp'],
    pools: [{ key: 'health', current: 3, maximum: 9, band: 'hurt', tone: 'warn' }],
    statuses: [{ label: 'status.cold', ends_at: 40 }],
    clock: { time: { label: 'dusk' }, calendar: undefined },
    choice: { prompt: 'choice.p', options: ['Yes'] },
  });
});

// Breaks: a detail action of another room offered; a tool action tied to a room; a dialogue offered
// whose NPC is elsewhere.
test('offers are this room: its details, any tool or spell, and the dialogues of who is here', () => {
  assert.deepEqual(shown(view, () => undefined, canon, ids, rooms).offers, {
    action: ['here', 'tool'],
    dialogue: ['with_maud'],
  });
});
