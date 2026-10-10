import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { color } from './tokens.ts';

// palette.ts's hooks outside React: one component, its state slots and effects run by hand.
const h = globalThis as any;
registerHooks({
  resolve: (s, c, next) =>
    s === 'react' && c.parentURL?.endsWith('/palette.ts')
      ? { url: 'test:palette-react', shortCircuit: true }
      : next(s, c),
  load: (url, c, next) =>
    url === 'test:palette-react'
      ? {
          format: 'module',
          shortCircuit: true,
          source: `export const createContext = v => ({ _currentValue: v });
export const useContext = c => c._currentValue;
export const useState = v => globalThis.hook.state(v);
export const useRef = v => globalThis.hook.state({ current: v })[0];
export const useEffect = (f, deps) => globalThis.hook.effect(f, deps);`,
        }
      : next(url, c),
});
const { contrast, paletteOf, useShownPalette } = await import('./palette.ts');

// Breaks: a phase shows the wrong palette, an unknown or inherited name ('constructor') or a world
// without a calendar shows anything but light (docs/system/book-ui.md#world-and-status-entry).
test('the solar phase name picks the palette', () => {
  for (const [solar, bg] of [
    ['day', '#ebe6d7'],
    ['dawn', '#e2d7d7'],
    ['dusk', '#2c2846'],
    ['night', '#10151e'],
    ['twilight', '#ebe6d7'],
    ['constructor', '#ebe6d7'],
    [undefined, '#ebe6d7'],
  ] as const)
    assert.equal(paletteOf(solar).bg, bg, String(solar));
});

// Breaks: a palette value that leaves a text role under 4.5:1 on its paper or card
// (docs/BOOK-UI-COMPONENTS.md#design-tokens).
test('every text role is at least 4.5:1 on bg and card in every palette', () => {
  assert.equal(contrast('#000000', '#ffffff').toFixed(0), '21');
  assert.equal(contrast('#ffffff', '#ff0000').toFixed(2), '4.00'); // WCAG's red on white
  for (const [name, p] of Object.entries(color))
    for (const role of ['fg', 'dim', 'action', 'danger', 'warning'] as const)
      for (const paper of ['bg', 'card'] as const)
        assert.ok(contrast(p[role], p[paper]) >= 4.5, `${name}.${role} on ${paper}`);
});

// Drives useShownPalette as a component would be: render, then run changed effects; frames and the
// clock are in the test's hands.
function mount(curve?: (t: number) => number) {
  const slots: any[] = [];
  const deps: unknown[][] = [];
  const cleanups: ((() => void) | void)[] = [];
  const frames: (() => void)[] = [];
  let clock = 1000;
  let slot = 0;
  let pending: (() => void)[] = [];
  h.requestAnimationFrame = (f: () => void) => frames.push(f);
  h.cancelAnimationFrame = () => frames.splice(0);
  h.performance = { now: () => clock };
  h.hook = {
    state: (v: unknown) => {
      const i = slot++;
      if (!(i in slots)) slots[i] = v;
      return [slots[i], (n: unknown) => (slots[i] = n)];
    },
    effect: (f: () => (() => void) | void, d: unknown[]) => {
      const i = slot++;
      if (deps[i]?.every((x, j) => Object.is(x, d[j]))) return;
      deps[i] = d;
      pending.push(() => (cleanups[i]?.(), (cleanups[i] = f())));
    },
  };
  const render = (target: typeof color.light) => {
    slot = 0;
    useShownPalette(target, curve);
    for (const f of pending.splice(0)) f();
    slot = 0;
    return useShownPalette(target, curve); // after its effects, as the next render sees it
  };
  const frame = (at: number) => ((clock = 1000 + at), frames.shift()!());
  return { render, frame, frames };
}

// Breaks: the Book fades in from light on opening, never reaches the new palette exactly, or does
// not switch at once under reduced motion (no curve).
test('the shown palette: at once on mount and without a curve, else eased over motion.palette', () => {
  const still = mount();
  assert.equal(still.render(color.dusk).bg, '#2c2846');
  assert.equal(still.render(color.light).bg, '#ebe6d7');
  const fade = mount((t) => t);
  assert.equal(fade.render(color.light).bg, '#ebe6d7');
  assert.equal(fade.frames.length, 0);
  fade.render(color.dawn);
  fade.frame(750);
  assert.equal(fade.render(color.dawn).bg, '#e7dfd7'); // half-way, by hand
  fade.frame(1500);
  assert.equal(fade.render(color.dawn).bg, '#e2d7d7');
  assert.equal(fade.frames.length, 0);
});

// Breaks: a fade across a polarity flip (ink and paper cross, so some frame has no contrast), or a
// same-polarity fade whose frame drops a text role under 4.5:1 (docs/BOOK-UI-COMPONENTS.md#design-tokens).
test('every ordered palette change: same polarity fades readably, a flip switches at once', () => {
  const flips = new Set(['light>dusk', 'light>dark', 'dawn>dusk', 'dawn>dark']);
  for (const [from, a] of Object.entries(color))
    for (const [to, b] of Object.entries(color)) {
      if (a === b) continue;
      const pair = `${from}>${to}`;
      const fade = mount((t) => t);
      fade.render(a);
      const first = fade.render(b);
      if (flips.has(pair) || flips.has(`${to}>${from}`)) {
        assert.equal(first, b, `${pair} switches at once`);
        assert.equal(fade.frames.length, 0, `${pair} schedules no fade`);
        continue;
      }
      assert.equal(fade.frames.length, 1, `${pair} fades`);
      for (let at = 15; at <= 1500; at += 15) {
        fade.frame(at);
        const p = fade.render(b);
        for (const role of ['fg', 'dim', 'action', 'danger', 'warning'] as const)
          for (const paper of ['bg', 'card'] as const)
            assert.ok(contrast(p[role], p[paper]) >= 4.5, `${pair} at ${at}: ${role} on ${paper}`);
      }
      assert.equal(fade.render(b), b, `${pair} ends on the target`);
    }
});

// Breaks: a fade cut short by a flip keeps fading from its mixed frame across the flip.
test('a flip during a same-polarity fade switches at once', () => {
  const fade = mount((t) => t);
  fade.render(color.light);
  fade.render(color.dawn);
  fade.frame(750);
  assert.equal(fade.render(color.dusk), color.dusk);
  assert.equal(fade.frames.length, 0);
});
