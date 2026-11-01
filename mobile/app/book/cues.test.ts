// Named breaks for the cue bus, over minimal views; every expected value is written by hand.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GameView } from '../../packages/game-view/session.ts';
import { cuesOf, QUIET, soundOf, step, type Cue, type CueName } from './cues.ts';
import { motion } from './tokens.ts';

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
const QUICK = motion.quick.duration;
const fight = { combat: { encounter_id: 'e' } };

// Each row breaks if that cue's trigger, or its sound, changes. [cue, was, now, sound].
const rows: [CueName, GameView, GameView, string | undefined][] = [
  ['pickup', base, view({ inventory: [item('sack')] }), 'pickup'],
  ['coin', pool(9, 5), pool(9, 8), 'coin'],
  ['hp_loss', pool(9, 0, fight), pool(7, 0, fight), 'blow'],
  ['status_in', base, view({ conditions: [{ label: 'dazed', ends_at: 9 }] }), undefined],
  [
    'status_in',
    base,
    view({ conditions: [{ label: 'sick', ends_at: 9, kind: 'debuff' }] }),
    'tick',
  ],
  [
    'status_in',
    base,
    view({ conditions: [{ label: 'keen', ends_at: 9, kind: 'buff' }] }),
    undefined,
  ],
  ['status_in', base, view({ bleeding: { label: 'cut' } }), 'tick'],
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
    { name: 'combat_close', end: 'fell' },
  ]);
});

// Breaks: a character's first view with pools and a level plays coin, level and a blow as gains.
test('fields that first appear, or leave, are no change', () => {
  const full = pool(9, 5, { levelling: { level: 1 }, ...fight });
  assert.deepEqual(cuesOf(full, view(fight)), []);
  assert.deepEqual(cuesOf(view(fight), full), []);
});

// Breaks: a gain of nothing reads as a gain; or a skill or level with no number stays silent.
test('a skill or level that stands still is silent, one first numbered has risen', () => {
  const blade = (level?: number) => view({ skills: [skill('blade', true, level)] });
  assert.deepEqual(cuesOf(blade(2), blade(2)), []);
  assert.deepEqual(cuesOf(blade(), blade(0)), []);
  assert.deepEqual(names(cuesOf(blade(1), blade())), ['skill_up']);
  const lv = (level: number) => view({ levelling: { level } });
  assert.deepEqual(cuesOf(lv(3), lv(3)), []);
  assert.deepEqual(cuesOf(view({}), lv(0)), []);
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

// Breaks: a silent buff swallows the debuff's tick arriving just after it.
test('a silent small cue does not merge a heard one', () => {
  const a = step(QUIET, [{ name: 'status_in', silent: true }], 1000);
  assert.deepEqual(names(step(a.q, [{ name: 'status_in' }], 1100).fired), ['status_in']);
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

// Breaks: a cue moves severity against plan section 2's table, so it queues or merges wrongly.
test('each cue behaves as its severity', () => {
  const felt = (name: CueName) => {
    const first = step(QUIET, [{ name }], 1000);
    const next = step(first.q, [{ name }], 1100);
    if (first.q.card) return 4;
    if (next.q.pending) return 3;
    return next.fired.length ? 1 : 2;
  };
  const severities = Object.fromEntries(
    (
      [
        'pickup',
        'coin',
        'hp_loss',
        'status_in',
        'status_out',
        'quest_on',
        'quest_resolved',
        'quest_fail',
        'level',
        'skill_learned',
        'skill_up',
        'chapter',
        'place',
        'combat_open',
        'combat_close',
        'blow_dealt',
      ] as CueName[]
    ).map((n) => [n, felt(n)]),
  );
  assert.deepEqual(severities, {
    pickup: 2,
    coin: 2,
    hp_loss: 3,
    status_in: 2,
    status_out: 1,
    quest_on: 2,
    quest_resolved: 3,
    quest_fail: 2,
    level: 3,
    skill_learned: 2,
    skill_up: 2,
    chapter: 4,
    place: 1,
    combat_open: 1,
    combat_close: 1,
    blow_dealt: 2,
  });
});

// Breaks: the 30 s limit of skill_up silences every other small cue.
test('other small cues keep their sound past coalescing', () => {
  const coin: Cue = { name: 'coin' };
  const first = step(QUIET, [coin], 1000);
  assert.deepEqual(step(first.q, [coin], 1300).fired, [coin]);
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
  const away = step(r.q, [coin], 1400, true);
  assert.deepEqual(away.fired, []);
  assert.deepEqual(names(step(away.q, [], 1400 + QUICK).fired), ['coin']);
  assert.deepEqual(step(r.q, [coin], 1799).fired, []);
  assert.deepEqual(names(step(r.q, [coin], 1800).fired), ['coin']);
});

// Breaks: a turn leaves the leaving page's blow waiting; a turn loses this view's own cues; or they
// start at the turn, under a picture still covering the page (book-ui.md, Queue).
test('a page turn cancels what is queued; the arriving cues start at the picture deadline', () => {
  let r = step(QUIET, [blow(1)], 1000);
  r = step(r.q, [blow(2)], 1100);
  const turned = step(r.q, [{ name: 'level' }], 1200, true);
  assert.deepEqual(turned.fired, []);
  assert.equal(turned.q.pending, undefined);
  assert.deepEqual(step(turned.q, [], 1200 + QUICK - 1).fired, []);
  const due = step(turned.q, [], 1200 + QUICK);
  assert.deepEqual(names(due.fired), ['level']);
  assert.deepEqual(due.q.held, []);
  const chapter = step(r.q, [{ name: 'chapter' }], 1200, true);
  assert.deepEqual(names(step(chapter.q, [], 1200 + QUICK).fired), ['chapter']);
});

// Breaks: a second turn lets the first arriving page's cue play on the page after it.
test('another turn inside the hold cancels the held cues', () => {
  const first = step(QUIET, [{ name: 'level' }], 1000, true);
  const second = step(first.q, [], 1100, true);
  assert.deepEqual(step(second.q, [], 1100 + QUICK).fired, []);
});

// Breaks: two views inside a hold play one key twice, or the merged cue names only the first's items.
test('small cues held together fire once with all their ids', () => {
  const a = step(QUIET, [{ name: 'pickup', ids: ['a'] }], 1000, true);
  const b = step(a.q, [{ name: 'pickup', ids: ['b'] }], 1050);
  assert.deepEqual(step(b.q, [], 1000 + QUICK).fired, [{ name: 'pickup', ids: ['a', 'b'] }]);
});

// Breaks: a status tick in combat thuds (owner rule: silent); the per_tick sign is reversed, so a
// blow reads wrong; or a healing tick hides part of a blow. Literals: a tick every 60 of -1 HP.
test('a tick in combat is no blow; a blow beside a tick is its own size', () => {
  const poison = (next_tick_at: number, per_tick = -1) => ({
    conditions: [{ label: 'p', resource: 'hp', per_tick, tick_every: 60, next_tick_at }],
  });
  const fought = (hp: number, more: object) => view({ ...pool(hp), ...fight, ...more });
  const hp = (now: GameView, was: GameView) =>
    cuesOf(now, was).find((c) => c.name === 'hp_loss')?.loss;
  assert.equal(hp(fought(9, poison(160)), fought(10, poison(100))), undefined);
  assert.equal(hp(fought(8, poison(220)), fought(10, poison(100))), undefined); // two ticks
  assert.equal(hp(fought(6, poison(160)), fought(10, poison(100))), 3);
  assert.equal(hp(fought(9, poison(160, 2)), fought(10, poison(100, 2))), 3); // heals 2, blow 3
  assert.equal(hp(fought(7, poison(100)), fought(10, poison(100))), 3); // no tick fell
  const stamina = (next_tick_at: number) => ({
    conditions: [{ label: 's', resource: 'stamina', per_tick: -5, tick_every: 60, next_tick_at }],
  });
  assert.equal(hp(fought(7, stamina(160)), fought(10, stamina(100))), 3); // a stamina tick takes no HP
  const bleed = (next_tick_at: number, generation = 1) => ({
    bleeding: { label: 'b', hp_loss: 2, tick_every: 100, next_tick_at, generation },
  });
  assert.equal(hp(fought(8, bleed(200)), fought(10, bleed(100))), undefined);
  assert.equal(hp(fought(7, bleed(200)), fought(10, bleed(100))), 1);
  assert.equal(hp(fought(7, bleed(200, 2)), fought(10, bleed(100))), 3); // a new wound, no tick
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

const foe = (band: string, more = {}) => ({
  combat: { encounter_id: 'e', opponent_id: 'wolf', band, ...more },
});
const standing = view({ entities: [{ id: 'wolf' }] });
const endOf = (now: GameView) =>
  cuesOf(now, view({ ...foe('hurt') })).find((c) => c.name === 'combat_close')?.end;

// Breaks: the fanfare plays for a flight, or for a fight the foe walked away from; the room is checked
// after the foe, whose entity is gone from any new room.
test('a close knows flight, then a fallen foe, then a quiet end', () => {
  assert.equal(endOf(view({ place: { id: 'p2' } })), 'fled');
  assert.equal(endOf(view()), 'fell');
  assert.equal(endOf(standing), 'quiet');
});

// Breaks: a death also closes the fight, so the fanfare races the cut; or the fatal blow, whose hp the
// death restores, loses its thud; or a death outside a fight thuds.
test('a death is the fatal blow and the death, and no close', () => {
  const fall = cuesOf(view(), view(foe('hurt')), true);
  assert.deepEqual(fall, [
    { name: 'hp_loss', loss: 0 },
    { name: 'death', fight: true },
  ]);
  assert.deepEqual(cuesOf(view(), view(), true), [{ name: 'death', fight: false }]);
});

// Breaks: an unmoved band, or a new encounter's first band, plays an impact.
test('a blow dealt is a moved band or a pack fallen by one, in one encounter', () => {
  const dealt = (was: object, now: object) =>
    cuesOf(view(now), view(was)).filter((c) => c.name === 'blow_dealt');
  assert.deepEqual(dealt(foe('fine'), foe('hurt')), [{ name: 'blow_dealt', ids: ['wolf'] }]);
  assert.deepEqual(dealt(foe('hurt'), foe('hurt')), []);
  assert.deepEqual(dealt(foe('fine'), foe('hurt', { encounter_id: 'e2' })), []);
  const pack = (...ids: string[]) =>
    foe('hurt', { active_opponents: ids.map((id) => ({ id, band: 'hurt' })) });
  assert.deepEqual(dealt(pack('a', 'b'), pack('a')), [{ name: 'blow_dealt', ids: [] }]);
});

// Breaks: a death waits behind a card or a turn's hold, leaves a pending cue to sound over it, or stops
// a thud already playing (the queue has no such power: `playing` is only forgotten, nothing is fired).
test('a death clears what is pending and fires at once, past a held card', () => {
  const later = { ...QUIET, card: true, until: 9999, heldUntil: 9999 };
  const pending = {
    ...later,
    playing: { name: 'hp_loss' as const },
    pending: { name: 'coin' as const },
  };
  const { q, fired } = step(pending, [{ name: 'coin' }, { name: 'death', fight: false }], 10);
  assert.deepEqual(fired, [{ name: 'death', fight: false, wash: false }]);
  assert.equal(q.pending, undefined);
  assert.equal(q.card, false);
  assert.deepEqual(q.held, []);
  // The blow comes first and its wash decision reaches the death, which Blow's hold reads.
  const blow = step(
    QUIET,
    [
      { name: 'hp_loss', loss: 0 },
      { name: 'death', fight: true },
    ],
    5000,
  );
  assert.deepEqual(blow.fired, [
    { name: 'hp_loss', loss: 0, wash: true },
    { name: 'death', fight: true, wash: true },
  ]);
  // Two blows held behind a turn: the thud is the fatal one's.
  const two = step(
    { ...QUIET, held: [{ name: 'hp_loss', loss: 1 }] },
    [
      { name: 'hp_loss', loss: 7 },
      { name: 'death', fight: true },
    ],
    5000,
  );
  assert.deepEqual(two.fired[0], { name: 'hp_loss', loss: 7, wash: true });
});
