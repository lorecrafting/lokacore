import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { reactShim } from './__tests__/react-shim.ts';
import { color, opacity } from './tokens.ts';

// palette.ts's hooks outside React: one component, its state slots and effects run by hand.
const h = globalThis as any;
registerHooks({
  resolve: (s, c, next) =>
    s === 'react' && c.parentURL?.endsWith('/palette.ts')
      ? { url: 'test:palette-react', shortCircuit: true }
      : next(s, c),
  load: (url, c, next) =>
    url === 'test:palette-react' ? reactShim('globalThis.hook') : next(url, c),
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

// Breaks: the lightning token is raised past the two dips Design tokens allows it, or a palette or a
// role drops under 4.5:1 unnoticed. Literal floors per palette and role, as the spec states them.
test('lightning over the paper keeps every role at its stated contrast', () => {
  const mix = (under: string, over: string, a: number) =>
    '#' +
    [1, 3, 5]
      .map((i) => {
        const at = (hex: string) => parseInt(hex.slice(i, i + 2), 16);
        const v = Math.round(at(under) * (1 - a) + at(over) * a);
        return v.toString(16).padStart(2, '0');
      })
      .join('');
  const dips: Record<string, number> = {
    'dusk.dim': 4.25,
    'dusk.warning': 4.03,
    'dark.warning': 3.95,
  };
  for (const [name, p] of Object.entries(color)) {
    const lit = mix(p.bg, color.light.bg, opacity.afterimage);
    assert.ok(contrast(p.fg, lit) > 7, `${name}.fg`);
    assert.ok(contrast(p.action, lit) > 5, `${name}.action`);
    assert.ok(contrast(p.danger, lit) > 5, `${name}.danger`);
    for (const role of ['dim', 'warning'] as const) {
      const floor = dips[`${name}.${role}`] ?? 4.5;
      assert.ok(contrast(p[role], lit) >= floor - 0.005, `${name}.${role}`);
    }
  }
});

// Breaks (loka-x6t.86): danger drawn in the action's ink, so what is barred reads as pressable
// (docs/BOOK-UI-COMPONENTS.md#design-tokens: distinct hues in every palette).
test('danger and action are distinct hues in every palette', () => {
  const hue = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return (Math.atan2(Math.sqrt(3) * (g! - b!), 2 * r! - g! - b!) * 180) / Math.PI;
  };
  assert.equal(Math.round(hue('#00ff00')), 120);
  for (const [name, p] of Object.entries(color)) {
    const apart = Math.abs(hue(p.danger) - hue(p.action)) % 360;
    assert.ok(Math.min(apart, 360 - apart) >= 20, name);
  }
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
