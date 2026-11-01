// The real PageTurn around the effects it ends and hosts: a wash, the chapter card's blur.
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { effects, flat, rig } from './__tests__/hook-rig.ts';
import { nodes } from './__tests__/polish-book.test.ts';

const g = globalThis as any;
const stubs: Record<string, string> = {
  'react-native-reanimated':
    "export default {View:'View'};export const ReduceMotion={Never:'never'},useAnimatedStyle=f=>f()," +
    'useDerivedValue=f=>({value:f()}),useReducedMotion=()=>globalThis.reducedMotion,' +
    'useSharedValue=value=>globalThis.sharedSlot(value),Easing={bezier:()=>()=>0,linear:t=>t,' +
    'quad:t=>t,in:f=>f,out:f=>f,inOut:f=>f},' +
    'withTiming=(v,o,done)=>{globalThis.timed=o;globalThis.finish=done;return v};',
  'react-native-worklets': 'export const scheduleOnRN=f=>f();',
  '@shopify/react-native-skia':
    "export const Blur='Blur',Canvas='Canvas',Fill='Fill',Image='SkiaImage',ImageShader='ImageShader'," +
    "Shader='Shader',Skia={Color:()=>[0,0,0,0],RuntimeEffect:{Make:()=>({})}};",
  './page-curl.sksl': "export default '';",
  './snapshot': 'export const snapshot=()=>globalThis.snap(),warm=()=>{};',
};
registerHooks({
  resolve(specifier, context, next) {
    const code = stubs[specifier];
    return code
      ? { url: `data:text/javascript,${encodeURIComponent(code)}`, shortCircuit: true }
      : next(specifier, context);
  },
});
// By URL: polish-book stubs the './PageTurn.tsx' specifier.
const { PageTurn } = await import(new URL('./PageTurn.tsx', import.meta.url).href);
const { Blow } = await import('./Blow.tsx');
const { motion } = await import('./tokens.ts');
const { cardContext, useCardInk, useCardTurn } = await import('./card.ts');

// The tree as PageTurn returns it, inner components left unrendered.
const walk = (e: any): any[] =>
  Array.isArray(e)
    ? e.flatMap(walk)
    : e && typeof e === 'object'
      ? [e, ...walk(e.props?.children)]
      : [];
const named = (tree: any[], name: string) => tree.find((n) => n.type?.name === name);
const settle = () => new Promise((r) => setImmediate(r));

function turner(t: any, card = false) {
  const shell = rig(t);
  const page = { type: 'Page', key: null, props: {} };
  const draw = (turn: number) =>
    shell(() => walk(PageTurn({ turn, dir: 1, paper: '#fff', card, children: page })));
  // Twice: the render that hears the turn sets `leaving` for the next, as React's rerun does.
  const go = async (turn: number) => {
    draw(turn);
    draw(turn);
    await settle();
    draw(turn);
    return draw(turn);
  };
  return { draw, go };
}
const inContext = (tree: any[]) => tree[1].props.value;

// Breaks: PageTurn keeps one instance across a turn, so the old page's wash stays on the new page.
test('a page turn mounts a fresh page: the old wash does not carry over', async (t) => {
  effects(t);
  g.reducedMotion = false;
  g.snap = async () => null;
  const keyed = (tree: any[]) => tree.filter((n) => n.type === 'View' && n.key !== null);
  const pages = new Map<string, ReturnType<typeof rig>>();
  const blow = (key: string) => {
    if (!pages.has(key)) pages.set(key, rig(t));
    return pages.get(key)!(() => nodes(Blow({ children: null })));
  };
  const { go } = turner(t);
  const first = keyed(await go(0))[0].key;
  blow(first);
  pages.get(first)!.shared[0]!.value = 0.18;
  assert.equal(flat(blow(first)[1].props.style).opacity, 0.18);
  const second = keyed(await go(1))[0].key;
  const fresh = blow(second);
  assert.equal(flat(fresh[1].props.style).opacity, 0);
  assert.equal(flat(fresh[2].props.style).transform[0].scale, 1);
});

// Breaks: the card curls, or draws nothing, over a picture; or the blur does not run blurFrom to
// blurTo and let go at the end (tokens: motion.card, hand-checked below).
test('a card over a picture blurs it, without a curl, and lets go at the end', async (t) => {
  effects(t);
  g.reducedMotion = false;
  const image = { dispose: () => {} };
  g.snap = async () => image;
  const { go } = turner(t, true);
  await go(0);
  const tree = await go(1);
  assert.equal(inContext(tree), 'picture');
  assert.equal(named(tree, 'Curl'), undefined);
  const blur = named(tree, 'CardBlur');
  assert.equal(blur.props.image, image);
  const at = (value: number) => {
    const canvas = walk(rig(t)(() => blur.type({ ...blur.props, progress: { value } })));
    return {
      blur: canvas.find((n) => n.type === 'Blur').props.blur.value,
      shown: canvas.find((n) => n.type === 'SkiaImage').props.opacity.value,
    };
  };
  assert.deepEqual(at(0), { blur: 6, shown: 1 });
  assert.deepEqual(at(1), { blur: 12, shown: 0 });
  // Halfway the picture is still held whole: only motion.card.out lets it go.
  assert.equal(at(0.5).shown, 1);
  // Breaks: the blur runs and lets go 300 ms early: the card's whole duration, then `out` after it.
  assert.equal(g.timed.duration, 900);
  assert.ok(Math.abs(at(5 / 6).shown - 0.5) < 1e-9); // 150 ms of the 300 left
  const { x, y } = walk(rig(t)(() => blur.type({ ...blur.props, progress: { value: 0 } }))).find(
    (n) => n.type === 'SkiaImage',
  ).props;
  assert.deepEqual([x, y], [0, 0]);
  // Breaks: a page or the canvas stops filling the Book, so the turn draws a collapsed page.
  const fills = tree.filter((n) => n.props?.style?.flex === 1);
  assert.equal(fills.length, 2);
});

// Breaks: a turn with no picture (web without CanvasKit) waits for a blur that never comes, leaving
// the card's ink unseen; `undefined` is the context that says ink at once.
test('no picture means no blur and the card is simply there', async (t) => {
  effects(t);
  g.reducedMotion = false;
  g.snap = async () => null;
  const { go } = turner(t, true);
  await go(0);
  const tree = await go(1);
  assert.equal(inContext(tree), undefined);
  assert.equal(named(tree, 'CardBlur'), undefined);
});

// Breaks: reduced motion blurs (or takes a picture to), rather than book-ui's cross-fade.
test('reduced motion takes no picture for a card and blurs nothing', async (t) => {
  effects(t, true);
  g.snap = () => assert.fail('no picture under reduced motion');
  const { go } = turner(t, true);
  await go(0);
  const tree = await go(1);
  assert.equal(inContext(tree), undefined);
  assert.equal(named(tree, 'CardBlur'), undefined);
});

// Breaks: the card's picture leaks (or is freed while Skia may still draw it: two frames later).
test('the blurred picture is freed two frames after the card lets go', async (t) => {
  effects(t);
  g.reducedMotion = false;
  let freed = 0;
  g.snap = async () => ({ dispose: () => freed++ });
  const frames: (() => void)[] = [];
  t.mock.method(globalThis, 'requestAnimationFrame', (f: () => void) => frames.push(f));
  const { go, draw } = turner(t, true);
  await go(0);
  await go(1);
  g.finish(true);
  draw(1);
  assert.equal(freed, 0);
  frames.shift()!();
  assert.equal(freed, 0);
  frames.shift()!();
  assert.equal(freed, 1);
});

// Breaks: the card's marks dry together, or wait for a picture when none is coming.
test('a card dries mark by mark over a picture and is there at once without one', (t) => {
  effects(t);
  const outer = cardContext._currentValue;
  t.after(() => void (cardContext._currentValue = outer));
  const mark = (i: number) => rig(t)(() => useCardInk(i));
  cardContext._currentValue = 'picture';
  [0, 1, 2].forEach(mark);
  assert.deepEqual(g.delays, [0, 120, 240]);
  assert.equal(mark(0).opacity, 0);
  // Breaks: a card still waiting for its picture inks early, or the "no picture" answer leaves it blank.
  const ink = rig(t);
  const draw = () => ink(() => useCardInk(0)).opacity;
  cardContext._currentValue = 'picture';
  draw();
  assert.equal(draw(), 1);
  const late = rig(t);
  const wait = () => late(() => useCardInk(0)).opacity;
  cardContext._currentValue = 'waiting';
  wait();
  assert.equal(wait(), 0);
  cardContext._currentValue = undefined;
  wait();
  assert.equal(wait(), 1);
});

// The chapter card's clock: on the mock timers, the device through react-shim's seam.
async function card(t: any, device: object = {}) {
  effects(t);
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  g.cardDevice = device;
  t.after(() => (g.cardDevice = undefined));
  const turned = { count: 0 };
  const draw = rig(t);
  const on = () =>
    draw(() =>
      useCardTurn(() => {
        turned.count++;
      }),
    );
  on();
  await settle();
  const hook = on();
  return { turned, hook, draw, on, tick: (ms: number) => t.mock.timers.tick(ms) };
}

// Breaks: the card waits for ever, or turns early, or turns twice.
test('the card turns itself once, at the token', async (t) => {
  const { turned, tick } = await card(t);
  tick(motion.card.auto - 1);
  assert.equal(turned.count, 0);
  tick(1);
  assert.equal(turned.count, 1);
  tick(motion.card.auto);
  assert.equal(turned.count, 1);
});

// Breaks: the turn calls the done of the card's first render: its stale stack pops the wrong page.
test('the card turns with the latest done', async (t) => {
  const { draw, tick } = await card(t);
  const calls: string[] = [];
  draw(() => useCardTurn(() => calls.push('latest')));
  tick(motion.card.auto);
  assert.deepEqual(calls, ['latest']);
});

// Breaks: a tap and the clock both turn, skipping the next page too.
test('a tap skips once and cancels the clock', async (t) => {
  const { turned, hook, tick } = await card(t);
  tick(10);
  hook.turn();
  hook.turn();
  assert.equal(turned.count, 1);
  assert.equal(t.mock.timers.getTimers?.()?.length ?? 0, 0);
  tick(motion.card.auto);
  assert.equal(turned.count, 1);
});

// Breaks: the card turns while the app is away, or restarts its clock, or a second away (inactive,
// then background) loses more time than passed.
test('a backgrounded card keeps the time it had left', async (t) => {
  const device: any = {};
  const { turned, tick } = await card(t, device);
  tick(1000);
  device.change(false);
  tick(100);
  device.change(false);
  tick(motion.card.auto);
  assert.equal(turned.count, 0);
  device.change(true);
  device.change(true);
  tick(motion.card.auto - 1000 - 1 - 100);
  assert.equal(turned.count, 0);
  tick(100 + 1);
  assert.equal(turned.count, 1);
});

// Breaks: a card opened in the background is already counting.
test('a card opened away starts its clock on return', async (t) => {
  const device: any = { away: true };
  const { turned, tick } = await card(t, device);
  tick(motion.card.auto * 2);
  assert.equal(turned.count, 0);
  device.change(true);
  tick(motion.card.auto);
  assert.equal(turned.count, 1);
});

// Breaks: a screen reader user's card leaves before it is read.
test('with a screen reader on there is no clock', async (t) => {
  const { turned, hook, tick } = await card(t, { reader: true });
  assert.equal(hook.reader, true);
  tick(motion.card.auto * 2);
  assert.equal(turned.count, 0);
});

// Breaks: an unmounted card (a scene took over) still turns the page or keeps its listener.
test('an unmounted card leaves no clock or listener', async (t) => {
  const device: any = {};
  const { turned, draw, tick } = await card(t, device);
  draw.unmount();
  tick(motion.card.auto);
  assert.equal(turned.count, 0);
  assert.equal(device.change, undefined);
});
