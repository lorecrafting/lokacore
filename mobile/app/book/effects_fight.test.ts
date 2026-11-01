// The fatal blow's hold and the foe's press and settle, on real components.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effects, flat, rig } from './__tests__/hook-rig.ts';
import { nodes, words } from './__tests__/polish-book.test.ts';
import type { GameView } from '../../packages/game-view/session.ts';

const { Blow } = await import('./Blow.tsx');
const { Foe } = await import('./Combat.tsx');
const { flashesOn, useCues } = await import('./cues.ts');
const { color, size } = await import('./tokens.ts');

const g = globalThis as any;
const say = ((s: string) => s.replace('.name', '')) as never;
const held_view = { place: { id: 'p' }, inventory: [], journal: [] } as unknown as GameView;
const hit = (hp: number) =>
  ({
    ...held_view,
    combat: {},
    resources: [
      {
        resource: { key: 'hp', short_label: 'hp' },
        current: hp,
        maximum: 20,
        tone: 'normal',
        band: 'hurt',
      },
    ],
  }) as unknown as GameView;
function clock(t: any) {
  let now = 5000;
  t.mock.method(performance, 'now', () => now);
  return (ms: number) => (now += ms);
}
const peaks = () => g.sequences.map((s: any[]) => s[1]);

const shrine = { place: { id: 'shrine' }, inventory: [], journal: [] } as unknown as GameView;
function falling(t: any, reduced = false) {
  effects(t, reduced);
  const tick = clock(t);
  const draw = rig(t);
  const at = (view: GameView, died?: string) =>
    draw(() => {
      useCues(view, false, 0, 0, false, undefined, died);
      return nodes(Blow({ children: null }));
    });
  return { at, tick, held: () => draw.shared[1]!.value };
}

// Breaks: the wash falls to nothing; the half wash is lost under reduced motion; a death with no peak pops
// the hold in over the wash's time, not fading over settle.
test('a fatal blow falls to the faint hold, whatever the settings say of its peak', (t) => {
  for (const [reduced, flashes, peak, over] of [
    [false, true, [0.18], 120],
    [true, true, [0.09], 120],
    [false, false, [], 400],
  ] as const)
    t.test(`reduced ${reduced}, flashes ${flashes}`, (s: any) => {
      const { at, tick, held } = falling(s, reduced);
      s.after(() => flashesOn(true));
      flashesOn(flashes);
      at(hit(20));
      tick(2000);
      g.timings.length = 0;
      at(shrine, 'd');
      assert.deepEqual(peaks(), peak);
      assert.equal(held(), 0.06);
      assert.equal(g.timings.at(reduced || flashes ? -1 : 0), over);
    });
});

// Breaks: a death outside a fight washes the world page.
test('a death outside a fight holds nothing', (t) => {
  const { at, held } = falling(t);
  at(held_view);
  at(shrine, 'd');
  assert.equal(held(), 0);
  assert.deepEqual(g.sequences, []);
});

const fought = (band?: string) =>
  ({
    ...held_view,
    entities: [{ id: 'wolf' }],
    combat: { encounter_id: 'e', opponent_id: 'wolf', band },
  }) as unknown as GameView;
function foe(t: any, reduced = false) {
  effects(t, reduced);
  const tick = clock(t);
  const draw = rig(t);
  const at = (view: GameView) => {
    const out = draw(() => {
      useCues(view, false, 0);
      return nodes(
        Foe({
          opponent: { id: 'wolf', name: 'wolf.name', band: 'hurt' } as never,
          target: false,
          live: true,
          text: say,
          children: null,
        }),
      );
    });
    return { lift: flat(out[0].props.style).transform[0].translateY, shown: out };
  };
  return { at, tick, draw, fell: () => draw.shared[1]!.value };
}
const phraseInk = (shown: any[]) =>
  flat(shown.find((n) => n.type?.name === 'Line' && words(n).startsWith(' — '))?.props.style)
    ?.color;

// Breaks: the press loses its colour under reduced motion, keeps its travel there, sticks, or fires
// when the band did not move.
test('a blow dealt presses the phrase once; reduced motion keeps colour, not travel', (t) => {
  for (const reduced of [false, true])
    t.test(`reduced ${reduced}`, (s: any) => {
      const f = foe(s, reduced);
      f.at(fought('fine'));
      f.at(fought('hurt'));
      assert.equal(phraseInk(f.at(fought('hurt')).shown), color.dim);
      assert.equal(g.sequences.length, 1);
      f.draw.shared[0]!.value = 1;
      assert.equal(f.at(fought('hurt')).lift, reduced ? 0 : -size.rule);
      f.tick(250);
      assert.equal(phraseInk(f.at(fought('hurt')).shown), undefined);
    });
});

// Breaks: the foe's line stays in full ink after it falls, or dims on a flight.
test('a fallen foe settles to dim; a flight does not', (t) => {
  for (const [after, fell] of [
    [{ ...held_view, entities: [] } as unknown as GameView, 1],
    [{ ...fought(), place: { id: 'away' }, combat: undefined } as unknown as GameView, 0],
  ] as const)
    t.test(String(fell), (s: any) => {
      const f = foe(s);
      f.at(fought('hurt'));
      f.at(after);
      assert.equal(f.fell(), fell);
    });
});

// Breaks: a death with no line retains no narration read, so a fatal press never falls.
test('a fatal press with no line still marks the fall', async () => {
  const { presenter } = await import('./presenter.ts');
  const view = { actions: [], entities: [], exits: [], ...held_view, time: 0 } as never;
  const projection = { view, token: 'view:r:0' };
  let pressed = false;
  const p = presenter({
    view: () => projection,
    invoke: () => {
      pressed = true;
      return {
        kind: 'saved',
        command_id: 'fatal',
        decision: {
          kind: 'accepted',
          outcome: 'attacked',
          events: [{ causation_id: 'fatal', payload: { type: 'entity_died' } }],
        },
      } as never;
    },
    pending: () => false,
    pendingInvocation: () => undefined,
    subscribe: () => () => {},
    text: () => undefined,
    lastNarration: () => (pressed ? { command_id: 'fatal', lines: [], died: true } : undefined),
  } as never);
  p.press({ label: 'Strike', action_key: 'attack', target_ids: [], input: {} } as never);
  assert.equal(p.screen().died, 'fatal');
});
