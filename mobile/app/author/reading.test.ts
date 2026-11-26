// The notebook's Tools readers (author/build/reading.tsx and numbers.tsx, slice 6.2b): Why, Step and
// Numbers as drawn and pressed over a controlled game and watcher.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nodes, words } from '../book/__tests__/combat-book.test.ts'; // also registers the .tsx loader

const { toolRows } = await import('./build/tools.tsx');
const build = await import('./build/Build.tsx'); // its place() hands the game to the Tools tab
const settle = () => new Promise((r) => setTimeout(r));
let sent: { url: string; body?: unknown }[] = [];
let answer: (url: string) => Promise<unknown> = async () => ({ ok: true, json: async () => [] });
Object.assign(globalThis, {
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  fetch: (url: string, init?: { body?: string }) => (
    sent.push({ url, body: init?.body && JSON.parse(init.body) }),
    answer(url)
  ),
});
const replies = (ok: boolean, told: unknown) => async () => ({
  ok,
  json: async () => told,
  text: async () => String(told),
});
const refused = async () => {
  throw new Error('watcher down');
};

/** A game whose state the test sets: one action and one fact, at step `steps`. */
let state: any;
const at = (steps: number, lamp: unknown, hash = 'h1') =>
  (state = {
    hash,
    steps: Array(steps).fill({}),
    facts: [
      { row: 'f.lamp', key: 'lamp_lit', value: lamp, set: true },
      { row: 'f.door', key: 'door_open', value: false, set: false },
    ],
    shown: {
      room: 'Hall',
      people: [],
      held: [],
      pools: [],
      statuses: [],
      clock: { time: 0 },
      quests: [],
      offers: { action: ['light_lamp'], dialogue: [] },
    },
  });
const game = {
  state: () => state,
  place: () => ({ steps: [] }),
  game: { trace: () => ['look', 'n'] },
};
build.place(game as never);
toolRows(); // the Play tab's first draw asks for the checkpoint names, once
const text = () =>
  nodes(toolRows())
    .filter((n) => typeof n.props?.children === 'string')
    .map((n) => n.props.children)
    .join('|');
const press = (label: string) =>
  nodes(toolRows())
    .find((n) => n.props?.accessibilityRole === 'button' && words(n) === label)
    .props.onPress();
const pressed = async (...labels: string[]) => {
  for (const l of labels) press(l);
  toolRows(); // the redraw a press asks for
  await settle();
  await settle();
};

// Break: the answer's lines dropped or their verdict lost (a failed condition not reading "no"), or
// the question sent without the game's trace or the action's key.
test('Why on an action names the failed condition in its words; a failure says why', async () => {
  at(1, false);
  sent = [];
  answer = replies(true, { lines: [{ text: 'item lamp is held', ok: false, depth: 0 }] });
  await pressed('Why', 'light_lamp');
  assert.deepEqual(sent, [
    { url: '/__author/why', body: { trace: ['look', 'n'], action: 'light_lamp' } },
  ]);
  assert.match(text(), /\|light_lamp\|no: item lamp is held/);
  answer = replies(false, 'no such action');
  await pressed('light_lamp');
  assert.match(text(), /\|no such action/);
  assert.doesNotMatch(text(), /no: item lamp/);
  answer = refused;
  await pressed('light_lamp');
  assert.match(text(), /\|watcher down/);
});

// Break: the before/after pair folded on draw instead of on every update (a step taken with the
// notebook shut pairs with an older one), or a fact that did not change listed.
test('Step after a move lists exactly the facts it changed and the rule that looked', async () => {
  for (const [n, lamp] of [
    [0, null],
    [1, false],
    [2, true],
  ] as const)
    build.updated((at(n, lamp), { kind: 'pulse' }) as never); // as panel.tsx's subscription
  answer = replies(true, {
    ordinal: 2,
    command: 'light lamp',
    outcome: 'accepted',
    reactions: [
      { rule: 'glow', causes: [1], fired: 1 },
      { rule: 'idle', causes: [], fired: 0 },
    ],
  });
  await pressed('Step');
  assert.equal(sent.at(-1)!.url, '/__author/why');
  assert.match(
    text(),
    /Step 2 · light lamp accepted\|asked in \d+ ms\|Facts changed \(1\)\|lamp_lit false → true\|Quests changed \(0\)\|none\|Rules that looked \(1\)\|glow fired$/,
  );
  build.updated((at(3, true), { kind: 'pulse' }) as never);
  answer = replies(false, 'replay failed');
  await pressed('Step');
  assert.match(text(), /Step 3\|replay failed\|Facts changed \(0\)/);
  build.updated((at(4, true), { kind: 'pulse' }) as never);
  answer = refused;
  await pressed('Step');
  assert.match(text(), /Step 4\|watcher down/);
});

const report = {
  hash: 'h1',
  pacing: {
    report: {
      pools: { seeds: 4, days: 2, hours_played: 30, pools: [] },
      levels: [
        { level: 1, experience: 0, step: 10, points: 1, kills: [] },
        { level: 2, experience: 10, step: 20, points: 1, kills: [] },
        { level: 3, experience: 30, step: 30, points: 2, kills: [] },
      ],
    },
  },
  fights: { why: 'no fight sim here' },
};
// Break: a level row dropped or doubled, the header lost, a failed run silent, or a report for an
// older cartridge drawn as current.
test('Numbers draws one row per level under its header; a failure and a stale report say so', async () => {
  answer = replies(true, report);
  await pressed('Numbers', 'Run');
  assert.equal(sent.at(-1)!.url, '/__author/numbers');
  const levels = text().split('|Levels|')[1].split('|Fights|')[0].split('|');
  assert.deepEqual(levels, [
    'level  XP  step  points  kills for the step',
    '1  0  10  1  no kill pays XP',
    '2  10  20  1  no kill pays XP',
    '3  30  30  2  no kill pays XP',
  ]);
  assert.match(text(), /\|Fights\|no fight sim here$/);
  assert.doesNotMatch(text(), /Older than/);
  at(1, true, 'h2');
  assert.match(text(), /Older than the cartridge in the Book/);
  answer = replies(false, 'sim crashed');
  await pressed('Run');
  assert.match(text(), /Numbers failed: sim crashed/);
  answer = refused;
  await pressed('Run');
  assert.match(text(), /Numbers failed: watcher down/);
});

// Break: a fact at its declared default read as set by play, or the room or a section lost.
test('State reads the room and each fact, marking one at its default', async () => {
  at(1, false);
  await pressed('State');
  assert.match(
    text(),
    /\|Room\|Hall\|People\|Held\|Pools\|Statuses\|Clock\|.+\|Quests\|Facts\|lamp_lit: false\|door_open: false \(default\)$/,
  );
});
