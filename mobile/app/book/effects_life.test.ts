// First times, map ink and page life on real components: cues, timings, delays and timers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effects, flat, rig } from './__tests__/hook-rig.ts';
import { nodes } from './__tests__/polish-book.test.ts';
import type { GameView } from '../../packages/game-view/session.ts';

const { playCue, playRiffle } = await import('./cueSounds.ts');
const { cuesOf, riffles } = await import('./cueDiff.ts');
const { curlFor, QUIET, step, useCues } = await import('./cues.ts');
const { DiscoveredMap } = await import('./DiscoveredMap.tsx');
const { useCueSounds } = await import('./Book.tsx');
const { ItemPop } = await import('./ItemPop.tsx');
const { group } = await import('./model.ts');
const { NpcPage } = await import('./Npc.tsx');
const { Here } = await import('./people.tsx');
const { Riddle, RightWord } = await import('./Riddle.tsx');
const { RunningHead } = await import('./RunningHead.tsx');
const { UnderInk } = await import('./UnderInk.tsx');
const { color, motion } = await import('./tokens.ts');

const g = globalThis as any;
const say = ((s: string) => s) as never;
const view = (over: object) =>
  ({
    place: { id: 'p' },
    inventory: [],
    equipment: [],
    journal: [],
    entities: [],
    resources: [],
    ...over,
  }) as unknown as GameView;
const named = (cues: { name: string; first?: true }[], name: string) =>
  cues.find((c) => c.name === name);
const rope = { id: 'rope', name: 'rope' };
const quest = { quest: { key: 'q' }, state: 'active', journal: 'the head' };

// Breaks: a first read off the wrong field, or every pickup, quest or level counted as the first.
test('the view alone says first: empty hands, an empty journal, level 1', () => {
  const pickup = (was: object) =>
    named(cuesOf(view({ inventory: [rope] }), view(was)), 'pickup')?.first;
  assert.equal(pickup({}), true);
  assert.equal(pickup({ equipment: [{ item: { id: 'hat' } }] }), undefined, 'worn is held');
  const q = (was: object) => named(cuesOf(view({ journal: [quest] }), view(was)), 'quest_on');
  assert.equal(q({})?.first, true);
  const older = { journal: [{ quest: { key: 'old' }, state: 'active' }] };
  const more = named(cuesOf(view({ journal: [...older.journal, quest] }), view(older)), 'quest_on');
  assert.ok(more, 'a second quest still cues');
  assert.equal(more.first, undefined);
  const level = (from: number) =>
    named(
      cuesOf(view({ levelling: { level: from + 1 } }), view({ levelling: { level: from } })),
      'level',
    )?.first;
  assert.equal(level(1), true);
  assert.equal(level(2), undefined);
});

// Breaks: the step up is lost, skips a rung, or runs off the top of either ladder.
test('a first plays one tier louder and one haptic step stronger', (t) => {
  effects(t);
  playCue({ name: 'pickup' });
  playCue({ name: 'pickup', first: true });
  const [plain, first] = g.bookDevice.filter((d: any[]) => d[0] === 'play');
  assert.deepEqual(plain.slice(1), ['pickup']);
  assert.deepEqual(first.slice(1), ['pickup', 'beat']);
  const felt = g.bookDevice.filter((d: any[]) => d[0] === 'haptic').map((d: any[]) => d[1]);
  assert.deepEqual(felt, ['light', 'medium']);
});

// Breaks: the pop's first gilt is dropped, or sticks on the pickups after it.
test('the first pickup rises to warning; a later one to action', (t) => {
  effects(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let now = 5000;
  t.mock.method(performance, 'now', () => now);
  const draw = rig(t);
  const at = (v: GameView) =>
    draw(() => {
      useCues(v, false, 0);
      return nodes(ItemPop({ view: v, text: say }));
    });
  // The cue lands in an effect, so the second draw is the one that shows it.
  const ink = (v: GameView) => (
    at(v),
    flat(at(v).find((n) => n.type === 'Text')!.props.style).color
  );
  at(view({}));
  assert.equal(ink(view({ inventory: [rope] })), color.light.warning);
  t.mock.timers.tick(10_000);
  now += 10_000;
  assert.equal(ink(view({ inventory: [{ id: 'nail', name: 'nail' }, rope] })), color.light.action);
});

// Breaks: the head never takes warning, never lets it go, or a later quest takes it too.
test('the first quest holds the head in warning for motion.first.hold', (t) => {
  effects(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(performance, 'now', () => 5000);
  const draw = rig(t);
  const was = view({});
  const now = view({ journal: [quest] });
  const head = (v: GameView) =>
    draw(() => {
      useCues(v, false, 0);
      return nodes(RunningHead({ view: v, text: say }));
    });
  const ink = (v: GameView) =>
    flat(head(v).filter((n) => n.type === 'Text' || n.type === 'InkText')[0].props.style).color;
  head(was);
  head(now);
  assert.equal(ink(now), color.light.warning);
  t.mock.timers.tick(motion.first.hold - 1);
  assert.equal(ink(now), color.light.warning);
  t.mock.timers.tick(1);
  assert.equal(ink(now), color.light.dim);
});

// Breaks: a riffle on a walk, a stay, a fight or a scene (book-ui.md: combat and scenes take none).
test('only a travel that moves, on a plain page, riffles', () => {
  const was = view({});
  const there = view({ place: { id: 'q' } });
  assert.equal(riffles('expedition', was, there), true);
  assert.equal(riffles('move', was, there), false);
  assert.equal(riffles('expedition', was, was), false);
  assert.equal(riffles('expedition', was, view({ place: { id: 'q' }, combat: { on: 1 } })), false);
  assert.equal(riffles('expedition', was, view({ place: { id: 'q' }, scene: { id: 's' } })), false);
});

// Breaks: the riffle's haptic lands before the curl it follows, or not at all.
test('a riffle sounds once at once and its light haptic lands after the curl', (t) => {
  effects(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let now = 1e9;
  t.mock.method(performance, 'now', () => now);
  const felt = () => g.bookDevice.filter((d: any[]) => d[0] === 'haptic').map((d: any[]) => d[1]);
  playRiffle();
  assert.deepEqual(
    g.bookDevice.filter((d: any[]) => d[0] === 'play').map((d: any[]) => d[1]),
    ['riffle'],
  );
  assert.deepEqual(felt(), ['light'], 'no curl running: at once');
  // A curl running: the haptic waits for the whole riffle, which holds the curl gate that long.
  curlFor(100);
  playRiffle();
  const length = motion.quick.duration + motion.riffle.sweeps * motion.riffle.duration;
  t.mock.timers.tick(length - 1);
  assert.deepEqual(felt(), ['light']);
  // The clock a hair behind the timer, as real timers run: the curl gate would drop it.
  now += length - 1;
  t.mock.timers.tick(1);
  assert.deepEqual(felt(), ['light', 'light']);
});

const room = (id: string, x: number) => ({ id, title: id, x, y: 0, z: 0 });
const mapOf = (rooms: ReturnType<typeof room>[], links: object[] = []) =>
  view({ place: { id: 'a' }, map: { rooms, links, unexplored: [] } });
const link = { from: 'a', to: 'b', direction: 'east' };

// Breaks: a reload replays the whole map, a reopening redraws it, new ink is not drawn, it animates
// under reduced motion, or an old room is redrawn with the new one.
test('the map draws on only what is new since it last showed', (t) => {
  const open = (v: GameView, reduced = false) => {
    effects(t, reduced);
    const shell = rig(t);
    shell(() => nodes(DiscoveredMap({ view: v, text: say })));
    return { timings: g.timings as number[], shared: shell.shared.map((s) => s.value) };
  };
  const one = mapOf([room('a', 0)]);
  assert.deepEqual(open(one).timings, [], 'the first opening draws nothing');
  assert.deepEqual(open(one).timings, [], 'nor does reopening');
  const two = mapOf([room('a', 0), room('b', 1)], [link]);
  const drawn = open(two);
  const settle = motion.settle.duration;
  assert.deepEqual(drawn.timings, [settle, settle], 'the new dot and its line, together');
  assert.deepEqual(open(two).timings, [], 'shown now');
  const three = mapOf([room('a', 0), room('b', 1), room('c', 2)], [link]);
  assert.deepEqual(open(three, true).timings, [], 'reduced motion: it appears');
});

// Breaks: a level step redraws ink: each level mounts its marks anew, so the draw would replay.
test('a level step ends the ink: what it mounts appears', (t) => {
  effects(t);
  const at = (id: string, z: number) => ({ ...room(id, z), z });
  const first = rig(t);
  first(() => nodes(DiscoveredMap({ view: mapOf([at('s0', 0)]), text: say })));
  first.unmount();
  effects(t);
  const shell = rig(t);
  const v = mapOf([at('s0', 0), at('s1', 0), at('s2', 1)]);
  const page = () => shell(() => nodes(DiscoveredMap({ view: v, text: say })));
  page()
    .find((n) => n.props?.accessibilityLabel === 'Next map level')
    .props.onPress();
  assert.deepEqual(g.timings, [motion.settle.duration], 'the new room on this level draws');
  page();
  assert.deepEqual(g.timings, [motion.settle.duration], 'the one a level up does not');
});

const button = (id: string) => ({
  action_key: 'choose',
  command: 'choose',
  target_ids: [],
  input: { choice_id: id },
  label: id,
  token: id,
});
function talk(t: any, continuation: string, n: number, reduced = false, waiting = () => false) {
  effects(t, reduced);
  const ids = Array.from({ length: n }, (_, i) => `c${i}`);
  const v = view({
    choice: {
      continuation_id: continuation,
      speaker_id: 'npc',
      choices: ids.map((id) => ({ choice_id: id, label: id, available: true })),
    },
  });
  const buttons = ids.map(button) as never;
  const shell = rig(t);
  const pressed: any[] = [];
  const page = () =>
    shell(() =>
      nodes(
        NpcPage({
          view: v,
          text: say,
          g: group(buttons),
          press: (b) => pressed.push(b),
          pending: waiting(),
          log: [],
          leave: () => {},
          open: () => {},
        }),
      ),
    );
  return { page, pressed };
}

// Breaks: answers lift together or past the cap, lift under reduced motion, or lift again on a redraw.
test('a new choice lifts its answers apart, capped, and never again', (t) => {
  const { page } = talk(t, 'k1', 10);
  page();
  const gap = motion.stagger.gap;
  assert.deepEqual(
    g.delays,
    [1, 2, 3, 4, 5, 6, 7, 7, 7].map((i) => i * gap),
    'the first at once; after the eighth the rest arrive with it',
  );
  g.delays.length = g.timings.length = 0;
  page();
  assert.deepEqual([g.delays, g.timings], [[], []], 'a redraw lifts nothing');
  const back = talk(t, 'k1', 10);
  back.page();
  assert.deepEqual([g.delays, g.timings], [[], []], 'coming back to it lifts nothing');
  const still = talk(t, 'k2', 3, true);
  still.page();
  assert.deepEqual([g.delays, g.timings], [[], []], 'reduced motion: together');
});

// Breaks: the others stay pressable or lit once an answer is chosen, the chosen one fades too, or
// a refusal (no reply pending, the same view) leaves them gone.
test('choosing an answer fades the others while its reply is pending', (t) => {
  let waiting = true;
  const { page, pressed } = talk(t, 'k3', 3, false, () => waiting);
  const off0 = page().filter((n) => n.props?.pointerEvents === 'none');
  assert.equal(off0.length, 0, 'none chosen yet: another press pending fades nothing');
  g.timings.length = 0;
  page()
    .find((n) => n.type === 'Pressable' && n.props.accessibilityLabel === 'c1')
    .props.onPress();
  assert.equal(pressed.length, 1);
  const shown = page();
  assert.deepEqual(g.timings, [motion.fade.duration, motion.fade.duration], 'two others');
  const off = shown.filter((n) => n.props?.pointerEvents === 'none');
  assert.equal(off.length, 2);
  waiting = false;
  assert.equal(page().filter((n) => n.props?.pointerEvents === 'none').length, 0, 'they return');
});

const npc = (id: string) => ({ id, kind: 'npc', name: id });
const room2 = (ids: string[], place = 'p') =>
  view({ place: { id: place }, entities: ids.map(npc) });
function people(t: any) {
  effects(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const shell = rig(t);
  return (v: GameView) => shell(() => nodes(Here({ view: v, text: say, open: () => {} })));
}
const links = (shown: any[]) =>
  shown.filter((n) => n.props?.accessibilityLabel).map((n) => n.props.accessibilityLabel);

// Breaks: an arrival is not dried, or a change of room reads as everyone arriving.
test('someone arriving dries in; entering another room says nothing', (t) => {
  const draw = people(t);
  draw(room2(['ann']));
  assert.deepEqual(g.timings, []);
  draw(room2(['ann', 'bo']));
  assert.deepEqual(g.timings, [motion.dry.duration]);
  g.timings.length = 0;
  draw(room2(['cy', 'di'], 'elsewhere'));
  assert.deepEqual(g.timings, []);
});

// Breaks: the leaver vanishes at once, keeps a live link while fading, or the paragraph never closes.
test('someone leaving fades without a link, then the paragraph closes up', (t) => {
  const draw = people(t);
  const both = room2(['ann', 'bo']);
  const left = room2(['ann']);
  draw(both);
  const fading = draw(left);
  assert.deepEqual(g.timings, [motion.fade.duration]);
  assert.deepEqual(links(fading), ['Ann, open'], 'no touch while fading');
  const text = (shown: any[]) => JSON.stringify(shown.map((n) => n.props?.children));
  assert.match(text(fading), /bo/, 'still in the sentence');
  t.mock.timers.tick(motion.fade.duration);
  assert.doesNotMatch(text(draw(left)), /bo/);
});

function riddleRig(t: any, id: string) {
  effects(t);
  const button0 = { ...button(id), action_key: 'answer', input: { choice_id: id } } as never;
  const shell = rig(t);
  const riddle = (lastTry = false) =>
    shell(() => nodes(Riddle({ bank: ['a', 'b'], button: button0, press: () => {}, lastTry })));
  const submit = (lastTry = false) => {
    riddle(lastTry)
      .find((n) => n.props?.accessibilityLabel === 'a, tile 1')
      .props.onPress();
    riddle(lastTry)
      .find((n) => n.type === 'Pressable' && /Submit/.test(n.props.accessibilityLabel ?? ''))
      .props.onPress();
    return riddle(lastTry);
  };
  const word = rig(t);
  const after = (v: GameView, choice?: GameView['choice']) =>
    word(() => nodes(RightWord({ view: v, choice })));
  const plays = () => g.bookDevice.filter((d: any[]) => d[0] === 'play' && d[1] === 'riddleRight');
  return { submit, after, plays, word };
}

// Breaks: a right word is not gilt, plays no sound, stays past its view or replays on a redraw.
test('a right riddle word shows gilt once, with its sound, and leaves at the next view', (t) => {
  const { submit, after, plays } = riddleRig(t, 'r1');
  submit();
  const v = view({});
  const shown = after(v);
  assert.equal(shown.filter((n) => n.props?.children === 'a').length, 1);
  assert.equal(plays().length, 1);
  assert.equal(after(v).length > 0, true, 'a redraw of the same view keeps it');
  assert.equal(plays().length, 1);
  assert.deepEqual(after(view({})), []);
});

// Breaks: an answer that also left the NPC page gilds a word on the next person's page.
test('a right word sent as the page closes never shows on a later page', (t) => {
  const { submit, after, plays, word } = riddleRig(t, 'r4');
  after(view({}));
  submit();
  word.unmount();
  const later = rig(t);
  assert.deepEqual(
    later(() => nodes(RightWord({ view: view({}) }))),
    [],
  );
  assert.equal(plays().length, 0);
});

// Breaks: a wrong answer turns gilt (book-ui.md Gilt rule) or the tiles snap back at once.
test('a wrong riddle shows no word; its tiles return over motion.settle', (t) => {
  const { submit, after, plays } = riddleRig(t, 'r2');
  submit();
  assert.ok(g.timings.includes(motion.settle.duration), 'the used tile goes back slowly');
  const v = view({});
  assert.deepEqual(after(v, { riddle: { choice_id: 'r2' } } as never), []);
  assert.equal(plays().length, 0);
});

// Breaks: a wrong last try, which also closes the choice, read as right.
test('a word on the last try is never gilt', (t) => {
  const { submit, after, plays } = riddleRig(t, 'r3');
  submit(true);
  assert.deepEqual(after(view({})), []);
  assert.equal(plays().length, 0);
});

// loka-xz76e.9. Breaks: the Book's hook keeps hearCues but drops its cleanup (Book.tsx), so a fight's
// loop outlives the Book and plays over the new game after Start over.
test('the Book unmounting cuts the music', (t) => {
  effects(t);
  const draw = rig(t);
  const props = {
    screen: { view: view({}), catchingUp: false },
    flip: { turn: 0, dir: 1 },
  } as never;
  draw(() => (useCueSounds(props), []));
  g.bookDevice = [];
  draw.unmount();
  assert.deepEqual(g.bookDevice, [['fight', 'cut']]);
});

// Breaks: a layer unmounts as it ends, so low health cuts out instead of fading (book-ui.md).
test('the vignette stays drawn while it fades out', (t) => {
  effects(t);
  g.CanvasKit = {};
  t.after(() => delete g.CanvasKit);
  const shell = rig(t);
  const layers = (v: GameView) =>
    shell(() => nodes(UnderInk({ view: v }))).filter((n) => n.props?.['aria-hidden']).length;
  assert.equal(layers(view({})), 0, 'nothing before it is needed');
  const low = view({ resources: [{ resource: { key: 'hp' }, tone: 'danger' }] });
  assert.equal(layers(low), 1);
  assert.equal(layers(view({})), 1);
});

// Breaks: a first arriving after another of its key, in one hold, loses its stronger moment.
test('cues gathered from one hold keep a later first', () => {
  const { fired } = step(
    QUIET,
    [
      { name: 'pickup', ids: ['a'] },
      { name: 'pickup', ids: ['b'], first: true },
    ],
    10_000,
  );
  assert.equal(named(fired, 'pickup')?.first, true);
});
