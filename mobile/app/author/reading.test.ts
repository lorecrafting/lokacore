// The notebook's Tools readers (author/build/reading.tsx and numbers.tsx, slice 6.2b): Why, Step and
// Numbers as drawn and pressed over a controlled game and watcher.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nodes, words } from '../book/__tests__/combat-book.test.ts'; // also registers the .tsx loader

const { toolRows } = await import('./build/tools.tsx');
const build = await import('./build/Build.tsx'); // its place() hands the game to the Tools tab
const { ink } = await import('./build/build.ts');
const settle = () => new Promise((r) => setTimeout(r));
let clock = 0; // performance.now, so a report's timing is the test's
performance.now = () => clock;
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
const tone = (t: string) =>
  nodes(toolRows()).find((n) => n.props?.children === t).props.style.color;
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
// the question sent without the game's trace or the action's key, or the open tab or the asked
// button not marked.
test('Why on an action names the failed condition in its words; a failure says why', async () => {
  at(1, false);
  sent = [];
  answer = replies(true, { lines: [{ text: 'item lamp is held', ok: false, depth: 0 }] });
  await pressed('Why', 'light_lamp');
  assert.deepEqual(sent, [
    { url: '/__author/why', body: { trace: ['look', 'n'], action: 'light_lamp' } },
  ]);
  assert.match(text(), /\|light_lamp\|no: item lamp is held/);
  assert.equal(tone('no: item lamp is held'), ink('danger'));
  const shelf = nodes(toolRows()).filter((n) => /^tool /.test(n.key ?? ''));
  assert.deepEqual(
    shelf.map((n) => [words(n), n.props.accessibilityState.selected]),
    [
      ['Play', false],
      ['State', false],
      ['Why', true],
      ['Step', false],
      ['Numbers', false],
      ['Worlds', false],
    ],
  );
  const asked = nodes(toolRows()).find((n) => n.key === 'action light_lamp');
  assert.equal(asked.props.accessibilityState.selected, true); // the pressed button marked
  answer = replies(false, 'no such action');
  await pressed('light_lamp');
  assert.match(text(), /\|no such action/);
  assert.doesNotMatch(text(), /no: item lamp/);
  answer = refused;
  await pressed('light_lamp');
  assert.match(text(), /\|watcher down/);
});

// Break: the before/after pair folded on draw instead of on every update (a step taken with the
// notebook shut pairs with an older one), a fact that did not change listed, an unset value not read
// as unset, a matched rule that did not fire not marked, or a slow report not said (past 2000 ms).
test('Step after a move lists exactly the facts it changed and the rule that looked', async () => {
  for (const [n, lamp] of [
    [0, false],
    [1, null],
    [2, true],
  ] as const)
    build.updated((at(n, lamp), { kind: 'pulse' }) as never); // as panel.tsx's subscription
  const told = {
    ordinal: 2,
    command: 'light lamp',
    outcome: 'accepted',
    reactions: [
      { rule: 'glow', causes: [1], fired: 1 },
      { rule: 'hush', causes: [1], fired: 0 },
      { rule: 'idle', causes: [], fired: 0 },
    ],
  };
  const taking = (ms: number) => async () => ((clock += ms), replies(true, told)());
  answer = taking(2000);
  await pressed('Step');
  assert.equal(sent.at(-1)!.url, '/__author/why');
  assert.match(
    text(),
    /Step 2 · light lamp accepted\|asked in 2000 ms\|Facts changed \(1\)\|lamp_lit unset → true\|Quests changed \(0\)\|none\|Rules that looked \(2\)\|glow fired\|hush no when leaf held$/,
  );
  assert.equal(tone('glow fired'), ink('fg'));
  assert.equal(tone('hush no when leaf held'), ink('danger'));
  build.updated((at(3, true), { kind: 'pulse' }) as never);
  answer = taking(2001);
  await pressed('Step');
  assert.match(text(), /\|asked in 2001 ms \(slow\)\|/);
  build.updated((at(4, true), { kind: 'pulse' }) as never);
  answer = replies(false, 'replay failed');
  await pressed('Step');
  assert.match(text(), /Step 4\|replay failed\|Facts changed \(0\)/);
  build.updated((at(5, true), { kind: 'pulse' }) as never);
  answer = refused;
  await pressed('Step');
  assert.match(text(), /Step 5\|watcher down/);
});

// Break: a late /why reply for an older step overwriting the newer step's report (shown as nothing,
// and never asked again).
test('Step keeps the newer report when an older reply lands after it', async () => {
  let late!: () => void;
  answer = () =>
    new Promise(
      (r) =>
        (late = () =>
          r(replies(true, { ordinal: 6, command: 'n', outcome: 'accepted', reactions: [] })())),
    );
  build.updated((at(6, true), { kind: 'pulse' }) as never);
  await pressed('Step');
  build.updated((at(7, true), { kind: 'pulse' }) as never);
  answer = replies(true, { ordinal: 7, command: 'look', outcome: 'accepted', reactions: [] });
  await pressed('Step');
  late();
  await settle();
  await settle();
  assert.match(text(), /\|Step 7 · look accepted\|/);
  answer = refused; // as the test before left it
});

// Break: Step asking the watcher before the first step, or past its 400-step replay budget (or
// refusing at 400).
test('Step before the first step and past 400 steps says so without asking', async () => {
  at(0, false);
  sent = [];
  await pressed('Step');
  assert.match(text(), /\|Take a step in the Book first\.$/);
  at(400, false);
  await pressed('Step');
  assert.match(text(), /\|Step 400\|/);
  at(401, false);
  await pressed('Step');
  assert.match(text(), /\|Why is off past 400 steps/);
  assert.equal(sent.length, 1); // step 400's, alone
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
    'level · XP · step · points · kills for the step',
    '1 · 0 · 10 · 1 · no kill pays XP',
    '2 · 10 · 20 · 1 · no kill pays XP',
    '3 · 30 · 30 · 2 · no kill pays XP',
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

// Break: a fact at its declared default read as set by play, the room or a section lost, or an
// empty section left a bare heading.
test('State reads the room and each fact, marking one at its default', async () => {
  at(1, false);
  await pressed('State');
  assert.match(
    text(),
    /\|Room\|Hall\|People\|none\|Held\|none\|Pools\|none\|Statuses\|none\|Clock\|.+\|Quests\|none\|Facts\|lamp_lit: false\|door_open: false \(default\)$/,
  );
});

// Break: a reader drawn, or an update folded, before the Book has a game or a state.
test('with no game or no state yet, the readers say so and an update is harmless', async () => {
  build.place(undefined as never);
  build.updated({ kind: 'pulse' } as never);
  assert.match(text(), /\|No Book yet$/);
  build.place({ ...game, state: () => undefined } as never);
  build.updated({ kind: 'pulse' } as never);
  assert.match(text(), /\|No Book yet$/);
  build.place(game as never);
});
