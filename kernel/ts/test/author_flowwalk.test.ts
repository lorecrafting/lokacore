// The Flow focus walk (kernel/ts/play/flowwalk.ts): expected refs worked by hand on six nodes, one
// per Flow lane. arrive `then` gate; gate's two choices set lamp_lit, it `then`s itself and reads an
// NPC; glow, find and dark read lamp_lit (glow's edge listed before gate's).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FILTERS } from '../play/flow.ts';
import { walk } from '../play/flowwalk.ts';
import { model, ref } from './author_flow_fixture.ts';

const [sp, qq, dlg, lit, rx, cnd, npc] = [
  ref('story_point', 'arrive'),
  ref('quest', 'find'),
  ref('dialogue', 'gate'),
  ref('fact', 'lamp_lit'),
  ref('reaction', 'glow'),
  ref('condition', 'dark'),
  ref('npc', 'aldous'),
];
const S = {
  ...model(
    [sp, qq, dlg, lit, rx, cnd],
    [
      { from: sp, to: dlg, path: '/then', op: 'then' },
      { from: rx, to: lit, path: '/when', op: 'fact_compare' },
      { from: dlg, to: lit, path: '.choices.a.set', set: true },
      { from: dlg, to: lit, path: '.choices.b.set', set: true },
      { from: dlg, to: dlg, path: '/then' },
      { from: dlg, to: npc, path: '/when/npc' },
      { from: qq, to: lit, path: '/when' },
      { from: cnd, to: lit, path: '/when' },
    ],
  ),
  todo: {
    [rx]: [{ file: 'r.json', words: 0, placeholders: ['~'] }],
    [qq]: [{ file: 'q.json', words: 3, placeholders: [] }],
  },
  diagnostics: { [cnd]: [{ code: 'unknown_ref' }] },
};

// Breaks: above and below swapped, the NPC anchor or the self `then` kept, the two set edges
// listed twice, or a dialogue given a thread.
test("a choice's below holds the fact it sets; anchors, self edges and repeats dropped", () => {
  assert.deepEqual(walk(S, dlg), { above: [sp], below: [lit], thread: [] });
});

// Breaks: the thread misses a reader, lists readers before the setter, or keeps the fact itself.
test("a fact's thread is its setter, then every reader", () => {
  assert.deepEqual(walk(S, lit), {
    above: [rx, dlg, qq, cnd],
    below: [],
    thread: [dlg, rx, qq, cnd],
  });
});

// Breaks: walk() ignores its filters or one of them; `needs words` counts a todo with no
// placeholder (find) or `potential problems` misses a diagnostic (dark).
const BY: Record<string, [string, ReturnType<typeof walk>]> = {
  story: [dlg, { above: [], below: [lit], thread: [] }],
  fact: [dlg, { above: [sp], below: [], thread: [] }],
  quest: [lit, { above: [rx, dlg, cnd], below: [], thread: [dlg, rx, cnd] }],
  dialogue: [lit, { above: [rx, qq, cnd], below: [], thread: [rx, qq, cnd] }],
  reaction: [lit, { above: [dlg, qq, cnd], below: [], thread: [dlg, qq, cnd] }],
  condition: [lit, { above: [rx, dlg, qq], below: [], thread: [dlg, rx, qq] }],
  'needs words': [lit, { above: [rx], below: [], thread: [rx] }],
  'potential problems': [lit, { above: [cnd], below: [], thread: [cnd] }],
};
test('each Flow filter changes what the walk shows', () => {
  for (const filter of FILTERS) {
    const [at, want] = BY[filter]!;
    assert.deepEqual(walk(S, at, [filter]), want, filter);
  }
});
