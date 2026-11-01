// The listening list's table (audio-listening-list.md), row by row: a change in the view to the file
// heard and the haptic felt. Every expected value is written by hand from that table and plan 3.x.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import './__tests__/polish-book.test.ts';
import type { GameView } from '../../packages/game-view/session.ts';

const { cuesOf, QUIET, step } = await import('./cues.ts');
const { hearCues, playCue } = await import('./cueSounds.ts');
await import('./samples.web.ts');
const g = globalThis as any;
const samples: Record<string, string[]> = g.bookSamples;

const base = { place: { id: 'p' }, inventory: [], journal: [], time: 0 };
const view = (more = {}) => ({ ...base, ...more }) as unknown as GameView;
const res = (key: string, current: number) => ({ resource: { key }, current, maximum: 20 });
const purse = (n: number, more = {}) => view({ resources: [res('pennies', n)], ...more });
const wounded = (hp: number) => view({ combat: { encounter_id: 'e' }, resources: [res('hp', hp)] });
const quest = (state: string) => ({ journal: [{ quest: { key: 'q' }, state, title: 't' }] });
const skill = (acquired: boolean, level?: number) => ({
  skills: [{ skill: { key: 's' }, acquired, level }],
});
const worn = (kind?: string) => ({
  conditions: [{ label: 'sick', ends_at: 9, ...(kind ? { kind } : {}) }],
});
const sack = { inventory: [{ id: 'sack' }] };

/** What this change is heard and felt as: the files in play order, then the haptics. */
function heard(was: GameView, now: GameView) {
  g.bookDevice = [];
  for (const cue of cuesOf(now, was)) playCue(cue);
  const log: [string, string][] = g.bookDevice;
  g.bookDevice = undefined;
  return {
    files: log.filter((l) => l[0] === 'play').map((l) => samples[l[1]]![0]),
    felt: log.filter((l) => l[0] === 'haptic').map((l) => l[1]),
  };
}

const tones = 'sfx-harp-';
// [event, was, now, file, haptic]: breaks if a row's trigger, file or haptic moves.
const table: [string, GameView, GameView, string, string?][] = [
  ['pickup', view(), view(sack), 'ui-paper-flick-01.m4a', 'light'],
  ['pennies', purse(5), purse(8), 'sfx-coin-clink-01.m4a', 'selection'],
  ['a blow taken', wounded(9), wounded(7), 'sfx-paper-thud-01.m4a', 'heavy'],
  ['a debuff arrives', view(), view(worn('debuff')), 'ui-paper-tick-01.m4a', 'selection'],
  [
    'a bleed arrives',
    view(),
    view({ bleeding: { label: 'cut' } }),
    'ui-paper-tick-01.m4a',
    'selection',
  ],
  [
    'level up',
    view({ levelling: { level: 1 } }),
    view({ levelling: { level: 2 } }),
    `${tones}note-high-01.m4a`,
    'medium',
  ],
  ['new skill', view(skill(false)), view(skill(true, 1)), `${tones}note-low-01.m4a`, 'light'],
  [
    'quest resolved',
    view(quest('active')),
    view(quest('resolved')),
    `${tones}note-low-01.m4a`,
    'light',
  ],
  [
    'quest failed',
    view(quest('active')),
    view(quest('failed')),
    'sfx-paper-close-01.m4a',
    'warning',
  ],
  ['skill improves', view(skill(true, 1)), view(skill(true, 2)), `${tones}tone-high-01.m4a`],
  ['quest gained', view(), view(quest('active')), `${tones}tone-low-01.m4a`],
  [
    'chapter',
    view({ chapter: { index: 0 } }),
    view({ chapter: { index: 1 } }),
    'mus-theme-chapter-01.m4a',
    'medium',
  ],
];
for (const [event, was, now, file, felt] of table)
  test(`${event} plays ${file}`, () => {
    assert.deepEqual(heard(was, now), { files: [file], felt: felt ? [felt] : [] });
  });

// Breaks: a buy gains the flick back (the coin alone is the owner's line), or loses the coin.
test('a buy plays the coin and no flick', () => {
  assert.deepEqual(heard(purse(8), purse(5, sack)), {
    files: ['sfx-coin-clink-01.m4a'],
    felt: ['selection'],
  });
});

// Breaks: a tick or the end of a status sounds (owner rule), a buff ticks, or a walk does.
const silent: [string, GameView, GameView][] = [
  ['a buff arrives', view(), view(worn('buff'))],
  ['a status of no kind arrives', view(), view(worn())],
  ['a status ticks on', view(worn('debuff')), view({ ...worn('debuff'), time: 5 })],
  ['a status ends', view(worn('debuff')), view()],
  ['a walk', view(), view({ place: { id: 'q' } })],
];
for (const [event, was, now] of silent)
  test(`${event} is neither heard nor felt`, () => {
    assert.deepEqual(heard(was, now), { files: [], felt: [] });
  });

// Breaks: the merge keeps the first cue's flag, so a debuff behind a buff in one moment goes unheard.
test('a debuff and a buff landing together tick, either way round', () => {
  const buff = { name: 'status_in', ids: ['keen'], silent: true } as const;
  const debuff = { name: 'status_in', ids: ['sick'] } as const;
  for (const both of [
    [buff, debuff],
    [debuff, buff],
  ]) {
    const [cue] = step(QUIET, both, 1000).fired;
    assert.equal(cue!.silent, undefined);
    assert.deepEqual([...cue!.ids!].sort(), ['keen', 'sick']);
  }
  assert.equal(step(QUIET, [buff, buff], 1000).fired[0]!.silent, true);
});

// Breaks: a turn repeats one sample where the plan wants three in rotation.
test('the page turn has its three recordings', () => {
  assert.deepEqual(samples.pageTurn, [
    'ui-paper-turn-01.m4a',
    'ui-paper-turn-02.m4a',
    'ui-paper-turn-03.m4a',
  ]);
});

// Every row: [cue, music call, haptics]. Breaks: the fanfare's light haptic reaches a flight, a reopened
// fight buzzes, a death in a fight doubles the thud's heavy, or one outside a fight has none.
const fightRows: [Parameters<typeof playCue>[0], string, string[]][] = [
  [{ name: 'combat_open' }, 'open', ['medium']],
  [{ name: 'combat_open', resumed: true }, 'resume', []],
  [{ name: 'combat_close', end: 'fell' }, 'won', ['light']],
  [{ name: 'combat_close', end: 'fled' }, 'away', []],
  [{ name: 'combat_close', end: 'quiet' }, 'away', []],
  [{ name: 'combat_close', resumed: true }, 'away', []],
  [{ name: 'death', fight: true }, 'cut', []],
  [{ name: 'death', fight: false }, 'cut', ['heavy']],
];
for (const [cue, music, felt] of fightRows)
  test(`${cue.name} ${JSON.stringify(cue)}: music ${music}, haptic ${felt}`, () => {
    g.bookDevice = [];
    playCue(cue);
    const log: [string, string][] = g.bookDevice;
    g.bookDevice = undefined;
    assert.deepEqual(
      log.filter((l) => l[0] === 'fight').map((l) => l[1]),
      [music],
    );
    assert.deepEqual(
      log.filter((l) => l[0] === 'haptic').map((l) => l[1]),
      felt,
    );
  });

// Breaks: a blow dealt buzzes, or plays nothing.
test('a blow dealt is an impact, with no haptic', () => {
  g.bookDevice = [];
  playCue({ name: 'blow_dealt', ids: ['wolf'] });
  const log: [string, string][] = g.bookDevice;
  g.bookDevice = undefined;
  assert.deepEqual(log, [['play', 'impact']]);
});

// Breaks: the loop outlives the Book, so Start over mid-fight plays it over the new game.
test('the Book going cuts the music', () => {
  const off = hearCues();
  g.bookDevice = [];
  off();
  const log: [string, string][] = g.bookDevice;
  g.bookDevice = undefined;
  assert.deepEqual(log, [['fight', 'cut']]);
});

// Breaks: a sound name or a room tag is wired to another's file, or a tag loses its bed or piece.
test('the room and deed sounds play their manifest files', () => {
  assert.deepEqual(samples.miss, ['sfx-miss-01.m4a']);
  assert.deepEqual(samples.lever, ['sfx-lever-01.m4a']);
  assert.deepEqual(samples.latch, ['sfx-latch-01.m4a']);
  assert.deepEqual(samples.weather, ['amb-rain-01.m4a']);
  assert.deepEqual(samples.thunder, [
    'sfx-thunder-01.m4a',
    'sfx-thunder-02.m4a',
    'sfx-thunder-03.m4a',
  ]);
  for (const tag of 'wild shore cave mill forge church crypt vault inn village'.split(' ')) {
    assert.equal(g.bookRooms.beds[tag], `amb-${tag}-01.m4a`);
    assert.equal(g.bookRooms.pieces[tag], `mus-explore-${tag}-01.m4a`);
  }
});
