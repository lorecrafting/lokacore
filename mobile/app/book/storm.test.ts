// Storm and Wind on the real component: what a strike draws, and when (book-ui.md, Storm; Wind).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effects, flat, rig } from './__tests__/hook-rig.ts';
import { nodes } from './__tests__/polish-book.test.ts';
import type { GameView } from '../../packages/game-view/session.ts';

const { flashesOn, lightFell, QUIET, step } = await import('./cues.ts');
const { Storm } = await import('./Storm.tsx');
const { color, motion, opacity } = await import('./tokens.ts');
const { UnderInk } = await import('./UnderInk.tsx');
const PaletteContext = (await import('./palette.ts')).PaletteContext as any;

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

// Breaks: Storm's light does not tell the cues, so a blow's wash follows it inside the Flash limit.
test('a blow just after the light keeps all but its wash', (t) => {
  t.after(() => lightFell(-Infinity));
  sky(t, 'storm').struck();
  const fired = step(QUIET, [{ name: 'hp_loss', loss: 1 }], performance.now()).fired;
  assert.equal(fired[0]?.wash, false);
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
    return shown.props.children[0].props;
  };
  // Breaks: the sky is told the wrong place, so a storm draws indoors (book-ui.md, Storm; Wind).
  assert.equal(world({ place: { id: 'p', exposed: true } }).exposed, true);
  assert.equal(world({}).exposed, false);
  assert.equal(world({}).world, true);
  assert.equal(world({ combat: {} }).world, false);
  assert.equal(world({ scene: {} }).world, false);
  assert.equal(world({ ancestry_choices: [] }).world, false);
  assert.equal(world({}, { page: 'map' }).world, false);
  assert.equal(world({}, { screen: { view: { place, exits: [] }, ended: true } }).world, false);
});

// Breaks: a strike leaves the held layer up, so the afterimage's contrast exemption is untrue, or it
// comes back by a cut (book-ui.md, Lightning; rulings, One held layer).
test('the light cuts the held layer, which returns over the settle after the strike', (t) => {
  const was = PaletteContext._currentValue;
  PaletteContext._currentValue = { ...was, bg: color.dark.bg };
  g.CanvasKit = {};
  t.after(() => {
    PaletteContext._currentValue = was;
    delete g.CanvasKit;
  });
  const { struck } = sky(t, 'storm');
  const under = rig(t);
  const lit = {
    place: { id: 'p', exposed: true },
    inventory: [{ fuel: { lit: true } }],
    equipment: [],
    entities: [],
    resources: [],
  } as unknown as GameView;
  const glow = () =>
    flat(
      nodes(under(() => UnderInk({ view: lit }))).find((n) => n.props?.['aria-hidden'])!.props
        .style,
    ).opacity;
  glow();
  assert.equal(glow(), opacity.glow, 'held before the strike');
  const cut = under.shared.at(-1)!;
  const writes: number[] = [];
  let value = cut.value;
  Object.defineProperty(cut, 'value', {
    get: () => value,
    set: (v) => writes.push((value = v)),
  });
  g.timings.length = 0;
  g.delays.length = 0;
  assert.equal(struck(), true);
  assert.deepEqual(writes, [0, 1], 'off at once, then back');
  assert.ok(
    g.delays.includes(motion.afterimage.duration + motion.afterimage.out),
    'waits out the strike',
  );
  assert.ok(g.timings.includes(motion.settle.duration), 'returns over the settle');
  value = 0;
  assert.equal(glow(), 0, 'the cut reaches the drawn glow');
  under.unmount();
  writes.length = 0;
  struck();
  assert.deepEqual(writes, [], 'an unmounted layer stops listening');
});
