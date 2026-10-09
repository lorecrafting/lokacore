// Combat page layout over controlled Book boundary inputs (the harness: __tests__/combat-book.test.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Intent } from '../../packages/game-view/session.ts';
import { BookView, color, game, nodes, view, words } from './__tests__/combat-book.test.ts';
import { group, type Page } from './model.ts';
import { presenter } from './presenter.ts';

// Breaks: Combat renders only the primary and hides actual helper presence behind identical template names.
test('combat component shows the exact active pack and marks the current primary', () => {
  const current = view({
    combat: {
      encounter_id: 'fight',
      opponent_id: 'rat',
      name: 'npc.rat',
      active_opponents: [
        { id: 'helper', name: 'npc.rat' },
        { id: 'rat', name: 'npc.rat' },
      ],
    },
  });
  const screen = presenter(game(current)).screen();
  const drawn = nodes(
    BookView({
      palette: color.light,
      screen,
      stack: [],
      flip: { turn: 0, dir: 1 },
      go: () => {},
      press: () => {},
      refused: () => {},
      startOver: () => {},
      shell: { confirm: (f) => f(), learned: { get: () => true } as never },
    }),
  );
  const lines = drawn.filter((n) => n.type === 'Text').map(words);
  assert.ok(lines.includes('a marsh rat (your target)'));
  assert.equal(lines.filter((line) => line === 'a marsh rat').length, 2);
  assert.ok(
    !lines.some(
      (line) => line.includes('helper') || (line.includes('rat') && line.includes('fight')),
    ),
  );
});

// Break: a menu/detail hides escape, Flee invents directions, or controls sit outside the narrative scroll.
test('combat page lists offered controls vertically below history in one scroll', () => {
  const sent: Intent[] = [];
  const p = presenter({
    ...game(
      view({
        actions: [
          ...view().actions,
          { ...view().actions[0], action_key: 'look', label: 'action.look' },
        ],
      }),
    ),
    lastNarration: () =>
      ({ command_id: 'before', lines: [{ key: 'combat.result' }], combat_lines: [0] }) as never,
    invoke: (intent) => (sent.push(intent), { kind: 'stale_view' }),
  });
  const screen = p.screen();
  assert.deepEqual(group(screen.buttons).door('north'), []);
  for (const stack of [[], [{ kind: 'contents' }], [{ kind: 'thing', id: 'rat' }]] as Page[][]) {
    const drawn = nodes(
      BookView({
        palette: color.light,
        screen,
        stack,
        flip: { turn: 0, dir: 1 },
        go: () => {},
        press: (b) => p.press(b),
        refused: () => {},
        startOver: () => {},
        shell: { confirm: (f) => f(), learned: { get: () => true } as never },
      }),
    );
    assert.ok(drawn.some((n) => n.props?.accessibilityRole === 'header' && words(n) === 'Combat'));
    const controls = drawn.filter((n) =>
      ['Stand', 'Look', 'Flee', 'Flee north', 'Flee west'].includes(n.props?.accessibilityLabel),
    );
    assert.deepEqual(
      controls.map((n) => n.props.accessibilityLabel),
      ['Stand', 'Look', 'Flee'],
    );
    const scroll = drawn.find((n) => n.type === 'ScrollView')!;
    const inside = nodes(scroll);
    const narrative = inside.findIndex(
      (n) => n.type === 'Text' && words(n) === 'The marsh rat falls.',
    );
    assert.ok(narrative >= 0);
    for (const control of controls) {
      assert.ok(
        inside.findIndex((n) => n.props?.accessibilityLabel === control.props.accessibilityLabel) >
          narrative,
      );
      control.props.onPress();
    }
    assert.notEqual(scroll.props.contentContainerStyle.flexDirection, 'row');
  }
  assert.deepEqual(
    sent,
    Array.from({ length: 3 }, () => [
      { action_key: 'stand', target_ids: [], input: {}, view_freshness_token: 'view:drawn' },
      { action_key: 'look', target_ids: [], input: {}, view_freshness_token: 'view:drawn' },
      {
        action_key: 'flee',
        target_ids: [],
        input: {},
        view_freshness_token: 'view:drawn',
      },
    ]).flat(),
  );
  assert.deepEqual(
    group(presenter(game(view({ combat: undefined, actions: [] }))).screen().buttons).flee,
    [],
  );
});
