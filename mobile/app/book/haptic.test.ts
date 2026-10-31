// Named breaks for the browser haptic module, over a fake navigator (the device is external).
import assert from 'node:assert/strict';
import { test } from 'node:test';

let page = 0;
async function browser(t: import('node:test').TestContext, dev: boolean) {
  const buzzes: unknown[] = [];
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { vibrate: (p: unknown) => buzzes.push(p) },
  });
  Object.assign(globalThis, { __DEV__: dev });
  t.mock.timers.enable({ apis: ['Date'], now: 1000 });
  const mod: typeof import('./haptic.web.ts') = await import(`./haptic.web.ts?page=${page++}`);
  return { ...mod, buzzes, tick: (ms: number) => t.mock.timers.tick(ms) };
}

// Breaks: the setting does not gate, or a turned-on setting stays off.
test('Haptics off stops a haptic, device and pulse alike', async (t) => {
  const b = await browser(t, true);
  const pulses: string[] = [];
  b.onPulse((k) => pulses.push(k));
  b.hapticsOn(false);
  b.haptic('light');
  assert.deepEqual([b.buzzes, pulses], [[], []]);
  b.hapticsOn(true);
  b.haptic('light');
  assert.deepEqual([b.buzzes, pulses], [[15], ['light']]);
});

// Breaks: two haptics inside 100 ms, a boundary off by one, or a suppressed one resetting the gap.
test('no two haptics within the gap', async (t) => {
  const b = await browser(t, false);
  b.haptic('heavy');
  b.tick(99);
  b.haptic('heavy');
  assert.deepEqual(b.buzzes, [40]);
  b.tick(1);
  b.haptic('warning');
  assert.deepEqual(b.buzzes, [40, [20, 60, 20]]);
});

// Breaks: the dev pulse reaches a player build, while the device still vibrates there.
test('the pulse is absent in a player build', async (t) => {
  const b = await browser(t, false);
  const pulses: string[] = [];
  b.onPulse((k) => pulses.push(k));
  b.haptic('medium');
  assert.deepEqual([b.buzzes, pulses], [[25], []]);
});

// Breaks: an unmounted pulse is still called (a set state on a gone component).
test('an unsubscribed pulse hears nothing', async (t) => {
  const b = await browser(t, true);
  const pulses: string[] = [];
  b.onPulse((k) => pulses.push(k))();
  b.haptic('light');
  assert.deepEqual(pulses, []);
});

// Breaks: a browser with no vibration throws, so the press fails; and the pulse there is the point.
test('a browser with no vibrate still pulses', async (t) => {
  const b = await browser(t, true);
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
  const pulses: string[] = [];
  b.onPulse((k) => pulses.push(k));
  b.haptic('light');
  assert.deepEqual(pulses, ['light']);
});
