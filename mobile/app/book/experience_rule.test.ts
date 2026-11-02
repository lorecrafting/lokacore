// The experience rule on the real component, over controlled levelling views (book-ui.md, Levelling details).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effects, flat, rig } from './__tests__/hook-rig.ts';
import { nodes } from './__tests__/polish-book.test.ts';
import type { RuleDrawn } from './ExperienceRule.tsx';

const { ExperienceRule } = await import('./ExperienceRule.tsx');
const { StatusLine } = await import('./Status.tsx');
const { color, motion, size } = await import('./tokens.ts');

const g = globalThis as any;
const DRY = motion.dry.duration;
const HOLD = motion.settle.hold;
const FG = color.light.fg;
const at = (experience: number, level = 1, from = 0, next = 100) => ({
  level,
  experience,
  from,
  next: next as number | undefined,
  unspent: 0,
});

// The drawn rule: its track, its ink, and what the shared values hold once the effects have run.
const mount = (t: any, reduced = false, drawn: RuleDrawn = {}) => {
  effects(t, reduced);
  const draw = rig(t);
  const show = (levelling: ReturnType<typeof at>) =>
    nodes(draw(() => ExperienceRule({ levelling, drawn })));
  const moves = () => ({
    timings: g.timings.splice(0),
    delays: g.delays.splice(0),
    sequences: g.sequences.splice(0),
  });
  return { show, moves, draw };
};
const NONE = { timings: [], delays: [], sequences: [] };

// Breaks: the fraction is of total experience rather than of this level's span, or a top level
// (no `next`) divides by nothing.
test('the first draw of a launch sits at the fraction of this level, with no animation', (t) => {
  const r = mount(t);
  r.show(at(150, 2, 100, 200));
  assert.equal(r.draw.shared[0].value, 0.5);
  assert.deepEqual(r.moves(), NONE);
  const top = mount(t);
  top.show({ ...at(900, 9, 800), next: undefined });
  assert.equal(top.draw.shared[0].value, 1);
});

// Breaks: a redraw with the same value re-animates (every reply would twitch the rule).
test('a redraw at the same value does not move', (t) => {
  const r = mount(t);
  r.show(at(40));
  r.show(at(40));
  assert.deepEqual(r.moves(), NONE);
});

// Breaks: a gain or a loss runs the level's gilt, or a loss snaps rather than falling over dry.
for (const [name, from, to] of [
  ['gain', 20, 40],
  ['loss', 40, 20],
] as const) {
  test(`a ${name} moves over motion.dry with no warning`, (t) => {
    const r = mount(t);
    r.show(at(from));
    r.moves();
    const out = r.show(at(to));
    assert.equal(r.draw.shared[0].value, to / 100);
    assert.equal(r.draw.shared[1].value, 0);
    assert.deepEqual(r.moves(), { timings: [DRY, DRY], delays: [], sequences: [] });
    assert.equal(flat(out.at(-1).props.style).backgroundColor, FG);
  });
}

// Breaks: losing a level plays the level run, or a change of `from` reads as no move.
test('a lower level falls like a loss', (t) => {
  const r = mount(t);
  r.show(at(150, 2, 100, 200));
  r.moves();
  r.show(at(90, 1, 0, 100));
  assert.equal(r.draw.shared[0].value, 0.9);
  assert.deepEqual(r.moves().sequences, []);
});

// Breaks: the run skips full, skips the hold, ends at the wrong fraction or stays warning; several
// levels at once run it more than once.
for (const [name, level] of [
  ['one level', 2],
  ['several levels', 4],
] as const) {
  test(`${name}: full over dry, warning for the hold, then fg at the new fraction`, (t) => {
    const r = mount(t);
    r.show(at(90));
    r.moves();
    r.show(at(130, level, 100, 200));
    const { timings, delays, sequences } = r.moves();
    assert.deepEqual(sequences, [
      ['never', 1, 0.3],
      ['never', 1, 0],
    ]);
    assert.deepEqual(delays, [HOLD, DRY, HOLD]);
    assert.deepEqual(timings, [DRY, DRY, 0, DRY]);
  });
}

// Breaks: reduced motion drops the hold, or still animates the width.
test('reduced motion cuts the width and keeps the hold', (t) => {
  const r = mount(t, true);
  r.show(at(90));
  r.moves();
  r.show(at(130, 2, 100, 200));
  const { timings, delays } = r.moves();
  assert.deepEqual(timings, [0, 0, 0, 0]);
  assert.deepEqual(delays, [HOLD, 0, HOLD]);
});

// Breaks: the last value lives in the status line, which unmounts on a detail page.
test('coming back from a page without the line runs from the value last drawn', (t) => {
  const drawn: RuleDrawn = {};
  const before = mount(t, false, drawn);
  before.show(at(20));
  before.draw.unmount();
  const same = mount(t, false, drawn);
  same.show(at(20));
  assert.deepEqual(same.moves(), NONE);
  const gain = mount(t, false, drawn);
  const start = gain.show(at(60)).at(-1); // the render precedes the effect that moves it
  assert.equal(flat(start.props.style).transform[0].scaleX, 0.2);
  assert.deepEqual(gain.moves().timings, [DRY, DRY]);
  assert.equal(drawn.current?.at, 0.6);
  const levelled = mount(t, false, drawn);
  levelled.show(at(130, 2, 100, 200));
  assert.equal(levelled.moves().sequences.length, 2);
});

// Breaks: the rule gains a touch target or a reader's stop, or sits above the row.
test('the rule is under the row, unreachable and absent without levelling', () => {
  const line = (rule?: object) =>
    StatusLine({
      time: 0,
      text: (k: string) => k,
      locked: false,
      pending: false,
      open: () => {},
      openCharacter: () => {},
      rule,
    } as never) as any;
  const kids = line({ levelling: at(10), drawn: {} }).props.children;
  assert.equal(kids[2].type, ExperienceRule);
  assert.ok(!line().props.children[2]);
  const drawn = nodes(ExperienceRule({ levelling: at(10), drawn: {} }));
  assert.equal(drawn[0].props['aria-hidden'], true);
  assert.equal(drawn[0].props.pointerEvents, 'none');
  assert.ok(drawn.every((n) => !n.props.onPress && !n.props.accessibilityRole));
  assert.equal(flat(drawn.at(-1).props.style).height, size.experienceRule);
  assert.equal(flat(drawn[0].props.style).backgroundColor, color.light.line);
});
