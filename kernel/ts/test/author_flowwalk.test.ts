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

// Breaks: a read is not flipped (readers above the fact), the thread misses a reader, lists
// readers before the setter, or keeps the fact itself.
test("a fact's setter leads to it, its readers are unlocked; its thread is setter then readers", () => {
  assert.deepEqual(walk(S, lit), {
    above: [dlg],
    below: [rx, qq, cnd],
    thread: [dlg, rx, qq, cnd],
  });
});

// Breaks: the flip applied only on the fact's side, so a reader lists its fact below.
test('a reader has the fact it reads above it', () => {
  assert.deepEqual(walk(S, rx), { above: [lit], below: [], thread: [] });
});

// Breaks: walk() ignores its filters or one of them; `needs words` counts a todo with no
// placeholder (find) or `potential problems` misses a diagnostic (dark).
const BY: Record<string, [string, ReturnType<typeof walk>]> = {
  story: [dlg, { above: [], below: [lit], thread: [] }],
  fact: [dlg, { above: [sp], below: [], thread: [] }],
  quest: [lit, { above: [dlg], below: [rx, cnd], thread: [dlg, rx, cnd] }],
  dialogue: [lit, { above: [], below: [rx, qq, cnd], thread: [rx, qq, cnd] }],
  reaction: [lit, { above: [dlg], below: [qq, cnd], thread: [dlg, qq, cnd] }],
  condition: [lit, { above: [dlg], below: [rx, qq], thread: [dlg, rx, qq] }],
  'needs words': [lit, { above: [], below: [rx], thread: [rx] }],
  'potential problems': [lit, { above: [], below: [cnd], thread: [cnd] }],
};
test('each Flow filter changes what the walk shows', () => {
  assert.deepEqual(Object.keys(BY).sort(), [...FILTERS].sort());
  for (const filter of FILTERS) {
    const [at, want] = BY[filter]!;
    assert.deepEqual(walk(S, at, [filter]), want, filter);
  }
});
