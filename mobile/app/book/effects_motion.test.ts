// The pop's and the head's motion over time on real components: values, delays and timers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effects, flat, rig } from './__tests__/hook-rig.ts';
import { nodes } from './__tests__/polish-book.test.ts';
import type { GameView } from '../../packages/game-view/session.ts';

const { playCue } = await import('./cueSounds.ts');
const { onCue, useCues } = await import('./cues.ts');
const { ItemPop } = await import('./ItemPop.tsx');
const { RunningHead } = await import('./RunningHead.tsx');
const { ShelfPage } = await import('./Shelf.tsx');
const { color, motion } = await import('./tokens.ts');

const g = globalThis as any;
const say = ((s: string) => s.replace('.name', '')) as never;
const POP = motion.pop.duration + motion.pop.hold + motion.pop.out;

const held = (ids: string[], hp = 20) =>
  ({
    place: { id: 'p' },
    inventory: ids.map((id) => ({ id, name: `${id}.name` })),
    journal: [],
    combat: {},
    resources: [
      { resource: { key: 'hp', short_label: 'hp' }, current: hp, maximum: 20, tone: 'normal' },
    ],
  }) as unknown as GameView;

function popRig(t: any) {
  effects(t, false);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let now = 5000;
  t.mock.method(performance, 'now', () => now);
  const draw = rig(t);
  const at = (v: GameView) =>
    draw(() => {
      useCues(v, false, 0);
      return nodes(ItemPop({ view: v, text: say }));
    });
  return { at, draw, tick: (ms: number) => (t.mock.timers.tick(ms), (now += ms)) };
}
const said = (shown: any[]) => shown.filter((n) => n.type === 'Text').map((n) => n.props.children);

// Breaks: the pop starts visible, a second pickup does not rise again from nothing, its rise or fade
// lands wrong, or its ink never reaches the action colour.
test('the pop rises from nothing into action ink, then fades, and a later pickup replays it', (t) => {
  const { at, draw } = popRig(t);
  at(held(['sack']));
  const [up, gone] = draw.shared.slice(-2) as { value: number }[];
  assert.deepEqual([up!.value, gone!.value], [0, 0]);
  const writes: number[][] = [[], []];
  [up!, gone!].forEach((shared, i) => {
    let value = shared.value;
    Object.defineProperty(shared, 'value', {
      get: () => value,
      set: (n) => (writes[i]!.push(n), (value = n)),
    });
  });
  at(held(['sack', 'rope']));
  assert.deepEqual(writes, [
    [0, 1],
    [0, 1],
  ]);
  const look = (u: number, f: number) => {
    up!.value = u;
    gone!.value = f;
    const shown = at(held(['sack', 'rope']));
    const box = flat(shown.find((n) => n.props?.['aria-hidden'])!.props.style);
    const words = shown.find((n) => n.type === 'Text')!;
    return [box.opacity, box.transform[0].translateY, flat(words.props.style).color];
  };
  assert.deepEqual(look(0, 0), [0, motion.pop.rise, color.light.dim]);
  assert.deepEqual(look(1, 0), [1, 0, color.light.action]);
  assert.deepEqual(look(1, 1), [0, 0, color.light.action]);
});

// Breaks: reduced motion keeps the pop's rise (book-ui.md, the fade alone).
test('reduced motion: the pop fades in place', (t) => {
  const { at, draw } = popRig(t);
  g.reducedMotion = true;
  at(held(['sack']));
  at(held(['sack', 'rope']));
  draw.shared.at(-2)!.value = 0;
  const box = flat(at(held(['sack', 'rope'])).find((n) => n.props?.['aria-hidden'])!.props.style);
  assert.equal(box.transform[0].translateY, 0);
});

// Breaks: another cue (a blow) wipes a showing pop, the pop outlives its hold, or a second pickup
// inherits the first one's timer and leaves early.
test('a pop stays its whole length: a blow leaves it, a second pickup restarts it', (t) => {
  const { at, tick } = popRig(t);
  at(held(['sack']));
  at(held(['sack', 'rope']));
  assert.deepEqual(said(at(held(['sack', 'rope'], 15))), ['+ rope']);
  assert.deepEqual(said(at(held(['sack', 'rope'], 15))), ['+ rope']);
  tick(1000);
  at(held(['sack', 'rope', 'oar'], 15));
  assert.deepEqual(said(at(held(['sack', 'rope', 'oar'], 15))), ['+ oar']);
  tick(POP - 1);
  assert.deepEqual(said(at(held(['sack', 'rope', 'oar'], 15))), ['+ oar']);
  tick(1);
  assert.deepEqual(said(at(held(['sack', 'rope', 'oar'], 15))), []);
});

const quest = (key: string, state: string) => ({
  quest: { key },
  state,
  journal: `${key}.seek`,
  title: 'title',
});
const journal = (...q: object[]) =>
  ({ place: { id: 'p' }, inventory: [], journal: q }) as unknown as GameView;
const opacities = (shown: any[]) =>
  shown
    .filter((n) => n.type === 'View' && 'opacity' in flat(n.props.style))
    .map((n) => flat(n.props.style).opacity);

// The head as mounted after `before` was drawn: a page turn's remount reads what was last drawn.
function headAfter(t: any, before: GameView) {
  effects(t, false);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  rig(t)(() => nodes(RunningHead({ view: before, text: say })));
  const draw = rig(t);
  return (v: GameView) => draw(() => nodes(RunningHead({ view: v, text: say })));
}

// Breaks: the last objective lingers past motion.settle or leaves late, after a lag.
test('a finished objective with none after it fades at once, then its space closes', (t) => {
  const head = headAfter(t, journal(quest('q', 'active')));
  const done = journal({ ...quest('q', 'resolved'), journal: null });
  assert.deepEqual(opacities(head(done)), [1]);
  assert.deepEqual(opacities(head(done)), [0]);
  assert.deepEqual(g.delays, []);
  t.mock.timers.tick(motion.settle.duration);
  assert.deepEqual(head(done), []);
});

// Breaks: the next objective lands before the old one has gone, or the old one stays on the page.
test('a settled objective goes first; the next waits motion.settle, then dries in', (t) => {
  const head = headAfter(t, journal(quest('q', 'active')));
  const next = journal(quest('q', 'resolved'), quest('r', 'active'));
  assert.deepEqual(opacities(head(next)), [1, 0]);
  assert.deepEqual(opacities(head(next)), [0, 1]);
  assert.deepEqual(g.delays, [motion.settle.duration]);
});

// Breaks: a changed objective keeps the old words showing under the new.
test('a changed objective cross-fades with no wait', (t) => {
  const head = headAfter(t, journal(quest('q', 'active')));
  const next = journal(quest('r', 'active'));
  assert.deepEqual(opacities(head(next)), [1, 0]);
  assert.deepEqual(opacities(head(next)), [0, 1]);
  assert.deepEqual(g.delays, []);
});

// Breaks: a buy never pops, for a buy writes no line on this page (book-ui.md, quiet; quiet_log.test.ts
// "the page keeps neither"): the page's own detail is empty, the rest of the path is real.
test('a buy pops its item on a shop page with no line', (t) => {
  const { draw } = popRig(t);
  const buy = (v: GameView) =>
    draw(() => {
      useCues(v, false, 0);
      return nodes(
        ShelfPage({
          id: 'npc',
          screen: {
            view: { ...v, entities: [{ id: 'npc', name: 'npc.name', shop: [] }] },
            text: say,
            detail: () => [],
          },
          g: { on: () => [] },
          press: () => {},
          open: () => {},
          back: () => {},
        } as any),
      );
    });
  const purse = (n: number, ids: string[]) => {
    const v = held(ids) as any;
    return { ...v, resources: [{ resource: { key: 'pennies' }, current: n }] } as GameView;
  };
  buy(purse(5, []));
  buy(purse(3, ['rope']));
  assert.ok(said(buy(purse(3, ['rope']))).includes('+ rope'));
});

// Breaks: a shop with no purse and no history draws an empty wrapper (a gap in the page), or a line
// drops the pop.
test('the shop draws no empty anchor, and the pop hangs under the last line', () => {
  const page = (lines: string[]) =>
    ShelfPage({
      id: 'npc',
      screen: {
        view: { entities: [{ id: 'npc', name: 'npc.name', shop: [] }], inventory: [] },
        text: say,
        detail: () => lines,
      },
      g: { on: () => [] },
      press: () => {},
      open: () => {},
      back: () => {},
    } as any);
  const bought = (lines: string[]) => {
    const el = page(lines).props.children.find((c: any) => c?.type?.name === 'Bought');
    return el.type(el.props);
  };
  assert.equal(bought([]), null);
  const under = bought(['You buy a rope.']).props.children;
  assert.deepEqual(
    under.filter(Boolean).map((c: any) => c.type.name),
    ['LogLines', 'ItemPop'],
  );
});

// Breaks: a take plays the page turn and its flick; a plain turn goes silent; a buy's silent pickup
// mutes a turn; the first draw counts as a turn. Files from the real sound table, in play order.
test('one action, one paper sound', (t) => {
  effects(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let now = 5000;
  t.mock.method(performance, 'now', () => now);
  const room = held([]);
  const off = onCue(playCue);
  t.after(off);
  const played = (steps: [GameView, number][]) => {
    g.bookDevice = [];
    const draw = rig(t);
    for (const [v, turn] of steps) {
      draw(() => useCues(v, false, turn));
      now += 1000;
      t.mock.timers.tick(1000);
    }
    const log: string[] = g.bookDevice
      .filter((l: string[]) => l[0] === 'play')
      .map((l: string[]) => l[1]);
    g.bookDevice = undefined;
    return log;
  };
  const withSack = held(['sack']);
  assert.deepEqual(played([[room, 0]]), []);
  assert.deepEqual(
    played([
      [room, 0],
      [room, 1],
    ]),
    ['pageTurn'],
  );
  assert.deepEqual(
    played([
      [room, 0],
      [withSack, 1],
    ]),
    ['pickup'],
  );
});
