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

// Breaks: a valid pending/refused item reply asks the book to leave detail as if custody changed.
test('pending and refused Take/Drop retain detail routing and unchanged custody', () => {
  for (const action of ['take', 'drop']) {
    for (const pending of [true, false]) {
      const item = { id: 'lantern', kind: 'item', name: 'item.lantern', actions: [] };
      const view = {
        ...(VIEW as object),
        inventory: action === 'drop' ? [item] : [],
        entities: action === 'take' ? [item] : [],
      } as never;
      const p = presenter({
        ...game(() =>
          pending
            ? { kind: 'pending' }
            : ({
                kind: 'saved',
                decision: { kind: 'rejected', error: { code: 'not_present' } },
              } as Reply),
        ),
        view: () => ({ view, token: 'view:r:0' }),
        pending: () => pending,
      });
      p.press({ label: action, action_key: action, target_ids: ['lantern'], input: {} });
      assert.equal(p.screen().returnWorld, false);
      assert.equal(p.screen().view, view);
      assert.equal(p.screen().view.inventory.length, action === 'drop' ? 1 : 0);
      assert.deepEqual(p.screen().log, [
        pending
          ? '(pending: not confirmed saved; press any button to retry it)'
          : "You can't do that: not here.",
      ]);
    }
  }
});

// Breaks: recovery guesses that retained narration was navigation and drops an authored consequence.
test('recovery removes the current heading but retains an unclassified consequence', () => {
  const restored = {
    ...game(() => accepted('looked')),
    lastNarration: () => ({
      command_id: 'saved-command',
      lines: [{ key: 'place.title' }, { key: 'quest.consequence' }],
    }),
    text: (key: string) =>
      key === 'quest.consequence' ? 'The lantern is yours to carry now.' : 'Ferry Landing',
  };
  assert.deepEqual(presenter(restored).screen().log, ['The lantern is yours to carry now.']);
});

// Breaks: an old rejection follows accepted movement, or reset happens after the new authored result.
test('confirmed room change clears old history before adding new authored consequences', () => {
  let view = VIEW;
  let calls = 0;
  const g = {
    ...game(() => accepted('looked')),
    view: () => ({ view, token: 'view:r:0' }),
    text: (key: string) =>
      key === 'move.consequence' ? 'The gate closes behind you.' : 'New room',
    invoke: (): Reply => {
      if (calls++ === 0)
        return {
          kind: 'saved',
          decision: { kind: 'rejected', error: { code: 'unsupported_capability' } },
        } as Reply;
      if (calls === 2) return { kind: 'stale_view' };
      view = { ...(VIEW as object), place: { id: 'new', title: { key: 'new.title' } } } as never;
      return {
        kind: 'saved',
        decision: {
          kind: 'accepted',
          outcome: 'moved',
          narration: [{ key: 'new.title' }, { key: 'move.consequence' }],
        },
      } as Reply;
    },
  };
  const p = presenter(g);
  p.press(north);
  assert.deepEqual(p.screen().log, ["You can't do that: unsupported capability."]);
  p.press(north);
  assert.deepEqual(p.screen().log, [
    "You can't do that: unsupported capability.",
    'The page had changed; here it is again.',
  ]);
  p.press(north);
  assert.deepEqual(p.screen().log, ['The gate closes behind you.']);
});

// Breaks: routine Close echoes on World, or suppressing it also discards a genuine authored consequence.
test('World omits the routine Close fallback while retaining authored consequences', () => {
  assert.deepEqual(presenter(game(() => accepted('choice_closed'))).screen().log, []);
  const p = presenter(game(() => accepted('choice_closed')));
  p.press(north);
  assert.deepEqual(p.screen().log, []);
  const authored = presenter({
    ...game(
      () =>
        ({
          kind: 'saved',
          decision: {
            kind: 'accepted',
            outcome: 'choice_closed',
            narration: [{ key: 'quest.changed' }],
          },
        }) as Reply,
    ),
    text: () => 'Bram nods toward the path north.',
  });
  authored.press(north);
  assert.deepEqual(authored.screen().log, ['Bram nods toward the path north.']);
});

// Breaks: a durable choice result already restored into detail is appended again when its receipt settles.
test('a restored committed narration is not duplicated by its pending receipt retry', () => {
  const choice = {
    speaker_id: 'bram',
    prompt: { key: 'prompt' },
    continuation_id: 'continuation',
    choices: [],
    closable: true,
  };
  let pending = true;
  const g = {
    ...game(() => accepted('choice_closed')),
    view: () => ({
      view: { ...(VIEW as object), choice: pending ? choice : undefined } as never,
      token: 'view:r:0',
    }),
    pending: () => pending,
    text: (key: string) =>
      key === 'prompt' ? 'Would you fetch it?' : 'Bram nods toward the path north.',
    lastNarration: () => ({ command_id: 'committed-choice', lines: [{ key: 'quest.changed' }] }),
    invoke: (): Reply => {
      pending = false;
      return {
        kind: 'saved',
        decision: {
          kind: 'accepted',
          outcome: 'choice_closed',
          narration: [{ key: 'quest.changed' }],
        },
      } as Reply;
    },
  };
  const p = presenter(g);
  p.press({ label: 'Close', action_key: 'close_choice', target_ids: [], input: {} }, 'bram');
  assert.deepEqual(p.screen().detail('bram'), [
    'Bram nods toward the path north.',
    'Would you fetch it?',
  ]);
});

// Breaks (R6P rerun N-1): an authority rejection worded "You can't do that: too exhausted." because
// it skips the sentence a refused drag uses for the same code.
test('a move rejected for want of MV says the body is too exhausted', () => {
  const rejected = { kind: 'rejected', error: { code: 'insufficient_resource' } } as DecisionResult;
  const p = presenter(game(() => ({ kind: 'saved', decision: rejected })));
  p.press(north);
  assert.deepEqual(p.screen().log, ['You are too exhausted.']);
});

// Breaks (R6P-A04): a log that keeps every press while the process lives (memory, redraws).
test('the log stops growing in one room, its last line the latest answer', () => {
  const p = presenter(game((n) => accepted(n % 2 ? 'dropped' : 'taken')));
  const cycles = () => {
    for (let i = 0; i < 150; i++) [north, north].map((b) => p.press(b));
    return p.screen().log;
  };
  const [once, log] = [cycles().length, cycles()];
  assert.deepEqual([log.length, ...log.slice(-2)], [once, 'Taken.', 'Dropped.']);
});

// Breaks (review N-1): a Start over that is not confirmed shown as its empty message, or a failed
// one hiding its own message behind "not confirmed".
test('the save-error line says a pending start over in words and shows any other message', () => {
  const failed = { message: '', startOver: true };
  assert.equal(detail({ ...failed, code: 'start_over_pending' }), 'start over not confirmed');
  assert.equal(detail({ ...failed, message: 'disk I/O error' }), 'disk I/O error');
});
