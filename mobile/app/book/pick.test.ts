// pick.ts on controlled views: row labels for mixed scripted actions, twin notes, the Use on… refusal dedupe.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GameView } from '../../packages/game-view/session.ts';
import { picks } from './pick.ts';
import type { Button } from './presenter.ts';

const view = {
  entities: [
    { id: 'cart', name: 'a cart' },
    { id: 'winch', name: 'a winch' },
  ],
  inventory: [
    { id: 'b1', name: 'a bucket', state: 'full' },
    { id: 'b2', name: 'a bucket', state: 'empty' },
    { id: 'can', name: 'an oilcan' },
  ],
} as unknown as GameView;
const pair = (action_key: string, target: string, tool: string, reason?: string): Button => ({
  label: action_key === 'quench' ? 'Quench' : 'Oil',
  action_key,
  target_ids: [target, tool],
  input: {},
  pick: reason ? { reason } : {},
});
const say = (k: string) => k;
const shown = (k: ReturnType<typeof picks>) =>
  k.map((o) => [o.label, o.rows.map((r) => ('b' in r ? [r.label, r.note] : [r.label, r.reason]))]);

// Breaks: two scripted actions on one page read as bare tool names, or same-name tools lose their state note.
test('mixed scripted actions name their verb; same-name tools carry their state', () => {
  const buttons = [
    pair('quench', 'cart', 'b1'),
    pair('quench', 'cart', 'b2'),
    pair('oil', 'cart', 'can'),
  ];
  assert.deepEqual(shown(picks(view, buttons, 'cart', say)), [
    [
      'Use an item…',
      [
        ['Quench with a bucket', 'Full'],
        ['Quench with a bucket', 'Empty'],
        ['Oil with an oilcan', undefined],
      ],
    ],
  ]);
  // Breaks: twins share one accessible name, or the name drops the shown note (label in name).
  const named = picks(view, buttons, 'cart', say)[0]!.rows.map((r) => 'b' in r && r.name);
  assert.deepEqual(named.slice(0, 2), [
    'Quench with a bucket Full, quench a cart',
    'Quench with a bucket Empty, quench a cart',
  ]);
  assert.deepEqual(shown(picks(view, buttons.slice(0, 1), 'cart', say)), [
    ['Use an item…', [['A bucket', undefined]]],
  ]);
});

// Breaks: a resting tool shows one note per target under Use on…, or a target's page dedupes away
// distinct resting tools.
test('a resting use is one Use on… note; each resting tool is its own row on the target', () => {
  const rest = [pair('quench', 'cart', 'b1', 'not yet'), pair('quench', 'winch', 'b1', 'not yet')];
  assert.deepEqual(shown(picks(view, rest, 'b1', say)), [['Use on…', [['Quench', 'not yet']]]]);
  const tools = [pair('quench', 'cart', 'b1', 'not yet'), pair('quench', 'cart', 'can', 'not yet')];
  assert.deepEqual(shown(picks(view, tools, 'cart', say)), [
    [
      'Use an item…',
      [
        ['A bucket', 'not yet'],
        ['An oilcan', 'not yet'],
      ],
    ],
  ]);
});

// Breaks: two scripted actions resting on one tool read as two identical "A bucket: not yet" rows (PM ruling).
test('two scripted actions resting on one tool name their verb on the target', () => {
  const rest = [pair('quench', 'cart', 'b1', 'not yet'), pair('oil', 'cart', 'b1', 'not yet')];
  assert.deepEqual(shown(picks(view, rest, 'cart', say)), [
    [
      'Use an item…',
      [
        ['Quench with a bucket', 'not yet'],
        ['Oil with a bucket', 'not yet'],
      ],
    ],
  ]);
});
