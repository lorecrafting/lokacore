// The screen's treatment (book-ui.md, Book treatments): the view's, until a fault.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Game } from '../../packages/game-view/session.ts';
import { presenter } from './presenter.ts';

const view = {
  actions: [],
  entities: [],
  exits: [],
  inventory: [],
  journal: [],
  time: 0,
  place: { id: 'p', title: { key: 'p' } },
};
const projection = {
  view: { ...view, scene: { treatment: 'reverie' } },
  token: 'view:r:0',
} as never;
const game = {
  view: () => projection,
  invoke: () => {
    throw new Error('down');
  },
  pending: () => false,
  pendingInvocation: () => undefined,
  subscribe: () => () => {},
  text: () => undefined,
  lastNarration: () => undefined,
} as unknown as Game;

// Breaks: a fault leaves the treatment drawn, hiding the footer's fault (Ends: the scene shows plain).
test('a fault shows a treated scene plain', () => {
  const p = presenter(game);
  assert.equal(p.screen().treatment, 'reverie');
  p.press({ label: 'Go north', action_key: 'move', target_ids: [], input: {} });
  assert.ok(p.screen().fault);
  assert.equal(p.screen().treatment, undefined);
});
