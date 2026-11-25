// The Flow focus walk on the phone (author/build/flow.tsx, slice 5.5b): what a centre draws, how a tap
// re-centres and Back steps back, and what a filter hides. The walk's rules are flowwalk's
// (kernel/ts/test/author_flowwalk.test.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nodes } from '../book/__tests__/combat-book.test.ts'; // the React Native stand-ins
import { BUILD } from './build/build.ts';

const kept = new Map([[BUILD, '{"on":true}']]);
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => kept.get(k) ?? null,
    setItem: (k: string, v: string) => void kept.set(k, v),
  },
  addEventListener() {},
  removeEventListener() {},
  innerWidth: 390,
});
const R = (kind: string, key: string) => `w@1:${kind}/${key}`;
const story = {
  graph: {
    nodes: [
      { ref: R('dialogue', 'greet'), kind: 'dialogue' },
      { ref: R('dialogue', 'farewell'), kind: 'dialogue' },
      { ref: R('fact', 'met_nell'), kind: 'fact' },
      { ref: R('npc', 'nell'), kind: 'npc' },
    ],
    edges: [
      // the reader first: the walk draws the setter above, the reader below, whatever the order
      { from: R('dialogue', 'farewell'), to: R('fact', 'met_nell'), path: '.when', op: 'fact_is' },
      { from: R('dialogue', 'greet'), to: R('fact', 'met_nell'), path: '.on', set: true },
      { from: R('dialogue', 'greet'), to: R('npc', 'nell'), path: '.speaker' },
      { from: R('dialogue', 'greet'), to: R('room', 'hall'), path: '.room' },
    ],
  },
  report: { unreachable: {}, orphan_facts: { unused: [], write_only: [], read_only: [] } },
  todo: {},
  diagnostics: {},
  files: { [R('dialogue', 'greet')]: 'dialogues/greet.json' },
  map: [{ ref: R('room', 'hall'), key: 'hall', area: null, title: 'Hall', exits: [] }],
};
const api = async (path: string): Promise<[number, any]> =>
  path === '/story' ? [200, story] : [404, null];
const started: string[] = [];
const build = await import('./build/Build.tsx');
build.place({
  place: () => ({ steps: [] }),
  here: () => 'hall',
  startIn: (r: string) => void started.push(r),
} as never);
build.install({ seen: new Map(), said: new Map(), redraw() {}, api } as never);
await new Promise((r) => setTimeout(r)); // /story

const stack = (): string[] => JSON.parse(kept.get(BUILD)!).sheets;
const sheet = () => nodes(build.sheets.flow.body(stack().at(-1)!.slice('flow:'.length)));
const label = (e: any) => e.props.children?.props?.children;
const press = (name: string, n = sheet()) =>
  n.find((e) => e.type === 'Pressable' && label(e) === name).props.onPress();
const back = () => press('Back', nodes(build.Strip({ children: 'book' })));
// the headings and node names drawn, without the filters and the acts beside each node
const drawn = () =>
  sheet()
    .filter((e) => e.type === 'Text' && typeof e.props.children === 'string')
    .map((e) => e.props.children)
    .filter((t) => / /.test(t) || ['Unlocks', 'Leads here'].includes(t))
    .filter((t) => !t.startsWith('Go there') && !['needs words', 'potential problems'].includes(t));

test('a fact centred draws its setter above it and its reader below', () => {
  build.open(`flow:${R('fact', 'met_nell')}`);
  assert.deepEqual(drawn(), [
    'Set by',
    'dialogue greet',
    'fact met_nell',
    'Read by',
    'dialogue farewell',
  ]);
});

test('a tap re-centres in place, Back steps back along the trail to the first ref', () => {
  build.open(`flow:${R('dialogue', 'greet')}`);
  const depth = stack().length;
  press('fact met_nell');
  press('dialogue farewell');
  assert.equal(
    stack().at(-1),
    `flow:${R('dialogue', 'greet')} ${R('fact', 'met_nell')} ${R('dialogue', 'farewell')}`,
  );
  assert.equal(stack().length, depth, 're-centring does not push');
  back();
  back();
  assert.equal(stack().at(-1), `flow:${R('dialogue', 'greet')}`);
  back();
  assert.equal(stack().length, depth - 1, 'at the first ref, Back closes the walk');
});

test('a lane filter on hides its nodes and shows selected; off, they are back', () => {
  build.open(`flow:${R('dialogue', 'greet')}`);
  assert.deepEqual(drawn(), ['dialogue greet', 'Unlocks', 'fact met_nell']);
  press('fact');
  const fact = sheet().find((e) => e.type === 'Pressable' && label(e) === 'fact');
  assert.equal(fact.props.accessibilityState.selected, true);
  assert.deepEqual(drawn(), ['dialogue greet']);
  press('fact');
  assert.deepEqual(drawn(), ['dialogue greet', 'Unlocks', 'fact met_nell']);
});

test("the centre offers its file's Sheet, its person's sheet and its room's Go there", () => {
  build.open(`flow:${R('dialogue', 'greet')}`);
  press('Go there: hall');
  assert.deepEqual(started, ['hall']);
  press('nell');
  assert.equal(stack().at(-1), 'npc:nell');
  build.open(`flow:${R('dialogue', 'greet')}`);
  press('Sheet');
  assert.equal(stack().at(-1), 'def:dialogues/greet.json');
});

test('from DOCK.at the walk adds the second hop: greet reaches farewell through met_nell', () => {
  build.open(`flow:${R('dialogue', 'greet')}`);
  Object.assign(globalThis, { innerWidth: 1152 });
  assert.deepEqual(drawn().slice(-2), ['Two steps out', 'dialogue farewell']);
  Object.assign(globalThis, { innerWidth: 1151 });
  assert.equal(drawn().includes('Two steps out'), false);
});
