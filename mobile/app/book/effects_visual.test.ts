// The visual half of the effects plan on real components: pop, wash, flash limit, value, gilt, head.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effects, flat, rig } from './__tests__/hook-rig.ts';
import { book, nodes, words } from './__tests__/polish-book.test.ts';
import type { GameView } from '../../packages/game-view/session.ts';

const { Blow } = await import('./Blow.tsx');
const { flashesOn, onCue, useCues } = await import('./cues.ts');
const { ItemPop } = await import('./ItemPop.tsx');
const { RunningHead } = await import('./RunningHead.tsx');
const { StatusLine } = await import('./Status.tsx');
const { color } = await import('./tokens.ts');
const { CharacterPage } = await import('./sections.tsx');
const { LogLines } = await import('./lines.tsx');
const { JournalPage } = await import('./journal.tsx');
const { chapterCard } = await import('./Book.tsx');
const { cardContext } = await import('./card.ts');
const { ChapterPage } = await import('./sections.tsx');
const { skillEvents } = await import('./received.ts');
const { dark } = await import('./palette.ts');

const g = globalThis as any;
const say = ((s: string) => s.replace('.name', '')) as never;
const item = (id: string) => ({ id, name: `${id}.name` });
const held = (...ids: string[]) =>
  ({ place: { id: 'p' }, inventory: ids.map(item), journal: [] }) as unknown as GameView;
const hit = (hp: number) =>
  ({
    place: { id: 'p' },
    inventory: [],
    journal: [],
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

const popText = (shown: any[]) =>
  shown.filter((n) => n.type === 'Text').map((n) => n.props.children);

// Breaks: the pop shows on a first view (a reopen would announce the whole pack), takes its words
// from anywhere but the view's item name, or splits two items onto two lines.
test('the pop names what the view just added, on one line, and nothing on a first view', (t) => {
  effects(t);
  clock(t);
  const draw = rig(t);
  const at = (v: GameView) =>
    draw(() => {
      useCues(v, false, 0);
      return nodes(ItemPop({ view: v, text: say }));
    });
  const first = held('sack');
  assert.deepEqual(popText(at(first)), []);
  assert.deepEqual(popText(at(first)), []);
  const more = held('sack', 'rope', 'oar');
  at(more); // the cue lands in this draw's effect; the next draw shows it
  assert.deepEqual(popText(at(more)), ['+ rope, + oar']);
});

// Breaks: the pop is read aloud (it would say the pickup twice), or the Book never mounts it.
test('a real Take pops under the log and the live region does not repeat it', async () => {
  const h = book();
  h.go('north');
  h.tap('A brass lantern');
  h.tap('Take a brass lantern');
  // The pickup waits out the page turn's hold (book-ui.md, Queue), on a timer.
  const popped = (shown: any[]) => popText(shown).includes('+ a brass lantern');
  let shown = h.draw();
  for (let i = 0; i < 100 && !popped(shown); i++) {
    await new Promise((r) => setTimeout(r, 20));
    shown = h.draw();
  }
  assert.ok(popped(shown));
  // The screen reader hears the log line, so the pop's wrapper hides it.
  const hidden = shown.find(
    (n) => n.props?.['aria-hidden'] && words(n).includes('+ a brass lantern'),
  );
  assert.ok(hidden);
  assert.equal(hidden.props.importantForAccessibility, 'no-hide-descendants');
  const heard = shown.find((n) => n.type?.name === 'Heard');
  const said = words(heard.type(heard.props));
  assert.match(said, /You take a brass lantern/);
  assert.doesNotMatch(said, /\+/);
});

// Mounts a Blow with the cue hook above it, as the Book does.
function blown(t: any) {
  effects(t);
  const tick = clock(t);
  const draw = rig(t);
  const at = (hp: number) =>
    draw(() => {
      useCues(hit(hp), false, 0);
      return nodes(Blow({ children: null }));
    });
  return { at, tick, draw };
}
const peaks = () => g.sequences.map((s: any[]) => s[1]);
const scale = (shown: any[]) => flat(shown[2].props.style).transform[0].scale;

// Breaks: Flashes off still washes or swells (photosensitive players), or the setting sticks on.
test('Flashes off gives no wash and no swell', (t) => {
  const { at, tick } = blown(t);
  t.after(() => flashesOn(true));
  flashesOn(false);
  at(20);
  at(15);
  assert.deepEqual(g.sequences, []);
  flashesOn(true);
  tick(1000); // past the first blow's beat
  at(10);
  assert.deepEqual(peaks(), [0.18]);
});

// Breaks: Blow washes on any hp_loss instead of the cue's `wash`, so blows 600 ms apart flash at
// 1.7 Hz; the literal 1000 ms is the WCAG-derived limit in book-ui.md, Flash limit.
test('never more than one full-page peak per second, whatever the blow rate', (t) => {
  const { at, tick } = blown(t);
  const peakedAt: number[] = [];
  let elapsed = 0;
  g.sequences = { push: () => peakedAt.push(elapsed) };
  let hp = 100;
  at(hp);
  for (let i = 0; i < 7; i++) {
    tick(600);
    elapsed += 600;
    at((hp -= 5));
  }
  assert.deepEqual(peakedAt, [600, 1800, 3000, 4200]);
});

// Breaks: the swell is not the owner's 1.5%, or it does not return to rest.
test('a blow washes in full and swells 1.5% at the peak', (t) => {
  const { at, draw } = blown(t);
  at(20);
  at(15);
  assert.deepEqual(peaks(), [0.18]);
  assert.equal(g.sequences[0][2], 0, 'the wash leaves: the paper does not stay tinted');
  draw.shared[0]!.value = 0.18;
  assert.equal(scale(at(15)), 1.015);
  draw.shared[0]!.value = 0;
  assert.equal(scale(at(15)), 1);
});

// Breaks: reduced motion keeps the swell or the full wash.
test('reduced motion: half the wash, no swell', (t) => {
  const { at, draw } = blown(t);
  g.reducedMotion = true;
  at(20);
  at(15);
  assert.deepEqual(peaks(), [0.09]);
  draw.shared[0]!.value = 0.09;
  assert.equal(scale(at(15)), 1);
});

// Breaks: the value does not dry in the wash's colour and back, or Flashes off loses it with the
// wash (book-ui.md, Blow wash: the hp value alone).
test('the hp value dries in the wash colour and back, with Flashes off too', (t) => {
  effects(t);
  const tick = clock(t);
  const frames: (() => void)[] = [];
  t.mock.method(globalThis, 'requestAnimationFrame', (f: () => void) => frames.push(f));
  t.after(() => flashesOn(true));
  flashesOn(false);
  const draw = rig(t);
  const hp = (now: number) => {
    const shown = draw(() => {
      const v = hit(now);
      useCues(v, false, 0);
      return nodes(
        StatusLine({
          resources: v.resources,
          time: 0,
          text: say,
          locked: true, // a fight locks the line, and a blow only lands in a fight
          pending: false,
          open: () => {},
          openCharacter: () => {},
        } as never),
      );
    });
    const pool = shown.find(
      (n) => n.type === 'Text' && n.props.children?.[1]?.props?.children === 'hp',
    );
    return flat(pool.props.style).color;
  };
  const rest = hp(20);
  hp(15);
  tick(120); // the wash's peak
  frames.splice(0).forEach((f) => f()); // an earlier test's mounted Book listens too
  assert.notEqual(rest, color.light.action);
  assert.equal(hp(15), color.light.action);
  tick(380);
  frames.splice(0).forEach((f) => f()); // an earlier test's mounted Book listens too
  assert.equal(hp(15), rest);
});

const quest = (state: string, journal: string | null = 'q.seek') =>
  ({
    place: { id: 'p' },
    inventory: [],
    journal: [{ quest: { key: 'q' }, state, journal, title: 'q.title' }],
  }) as unknown as GameView;

// Breaks: a finished objective vanishes at once, turns gilt on failure, or an abandoned head settles.
test("a resolved or failed objective leaves over motion.settle, in the head's own ink", (t) => {
  effects(t);
  const head = (v: GameView) =>
    rig(t)(() => nodes(RunningHead({ view: v, text: say }))).filter((n) => n.type === 'Text');
  for (const state of ['resolved', 'failed']) {
    const [before] = head(quest('active'));
    g.timings = [];
    const [leaving] = head(quest(state));
    assert.equal(leaving.props.children, 'q.seek');
    assert.equal(flat(leaving.props.style).color, flat(before.props.style).color);
    assert.equal(flat(leaving.props.style).color, color.light.dim);
    assert.ok(g.timings.includes(400));
  }
  head(quest('active'));
  assert.deepEqual(head({ ...quest('active'), journal: [] }), []);
});

const ink = (shown: any[], words: string) =>
  flat(shown.find((n) => n.type === 'Text' && n.props.children === words)!.props.style).color;

// Breaks: a skill line never gilds, or the gilt never settles to the line's own colour.
test('a fresh gilt line starts in warning ink and settles to its colour', (t) => {
  effects(t);
  const draw = rig(t);
  const line = { text: 'You learn knots.', event: true, gilt: true } as const;
  const log = () => draw(() => nodes(LogLines({ lines: [line] })));
  assert.equal(ink(log(), line.text), color.light.warning);
  const settled = ink(log(), line.text);
  assert.notEqual(settled, color.light.warning);
});

// Breaks: the reply's skill lines lose their gilt, so the test above guards a line nobody writes.
test('a learned or raised skill narrates gilt', () => {
  const skill = (acquired: boolean, level = 0) =>
    ({
      skills: [{ skill: { key: 'k', kind: 'skill' }, label: 'knots', acquired, level }],
    }) as never;
  const text = (k: unknown) => k as string;
  assert.deepEqual(skillEvents(skill(false), skill(true), text), [
    { text: 'You learn knots.', event: true, gilt: true },
  ]);
  assert.deepEqual(skillEvents(skill(true, 1), skill(true, 2), text), [
    { text: 'Your knots improves.', event: true, gilt: true },
  ]);
});

// Breaks: unspent points read as plain prose, or spent ones stay gilt.
test('the Character level line is warning ink only while points wait', (t) => {
  effects(t);
  const line = (unspent: number) =>
    rig(t)(() =>
      nodes(
        CharacterPage({
          view: { levelling: { level: 2, unspent, xp: 0, next: 10 }, resources: [] },
          text: say,
          world: () => {},
        } as never),
      ).filter((n) => n.type === 'Text' && /level/i.test(String(n.props.children))),
    )[0];
  assert.equal(flat(line(1).props.style).color, color.light.warning);
  assert.notEqual(flat(line(0).props.style).color, color.light.warning);
});

// Breaks: a quest resolved with a chapter rise is never gilt: S4 fires alone and drops it from the queue;
// or one resolved over a resume, which sends no cue.
test('the Journal gilds a quest the queue never played', (t) => {
  effects(t);
  clock(t);
  const open = (v: GameView) =>
    ink(
      rig(t)(() =>
        nodes(JournalPage({ view: v, text: say, world: () => {}, chronicle: () => [] } as never)),
      ),
      'q.title',
    );
  const seen: string[] = [];
  const off = onCue((cue) => void seen.push(cue.name));
  t.after(off);
  const done = { ...quest('resolved', null), chapter: { index: 2 } } as GameView;
  let draw = rig(t);
  draw(() => useCues({ ...quest('active'), chapter: { index: 1 } } as GameView, false, 0));
  draw(() => useCues(done, false, 0));
  assert.deepEqual(seen, ['chapter']);
  assert.equal(open(done), color.light.warning);
  draw = rig(t);
  draw(() => useCues(quest('active'), false, 0, 0));
  draw(() => useCues(quest('resolved', null), false, 0, 1));
  assert.equal(open(quest('resolved', null)), color.light.warning);
});

// Breaks: a failed quest gilds in the Journal, or a resolved one's gilt repeats on a second visit.
test('the Journal gilds a quest resolved since its last visit, once, and never a failed one', (t) => {
  effects(t);
  clock(t);
  const open = (v: GameView) =>
    ink(
      rig(t)(() =>
        nodes(JournalPage({ view: v, text: say, world: () => {}, chronicle: () => [] } as never)),
      ),
      'q.title',
    );
  const finish = (state: string) => {
    const draw = rig(t);
    draw(() => useCues(quest('active'), false, 0));
    draw(() => useCues(quest(state, null), false, 0));
  };
  finish('failed');
  assert.notEqual(open(quest('failed', null)), color.light.warning);
  finish('resolved');
  assert.equal(open(quest('resolved', null)), color.light.warning);
  assert.notEqual(open(quest('resolved', null)), color.light.warning);
});

// Breaks: the hp sting spreads to another pool, a pickup starts it, reduced motion lets it pulse or
// overstay, its frames outlive the beat, or an unmounted line keeps drawing.
test('reduced motion holds the sting on hp alone for the beat, and leaving the page stops it', (t) => {
  effects(t, true);
  const tick = clock(t);
  const frames: (() => void)[] = [];
  const cancelled: number[] = [];
  t.mock.method(globalThis, 'requestAnimationFrame', (f: () => void) => frames.push(f));
  t.mock.method(globalThis, 'cancelAnimationFrame', (id: number) => cancelled.push(id));
  const stops: (() => void)[] = [];
  const draw = rig({ after: (f) => stops.push(f) });
  const view = (hp: number, ...ids: string[]) => ({
    ...hit(hp),
    inventory: ids.map(item),
    resources: [
      ...hit(hp).resources!,
      {
        resource: { key: 'ma', short_label: 'ma' },
        current: 5,
        maximum: 5,
        tone: 'normal',
        band: 'hurt',
      },
    ],
  });
  const inks = (v: any) => {
    const shown = draw(() => {
      useCues(v, false, 0);
      return nodes(
        StatusLine({
          resources: v.resources,
          time: 0,
          text: say,
          locked: true,
          pending: false,
          open: () => {},
          openCharacter: () => {},
        } as never),
      );
    });
    return ['hp', 'ma'].map(
      (key) =>
        flat(
          shown.find((n) => n.type === 'Text' && n.props.children?.[1]?.props?.children === key)
            .props.style,
        ).color,
    );
  };
  const run = () => frames.splice(0).forEach((f) => f());
  const rest = inks(view(20));
  inks(view(20, 'sack'));
  assert.deepEqual(frames, []);
  inks(view(15, 'sack'));
  tick(1);
  run();
  assert.deepEqual(inks(view(15, 'sack')), [color.light.action, rest[1]]);
  tick(498);
  run();
  assert.equal(inks(view(15, 'sack'))[0], color.light.action);
  tick(1);
  run();
  assert.deepEqual(inks(view(15, 'sack')), rest);
  assert.deepEqual(frames, []);
  inks(view(10, 'sack'));
  const pending = frames.length;
  cancelled.length = 0;
  stops.forEach((stop) => stop());
  assert.deepEqual(cancelled, [pending]);
});

// Breaks: the card's blur runs over a fight, an ending, a scene or ancestry page drawn over the
// card (their turns lose the curl), another page, or a chapter page with no chapter to name.
test('only a chapter page with a chapter is a card', () => {
  const screen = (view: object, ended = false) => ({ view, ended }) as never;
  const chapter = { kind: 'chapter' } as never;
  const on = { chapter: {} };
  assert.equal(chapterCard(screen(on), chapter), true);
  assert.equal(chapterCard(screen({ ...on, combat: {} }), chapter), false);
  assert.equal(chapterCard(screen(on, true), chapter), false);
  assert.equal(chapterCard(screen({ ...on, scene: {} }), chapter), false);
  assert.equal(chapterCard(screen({ ...on, ancestry_choices: [] }), chapter), false);
  assert.equal(chapterCard(screen(on), { kind: 'dialogue' } as never), false);
  assert.equal(chapterCard(screen(on)), false);
  assert.equal(chapterCard(screen({}), chapter), false);
});

// Breaks: the card's marks arrive out of order (book-ui.md, Page turn), or its page stops filling.
test('a chapter page dries label, title, rule in that order on no paper of its own', (t) => {
  effects(t);
  const outer = cardContext._currentValue;
  t.after(() => void (cardContext._currentValue = outer));
  cardContext._currentValue = 'picture';
  const shown = rig(t)(() => nodes(ChapterPage({ label: 'one', title: 't', done: () => {} })));
  assert.deepEqual(g.delays, [0, 120, 240]);
  const fills = (drawn: any[]) =>
    drawn.filter((n) => n.type !== 'Pressable' && flat(n.props?.style ?? {}).flex === 1);
  const paper = (drawn: any[]) => flat(fills(drawn)[0].props.style).backgroundColor;
  assert.equal(paper(shown), undefined);
  // Breaks: the leaving card has no paper, so its ink lies over the next page on the turn.
  cardContext._currentValue = undefined;
  const leaving = rig(t)(() => nodes(ChapterPage({ label: 'one', title: 't', done: () => {} })));
  assert.equal(paper(leaving), color.light.bg);
});

// Breaks: a screen reader user loses the explicit Continue, or a tap beside it turns the page.
test('with a screen reader on the card keeps Continue and no tap anywhere', async (t) => {
  effects(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => (g.cardDevice = undefined));
  const draw = rig(t);
  const card = () => draw(() => nodes(ChapterPage({ label: 'one', title: 't', done: () => {} })));
  const taps = (shown: any[]) => shown.filter((n) => n.props?.onPress);
  const worded = (shown: any[]) => shown.filter((n) => n.type === 'Text').map(words);
  g.cardDevice = {};
  card();
  await new Promise(setImmediate);
  const sighted = card();
  assert.equal(taps(sighted).length, 1);
  assert.ok(!worded(sighted).includes('Continue'));
  const draw2 = rig(t);
  g.cardDevice = { reader: true };
  const read = () => draw2(() => nodes(ChapterPage({ label: 'one', title: 't', done: () => {} })));
  read();
  await new Promise(setImmediate);
  const shown = read();
  assert.ok(worded(shown).includes('Continue'));
  assert.equal(taps(shown).length, 1); // Continue's own
  assert.equal(taps(shown)[0].props.accessible, undefined);
});

// Breaks: a buy's coin cue reaches the pop and wipes the item it just raised.
test('a buy keeps its pop through its own coin cue', (t) => {
  effects(t);
  clock(t);
  const draw = rig(t);
  const at = (v: GameView) =>
    draw(() => {
      useCues(v, false, 0);
      return nodes(ItemPop({ view: v, text: say }));
    });
  const purse = (n: number) => [
    { resource: { key: 'pennies', id: 'pennies' }, current: n, maximum: 99 },
  ];
  at({ ...held('sack'), resources: purse(9) } as never);
  const bought = { ...held('sack', 'rope'), resources: purse(5) } as never;
  at(bought);
  assert.deepEqual(popText(at(bought)), ['+ rope']);
});

// Breaks: paper and ink of one luminance read as dark, so the wash picks the dark book's colour.
test('equal luminance is not a dark palette', () => {
  assert.equal(dark({ fg: '#808080', bg: '#808080' } as never), false);
});
