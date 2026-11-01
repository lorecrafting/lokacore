// Storm and Wind on the real component: what a strike draws, and when (book-ui.md, Storm; Wind).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effects, rig } from './__tests__/hook-rig.ts';
import { nodes } from './__tests__/polish-book.test.ts';

const { flashesOn } = await import('./cues.ts');
const { Storm } = await import('./Storm.tsx');
const { motion } = await import('./tokens.ts');

const g = globalThis as any;
const SKY = { exposed: true, room: 'r', world: true, turn: 0 };
const LEG = motion.flutter.duration / (2 * motion.flutter.times);

function sky(t: any, weather: string, given: object = {}, reduced = false) {
  effects(t, reduced);
  t.mock.timers.reset();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(Math, 'random', () => 0); // the storm's first strike at its low end
  let now = 1_000_000;
  t.mock.method(performance, 'now', () => now);
  const draw = rig(t);
  const shown = draw(() => nodes(Storm({ ...SKY, weather, ...given })));
  return {
    shown,
    struck: () => {
      const ms = motion.afterimage.every[0]!;
      now += ms;
      t.mock.timers.tick(ms);
      return g.timings.includes(motion.afterimage.out);
    },
  };
}

// Breaks: the light strikes with no storm, with Flashes off (read when it strikes), under reduced
// motion, or on a page that is not the World.
test('the light falls only in a storm, with Flashes on and motion allowed', (t) => {
  assert.equal(sky(t, 'storm').struck(), true);
  assert.equal(sky(t, 'wind').struck(), false);
  assert.equal(sky(t, 'storm', { world: false }).struck(), false);
  assert.equal(sky(t, 'storm', { exposed: false }).struck(), false);
  assert.equal(sky(t, 'storm', {}, true).struck(), false);
  const off = sky(t, 'storm');
  flashesOn(false);
  t.after(() => flashesOn(true));
  assert.equal(off.struck(), false);
});

// Breaks: wind lifts indoors, under reduced motion, or on a page that is not the World.
test('the corner lifts in the wind, exposed, in motion, on the World', (t) => {
  const lifted = (given: object, reduced = false, weather = 'wind') => {
    effects(t, reduced);
    rig(t)(() => nodes(Storm({ ...SKY, weather, ...given })));
    return g.timings.includes(LEG);
  };
  assert.equal(lifted({}), true);
  assert.equal(lifted({}, false, 'rain'), false);
  assert.equal(lifted({ exposed: false }), false);
  assert.equal(lifted({ world: false }), false);
  assert.equal(lifted({}, true), false);
});

// Breaks: a page that is not the World draws the light or the fold.
test('off the World nothing is drawn', (t) => {
  const views = (world: boolean) =>
    sky(t, 'storm', { world }).shown.filter((n: any) => n.props?.pointerEvents === 'none').length;
  assert.equal(views(true), 2);
  assert.equal(views(false), 0);
});

// Breaks: a fight, a page, a scene or an ancestry choice counts as the World, or a fight unmounts the
// sky so its entry count and wind memory reset (book-ui.md, Storm).
test('Leaf keeps the sky mounted and says when it is the World', async () => {
  const { Leaf } = await import('./Leaf.tsx');
  const place = { id: 'p' };
  const world = (v: object, p: object = {}) => {
    const props = {
      screen: { view: { place, exits: [], ...v }, ended: false },
      stack: [],
      g: {},
      press: () => {},
      go: () => {},
      flip: { turn: 0, dir: 1 },
      ...p,
    };
    const shown = (Leaf as any)(props);
    return shown.props.children[0].props.world;
  };
  assert.equal(world({}), true);
  assert.equal(world({ combat: {} }), false);
  assert.equal(world({ scene: {} }), false);
  assert.equal(world({ ancestry_choices: [] }), false);
  assert.equal(world({}, { page: 'map' }), false);
  assert.equal(world({}, { screen: { view: { place, exits: [] }, ended: true } }), false);
});
