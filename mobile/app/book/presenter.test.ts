// The presenter over a hand-built Game: the replies' words need no engine, only the boundary.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DecisionResult, Game, GameView, Reply } from '../../packages/game-view/session.ts';
import { presenter } from './presenter.ts';
import { chapterLabel, comings, detail } from './words.ts';

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
    pendingInvocation: () => undefined,
    subscribe: (listener) => {
      listener({
        kind: 'state',
        projection: { view: VIEW, token: 'view:r:0' },
        status: { kind: 'ready' },
      });
      return () => {};
    },
    text: () => undefined,
    lastNarration: () => undefined,
  };
};
const accepted = (outcome: string) =>
  ({
    kind: 'saved',
    decision: { kind: 'accepted', events: [], outcome } as DecisionResult,
  }) as Reply;
const north = { label: 'Go north', action_key: 'move', target_ids: [], input: {} };

// Breaks: a pending/refused item or Leave reply leaves detail as if the action committed.
test('pending and refused Take/Drop/Leave retain detail routing and unchanged custody', () => {
  for (const action of ['take', 'drop', 'close_choice']) {
    for (const pending of [true, false]) {
      const item = { id: 'lantern', kind: 'item', name: 'item.lantern', actions: [] };
      const context = action === 'close_choice' ? 'bram' : 'lantern';
      const view = {
        ...(VIEW as object),
        inventory: action === 'drop' ? [item] : [],
        entities: action === 'take' ? [item] : [],
        ...(action === 'close_choice' && {
          choice: {
            continuation_id: 'choice-1',
            speaker_id: 'bram',
            prompt: { key: 'choice.prompt' },
            choices: [],
          },
        }),
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
      p.press(
        {
          label: action,
          action_key: action,
          target_ids: action === 'close_choice' ? [] : ['lantern'],
          input: action === 'close_choice' ? { continuation_id: 'choice-1' } : {},
          token: 'view:r:0',
        },
        context,
      );
      assert.equal(p.screen().returnWorld, false);
      assert.equal(p.screen().view, view);
      assert.equal(p.screen().view.inventory.length, action === 'drop' ? 1 : 0);
      assert.deepEqual(p.screen().log, []);
      assert.equal(p.screen().pending, pending);
      assert.deepEqual(
        p.screen().detail(context).slice(-1),
        pending
          ? action === 'close_choice'
            ? ['choice.prompt']
            : []
          : ["You can't do that: not here."],
      );
    }
  }
});

// Breaks: an item quest consequence is classified as NPC dialogue, or an unchanged journal repeats a cue.
test('journal cues belong only to changed NPC histories', () => {
  for (const kind of ['npc', 'item']) {
    let view = {
      ...(VIEW as object),
      entities: [{ id: 'target', kind, name: 'target', actions: [] }],
    } as never;
    const p = presenter({
      ...game(() => accepted('opened')),
      view: () => ({ view, token: 'view:r:0' }),
      invoke: () => {
        view = {
          ...(view as object),
          journal: [
            {
              state: 'active',
              title: 'quest.title',
              journal: 'quest.journal',
              quest: { key: 'lantern', cartridge_id: 'test', cartridge_version: '1' },
            },
          ],
        } as never;
        return accepted('opened');
      },
    });
    const button = { label: 'Open', action_key: 'open', target_ids: ['target'], input: {} };
    p.press(button, 'target');
    p.press(button, 'target');
    assert.deepEqual(
      p.screen().detail('target'),
      kind === 'npc'
        ? ['Opened.', { text: 'Journal updated', event: true }, 'Opened.']
        : ['Opened.', 'Opened.'],
    );
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
          events: [],
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
            events: [],
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
          events: [],
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
// one hiding its own message behind "not confirmed"; a bare kind code or the browser's raw OPFS
// lock message or any other raw exception text shown to the player.
test('the save-error line says a pending start over in words and never shows a raw message', () => {
  const failed = { message: '', startOver: true };
  assert.equal(detail({ ...failed, code: 'start_over_pending' }), 'Start over was not confirmed.');
  assert.equal(detail({ ...failed, message: 'disk I/O error' }), 'The save could not be opened.');
  const missing = 'pinned_release_missing';
  assert.equal(detail({ ...failed, kind: missing, message: missing }), undefined);
  assert.equal(detail(failed), undefined); // no message: no line, never a bare ''
  const lock =
    'Access Handles cannot be created if there is another open Access Handle or Writable stream associated with the same file.';
  assert.equal(detail({ ...failed, message: lock }), 'Loka is already open in another tab.');
});

// Break: failed recovery of receipt routing falls back to showing combat prose in World.
test('a narration recovery fault holds combat results while their line routing is unavailable', () => {
  for (const result of [
    { outcome: 'engaged', events: [] },
    { outcome: 'fled', events: [] },
    { outcome: 'waited', events: [{ payload: { type: 'attack_result' } }] },
  ]) {
    let committed = false;
    const p = presenter({
      ...game(() => accepted(result.outcome)),
      invoke: () => {
        committed = true;
        return {
          kind: 'saved',
          decision: { kind: 'accepted', events: [], ...result, narration: [{ key: 'strike' }] },
        } as Reply;
      },
      lastNarration: () => {
        if (committed) throw new Error('receipt temporarily unavailable');
        return undefined;
      },
    });
    p.press(north);
    assert.deepEqual(p.screen().log, []);
    assert.deepEqual(p.screen().combatLog, []);
    assert.match(p.screen().fault!, /narration recovery unavailable/);
  }
});

// Break: state delivery followed by reservation completion erases onset history or doubles escape.
test('combat receipt history is once-only when completion follows an already displayed state', () => {
  const view = (extra = {}) => ({ ...(VIEW as object), ...extra }) as GameView;
  let current = view(),
    token = 'view:quiet';
  let last: ReturnType<Game['lastNarration']>;
  const p = presenter({
    ...game(() => accepted('engaged')),
    text: () => 'The marsh rat falls.',
    view: () => ({ view: current, token }),
    lastNarration: () => last,
    pendingInvocation: () => 'reserved',
    invoke: () => ({ kind: 'catching_up', invocation_id: 'reserved' }),
  });
  for (const [key, after] of [
    [
      'combat.result',
      view({ combat: { encounter_id: 'fight', opponent_id: 'rat', name: 'npc.rat' } }),
    ],
    [
      'combat.result',
      view({ combat: undefined, place: { id: 'road', title: { key: 'road.title' } } }),
    ],
  ] as const) {
    const before = { view: current, token };
    p.press({ label: 'Act', action_key: 'flee', target_ids: [], input: {} });
    current = after;
    token += 'next';
    last = { command_id: token, lines: [{ key }], combat_lines: [0] } as never;
    p.update({ kind: 'state', projection: { view: current, token }, status: { kind: 'ready' } });
    p.update({
      kind: 'completion',
      invocation_id: 'reserved',
      intent: {} as never,
      before,
      reply: {
        kind: 'saved',
        decision: { kind: 'accepted', events: [], outcome: 'fled', narration: [{ key }] } as never,
      },
    });
  }
  assert.deepEqual(p.screen().combatLog, ['The marsh rat falls.', 'The marsh rat falls.']);
  assert.deepEqual(p.screen().log, []);
});

// Breaks: an NPC whose cartridge name starts lower case ("a crow") leaves or arrives mid-sentence.
test('a coming or going starts its sentence with a capital', () => {
  const at = (...names: string[]) =>
    ({
      place: { id: 'green' },
      entities: names.map((name) => ({ id: name, name, kind: 'npc' })),
    }) as unknown as GameView;
  assert.deepEqual(
    comings(at('a crow'), at('a fox'), (s) => s),
    ['A crow leaves.', 'A fox arrives.'],
  );
});

// Breaks: the label counts from the zero-based declaration index ("Chapter zero") or a chapter past
// the words shows "Chapter undefined".
test('the chapter label names the declaration index counted from one', () => {
  assert.equal(chapterLabel(0), 'Chapter one');
  assert.equal(chapterLabel(11), 'Chapter twelve');
  assert.equal(chapterLabel(12), 'Chapter 13');
});
