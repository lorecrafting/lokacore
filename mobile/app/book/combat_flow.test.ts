// Combat narration and encounter lifecycle over controlled Book boundary inputs (the harness:
// __tests__/combat-book.test.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Game, GameView } from '../../packages/game-view/session.ts';
import { Book, game, nodes, view, words } from './__tests__/combat-book.test.ts';
import { CONTENTS, control } from './__tests__/control.test.ts';
import { presenter } from './presenter.ts';

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
  assert.deepEqual(p.screen().combatLog, ['The marsh rat falls.']);
  assert.deepEqual(p.screen().log, ['The bell rings.', 'A door creaks.']);
});

// Real Book state/effect routing over controlled committed Game projections; no native layout claim.
function mounted(initial: GameView, recovered?: ReturnType<Game['lastNarration']>) {
  let current = initial,
    revision = 1,
    last = recovered,
    pending = false;
  let respond: () => any = () => ({ kind: 'stale_view' });
  let listener: ((event: any) => void) | undefined;
  const state: any[] = [],
    effects: (() => void)[] = [];
  let slot = 0;
  const projection = () => ({ view: current, token: `view:${revision}` });
  const g: Game = {
    ...game(initial),
    view: projection,
    lastNarration: () => last,
    text: (key) =>
      ({
        'room.title': 'The cellar',
        'road.title': 'The road',
        'shrine.title': 'The shrine',
        'npc.rat': 'a marsh rat',
        'combat.hit': 'You strike the marsh rat.',
        'combat.result': 'The marsh rat falls.',
        'combat.flee': 'You escape to the road.',
        'combat.death': 'You wake at the shrine.',
      })[key],
    invoke: () => respond(),
    pending: () => pending,
    pendingInvocation: () => (pending ? 'reservation' : undefined),
    subscribe: (f) => (
      (listener = f),
      f({ kind: 'state', projection: projection(), status: { kind: 'ready' } }),
      () => {
        listener = undefined;
      }
    ),
  };
  (globalThis as any)[Symbol.for('combat-state')] = (initial: any) => {
    const i = slot++;
    if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
    return [
      state[i],
      (next: any) => {
        state[i] = typeof next === 'function' ? next(state[i]) : next;
      },
    ];
  };
  (globalThis as any)[Symbol.for('combat-effect')] = (f: () => any, deps: any[]) => {
    const i = slot++,
      before = state[i];
    if (before && deps.every((d, j) => Object.is(d, before.deps[j]))) return;
    effects.push(() => {
      before?.cleanup?.();
      state[i] = { deps, cleanup: f() };
    });
  };
  const draw = () => {
    slot = 0;
    const root = Book({
      game: g,
      shell: { confirm: (f) => f(), learned: { get: () => true } as never },
      startOver: () => undefined,
    });
    effects.splice(0).forEach((f) => f());
    return nodes(root);
  };
  const texts = () =>
    draw()
      .filter((n) => n.type === 'Text')
      .map(words);
  return {
    texts,
    tap: (shown: string | RegExp) => control(draw(), shown).props.onPress(),
    publish: (next: GameView, line?: string) => {
      current = next;
      revision++;
      if (line)
        last = {
          command_id: `commit-${revision}`,
          lines: [{ key: line }],
          combat_lines: [0],
        } as never;
      listener?.({ kind: 'state', projection: projection(), status: { kind: 'ready' } });
    },
    answer: (reply: any, next = current, line?: string) => {
      respond = () => {
        current = next;
        revision++;
        pending = reply.kind === 'pending';
        if (line)
          last = {
            command_id: `commit-${revision}`,
            lines: [{ key: line }],
            combat_lines: [0],
          } as never;
        return reply;
      };
    },
    close: () => state.forEach((s) => s?.cleanup?.()),
  };
}

// Break: ending a foreground encounter leaves the old combat/menu page instead of the committed room.
test('confirmed encounter foregrounds another page and closure or death restores the World', () => {
  for (const ending of ['closed', 'opponent_dead', 'player_dead']) {
    const h = mounted(view({ combat: undefined }));
    try {
      h.tap(CONTENTS);
      h.tap('Settings');
      assert.ok(h.texts().includes('Settings'));
      h.publish(view(), 'combat.hit');
      assert.ok(h.texts().includes('Combat'));
      assert.ok(h.texts().includes('You strike the marsh rat.'));
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
      );
      assert.equal(h.texts().includes('Combat'), false);
      for (const text of [
        'You strike the marsh rat.',
        'The marsh rat falls.',
        'You wake at the shrine.',
      ])
        assert.equal(h.texts().includes(text), false);
      assert.ok(h.texts().includes(ending === 'player_dead' ? 'The shrine' : 'The cellar'));
    } finally {
      h.close();
    }
  }
});

// Break: Attack narration stays hidden in NPC detail, or an unconfirmed/refused Flee dismisses combat.
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
    assert.ok(h.texts().includes("You can't do that: locked."));
    const road = view({
      combat: undefined,
      place: { id: 'road', title: { key: 'road.title' }, description: { key: 'road.description' } },
    });
    h.answer(accepted('fled', 'combat.flee'), road, 'combat.flee');
    h.tap('Flee');
    assert.equal(h.texts().includes('Combat'), false);
    assert.ok(h.texts().includes('The road'));
    assert.equal(h.texts().includes('You escape to the road.'), false);
    assert.equal(h.texts().includes('You strike the marsh rat.'), false);
    assert.equal(h.texts().includes("You can't do that: locked."), false);
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
test('reopening after escape or either death never restores combat into the World log', () => {
  for (const key of ['combat.hit', 'combat.result', 'combat.flee', 'combat.death']) {
    const h = mounted(view({ combat: undefined, actions: [] }), {
      command_id: 'closed-round',
      lines: [{ key }],
      combat_lines: [0],
    } as never);
    try {
      assert.ok(h.texts().includes('The cellar'));
      assert.equal(
        h
          .texts()
          .some((line) =>
            [
              'You strike the marsh rat.',
              'The marsh rat falls.',
              'You escape to the road.',
              'You wake at the shrine.',
            ].includes(line),
          ),
        false,
      );
    } finally {
      h.close();
    }
  }
});
