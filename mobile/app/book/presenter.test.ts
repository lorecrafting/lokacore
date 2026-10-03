// The presenter over a hand-built Game: the replies' words need no engine, only the boundary.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DecisionResult, Game, Reply } from '../../packages/game-view/session.ts';
import { presenter } from './presenter.ts';
import { detail } from './words.ts';

const VIEW = {
  actions: [],
  entities: [],
  exits: [],
  inventory: [],
  journal: [],
  place: { id: 'p', title: { key: 'place.title' } },
  time: 0,
} as never;
const game = (reply: (n: number) => Reply): Game => {
  let n = 0;
  return {
    view: () => ({ view: VIEW, token: 'view:r:0' }),
    invoke: () => reply(n++),
    pending: () => false,
    text: () => undefined,
    lastNarration: () => undefined,
  };
};
const accepted = (outcome: string) =>
  ({ kind: 'saved', decision: { kind: 'accepted', outcome } as DecisionResult }) as Reply;
const north = { label: 'Go north', action_key: 'move', target_ids: [], input: {} };

// Breaks (R6P rerun N-1): an authority rejection worded "You can't do that: too exhausted." because
// it skips the sentence a refused drag uses for the same code.
test('a move rejected for want of MV says the body is too exhausted', () => {
  const rejected = { kind: 'rejected', error: { code: 'insufficient_resource' } } as DecisionResult;
  const p = presenter(game(() => ({ kind: 'saved', decision: rejected })));
  p.press(north);
  assert.deepEqual(p.screen().log, ['> Go north', 'You are too exhausted.']);
});

// Breaks (R6P-A04): a log that keeps every press while the process lives (memory, redraws).
test('the log stops growing in one room, its last line the latest answer', () => {
  const p = presenter(game((n) => accepted(n % 2 ? 'dropped' : 'taken')));
  const cycles = () => {
    for (let i = 0; i < 150; i++) [north, north].map(p.press);
    return p.screen().log;
  };
  const [once, log] = [cycles().length, cycles()];
  assert.deepEqual([log.length, ...log.slice(-2)], [once, '> Go north', 'Dropped.']);
});

// Breaks (review N-1): a Start over that is not confirmed shown as its empty message, or a failed
// one hiding its own message behind "not confirmed".
test('the save-error line says a pending start over in words and shows any other message', () => {
  const failed = { message: '', startOver: true };
  assert.equal(detail({ ...failed, code: 'start_over_pending' }), 'start over not confirmed');
  assert.equal(detail({ ...failed, message: 'disk I/O error' }), 'disk I/O error');
});
