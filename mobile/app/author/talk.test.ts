// The conversation in Build (docs/rnd/in-game-builder-mode-2026-11-19.md §4.6, slice 5.1b): a choice
// label's words, its icon row inside the card, and its writes (/edit for JSON, one reword for `.scene`).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nodes } from '../book/__tests__/combat-book.test.ts'; // the React Native stand-ins
import { bind, tagged } from './prose_rules.ts';

Object.assign(globalThis, { localStorage: { getItem: () => null, setItem() {} } });
const { attach, line, shut } = await import('./build/field.tsx');
const { icons, sceneLine } = await import('./build/talk.tsx');
const { known } = await import('./build/room.tsx');
const { wire } = await import('./build/roomedit.tsx');
const { ink } = await import('./build/build.ts');

const KEY = 'dialogue.cook_lesson.choices.first.label';
const REF = 'kit@0.0.1:dialogue/cook_lesson';
const SCENE = '"Want to learn the pot?" the cook asks.\n- Ask about fish #first\n  ~\n';
const seen = new Map<string, string>();
const said = new Map<string, string>();
const sent: [string, any][] = [];
let answers: [number, unknown][] = [];
let on = true;
let choice: Record<string, unknown> = {}; // the canon's choice `first`
const tick = () => new Promise((r) => setTimeout(r));
const api = async (path: string, body?: object): Promise<[number, any]> => {
  sent.push([path.split('?')[0], body]);
  return path.startsWith('/source') ? [200, { bytes: SCENE, sha256: 's1' }] : answers.shift()!;
};
const g = { canon: () => ({ dialogues: { [REF]: { choices: { first: choice } } } }) } as any;
wire(
  api,
  () => {},
  () => {},
);
attach({
  on: () => on,
  seen,
  said,
  redraw() {},
  focus() {},
  commit() {},
  api,
  wrote() {},
  icons: (key, words) => icons(g, () => {}, key, words),
  scene: sceneLine,
});

/** The label's line as the seam hands it, inside its card; `file` is the dialogue's source. */
function label(file: string, words = 'Ask about fish') {
  known.nodes = [{ ref: REF }] as any;
  known.files = { [REF]: file };
  const shown = tagged(KEY, words);
  bind(seen, shown, KEY);
  said.set(KEY, words);
  return { children: shown, style: { fontSize: 1 } };
}
const drawn = (p: object) => nodes(line(p as any).children);
const icon = (p: object, name: string) =>
  drawn(p).find((n) => n.props?.accessibilityLabel === name);
const stop = { stopPropagation() {} };
async function commit(p: object, words: string) {
  icon(p, 'words').props.onPress(stop);
  await tick();
  const input = drawn(p).find((n) => n.type === 'TextInput');
  input.props.onChangeText(words);
  input.props.onSubmitEditing();
  await tick();
}

// Breaks: the seam reaching a label's line with Build off (a pen, an icon row, a style).
test('Build off leaves the label line as drawn', () => {
  on = false;
  const p = label('world/cook.json');
  assert.equal(line(p as any), p);
  on = true;
});

// Breaks: a JSON label's words saved anywhere but /edit (a /set or /restructure), or not found by /line.
test('a JSON label commits through /line then /edit, no /restructure', async () => {
  sent.length = 0;
  const p = label('world/cook.json');
  answers = [
    [200, { file: 'world/cook.json', line: 7, was: 'w1', words: 'Ask about fish' }],
    [200, { id: 3 }],
  ];
  await commit(p, 'Ask about eels');
  assert.deepEqual(sent, [
    ['/line', undefined],
    ['/edit', { file: 'world/cook.json', line: 7, was: 'w1', words: 'Ask about eels', key: KEY }],
  ]);
});

// Breaks: a `.scene` label sent to /line, /edit or /set (decision 11: /set takes no label), or its
// reword aimed at the wrong line or without the source's sha.
test('a .scene label commits one reword at its own line, no /set', async () => {
  sent.length = 0;
  const p = label('world/cook.scene');
  answers = [[200, { id: 4 }]];
  await commit(p, 'Ask about eels');
  assert.deepEqual(sent, [
    ['/source', undefined],
    [
      '/restructure',
      {
        file: 'world/cook.scene',
        was: 's1',
        op: { reword: { line: 2, words: 'Ask about eels' } },
        carry: [],
      },
    ],
  ]);
});

// Breaks: a label line taking the card's press (the card plays the choice), an icon's press or the
// open field's tap bubbling to the card and playing it.
test("an icon press and the open field's tap are not the card's press", async () => {
  const p = label('world/cook.json');
  assert.equal(line(p as any).onPress, undefined, 'the label took the card press');
  let played = 0;
  const card = (target: { onPress: (e: object) => void }) => {
    let stopped = false;
    target.onPress({ stopPropagation: () => (stopped = true) });
    if (!stopped) played++; // the press bubbles to the card
  };
  card(icon(p, 'when').props);
  answers = [[200, { file: 'world/cook.json', line: 7, was: 'w1', words: 'Ask about fish' }]];
  card(icon(p, 'words').props);
  await tick();
  card(line(p as any) as any);
  assert.equal(played, 0);
  shut();
});

// Breaks: an empty `then` drawn lit (goes looks set), or a set field drawn dim.
test('an empty then draws goes dim; a set field draws lit', () => {
  choice = { steps: [{ say: 'x' }] };
  const p = label('world/cook.json');
  const color = (name: string) => icon(p, name).props.style.color;
  assert.equal(color('goes'), ink('dim'));
  assert.equal(color('when'), ink('dim'));
  assert.equal(color('does'), ink('action'));
  choice = {};
});
