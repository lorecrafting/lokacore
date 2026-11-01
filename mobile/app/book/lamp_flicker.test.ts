// The lamp's flicker on the real component: where it runs, by how much, and how often.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effects, flat, rig } from './__tests__/hook-rig.ts';
import { nodes } from './__tests__/polish-book.test.ts';
import type { GameView } from '../../packages/game-view/session.ts';

const { color, motion, opacity } = await import('./tokens.ts');
const PaletteContext = (await import('./palette.ts')).PaletteContext as any;
const { flickerClock } = await import('./heldLayer.ts');
const { UnderInk } = await import('./UnderInk.tsx');

const g = globalThis as any;
const view = (over: object) =>
  ({ inventory: [], equipment: [], entities: [], resources: [], ...over }) as unknown as GameView;

// Breaks: the lamp flickers in the open or under reduced motion, steps past its depth, works while
// the page is hidden, or misses its step range (book-ui.md, Lamp glow).
test('the lamp flickers away from an exposed room, by its depth, and holds still otherwise', (t) => {
  const was = PaletteContext._currentValue;
  PaletteContext._currentValue = { ...was, bg: color.dark.bg };
  g.CanvasKit = {};
  t.after(() => {
    PaletteContext._currentValue = was;
    delete g.CanvasKit;
    delete g.document;
  });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const glowAfter = (place: object, reduced: boolean, random: number) => {
    effects(t, reduced);
    const r = t.mock.method(Math, 'random', () => random);
    const shell = rig(t);
    const lit = view({ place, inventory: [{ fuel: { lit: true } }] });
    const draw = () =>
      flat(
        nodes(shell(() => UnderInk({ view: lit }))).find((n) => n.props?.['aria-hidden'])!.props
          .style,
      ).opacity;
    draw();
    t.mock.timers.tick(motion.flicker.max);
    const glow = draw();
    shell.unmount();
    r.mock.restore();
    return glow;
  };
  const dim = opacity.glow * (1 - motion.flicker.depth);
  assert.equal(glowAfter({ exposed: false }, false, 1), dim);
  assert.equal(glowAfter({ exposed: false }, false, 0), opacity.glow, 'the peak is the token');
  assert.equal(glowAfter({ exposed: true }, false, 1), opacity.glow, 'steady in the open');
  assert.equal(glowAfter({ exposed: false }, true, 1), opacity.glow, 'steady under reduced motion');
  g.document = { hidden: true };
  assert.equal(glowAfter({ exposed: false }, false, 1), opacity.glow, 'held in the background');
  delete g.document;
  for (const [random, gap] of [
    [0, motion.flicker.min],
    [1, motion.flicker.max],
  ] as const) {
    const r = t.mock.method(Math, 'random', () => random);
    const steps: number[] = [];
    const stop = flickerClock((share) => steps.push(share));
    t.mock.timers.tick(gap - 1);
    assert.equal(steps.length, 1, 'no second step before the gap');
    t.mock.timers.tick(1);
    assert.equal(steps.length, 2, 'the next step at the gap');
    stop();
    t.mock.timers.tick(gap);
    assert.equal(steps.length, 2, 'stopped');
    r.mock.restore();
  }
});
