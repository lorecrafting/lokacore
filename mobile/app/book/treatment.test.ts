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

// Breaks: a treated scene keeps the status line (book-ui.md, Book treatments).
test('a treated scene draws no status line', async () => {
  const { view: base } = await import('./__tests__/combat-book.test.ts');
  const { mounted } = await import('./__tests__/mounted.ts');
  const { validate } = await import('../../authority/local-story/__tests__/validate.ts');
  const id = '00000000-0000-4000-8000-000000000000'; // the harness's ids are not schema ids
  const ref = { cartridge_id: 'c', cartridge_version: '0.0.1', kind: 'scene', key: 's' };
  const at = (treatment?: string) =>
    base({ combat: undefined, scene: { scene: ref, line: 'l', index: 1, count: 2, treatment } });
  const { combat: _, ...wire } = at('reverie');
  const { place } = wire as { place: object };
  const valid = { ...wire, actor_id: id, place: { ...place, id }, entities: [] };
  assert.deepEqual(validate('GameView', valid), []);
  const scene = (treatment?: string) => mounted(at(treatment));
  assert.ok(scene().texts().includes('sitting'), 'a plain scene keeps it (the position)');
  assert.deepEqual(scene('reverie').texts(), ['l']); // the line alone
});
