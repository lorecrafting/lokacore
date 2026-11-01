// Press feedback, ink drying, status and head arrivals, error haptics: real components on a small hook
// rig that keeps slots and honours effect deps, as React does.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nodes } from './__tests__/polish-book.test.ts';
import type { GameView } from '../../packages/game-view/session.ts';

const { ActionCard } = await import('./actions.tsx');
const { LetterTile } = await import('./Riddle.tsx');
const { saidLabel } = await import('./Footer.tsx');
const { Chip } = await import('./Chip.tsx');
const { opacity } = await import('./tokens.ts');
const { useCues } = await import('./cues.ts');
const { Fault, LogLines } = await import('./lines.tsx');
const { dropLines, markDrawn, trimLog } = await import('./logs.ts');
const { Control, RunningHead, Tap } = await import('./pages.tsx');
const { StatusIcons } = await import('./StatusIcon.tsx');
const { SaveError } = await import('../SaveError.tsx');

const g = globalThis as any;
function effects(t: { after: (f: () => void) => void }, reduced = false) {
  g.reducedMotion = reduced;
  g.timings = [];
  g.delays = [];
  g.bookDevice = [];
  t.after(() => {
    g.reducedMotion = g.timings = g.delays = g.bookDevice = g.sharedSlot = undefined;
  });
}
function rig(t: { after: (f: () => void) => void }) {
  const slots: any[] = [];
  const stops: (() => void)[] = [];
  t.after(() => stops.forEach((stop) => stop()));
  let at = 0;
  const queued: (() => void)[] = [];
  return <T>(render: () => T): T => {
    at = 0;
    g[Symbol.for('loka-book-test-state')] = (v: any) => {
      const i = at++;
      if (!(i in slots)) slots[i] = typeof v === 'function' ? v() : v;
      return [slots[i], (n: any) => (slots[i] = typeof n === 'function' ? n(slots[i]) : n)];
    };
    g[Symbol.for('loka-book-test-effect')] = (f: () => () => void, deps: unknown[]) => {
      const i = at++;
      if (!slots[i]?.every((d: unknown, j: number) => Object.is(d, deps[j]))) {
        slots[i] = deps;
        queued.push(() => {
          const stop = f();
          if (typeof stop === 'function') stops.push(stop);
        });
      }
    };
    // A shared value lives as long as its component, as Reanimated's does.
    g.sharedSlot = (value: unknown) => g[Symbol.for('loka-book-test-state')](() => ({ value }))[0];
    const out = render();
    for (const f of queued.splice(0)) f();
    return out;
  };
}
const flat = (style: any) => Object.assign({}, ...[style].flat());
// A drying line is the only log Text with an animated style beside its own.
const dried = (shown: any[]) =>
  shown
    .filter((n) => n.type === 'Text' && Array.isArray(n.props.style))
    .map((n) => n.props.children);

// Breaks: a redraw re-dries the whole log (`>=` the wrong mark, or no mark), or cuts a drying line
// short by reading `fresh` on each draw.
test('only the line entering this redraw dries, and once', (t) => {
  effects(t);
  const lines: any[] = ['old a', 'old b', 'old c'];
  markDrawn(lines);
  const draw = rig(t);
  const log = () => draw(() => nodes(LogLines({ lines })));
  assert.deepEqual(dried(log()), []);
  assert.deepEqual(g.timings, []);
  lines.push('new');
  assert.deepEqual(dried(log()), ['new']);
  assert.deepEqual(g.timings, [240]);
  assert.deepEqual(g.delays, [], 'plain narration has no lag');
  assert.deepEqual(dried(log()), ['new'], 'still drying on the next redraw');
  assert.deepEqual(g.timings, [240], 'its timing started once');
});

// Breaks: a quiet merge counts as a new line (it re-dries); a trim renumbers the lines.
test('a quiet merge in place does not dry; a trim keeps each line its number', (t) => {
  effects(t);
  const quiet = (times: number) => ({
    quiet: 'q',
    plain: 'Rain.',
    times,
    text: `Rain. (${times} times)`,
  });
  const lines: any[] = ['a', 'b', quiet(1)];
  markDrawn(lines);
  const draw = rig(t);
  lines[2] = quiet(2);
  const merged = draw(() => nodes(LogLines({ lines })));
  assert.ok(merged.some((n) => n.props?.children === 'Rain. (2 times)'));
  assert.deepEqual(dried(merged), []);
  const keys = (shown: readonly any[], of?: any[]) =>
    (LogLines({ lines: shown, of }) as any).props.children.map((e: any) => e.key);
  assert.deepEqual(keys(lines), ['0', '1', '2']);
  dropLines(lines, 2);
  assert.deepEqual(keys(lines), ['2']);
  lines.push('c');
  assert.deepEqual(keys(lines), ['2', '3']);
  assert.deepEqual(keys(lines.slice(-1), lines), ['3'], 'a filtered copy numbers by its log');
  assert.deepEqual(dried(rig(t)(() => nodes(LogLines({ lines })))), ['c']);
  const missed: any[] = ['seen', 'also seen'];
  markDrawn(missed);
  dropLines(missed, 1);
  missed.push('fresh');
  assert.deepEqual(dried(rig(t)(() => nodes(LogLines({ lines: missed })))), ['fresh']);
});

// Breaks: a narrated event dries with the narration above it; reduced motion keeps the colour travel
// or the lag.
test('a narrated event dries motion.dry.lag later; reduced motion is a plain fade, no lag', (t) => {
  effects(t);
  const line = () => [{ text: 'You learn Cooking.', event: true }] as any[];
  const event = line();
  const draw = rig(t);
  const shown = draw(() => nodes(LogLines({ lines: event })));
  assert.deepEqual(g.delays, [60]);
  const ink = (n: any) => flat(n.props.style).color;
  assert.equal(ink(shown[1]), '#645c4f', 'wet on its first frame');
  assert.notEqual(ink(draw(() => nodes(LogLines({ lines: event })))[1]), '#645c4f', 'dry after');
  g.reducedMotion = true;
  g.delays = [];
  g.timings = [];
  const quiet = line();
  const drawStill = rig(t);
  const still = drawStill(() => nodes(LogLines({ lines: quiet })));
  assert.deepEqual(g.delays, []);
  assert.deepEqual(g.timings, [160]);
  assert.deepEqual(still[1].props.style[1], { opacity: 0 });
  const settled = drawStill(() => nodes(LogLines({ lines: quiet })));
  assert.deepEqual(settled[1].props.style[1], { opacity: 1 });
});

// Breaks: an away recap entering the log has no drying, or an old one re-dries; the cap drifts.
test('an away recap dries in like a line; the log keeps its last 200', (t) => {
  effects(t);
  const lines: any[] = [{ recap: ['b'], text: 'While you were away' }];
  const opacities = (shown: any[]) =>
    shown.map((n) => flat(n.props?.style ?? {}).opacity).filter((o) => o !== undefined);
  assert.ok(opacities(rig(t)(() => nodes(LogLines({ lines })))).includes(0));
  markDrawn(lines);
  assert.ok(!opacities(rig(t)(() => nodes(LogLines({ lines })))).includes(0));
  const long = Array.from({ length: 201 }, (_, i) => `line ${i}`);
  trimLog(long);
  assert.equal(long.length, 200);
  assert.equal(long[0], 'line 1');
});

const card = (shown: any[]) => shown.find((n) => n.type === 'Pressable');

// Breaks: the tile loses its tick, or the tick replaces the press's own haptic and lift.
test('a letter tile ticks and feels the press', (t) => {
  effects(t);
  const draw = rig(t);
  const shown = () =>
    card(
      draw(() => nodes(LetterTile({ letter: 'a', used: false, label: 'a', onPress: () => {} }))),
    );
  shown().props.onPressIn();
  assert.deepEqual(g.bookDevice, [
    ['play', 'tick'],
    ['haptic', 'selection'],
  ]);
  assert.deepEqual(g.timings, [90]);
});

// Breaks: a press has no feel, or travels under reduced motion, or loses its state change there.
test('a card lifts on press-in with a selection haptic; reduced motion keeps the colour, no travel', (t) => {
  for (const [reduced, rise] of [
    [false, -1],
    [true, 0],
  ] as const) {
    effects(t, reduced);
    const draw = rig(t);
    const shown = () => card(draw(() => nodes(ActionCard({ label: 'Go', onPress: () => {} }))));
    const rest = flat(shown().props.style);
    assert.equal(Math.abs(rest.transform[0].translateY), 0);
    shown().props.onPressIn();
    assert.deepEqual(g.bookDevice, [['haptic', 'selection']]);
    assert.deepEqual(g.timings, [90]);
    const held = flat(shown().props.style);
    assert.equal(held.transform[0].translateY, rise);
    assert.notEqual(held.backgroundColor, rest.backgroundColor);
    shown().props.onPressOut();
    assert.deepEqual(g.timings, [90, 160]);
    assert.deepEqual(flat(shown().props.style).backgroundColor, rest.backgroundColor);
  }
});

// Breaks: a free chip reads as unavailable, or an unavailable one as free.
test('a chip with a press is opaque; one without shows the disabled opacity', (t) => {
  effects(t);
  const draw = rig(t);
  const faded = (onPress?: () => void) =>
    flat(card(draw(() => nodes(Chip({ word: 'Off', label: 'Sound', onPress })))).props.style)
      .opacity;
  assert.equal(
    faded(() => {}),
    1,
  );
  assert.equal(faded(), opacity.disabled);
});

// Breaks: an unavailable card lifts or ticks like an available one, or a refusal has no warning.
test('an unavailable card never lifts; its press is a warning haptic and its reason dries in', (t) => {
  effects(t);
  const draw = rig(t);
  const shown = () => draw(() => nodes(ActionCard({ label: 'Take', reason: "It's too heavy." })));
  const refused = card(shown());
  assert.equal(refused.props.onPressIn, undefined);
  assert.equal(flat(refused.props.style).transform, undefined);
  refused.props.onPress();
  assert.deepEqual(g.bookDevice, [['haptic', 'warning']]);
  assert.deepEqual(g.timings, []);
  const after = shown();
  assert.deepEqual(g.timings, [240]);
  assert.deepEqual(g.delays, [], 'no lag on a refusal');
  const said = after.filter((n) => n.props?.children === "It's too heavy.");
  assert.equal(said.length, 2, 'on the card and in its live region');
  assert.equal(flat(card(after).props.style).transform, undefined);
});

// Breaks: a chosen chip loses its inverted colour to the press, or travels; its press stays silent.
test('a chip lifts when free and holds when chosen', (t) => {
  effects(t);
  const chip = (chosen: boolean) => {
    const draw = rig(t);
    return () =>
      card(draw(() => nodes(Chip({ word: 'Off', label: 'Sound', chosen, onPress: () => {} }))));
  };
  const free = chip(false);
  const color = flat(free().props.style).backgroundColor;
  free().props.onPressIn();
  assert.deepEqual(g.bookDevice, [['haptic', 'selection']]);
  assert.equal(flat(free().props.style).transform[0].translateY, -1);
  assert.notEqual(flat(free().props.style).backgroundColor, color);
  const chosen = chip(true);
  const held = flat(chosen().props.style).backgroundColor;
  chosen().props.onPressIn();
  assert.equal(flat(chosen().props.style).transform[0].translateY, 0);
  assert.equal(flat(chosen().props.style).backgroundColor, held);
});

// Breaks: a Control's label stays still, or a Tap thins or pulses when refused.
test('a Control inks on press-in; a Tap thins and pulses only when it may act', (t) => {
  effects(t);
  const draw = rig(t);
  const shown = () => draw(() => nodes(Control({ label: 'Back', onPress: () => {} })));
  const ink = () => flat(shown().find((n) => n.type === 'Text').props.style).color;
  const rest = ink();
  card(shown()).props.onPressIn();
  assert.deepEqual(g.bookDevice, [['haptic', 'selection']]);
  assert.notEqual(ink(), rest);
  g.bookDevice = [];
  const tap = (p: object) => {
    const go = rig(t);
    const each = () =>
      go(() => nodes(Tap({ label: 'x', onPress: () => {}, ...p, children: 'x' } as never)));
    const thin = () =>
      flat(each().find((n) => n.props?.style?.[1]?.opacity !== undefined).props.style).opacity;
    each()[0].props.onPressIn();
    return thin();
  };
  assert.equal(tap({ pulse: 'selection' }), 0.7);
  assert.deepEqual(g.bookDevice, [['haptic', 'selection']]);
  g.bookDevice = [];
  assert.equal(tap({ refused: 'No.', pulse: 'selection' }), 1);
  assert.deepEqual(g.bookDevice, []);
});

const view = (more: object) =>
  ({ inventory: [], journal: [], place: { id: 'p' }, ...more }) as unknown as GameView;
const publish = (t: any) => {
  const draw = rig(t);
  return (v: GameView) => draw(() => useCues(v, false, 0));
};

// Breaks: an icon pops on every redraw or tick, or on another status's arrival, or under reduced motion.
for (const [reduced, popped] of [
  [false, [220]],
  [true, []],
] as const) {
  test(`a status icon pops on its own status_in cue, not on a tick (reduced motion: ${reduced})`, (t) => {
    effects(t, reduced);
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let now = 1000;
    t.mock.method(performance, 'now', () => now);
    const poison = { label: 'poison', ends_at: 100 };
    const chill = { label: 'chill', ends_at: 100 };
    const draw = rig(t);
    const icons = () =>
      draw(() =>
        nodes(
          StatusIcons({
            conditions: [poison],
            time: 10,
            text: (s: any) => s,
            open: () => {},
          } as never),
        ),
      );
    const scale = () =>
      icons()
        .map((n) => flat(n.props?.style ?? {}).transform?.[0]?.scale)
        .find((s) => s !== undefined);
    assert.equal(scale(), 1, 'at rest on mount');
    const cue = publish(t);
    cue(view({ conditions: [] }));
    cue(view({ conditions: [chill] }));
    assert.deepEqual(g.timings, [], "another status's cue");
    now += 1000; // past the status cue's coalesce window
    cue(view({ conditions: [chill, poison] }));
    assert.deepEqual(g.timings, popped);
    assert.equal(scale(), 1, 'the pop lands at full size');
    now += 1000;
    cue(view({ conditions: [chill, { ...poison, ends_at: 90 }] }));
    icons();
    assert.deepEqual(g.timings, popped, 'a tick, a redraw');
  });
}

// Breaks: a repeated status shares a key, or an icon going remounts those after it; one icon's blur
// lets go of another's held tip.
test('status icons key by label and count; only the held icon lets go of its tip', (t) => {
  effects(t);
  const c = (label: string) => ({ label, ends_at: 100 });
  const draw = rig(t);
  const row = (conditions: unknown[]) =>
    draw(
      () =>
        StatusIcons({
          conditions,
          time: 10,
          text: (s: any) => s,
          open: () => {},
        } as never) as any,
    ).props.children;
  const keys = (conditions: unknown[]) => row(conditions)[0].map((e: any) => e.key);
  assert.deepEqual(keys([c('a'), c('b'), c('a')]), ['a-0', 'b-0', 'a-1']);
  assert.deepEqual(keys([c('b'), c('a')]), ['b-0', 'a-0']);
  const both = [c('a'), c('b')];
  const hold = (i: number) => row(both)[0][i].props.children.props.hold;
  const tip = () => Boolean(row(both).at(-1));
  hold(0)(true);
  assert.equal(tip(), true);
  hold(1)(false);
  assert.equal(tip(), true, "another icon's blur");
  hold(0)(false);
  assert.equal(tip(), false);
});

// Breaks: an exit's name shows on no direction, or labels the empty one; its press-in lags or runs long.
test('the footer says a lit direction, pressing in; nothing with no words', (t) => {
  effects(t);
  assert.equal(saidLabel('', 'left'), false);
  const shown = rig(t)(() => nodes(saidLabel('North', 'left')));
  assert.ok(shown.some((n) => n.props?.children === 'North'));
  assert.deepEqual(g.delays, []);
  assert.deepEqual(g.timings, [90]);
});

// Breaks: the head does not fade on a changed objective, fades on launch or a redraw, or keeps no old words.
test('the running head cross-fades a changed objective only', (t) => {
  effects(t);
  const objective = (journal: string) =>
    view({ journal: [{ quest: { key: 'q' }, state: 'active', journal }] });
  // A fresh rig each draw: the words key the line, so each one mounts (a page turn does too).
  const words = (v: GameView) =>
    rig(t)(() => nodes(RunningHead({ view: v, text: ((s: string) => s) as never })))
      .filter((n) => n.type === 'Text')
      .map((n) => n.props.children);
  assert.deepEqual(words(objective('find it')), ['find it']);
  assert.deepEqual(words(objective('find it')), ['find it']);
  assert.deepEqual(g.timings, []);
  assert.deepEqual(words(objective('bring it')), ['find it', 'bring it']);
  assert.deepEqual(g.timings, [240]);
  assert.deepEqual(g.delays, []);
  const layers = rig(t)(() =>
    nodes(RunningHead({ view: objective('seek it'), text: ((s: string) => s) as never })),
  )
    .map((n) => flat(n.props?.style ?? {}).opacity)
    .filter((o) => o !== undefined);
  assert.deepEqual(layers, [1, 0], 'old words full, new words clear, on the first frame');
});

// Breaks: every redraw of a fault or save error buzzes again, or neither buzzes at all; or a sound.
test('Fault and the save error give one error haptic on arrival', (t) => {
  effects(t);
  const shown = rig(t);
  const fault = (message: string) =>
    shown(() => nodes(Fault({ fault: message, startOver: () => {} })));
  fault('not saved');
  fault('not saved');
  assert.deepEqual(g.bookDevice, [['haptic', 'error']]);
  fault('still not saved');
  assert.deepEqual(g.bookDevice, [
    ['haptic', 'error'],
    ['haptic', 'error'],
  ]);
  g.bookDevice = [];
  const page = rig(t);
  const failed = { kind: 'save_corrupt', message: 'row 4', startOver: true } as const;
  const save = () =>
    page(() => nodes(SaveError({ failed, startOver: () => {}, tryAgain: () => {} })));
  save();
  save();
  assert.deepEqual(g.bookDevice, [['haptic', 'error']]);
  // Breaks: the Haptics setting is ignored here, where no Book has given it to the module.
  g.bookDevice = [];
  const quiet = rig(t);
  quiet(() => nodes(SaveError({ failed, startOver: () => {}, haptics: false })));
  assert.deepEqual(g.bookDevice, []);
});
