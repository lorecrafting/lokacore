// Combat narration and encounter lifecycle over controlled Book boundary inputs (the harness:
// __tests__/mounted.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Game } from '../../packages/game-view/session.ts';
import { game, view } from './__tests__/combat-book.test.ts';
import { CONTENTS } from './__tests__/control.test.ts';
import { logMark } from './logs.ts';
import { presenter } from './presenter.ts';
import { validate } from '../../authority/local-story/__tests__/validate.ts';
import { mounted } from './__tests__/mounted.ts';

// Break: a dead combat opponent is narrated both as killed and as leaving the room.
test('committed opponent death narrates once through the existing subscription', () => {
  let current = view({ combat: undefined }),
    token = 'view:1';
  let last: ReturnType<Game['lastNarration']> = {
    command_id: 'before',
    lines: [{ key: 'room.event' }],
  } as never;
  const p = presenter({
    ...game(current),
    text: (key) =>
      ({
        'room.event': 'The bell rings.',
        'ambient.event': 'A door creaks.',
        'combat.result': 'The marsh rat falls.',
      })[key],
    view: () => ({ view: current, token }),
    lastNarration: () => last,
  });
  current = view();
  token = 'view:onset';
  p.update({ kind: 'state', projection: { view: current, token }, status: { kind: 'ready' } });
  current = view({ combat: undefined, entities: [] });
  last = {
    command_id: 'round',
    lines: [{ key: 'combat.result' }, { key: 'ambient.event' }],
    combat_lines: [0],
  } as never;
  for (token of ['view:2', 'view:2', 'view:3'])
    p.update({ kind: 'state', projection: { view: current, token }, status: { kind: 'ready' } });
  // Break (review of #406): a closing receipt's line outside the combat keys (a deer's sight
  // close) lands in the World log, unseen on the ended Combat page (book-ui.md, Closure).
  assert.deepEqual(p.screen().combatLog, ['The marsh rat falls.', 'A door creaks.']);
  // The room log is the full record: the fight's lines land there too, once (book-ui.md Line placement).
  assert.deepEqual(p.screen().log, ['The bell rings.', 'The marsh rat falls.', 'A door creaks.']);
});

// Breaks: a round's miss comes on the clock with no press, and its whisper never reaches the cues.
test('a round on the clock hands its miss to the cues', () => {
  let current = view(),
    token = 'view:1';
  let last: ReturnType<Game['lastNarration']>;
  const p = presenter({
    ...game(current),
    view: () => ({ view: current, token }),
    lastNarration: () => last,
  });
  const round = (record: object) => {
    last = record as never;
    token += '+';
    p.update({ kind: 'state', projection: { view: current, token }, status: { kind: 'ready' } });
  };
  round({ command_id: 'hit', lines: [] });
  assert.equal(p.screen().deed, undefined);
  const miss = { command_id: 'miss', lines: [], missed: true };
  round(miss);
  assert.equal(p.screen().deed, miss);
});

// Breaks: two rounds' lines run together on the Combat page, or one round splits (book-ui.md,
// Live combat response).
test('each round on the clock begins its own block of the combat log', () => {
  let current = view(),
    token = 'view:1';
  let last: ReturnType<Game['lastNarration']>;
  const p = presenter({
    ...game(current),
    text: (key) => ({ 'combat.a': 'A.', 'combat.b': 'B.' })[key],
    view: () => ({ view: current, token }),
    lastNarration: () => last,
  });
  const round = (command_id: string) => {
    last = {
      command_id,
      lines: [{ key: 'combat.a' }, { key: 'combat.b' }],
      combat_lines: [0, 1],
    } as never;
    token += '+';
    p.update({ kind: 'state', projection: { view: current, token }, status: { kind: 'ready' } });
    p.update({ kind: 'state', projection: { view: current, token }, status: { kind: 'ready' } });
  };
  round('one');
  round('two');
  const lines = p.screen().combatLog;
  assert.deepEqual(lines, ['A.', 'B.', 'A.', 'B.']);
  // The one boundary inside the log: between the rounds, none within one.
  assert.deepEqual(
    logMark(lines).rounds.filter((n) => n < lines.length),
    [2],
  );
});

// Breaks: a death that closes no fight (bled out on the clock) turns an earlier fight's closed page into a death's.
test('a death after a closed fight keeps its Back to World', () => {
  const rat = { encounter_id: 'fight', opponent_id: 'rat', name: 'npc.rat' };
  const h = mounted(view({ combat: undefined }));
  try {
    h.publish(
      view({ combat: { ...rat, active_opponents: [{ id: 'rat', name: 'npc.rat' }] } }),
      'combat.hit',
    );
    assert.ok(h.texts().includes('Combat'));
    h.publish(view({ combat: undefined }), 'combat.result');
    assert.ok(h.texts().includes('Back to World'));
    h.publish(view({ combat: undefined }), 'combat.death');
    assert.ok(h.texts().includes('You wake at the shrine.'));
    assert.equal(h.texts().includes('Let go'), false);
  } finally {
    h.close();
  }
});

// Breaks: a closure jumps straight to the World (its closing lines unseen), the ended page keeps
// action cards, the footer or an open status line, or Back to World leaves the Combat page.
test('confirmed encounter foregrounds another page; closure keeps Combat until its foot', () => {
  for (const ending of ['closed', 'opponent_dead', 'player_dead']) {
    const h = mounted(view({ combat: undefined }));
    try {
      h.tap(CONTENTS);
      h.tap('Settings');
      assert.ok(h.texts().includes('Settings'));
      const rat = { encounter_id: 'fight', opponent_id: 'rat', name: 'npc.rat' };
      h.publish(
        view({ combat: { ...rat, active_opponents: [{ id: 'rat', name: 'npc.rat' }] } }),
        'combat.hit',
      );
      assert.ok(h.texts().includes('Combat'));
      assert.ok(h.texts().includes('You strike the marsh rat.'));
      assert.equal(h.texts().includes('Back to World'), false); // a live encounter has no foot
      assert.ok(!h.texts().some((t) => t.startsWith('a marsh rat')), 'no foe line (loka-kgd.204)');
      assert.equal(h.texts().includes('Settings'), false);
      h.publish(
        view({
          combat: undefined,
          entities: ending === 'opponent_dead' ? [] : view().entities,
          ...(ending === 'player_dead'
            ? {
                place: {
                  id: 'shrine',
                  title: { key: 'shrine.title' },
                  description: { key: 'shrine.description' },
                },
              }
            : {}),
        }),
        ending === 'player_dead'
          ? 'combat.death'
          : ending === 'opponent_dead'
            ? 'combat.result'
            : undefined,
        ending === 'player_dead' ? 'combat.hit' : undefined,
      );
      const ended = h.texts();
      assert.ok(
        ended.includes('Combat') && !ended.some((t) => t.startsWith('a marsh rat')),
        ending,
      );
      if (ending !== 'closed')
        assert.ok(
          ended.includes(
            ending === 'player_dead' ? 'You wake at the shrine.' : 'The marsh rat falls.',
          ),
        );
      // A death's page closes on Let go alone, a fight's on Back to World (book-ui.md, Falling).
      const [foot, not] =
        ending === 'player_dead' ? ['Let go', 'Back to World'] : ['Back to World', 'Let go'];
      assert.equal(ended.filter((t) => t === foot).length, 1, ending);
      assert.equal(h.footer(), false);
      for (const shut of [CONTENTS, 'sitting', 'Stand', 'Flee', not])
        assert.throws(() => h.tap(shut), undefined, `${ending}: ${shut}`);
      h.tap(foot);
      assert.equal(h.texts().includes('Combat'), false);
      // The fight's lines stay in the room log; a death's room change clears the cellar's, and
      // its own receipt's fight lines stay on the Combat page: the shrine opens at woke (loka-glj8).
      const kept = {
        closed: ['You strike the marsh rat.'],
        opponent_dead: ['You strike the marsh rat.', 'The marsh rat falls.'],
        player_dead: ['You wake at the shrine.'],
      }[ending]!;
      for (const text of [
        'You strike the marsh rat.',
        'The marsh rat falls.',
        'You wake at the shrine.',
      ])
        assert.equal(h.texts().includes(text), kept.includes(text), `${ending}: ${text}`);
      assert.ok(h.texts().includes(ending === 'player_dead' ? 'The shrine' : 'The cellar'));
    } finally {
      h.close();
    }
  }
});

// Break: Attack narration stays hidden in NPC detail, an unconfirmed/refused Flee dismisses combat,
// or a committed escape skips its closing line.
test('Attack opens its committed page; pending and refused Flee stay until committed escape', () => {
  const attack = {
    action_key: 'attack',
    label: 'action.attack',
    available: true,
    input: [],
    target: { kind: 'entity' },
  };
  const quiet = view({
    combat: undefined,
    entities: [{ ...view().entities[0], actions: [attack] }],
  });
  const fighting = view({ entities: quiet.entities });
  const h = mounted(quiet);
  const accepted = (outcome: string, key?: string) => ({
    kind: 'saved',
    decision: { kind: 'accepted', events: [], outcome, narration: key ? [{ key }] : [] },
  });
  try {
    h.tap('A marsh rat');
    h.answer(accepted('attacked', 'combat.hit'), fighting, 'combat.hit');
    h.tap('Attack a marsh rat');
    assert.ok(h.texts().includes('Combat'));
    assert.equal(h.texts().filter((s) => s === 'You strike the marsh rat.').length, 1);
    h.answer({ kind: 'pending' });
    h.tap('Flee');
    assert.ok(h.texts().includes('Combat'));
    assert.ok(h.texts().includes('save not confirmed'));
    h.answer({ kind: 'saved', decision: { kind: 'rejected', error: { code: 'exit_locked' } } });
    h.tap('Flee');
    assert.ok(h.texts().includes('Combat'));
    assert.ok(h.texts().includes("You can't do that—locked."));
    const road = view({
      combat: undefined,
      place: { id: 'road', title: { key: 'road.title' }, description: { key: 'road.description' } },
    });
    // Break (review of #406): a pressed closure's non-combat line (here an arrival room event)
    // lands in the World log instead of the ended Combat page (book-ui.md, Closure).
    h.answer(accepted('fled', 'combat.flee'), road, 'combat.flee', 'road.crows', 1);
    h.tap('Flee');
    assert.ok(h.texts().includes('Combat'));
    const shown = h.texts();
    const escape = shown.indexOf('You escape to the road.');
    assert.ok(
      escape >= 0 && shown[escape + 1] === 'Crows lift off the road.',
      JSON.stringify(shown),
    );
    h.tap('Back to World');
    assert.equal(h.texts().includes('Combat'), false);
    assert.ok(h.texts().includes('The road'));
    // Break (loka-glj8): the flight's line leaves the fight room's page for the road; the road's
    // room log opens at its arrival line (here the crows); the cellar's lines went with its room.
    assert.equal(h.texts().includes('You escape to the road.'), false);
    assert.equal(h.texts().filter((t) => t.includes('Crows')).length, 1);
    assert.equal(h.texts().includes('You strike the marsh rat.'), false);
    assert.equal(h.texts().includes("You can't do that—locked."), false);
  } finally {
    h.close();
  }
});

// Break: reopening a saved encounter restores an ordinary chapter/choice page over the live fight.
test('reopening an encounter restores the combat page and last committed narration', () => {
  const h = mounted(view({ chapter: { index: 1, title: 'chapter.title' } }), {
    command_id: 'saved-round',
    lines: [{ key: 'combat.hit' }],
    combat_lines: [0],
  } as never);
  try {
    assert.ok(h.texts().includes('Combat'));
    assert.equal(h.texts().filter((s) => s === 'You strike the marsh rat.').length, 1);
  } finally {
    h.close();
  }
});

// Break: a reopened terminal combat receipt leaks into World because there is no active encounter.
// Now (narration log slice 3): the closing line is in the room log once, never the combat page.
test('reopening after escape or either death never restores combat into the World log', () => {
  for (const key of ['combat.hit', 'combat.result', 'combat.flee', 'combat.death']) {
    const h = mounted(view({ combat: undefined, actions: [] }), {
      command_id: 'closed-round',
      lines: [{ key }],
      combat_lines: [0],
    } as never);
    try {
      assert.ok(h.texts().includes('The cellar'));
      assert.equal(h.texts().includes('Combat'), false, key);
      assert.equal(
        h
          .texts()
          .filter((line) =>
            [
              'You strike the marsh rat.',
              'The marsh rat falls.',
              'You escape to the road.',
              'You wake at the shrine.',
            ].includes(line),
          ).length,
        1,
        key,
      );
    } finally {
      h.close();
    }
  }
});

// Break (loka-glj8): a reopened death or flight receipt restores its fight lines into the room
// reached; the room log opens at the record's arrival line.
test('reopening a receipt that changed room restores the room log from its arrival line', () => {
  for (const [lines, after] of [
    [[{ key: 'combat.hit' }, { key: 'combat.death' }], 'You wake at the shrine.'],
    // A flight's lines are all fight lines (closing); the ones from the arrival are the room's.
    [
      [
        { key: 'combat.fled', bindings: { direction: 'north' } },
        { key: 'combat.ran_in', bindings: { from: 'south' } },
      ],
      'You run in from the south.',
    ],
  ] as const) {
    const g = game(view({ combat: undefined, actions: [] }));
    const record = { command_id: 'moved', lines, combat_lines: [0, 1], arrival: 1 };
    const p = presenter({
      ...g,
      lastNarration: () => record as never,
      text: (k) => (k === 'combat.death' ? 'You wake at the shrine.' : g.text(k)),
    });
    assert.deepEqual([p.screen().log, p.screen().combatLog], [[after], []]);
  }
});

// Break (review of loka-glj8): a flight into a room with its own fight (no closure) drops the
// arrival line from the room log, or logs it twice (the press line and the arrival cut).
test('a flight into another fight opens the room log at its arrival line', () => {
  let current = view(),
    fled = false;
  const g = game(current);
  const p = presenter({
    ...g,
    view: () => ({ view: current, token: 'view:drawn' }),
    lastNarration: () =>
      (fled && {
        command_id: 'fled',
        lines: [
          { key: 'combat.fled', bindings: { direction: 'north' } },
          { key: 'combat.ran_in', bindings: { from: 'south' } },
        ],
        combat_lines: [0],
        arrival: 1,
      }) as never,
    invoke: () => {
      fled = true;
      current = view({
        combat: { ...view().combat!, encounter_id: 'second' },
        place: { ...view().place, id: 'road' },
      });
      return {
        kind: 'saved',
        command_id: 'fled',
        decision: {
          kind: 'accepted',
          events: [],
          outcome: 'fled',
          narration: [{ key: 'combat.fled' }],
        },
      } as never;
    },
  });
  p.press(p.screen().buttons.find((b) => b.label === 'Flee')!);
  assert.deepEqual(
    p.screen().log.filter((l) => l.includes('south')),
    ['You run in from the south.'],
  );
});

// Breaks (book-ui.md, Spirit state): Rise works before zero or comes on its own, the revival lines
// lose their pace, the waking line shows (or is read) before the rise or out of order, focus is
// pulled to the card at zero or lost from it, its seconds left missing on the web, catching up
// draws the bottom row, or a fault, encounter, scene or chapter arriving leaves the spirit state up.
test('a death with revival lands in the spirit state until Rise', () => {
  const clock = Date.now;
  let now = 0;
  Date.now = () => now;
  const shrine = {
    combat: undefined,
    place: {
      id: 'shrine',
      title: { key: 'shrine.title' },
      description: { key: 'shrine.description' },
    },
    revival: { lines: ['rev.1', 'rev.2', 'rev.3'], seconds: 10 },
  };
  const id = '00000000-0000-4000-8000-000000000000'; // the harness's ids are not schema ids
  const { combat: _, ...wire } = view({
    ...shrine,
    actor_id: id,
    place: { ...shrine.place, id },
    entities: [{ id, kind: 'npc', name: 'npc.rat', actions: [] }],
  });
  assert.deepEqual(validate('GameView', wire), []);
  const rat = { encounter_id: 'fight', opponent_id: 'rat', name: 'npc.rat' };
  const died = () => {
    const h = mounted(view({ combat: undefined }));
    h.texts(); // mounts the subscription
    h.publish(
      view({ combat: { ...rat, active_opponents: [{ id: 'rat', name: 'npc.rat' }] } }),
      'combat.hit',
    );
    assert.ok(h.texts().includes('Combat'));
    h.publish(view(shrine), 'combat.death', 'combat.hit');
    assert.doesNotMatch(h.said(), /wake/); // read once, at the rise
    now = 0;
    h.tap('Let go');
    return h;
  };
  const shown = (h: ReturnType<typeof mounted>) =>
    h.texts().filter((t) => ['Dark.', 'A bell.', 'Breath.', 'You wake at the shrine.'].includes(t));
  try {
    const h = died();
    assert.deepEqual(shown(h), ['Dark.']);
    assert.equal(h.footer(), false); // the bottom row is not drawn
    assert.throws(() => h.tap('Rise')); // the unavailable form until zero
    now = 4999;
    assert.deepEqual(shown(h), ['Dark.']);
    now = 5000;
    assert.deepEqual(shown(h), ['Dark.', 'A bell.']);
    now = 9999;
    assert.throws(() => h.tap('Rise'));
    const card = (e: typeof h) => e.node((n) => n.props?.accessibilityLabel === 'Rise').props;
    const waiting = card(h);
    waiting.onFocus(); // the reader sits on the waiting card
    const attrs: Record<string, string> = {}; // on the web the seconds left are its description
    waiting.ref({ setAttribute: (k: string, v: string) => (attrs[k] = v) });
    assert.equal(attrs['aria-description'], '1 second');
    assert.deepEqual(shown(h), ['Dark.', 'A bell.']);
    now = 60_000; // no rise at zero
    assert.deepEqual(shown(h), ['Dark.', 'A bell.', 'Breath.']);
    waiting.onBlur(); // the waiting card leaves at zero: not a move away
    let focused = 0; // the card is new at zero: focus held on it moves to it, once
    const ready = (e: typeof h) => e.control('Rise').props.ref({ focus: () => focused++ });
    [1, 2].forEach(() => ready(h));
    assert.equal(focused, 1);
    h.tap('Rise');
    assert.equal(h.said(), 'You wake at the shrine.');
    assert.deepEqual(shown(h), ['Dark.', 'A bell.', 'Breath.', 'You wake at the shrine.']);
    assert.equal(h.texts().includes('Rise'), false);
    assert.notEqual(h.footer(), false); // it returns at the rise
    h.close();
    const elsewhere = died(); // focus moved off the card: zero moves none
    card(elsewhere).onFocus();
    card(elsewhere).onBlur();
    now = 60_000;
    ready(elsewhere);
    assert.equal(focused, 1);
    elsewhere.close();
    for (const [end, extra] of Object.entries({
      combat: { combat: { ...rat, active_opponents: [{ id: 'rat', name: 'npc.rat' }] } },
      scene: { scene: { index: 1, line: 'road.crows' } },
      chapter: { chapter: { index: 1, title: 'chapter.first' } },
    })) {
      const e = died();
      e.publish(view({ ...shrine, ...extra }));
      e.publish(view(shrine)); // and ends: the World page again
      if (end !== 'scene') e.tap('Back to World'); // the ended fight's or the chapter's page
      assert.ok(shown(e).includes('You wake at the shrine.'), end);
      assert.equal(e.texts().includes('Rise'), false, end);
      e.close();
    }
    const caught = died();
    caught.publish(view(shrine), undefined, undefined, { kind: 'catching_up' });
    assert.equal(caught.footer(), false); // catching up keeps the spirit layout
    assert.ok(caught.texts().includes('Rise'));
    caught.publish(view(shrine), undefined, undefined, { kind: 'fault', code: 'x' });
    assert.ok(shown(caught).includes('You wake at the shrine.')); // a fault ends it
    assert.equal(caught.texts().includes('Rise'), false);
    assert.notEqual(caught.footer(), false);
    caught.close();
  } finally {
    Date.now = clock;
  }
});
