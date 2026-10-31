// Named breaks for the cue bus, over minimal views; every expected value is written by hand.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GameView } from '../../packages/game-view/session.ts';
import { cuesOf, QUIET, soundOf, step, type Cue, type CueName } from './cues.ts';

const base = {
  actor_id: 'a',
  place: { id: 'p1', title: 't', description: 'd' },
  exits: [],
  actions: [],
  entities: [],
  inventory: [],
  journal: [],
  time: 0,
} as unknown as GameView;
const view = (more: object) => ({ ...base, ...more }) as GameView;
const res = (key: string, current: number) => ({ resource: { key }, current, maximum: 20 });
const pool = (hp: number, pennies = 0, more = {}) =>
  view({ resources: [res('hp', hp), res('pennies', pennies)], ...more });
const item = (id: string) => ({ id });
const quest = (key: string, state: string) => ({ quest: { key }, state, title: 't' });
const skill = (key: string, acquired: boolean, level?: number) => ({
  skill: { key },
  acquired,
  level,
});
const fight = { combat: { encounter_id: 'e' } };

// Each row breaks if that cue's trigger, or its sound, changes. [cue, was, now, sound].
const rows: [CueName, GameView, GameView, string | undefined][] = [
  ['pickup', base, view({ inventory: [item('sack')] }), 'pickup'],
  ['coin', pool(9, 5), pool(9, 8), 'coin'],
  ['hp_loss', pool(9, 0, fight), pool(7, 0, fight), 'blow'],
  ['status_in', base, view({ conditions: [{ label: 'dazed', ends_at: 9 }] }), undefined],
  ['status_in', base, view({ bleeding: { label: 'cut' } }), undefined],
  ['status_out', view({ conditions: [{ label: 'dazed' }] }), base, undefined],
  ['quest_on', base, view({ journal: [quest('q', 'active')] }), 'questGained'],
  [
    'quest_resolved',
    view({ journal: [quest('q', 'active')] }),
    view({ journal: [quest('q', 'resolved')] }),
    'questDone',
  ],
  [
    'quest_fail',
    view({ journal: [quest('q', 'active')] }),
    view({ journal: [quest('q', 'failed')] }),
    'questFailed',
  ],
  ['level', view({ levelling: { level: 1 } }), view({ levelling: { level: 2 } }), 'level'],
  [
    'skill_learned',
    view({ skills: [skill('s', false)] }),
    view({ skills: [skill('s', true, 1)] }),
    'skillNew',
  ],
  [
    'skill_up',
    view({ skills: [skill('s', true, 1)] }),
    view({ skills: [skill('s', true, 2)] }),
    'skillUp',
  ],
  [
    'chapter',
    view({ chapter: { index: 0, title: 'c' } }),
    view({ chapter: { index: 1, title: 'c' } }),
    'chapter',
  ],
  ['place', base, view({ place: { id: 'p2', title: 't', description: 'd' } }), undefined],
  ['combat_open', base, view(fight), undefined],
  ['combat_close', view(fight), base, undefined],
];
for (const [i, [name, was, now, sound]] of rows.entries())
  test(`row ${i} ${name}: this change is this one cue, and its sound`, () => {
    const out = cuesOf(now, was);
    assert.deepEqual(
      out.map((c) => c.name),
      [name],
    );
    assert.equal(soundOf(out[0]!), sound);
  });

// Breaks: a burst of sounds on open, or a catch-up that is heard.
test('a first view, or any view diffed against nothing, is silent', () => {
  assert.deepEqual(cuesOf(pool(1, 0, { inventory: [item('sack')], ...fight }), undefined), []);
});

// Breaks: an unchanged redraw plays again.
test('the same view twice is silent', () => {
  const v = pool(9, 5, { inventory: [item('sack')], journal: [quest('q', 'active')], ...fight });
  assert.deepEqual(cuesOf(v, v), []);
});

// Breaks: a bleed or poison tick thuds (book-ui.md: status ticks are silent).
test('hit points falling outside combat is no blow', () => {
  assert.deepEqual(cuesOf(pool(7), pool(9)), []);
});

// Breaks: the killing blow that ends the fight loses its thud.
test('a fall on the view that closes combat is still a blow', () => {
  assert.deepEqual(cuesOf(pool(7), pool(9, 0, fight)), [
    { name: 'hp_loss', loss: 2 },
    { name: 'combat_close' },
  ]);
});

// Breaks: a character's first view with pools and a level plays coin, level and a blow as gains.
test('fields that first appear, or leave, are no change', () => {
  const full = pool(9, 5, { levelling: { level: 1 }, ...fight });
  assert.deepEqual(cuesOf(full, view(fight)), []);
  assert.deepEqual(cuesOf(view(fight), full), []);
});

// Breaks: taking off a worn item flicks as a pickup.
test('an item off the body is no pickup', () => {
  const worn = view({ equipment: [{ slot: 'head', item: item('cap') }] });
  assert.deepEqual(cuesOf(view({ inventory: [item('cap')] }), worn), []);
});

// Breaks: an already-resolved quest re-sounds; a resumed quest counts as a new one.
test('only a quest new to the journal is quest_on', () => {
  const was = view({ journal: [quest('q', 'objectives_complete')] });
  assert.deepEqual(cuesOf(view({ journal: [quest('q', 'active')] }), was), []);
});

// Breaks: a permanent status gets an arrival effect (book-ui.md, Status icon).
test('a permanent status arriving has no cue', () => {
  assert.deepEqual(cuesOf(view({ conditions: [{ label: 'old_scar' }] }), base), []);
});

// Breaks: learning a skill also tones as an improvement.
test('a skill first acquired at level 1 is learned, not improved', () => {
  const out = cuesOf(view({ skills: [skill('s', true, 1)] }), base);
  assert.deepEqual(out, [{ name: 'skill_learned', ids: ['s'] }]);
});

// Breaks: a purchase plays two sounds, or loses the visual pop on the item.
test('a buy is the coin alone, and the item still marked for its pop', () => {
  const out = cuesOf(pool(9, 2, { inventory: [item('rope')] }), pool(9, 5));
  assert.deepEqual(out, [{ name: 'pickup', ids: ['rope'], silent: true }, { name: 'coin' }]);
  assert.deepEqual(out.map(soundOf), [undefined, 'coin']);
});

// Breaks: a quest reward (no pennies lost) is muted like a buy.
test('an item arriving with pennies gained still flicks', () => {
  const out = cuesOf(pool(9, 8, { inventory: [item('rope')] }), pool(9, 5));
  assert.deepEqual(out.map(soundOf), ['pickup', 'coin']);
});

// Breaks: the first of two in one command is lost, or both fire.
test('two pickups in one view are one cue naming both', () => {
  const out = cuesOf(view({ inventory: [item('sack'), item('rope')] }), base);
  assert.deepEqual(out, [{ name: 'pickup', ids: ['sack', 'rope'] }]);
});

const names = (fired: Cue[]) => fired.map((c) => c.name);
const coin: Cue = { name: 'coin' };
const blow = (loss: number): Cue => ({ name: 'hp_loss', loss });

// Breaks: the window is off by one either way (mix.coalesce, 300 ms).
test('a small cue inside 300 ms merges, at 300 ms it fires', () => {
  const a = step(QUIET, [coin], 1000);
  assert.deepEqual(names(a.fired), ['coin']);
  assert.deepEqual(step(a.q, [coin], 1299).fired, []);
  assert.deepEqual(names(step(a.q, [coin], 1300).fired), ['coin']);
});

// Breaks: small cues of different keys merge into each other.
test('coalescing is by key', () => {
  const a = step(QUIET, [coin], 1000);
  assert.deepEqual(names(step(a.q, [{ name: 'pickup' }], 1000).fired), ['pickup']);
});

// Breaks: S1 is rate limited.
test('whisper cues are free', () => {
  const place: Cue = { name: 'place' };
  assert.deepEqual(names(step(step(QUIET, [place], 1000).q, [place], 1000).fired), ['place']);
});

// Breaks: a flurry stacks, or the pending blow is the older one, or plays early or never.
test('a flurry of blows: one playing, the last pending, and it plays at the beat', () => {
  let r = step(QUIET, [blow(1)], 1000);
  assert.deepEqual(r.fired, [{ ...blow(1), wash: true }]);
  r = step(r.q, [blow(2)], 1100);
  r = step(r.q, [blow(3)], 1200);
  assert.deepEqual(r.fired, []);
  assert.deepEqual(r.q.pending, blow(3));
  assert.deepEqual(step(r.q, [], 1499).fired, []);
  const played = step(r.q, [], 1500);
  assert.equal(played.fired[0]?.loss, 3);
  assert.equal(played.q.pending, undefined);
});

// Breaks: a blow displaces a level already waiting.
test('another S3 key does not displace the pending one', () => {
  let r = step(QUIET, [blow(1)], 1000);
  r = step(r.q, [{ name: 'level' }], 1100);
  r = step(r.q, [blow(2)], 1200);
  assert.deepEqual(r.q.pending, { name: 'level' });
});

// Breaks: a second full-page flash inside a second (book-ui.md, Flash limit), off by one either way.
test('a blow within a second of a wash keeps all but the wash', () => {
  const a = step(QUIET, [blow(1)], 1000);
  assert.equal(step(a.q, [blow(2)], 1999).fired[0]?.wash, false);
  assert.equal(step(a.q, [blow(2)], 2000).fired[0]?.wash, true);
});

// Breaks: anything survives the chapter, or a second card stacks, or others play under it, or a
// chapter with no page turn silences the Book for good.
test('S4 clears the queue, fires alone, holds for the card or until the page turns', () => {
  let r = step(QUIET, [blow(1)], 1000);
  r = step(r.q, [blow(2)], 1100);
  r = step(r.q, [{ name: 'chapter' }, coin], 1200);
  assert.deepEqual(names(r.fired), ['chapter']);
  assert.equal(r.q.playing, undefined);
  assert.equal(r.q.pending, undefined);
  assert.deepEqual(step(r.q, [{ name: 'chapter' }, coin, blow(3)], 1300).fired, []);
  assert.deepEqual(names(step(r.q, [coin], 1400, true).fired), ['coin']);
  assert.deepEqual(step(r.q, [coin], 1799).fired, []);
  assert.deepEqual(names(step(r.q, [coin], 1800).fired), ['coin']);
});

// Breaks: a turn leaves the leaving page's blow waiting; or a turn loses this view's own cues.
test('a page turn cancels what is queued before this view joins', () => {
  let r = step(QUIET, [blow(1)], 1000);
  r = step(r.q, [blow(2)], 1100);
  const turned = step(r.q, [{ name: 'level' }], 1200, true);
  assert.deepEqual(names(turned.fired), ['level']);
  assert.equal(turned.q.pending, undefined);
  assert.deepEqual(names(step(r.q, [{ name: 'chapter' }], 1200, true).fired), ['chapter']);
});

// Breaks: grinding nags, off by one either way; or the line loses its gilt with the tone.
test('skill_up sounds once per 30 s and stays a cue between', () => {
  const up: Cue = { name: 'skill_up' };
  const a = step(QUIET, [up], 1000);
  assert.deepEqual(a.fired.map(soundOf), ['skillUp']);
  const hushed = step(a.q, [up], 30999);
  assert.deepEqual(hushed.fired, [{ name: 'skill_up', silent: true }]);
  assert.deepEqual(hushed.fired.map(soundOf), [undefined]);
  assert.deepEqual(step(a.q, [up], 31000).fired.map(soundOf), ['skillUp']);
  // A hushed one does not push the next sound back.
  assert.deepEqual(step(hushed.q, [up], 31298).fired, []);
  assert.deepEqual(step(hushed.q, [up], 31299).fired.map(soundOf), ['skillUp']);
});
