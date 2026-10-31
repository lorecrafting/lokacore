// size: allow 510, the replies share one hand-built Game and its view helpers (loka-x6t.102)
// The presenter over a hand-built Game: the replies' words need no engine, only the boundary.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DecisionResult, Game, GameView, Reply } from '../../packages/game-view/session.ts';
import { cardKey, presenter } from './presenter.ts';
import { chapterLabel, comings, detail, sayers } from './words.ts';

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
      p.screen(); // mounted: the live region reads only what comes after
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
      const refused = { kind: 'refused', reason: 'not here', text: "You can't do that—not here." };
      // A detail-page refusal is in place and in the room log (book-ui.md Line placement), read once.
      assert.deepEqual(p.screen().log, pending ? [] : [refused]);
      assert.equal(p.screen().pending, pending);
      const placed = pending ? (action === 'close_choice' ? ['choice.prompt'] : []) : [refused];
      assert.deepEqual(p.screen().detail(context).slice(-1), placed);
      const said = { log: 1, place: VIEW.place.id, key: 1, text: `not here, ${refused.text}` };
      if (!pending) assert.deepEqual(p.screen().said, said);
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
      ...game(() => accepted('waited')),
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
        return accepted('waited');
      },
    });
    const button = { label: 'Open', action_key: 'open', target_ids: ['target'], input: {} };
    p.press(button, 'target');
    p.press(button, 'target');
    assert.deepEqual(
      p.screen().detail('target'),
      kind === 'npc'
        ? ['Time passes.', { text: 'Journal updated', event: true }, 'Time passes.']
        : ['Time passes.', 'Time passes.'],
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
  const unsupported = {
    kind: 'refused',
    reason: 'not in this book',
    text: "You can't do that—not in this book.",
  };
  assert.deepEqual(p.screen().log, [unsupported]);
  p.press(north);
  assert.deepEqual(p.screen().log, [unsupported, 'The page had changed; here it is again.']);
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

const choice = (closable: boolean) => ({
  speaker_id: 'bram',
  prompt: { key: 'p' },
  continuation_id: 'c',
  choices: [],
  closable,
});
const bram = (closable: boolean, reply: (n: number) => Reply) =>
  presenter({
    ...game(reply),
    view: () => ({
      view: { ...(VIEW as object), choice: choice(closable) } as never,
      token: 'view:r:0',
    }),
    text: () => 'Would you fetch it?',
  });
const close = { label: 'Leave', action_key: 'close_choice', target_ids: [], input: {} };
const refused = { kind: 'saved', decision: { kind: 'rejected', error: { code: 'x' } } } as Reply;

// Breaks: a refused Leave the conversation empties the choice's question, or stays armed and a
// later typed close empties it (loka-x6t.102).
test("a refused Leave the conversation keeps the open choice's question", () => {
  const p = bram(true, (n) => (n === 0 ? refused : accepted('choice_closed')));
  p.screen().leave('bram');
  p.press(close, 'bram');
  assert.ok(p.screen().detail('bram').includes('Would you fetch it?'));
  p.press(close, 'bram'); // a typed close: no Leave
  assert.ok(p.screen().detail('bram').includes('Would you fetch it?'));
});

// Breaks: a Leave with no close to press (not closable) empties the history at the next answer.
test('a Leave without a close press keeps the history through the next answer', () => {
  const p = bram(false, () => accepted('choice_answered'));
  p.screen().leave('bram');
  p.press({ label: 'Yes', action_key: 'choose', target_ids: [], input: {} }, 'bram');
  assert.ok(p.screen().detail('bram').includes('Would you fetch it?'));
});

// Breaks (R6P rerun N-1): an authority rejection worded "You can't do that—too exhausted." because
// it skips the sentence a refused drag uses for the same code.
test('a move rejected for want of MV says the body is too exhausted', () => {
  const rejected = { kind: 'rejected', error: { code: 'insufficient_resource' } } as DecisionResult;
  const p = presenter(game(() => ({ kind: 'saved', decision: rejected })));
  p.press(north);
  assert.deepEqual(p.screen().log, [
    { kind: 'refused', reason: 'too exhausted', text: 'You are too exhausted.' },
  ]);
});

// Breaks (Q13 option A): an authority rejection while sitting reads "You can't do that—not now."
// because the answer drops the GameError's cause.
test('a move rejected while sitting says the player is not standing', () => {
  const rejected = {
    kind: 'rejected',
    error: { code: 'invalid_state', cause: 'not_standing' },
  } as DecisionResult;
  const p = presenter(game(() => ({ kind: 'saved', decision: rejected })));
  p.press(north);
  assert.deepEqual(p.screen().log, [
    { kind: 'refused', reason: 'not standing', text: 'You are not standing.' },
  ]);
});

// Breaks (loka-x6t.38): a remove refused by a curse reads "You can't do that—it will not come off."
// because the sentence table lacks the cursed cause.
test('a remove refused by a curse says it will not come off', () => {
  const rejected = {
    kind: 'rejected',
    error: { code: 'invalid_state', cause: 'cursed' },
  } as DecisionResult;
  const p = presenter(game(() => ({ kind: 'saved', decision: rejected })));
  p.press(north);
  assert.deepEqual(p.screen().log, [
    { kind: 'refused', reason: 'it will not come off', text: 'It will not come off.' },
  ]);
});

// Breaks (R6P-A04): a log that keeps every press while the process lives (memory, redraws).
test('the log stops growing in one room, its last line the latest answer', () => {
  const p = presenter(game((n) => accepted(n % 2 ? 'waited' : 'activated')));
  const cycles = () => {
    for (let i = 0; i < 150; i++) [north, north].map((b) => p.press(b));
    return p.screen().log;
  };
  const [once, log] = [cycles().length, cycles()];
  const last = ['You take on the task. It is in your journal.', 'Time passes.'];
  assert.deepEqual([log.length, ...log.slice(-2)], [once, ...last]);
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
  // The room log holds each combat line once too; the road's starts empty, so only the flee's shows.
  assert.deepEqual(p.screen().log, ['The marsh rat falls.']);
});

// Breaks: an NPC whose cartridge name starts lower case ("a crow") leaves or arrives mid-sentence.
test('a coming or going starts its sentence with a capital; a killed NPC does not leave', () => {
  const at = (...names: string[]) =>
    ({
      place: { id: 'green' },
      entities: names.map((name) => ({ id: name, name, kind: 'npc' })),
    }) as unknown as GameView;
  assert.deepEqual(
    comings(at('a crow'), at('a fox'), (s) => s),
    ['A crow leaves.', 'A fox arrives.'],
  );
  // Breaks (loka-y6yg.44): an NPC a spell killed outside a fight "leaves" after the kill line.
  const died = (type: string) => [{ payload: { type, victim_id: 'a crow' } }] as never;
  assert.deepEqual(
    comings(at('a crow', 'a fox'), at('a fox'), (s) => s, died('entity_died')),
    [],
  );
  const other = comings(at('a crow'), at(), (s) => s, died('status_applied'));
  assert.deepEqual(other, ['A crow leaves.']);
});

// Breaks (loka-y6yg.44): the reply path drops the decision events, so a spell-killed NPC "leaves".
test('an accepted reply that kills an NPC prints no leaves line', () => {
  const crow = { id: 'crow', name: 'Crow', kind: 'npc', actions: [] };
  let current = { ...(VIEW as object), entities: [crow] } as GameView;
  const p = presenter({
    ...game(() => accepted('cast')),
    view: () => ({ view: current, token: String(current.entities.length) }),
    invoke: () => {
      current = { ...(VIEW as object), entities: [] } as GameView;
      return {
        kind: 'saved',
        decision: {
          kind: 'accepted',
          outcome: 'cast',
          events: [{ payload: { type: 'entity_died', victim_id: 'crow' } }],
        },
      } as never;
    },
  });
  p.press(north);
  assert.ok(!p.screen().log.some((line) => line.includes('leaves')), p.screen().log.join('|'));
});

// Breaks: the label counts from the zero-based declaration index ("Chapter zero") or a chapter past
// the words shows "Chapter undefined".
test('the chapter label names the declaration index counted from one', () => {
  assert.equal(chapterLabel(0), 'Chapter one');
  assert.equal(chapterLabel(11), 'Chapter twelve');
  assert.equal(chapterLabel(12), 'Chapter 13');
});

// Breaks (loka-x6t.18): cards keyed by label, so Aldous's two Talk dialogues share one React key.
test('two offers with one label keep two card keys; one offer keeps one', () => {
  const talk = { label: 'Talk to Aldous', target_ids: ['aldous'], input: {} };
  const keys = [
    { ...talk, action_key: 'aldous_talk' },
    { ...talk, action_key: 'aldous_yard' },
    { ...talk, action_key: 'aldous_talk', target_ids: ['wat'] },
    { ...talk, action_key: 'aldous_talk', input: { word: 'steel' } },
  ].map(cardKey);
  assert.equal(new Set(keys).size, 4);
  assert.equal(cardKey({ ...talk, action_key: 'aldous_talk' }), keys[0]);
});

// Breaks (loka-x6t.36): the dark room's engine line shows its raw key, or overrides authored text.
test('place.dark reads the engine line unless the cartridge words it', () => {
  const say = (words: Record<string, string>) =>
    sayers({ text: (key: string) => words[key] } as unknown as Game).text('place.dark' as never);
  assert.equal(say({}), "It's too dark to see...");
  assert.equal(say({ 'place.dark': 'Pitch black.' }), 'Pitch black.');
});
