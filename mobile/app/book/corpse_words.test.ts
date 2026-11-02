// A corpse's short names its victim in narration (owner decision 2026-11-02); expected words by hand.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GameView } from '../../packages/game-view/session.ts';
import { lineWords } from './words.ts';

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
    { id: 'c1', name: 'corpse.short', victim: 'goblin.short' },
    { id: 'c2', name: 'corpse.short', victim: 'item.ear' },
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
