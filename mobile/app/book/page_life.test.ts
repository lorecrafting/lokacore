// What the Book's page life promises, against the real components: the routes, the held layers, the ink.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effects, flat, rig } from './__tests__/hook-rig.ts';
import { book, nodes } from './__tests__/polish-book.test.ts';
import { CONTENTS } from './__tests__/control.test.ts';
import type { GameView } from '../../packages/game-view/session.ts';

const { footContext, UnderInk } = await import('./UnderInk.tsx');
const { pressBook } = await import('./Book.tsx');
const { Blow } = await import('./Blow.tsx');
const { NightSky } = await import('./NightSky.tsx');
const { curlContext, useDrawn } = await import('./press.ts');
const { PaletteContext } = await import('./palette.ts');
const { useCues } = await import('./cues.ts');
const { LABEL } = await import('./labels.ts');
const { color, motion, opacity } = await import('./tokens.ts');

const g = globalThis as any;
const view = (over: object) =>
  ({
    inventory: [],
    equipment: [],
    journal: [],
    entities: [],
    resources: [],
    place: { id: 'p' },
    ...over,
  }) as unknown as GameView;
const low = view({ resources: [{ resource: { key: 'hp' }, tone: 'danger' }] });
const lit = view({ inventory: [{ id: 'lamp', fuel: { remaining: 5, capacity: 9, lit: true } }] });
const GLOW = 0;
const EDGE = 1; // the shared values' order in useLayers

function layers(t: any) {
  g.CanvasKit = {};
  t.after(() => delete g.CanvasKit);
  const shell = rig(t);
  return Object.assign((v: GameView) => shell(() => nodes(UnderInk({ view: v }))), shell);
}
const underInk = (drawn: any[]) => drawn.filter((n) => n.props?.['aria-hidden']);

// Breaks: the Credits route lost: its row falls through to the Carrying page.
test('the Credits row opens the Credits page', () => {
  const h = book();
  h.tap(CONTENTS);
  h.tap('Settings');
  h.tap(LABEL.credits);
  h.tap(LABEL.backToSettings); // only the Credits page has it
});

// Breaks: a killing blow leaves the page's glow and vignette held under the Blow (heldLayer.ts).
test('a killing blow clears the held layer', (t) => {
  effects(t);
  const draw = layers(t);
  const cues = rig(t);
  const bleeding = { ...low, combat: { on: 1 } } as unknown as GameView;
  const hear = (died?: string) =>
    cues(() => useCues(bleeding, false, 0, undefined, false, undefined, died));
  hear();
  draw(bleeding);
  assert.equal(g.sequences.length > 0, true, 'the vignette breathing');
  g.timings = [];
  hear('blow');
  draw(bleeding);
  const settle = motion.settle.duration;
  assert.deepEqual(g.timings, [settle, settle]);
});

// Breaks: the vignette breathes under reduced motion instead of holding still (book-ui.md).
test('reduced motion holds the vignette still at its faint value', (t) => {
  effects(t, true);
  const draw = layers(t);
  draw(low);
  assert.equal(draw.shared[EDGE].value, opacity.faint);
  assert.deepEqual(g.sequences, []);
});

// Breaks: a page turn fades a lit glow in again from nothing (UnderInk: `shown`).
test('a page arriving on a glow already showing starts at it', (t) => {
  effects(t);
  const paper = PaletteContext._currentValue;
  t.after(() => void (PaletteContext._currentValue = paper));
  PaletteContext._currentValue = color.dusk;
  layers(t)(lit);
  const next = rig(t);
  let first;
  next(() => {
    const drawn = nodes(UnderInk({ view: lit }));
    first = next.shared[GLOW].value; // before the effect sets its target
    return drawn;
  });
  assert.equal(first, opacity.glow);
});

// Breaks: the layer stops at the page, a straight seam above the foot (designer, PR 559).
test('a held layer reaches on under the foot', (t) => {
  effects(t);
  const foot = footContext._currentValue;
  t.after(() => void (footContext._currentValue = foot));
  footContext._currentValue = 64;
  const [layer] = underInk(layers(t)(low));
  assert.equal(flat(layer.props.style).bottom, -64);
});

// Breaks: the sky twinkles under reduced motion (book-ui.md).
test('reduced motion stills the stars', (t) => {
  effects(t, true);
  const groups = rig(t)(() => nodes(NightSky())).filter((n) => Array.isArray(n.props?.children));
  assert.ok(groups.length > 1);
  assert.deepEqual(
    groups.filter((n) => 'opacity' in flat(n.props.style ?? {})),
    [],
  );
});

// Breaks: ink dries under the curl over its page, mostly unseen (book-ui.md, Map ink).
test('ink waits for the curl over its page, on top of its own lag', (t) => {
  effects(t);
  const curl = curlContext._currentValue;
  t.after(() => void (curlContext._currentValue = curl));
  curlContext._currentValue = 500;
  rig(t)(() => useDrawn(true, motion.settle, 40));
  assert.deepEqual(g.delays, [540]);
});

// Breaks: the Book never measures its foot, so no layer learns how far to reach.
test('the Book hands its measured foot to the page', () => {
  const h = book();
  const measured = () => h.draw().find((n: any) => n.type === footContext).props.value;
  assert.equal(measured(), 0);
  h.draw()
    .find((n: any) => n.props?.onLayout)
    .props.onLayout({ nativeEvent: { layout: { height: 64 } } });
  assert.equal(measured(), 64);
});

// Breaks: the combat page clips its layer at the page, the seam back on a fight (Blow.tsx).
test('the Blow clips its swelling page, not what lies under it', (t) => {
  effects(t);
  const drawn = rig(t)(() => nodes(Blow({ under: 'under', children: null })));
  const clips = (n: any) => flat(n.props?.style ?? {}).overflow === 'hidden';
  assert.equal(clips(drawn[0]), false);
  assert.equal(drawn.filter(clips).length, 1);
});

// Breaks: a due job kills during a travel and the death page arrives under a riffle (book-ui.md).
test('a travel that moves riffles, unless the press killed', () => {
  const riffleAfter = (died: string | undefined) => {
    const was = view({ place: { id: 'p' } } as never);
    const there = view({ place: { id: 'q' } } as never);
    let shown = { view: was, died: undefined as string | undefined };
    const pr = {
      screen: () => shown,
      press: () => (shown = { view: there, died }),
      recovered: () => false,
    };
    const flips: { riffle?: boolean }[] = [];
    const state = {
      restoreInvocation: { current: undefined },
      current: { current: { stack: [{ kind: 'room' }], view: was } },
      setStack: () => {},
      redraw: () => {},
      setFlip: (f: (o: object) => { riffle?: boolean }) => flips.push(f({ turn: 0 })),
    };
    const game = { pendingInvocation: () => 'none', pending: () => false, view: () => was };
    pressBook(
      { game, shell: {} } as never,
      pr as never,
      state as never,
      { command: 'expedition', action_key: 'expedition', target_ids: [] } as never,
    );
    assert.equal(flips.length, 1);
    return flips[0]!.riffle;
  };
  assert.equal(riffleAfter(undefined), true);
  assert.equal(riffleAfter('You fell.'), false);
});
