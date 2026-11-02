// A corpse's short names its victim in narration (owner decision 2026-11-02); expected words by hand.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GameView } from '../../packages/game-view/session.ts';
import { lineWords } from './words.ts';
import { picks } from './pick.ts';
import { buttonsOf } from './buttons.ts';

const TEXT: Record<string, string> = {
  'item.put': 'You put {item} in {container}.',
  'item.ear': 'an ear',
  'corpse.short': 'the corpse of {victim}',
  'goblin.short': 'a goblin',
};
const say = (k: string) => TEXT[k] ?? k;
const view = {
  actor_id: 'a',
  place: { id: 'p', title: 't', description: 'd' },
  exits: [],
  actions: [],
  entities: [
    { id: 'c2', name: 'corpse.short', victim: 'item.ear' },
    { id: 'c1', name: 'corpse.short', victim: 'goblin.short' },
  ],
  inventory: [],
  journal: [],
  time: 0,
} as unknown as GameView;

// Breaks: a narration slot that leaves `{victim}` raw, or names another corpse's victim.
test('a put into a corpse names that corpse victim', () => {
  const line = {
    key: 'item.put',
    bindings: { item: 'item.ear', container: 'corpse.short' },
    participants: { container: 'c1' },
  };
  assert.equal(lineWords(line, say, view), 'You put an ear in the corpse of a goblin.');
});

// Breaks: a pick row's accessible name that reads the corpse target's raw `{victim}`.
test('a pick on a corpse names its victim', () => {
  const button = {
    label: 'Oil',
    action_key: 'oil',
    target_ids: ['c1', 'can'],
    input: {},
    pick: {},
  };
  const v = { ...view, inventory: [{ id: 'can', name: 'an oilcan' }] } as unknown as GameView;
  const [row] = picks(v, [button], 'c1', say)[0]!.rows;
  assert.equal(row && 'b' in row && row.name, 'An oilcan, oil the corpse of a goblin');
});

// Breaks: a held thing's card that names its corpse destination by the raw `{victim}`.
test('a put into a corpse card names its victim', () => {
  const put = { label: 'Put', action_key: 'put', command: 'put', target_ids: ['ear', 'c1'] };
  const ear = { id: 'ear', name: 'item.ear', actions: [{ ...put, available: true, input: [] }] };
  const entities = view.entities.map((e) => ({ ...e, actions: [] }));
  const v = { ...view, entities, inventory: [ear] } as unknown as GameView;
  const labels = buttonsOf(v, say, say).map((b) => b.label);
  assert.ok(labels.includes('Put an ear in the corpse of a goblin'), labels.join(' | '));
});
