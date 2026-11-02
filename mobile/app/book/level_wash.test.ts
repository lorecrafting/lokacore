// The level's wash and gilt line on real components, over controlled views (book-ui.md, Level wash, Gilt).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GameView } from '../../packages/game-view/session.ts';
import { effects, flat, rig } from './__tests__/hook-rig.ts';
import { game } from './__tests__/combat-book.test.ts';
import { nodes } from './__tests__/polish-book.test.ts';
import { presenter } from './presenter.ts';

const { Blow } = await import('./Blow.tsx');
const { cuesOf, flashesOn, lightFell, QUIET, step, useCues } = await import('./cues.ts');
const { LevelWash } = await import('./LevelWash.tsx');
const { LogLines } = await import('./lines.tsx');
const { narrationLines } = await import('./logs.ts');
const { Page } = await import('./pages.tsx');
const { color, motion, opacity } = await import('./tokens.ts');

const g = globalThis as any;
const view = (level: number, hp = 20, level_up = 'levelling.level_up') =>
  ({
    combat: {},
    place: { id: 'p', title: 't', description: 'd' },
    journal: [],
    inventory: [],
    actions: [],
    exits: [],
    entities: [],
    resources: [{ resource: { key: 'hp' }, current: hp, maximum: 20 }],
    levelling: { level, experience: 0, from: 0, next: 100, unspent: 0, level_up },
  }) as unknown as GameView;
const clock = (t: any) => {
  let now = 5000;
  t.mock.method(performance, 'now', () => now);
  return (ms: number) => void (now += ms);
};
// What a press to `to` fires from a quiet queue at time `at`, in order, past the beat.
const fired = (to: GameView, at = 5000) => {
  const first = step(QUIET, cuesOf(to, view(1)), at);
  return [...first.fired, ...step(first.q, [], at + 500).fired];
};
const peaks = () => g.sequences.map((s: any[]) => s[1]);

// The hook above a LevelWash, as the Book has it: both layers, the level's and the blow's.
function mounted(t: any, reduced = false) {
  effects(t, reduced);
  const tick = clock(t);
  const draw = rig(t);
  const at = (v: GameView) =>
    draw(() => {
      useCues(v, false, 0);
      return [...nodes(LevelWash()), ...nodes(Blow({ children: null }))];
    });
  return { at, tick };
}

// Breaks: a Page loses the layer (no wash on a page that shows) or draws it over the ink. World, NPC
// and Combat all render this Page, the last of them paperless.
test('a Page, with paper or without, draws the wash first, under its ink', (t) => {
  effects(t);
  const draw = rig(t);
  for (const paperless of [false, true]) {
    const root: any = draw(() => Page({ paperless, children: 'ink' }));
    assert.equal(root.props.children[0].type, LevelWash);
  }
});

// Breaks: the layer is another colour, in the way of a press, or at rest it shows.
test('the wash layer is warning, at rest clear, and takes no touch', (t) => {
  const { at } = mounted(t);
  const [layer] = at(view(1));
  assert.equal(flat(layer.props.style).backgroundColor, color.light.warning);
  assert.equal(flat(layer.props.style).opacity, 0);
  assert.equal(layer.props.pointerEvents, 'none');
});

// Breaks: a level does not wash, washes twice (LevelWash and Blow both answer), or swells; or a
// blow's wash reaches LevelWash, which would paint a blow in gilt's colour.
test('a level washes once with no swell; a blow leaves the level layer alone', (t) => {
  const { at, tick } = mounted(t);
  at(view(1));
  const after = at(view(2));
  assert.deepEqual(peaks(), [opacity.wash]);
  assert.equal(g.timings.filter((x: any) => x.to === motion.flash.swell).length, 0);
  assert.deepEqual(flat(after.at(-1).props.style).transform, [{ scale: 1 }]);
  g.sequences.length = 0;
  tick(2000);
  at(view(2, 15));
  assert.deepEqual(peaks(), [opacity.wash]);
  assert.equal(flat(at(view(2, 15))[0].props.style).opacity, 0);
});

// Breaks: both wash (two full-page changes inside the Flash limit), the level loses to the blow, or
// the blow loses its loss and with it value, thud and haptic.
test('a level and a blow in one reply: the level washes, the blow keeps the rest', () => {
  const both = fired(view(2, 15));
  assert.deepEqual(both, [
    { name: 'level', first: true, wash: true },
    { name: 'hp_loss', loss: 5, wash: false },
  ]);
});

// Breaks: the level ignores the gap, or its gap is off by one either way, or the blow's gap ignores it.
test('a level inside the Flash limit keeps all but its wash, and a blow after one too', () => {
  const blown = step(QUIET, [{ name: 'hp_loss', loss: 1 }], 1000);
  const level = { name: 'level' } as const;
  const held = step(blown.q, [level], 1000 + motion.flash.gap - 1);
  assert.deepEqual(held.fired, [{ name: 'level', wash: false }]);
  const clear = step(blown.q, [level], 1000 + motion.flash.gap);
  assert.deepEqual(clear.fired, [{ name: 'level', wash: true }]);
  const lit = step(QUIET, [level], 1000);
  const blowAfter = step(lit.q, [{ name: 'hp_loss', loss: 1 }], 1000 + motion.flash.gap - 1);
  assert.equal(blowAfter.fired[0]?.wash, false);
});

// Breaks: the level's wash ignores the light of Storm (book-ui.md, Flash limit).
test('a level just after the light keeps all but its wash', (t) => {
  t.after(() => lightFell(-Infinity));
  lightFell(1000);
  assert.deepEqual(step(QUIET, [{ name: 'level' }], 1999).fired, [{ name: 'level', wash: false }]);
});

// Breaks: each threshold crossed washes and sounds again.
test('two thresholds in one reply are one level cue and one wash', () => {
  assert.deepEqual(fired(view(3)), [{ name: 'level', first: true, wash: true }]);
});

// Breaks: Flashes off still washes (photosensitive players), or reduced motion plays in full.
test('Flashes off removes the wash; reduced motion halves it', (t) => {
  t.after(() => flashesOn(true));
  flashesOn(false);
  assert.deepEqual(fired(view(2)), [{ name: 'level', first: true, wash: false }]);
  flashesOn(true);
  const { at } = mounted(t, true);
  at(view(1));
  at(view(2));
  assert.deepEqual(peaks(), [opacity.washStill]);
});

// Breaks: the Book gilds by the line's words, a gained line gilds, or the level line goes italic.
test('the line with the level_up key is gilt whatever its words; another is not', (t) => {
  const record = { lines: [{ key: 'levelling.level_up' }, { key: 'levelling.gained' }] } as never;
  const [[up, gained]] = narrationLines(record, view(3), () => 'ANY', false, view(2)) as any;
  assert.deepEqual(up, { text: 'ANY', level: true, first: false });
  assert.equal(gained, 'ANY');
  const other = narrationLines(record, view(3, 20, 'other'), () => 'ANY') as any;
  assert.deepEqual(other[0], ['ANY', 'ANY']);
  effects(t);
  const draw = rig(t);
  const shown = draw(() => nodes(LogLines({ lines: [up] })));
  const ink = flat(shown.find((n) => n.props?.children === 'ANY').props.style);
  assert.equal(ink.color, color.light.warning);
  assert.equal(ink.fontStyle, undefined);
});

// Breaks: the first level holds no longer than any line, or every level holds as long as the first.
test('only the first level holds its gilt for motion.first.hold', (t) => {
  const record = { lines: [{ key: 'levelling.level_up' }] } as never;
  const lineOf = (from: number) =>
    (narrationLines(record, view(from + 1), () => 'x', false, view(from)) as any)[0][0];
  assert.equal(lineOf(1).first, true);
  assert.equal(lineOf(2).first, false);
  effects(t);
  const holds = (line: unknown) => {
    g.delays.length = 0;
    const draw = rig(t);
    draw(() => nodes(LogLines({ lines: [line] as never })));
    return [...g.delays];
  };
  assert.deepEqual(holds(lineOf(1)), [motion.first.hold]);
  assert.deepEqual(holds(lineOf(2)), [motion.settle.hold]);
});

// Breaks: the World log flattens the level line to its words, so a level off the Combat page is
// not gilt (review of this slice); an away recap stays words.
test('the room log keeps the level line gilt', () => {
  const was = view(1);
  const now = view(2);
  const last = { command_id: 'c', lines: [{ key: 'levelling.level_up' }] };
  let current = was;
  const p = presenter({
    ...game(was),
    text: () => 'ANY',
    view: () => ({ view: current, token: 'v' + current.levelling!.level }),
    lastNarration: () => (current === was ? undefined : last),
  } as never);
  current = now;
  p.update({
    kind: 'state',
    projection: { view: now, token: 'v2' },
    status: { kind: 'ready' },
  } as never);
  assert.deepEqual(p.screen().log, [{ text: 'ANY', level: true, first: true }]);
});
