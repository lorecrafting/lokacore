// The conversation in Build (docs/rnd/in-game-builder-mode-2026-11-19.md §4.6, slice 5.1b): a choice
// label's words, its icon row inside the card, and its writes (/edit for JSON, one reword for `.scene`).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nodes } from '../book/__tests__/combat-book.test.ts'; // the React Native stand-ins
import { bind, tagged } from './prose_rules.ts';

Object.assign(globalThis, { localStorage: { getItem: () => null, setItem() {} } });
const { attach, go, line, shut } = await import('./build/field.tsx');
const { header, icons, sceneLine, titled } = await import('./build/talk.tsx');
const { known } = await import('./build/room.tsx');
const { ed, refused, running, wire } = await import('./build/roomedit.tsx');
const { ink } = await import('./build/build.ts');
const { opened } = await import('./build/formwrite.ts');

const KEY = 'dialogue.cook_lesson.choices.first.label';
const REF = 'kit@0.0.1:dialogue/cook_lesson';
let SCENE = '"Want to learn the pot?" the cook asks.\n- Ask about fish #first\n  ~\n';
const seen = new Map<string, string>();
const said = new Map<string, string>();
const sent: [string, any][] = [];
let answers: [number, unknown][] = [];
let on = true;
let choice: Record<string, unknown> = {}; // the canon's choice `first`
const tick = () => new Promise((r) => setTimeout(r));
const api = async (path: string, body?: object): Promise<[number, any]> => {
  sent.push([path.split('?')[0], body]);
  if (!path.startsWith('/source')) return answers.shift()!;
  return SCENE ? [200, { bytes: SCENE, sha256: 's1' }] : [404, 'gone']; // '' is a deleted file
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

// Breaks: an unwritten label's dashed rule drawn under the whole line (its icon row too), or lost.
test("an unwritten label's rule sits under its hint only", () => {
  const out = line(label('world/cook.json', '~') as any) as any;
  const ruled = (style: unknown) => [style].flat().some((s: any) => s?.borderBottomWidth);
  assert.equal(ruled(out.style), false);
  assert.deepEqual(
    out.children.filter((n: any) => ruled(n?.props?.style)).map((n: any) => n.key),
    ['blank'],
  );
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
// reword aimed at the wrong line or without the source's sha; the def sheet's icons on a `.scene`.
test('a .scene label commits one reword at its own line, no /set', async () => {
  sent.length = 0;
  const p = label('world/cook.scene');
  assert.equal(icon(p, 'when'), undefined, 'a .scene choice drew the JSON icons');
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

// Breaks: an empty `then` drawn lit (goes looks set), or a set field drawn dim; goes with no
// destination opening the Add… menu, which never offers `then` (choices.tsx LINKS).
test('an empty then draws goes dim and opens the then fold; a set field draws lit', () => {
  choice = { steps: [{ say: 'x' }] };
  const p = label('world/cook.json');
  const color = (name: string) => icon(p, name).props.style.color;
  assert.equal(color('goes'), ink('dim'));
  assert.equal(color('when'), ink('dim'));
  assert.equal(color('does'), ink('action'));
  icon(p, 'goes').props.onPress(stop);
  assert.ok(opened.has('world/cook.json:["choices","first","then"]'));
  choice = {};
});

// Breaks: a choice key repeated in a nested set rewording the first match, another choice's line.
test('a .scene label whose key repeats opens no reword', async () => {
  label('world/cook.scene');
  const was = SCENE;
  SCENE = '- Ask about fish #first\n  - Ask again #first\n'; // the nested set's dialogue is another
  assert.equal(await sceneLine(KEY), undefined);
  SCENE = ''; // Breaks: a deleted source rejecting (an unhandled rejection) instead of no field.
  assert.equal(await sceneLine(KEY), undefined);
  SCENE = was;
});

// Breaks: a Checks row naming a label on this page sent to the owner's editor, not its field here.
test('a Checks row for a label on the page opens its field here', async () => {
  label('world/cook.json');
  answers = [[200, { file: 'world/cook.json', line: 7, was: 'w1', words: 'Ask about fish' }]];
  assert.equal(go(KEY), true);
  await tick();
  shut();
});

/** The field's note as drawn under the label (field.tsx `say`). */
const note = (p: object) => JSON.stringify(drawn(p)).match(/Changed on disk[^"]*/)?.[0];
async function stale(theirs: string) {
  const p = label('world/cook.scene');
  icon(p, 'words').props.onPress(stop);
  await tick();
  const input = drawn(p).find((n) => n.type === 'TextInput');
  input.props.onChangeText('Ask about eels');
  [SCENE, answers] = [theirs, [[409, 'stale']]];
  input.props.onSubmitEditing();
  await tick();
  await tick();
  return p;
}

// Breaks: a `.scene` 409 not reading the line again (their words unshown), or reading words from a
// source that lost the choice (a throw, the field stuck open with no Open source).
test('a .scene label that changed on disk shows their words, or Open source when it is gone', async () => {
  const was = SCENE;
  assert.equal(
    note(await stale('- Ask about cod #first\n')),
    'Changed on disk since you opened it. Ask about cod',
  );
  shut();
  assert.equal(note(await stale('- Other #second\n')), 'Changed on disk since you opened it.');
  shut();
  SCENE = was;
});

/** A game whose talk with the cook waits on its prompt; `policy` is the dialogue's. */
const talking = (policy?: object) =>
  ({
    game: {
      view: () => ({ view: { choice: { prompt: { key: 'dialogue.cook_lesson.prompt' } } } }),
    },
    canon: () => ({ dialogues: { [REF]: { policy } } }),
  }) as any;
const pens = (row: any[]) =>
  row
    .filter(Boolean)
    .map((n) => n.props.accessibilityLabel)
    .filter(Boolean);

// Breaks: Add choice or Add line aimed at the wrong line (inside a nested set, before the words, at
// a blank run), a refused add shown as nothing, an add with no Undo entry, the policy words drawn as
// a button, or Add line drawn for a JSON dialogue.
test('the header adds a .scene choice after the last top-level block and words before the first choice', async () => {
  label('world/cook.scene');
  const was = SCENE;
  SCENE = 'One.\nTwo.\n\n- A #first\n  ~\n- B #second\n  - Deep #third\n';
  const row = header(talking(), () => {})!;
  assert.deepEqual(pens(row), ['when it is offered', '＋ Add choice', '＋ Add line']);
  const words = row.find((n: any) => n?.key === 'when');
  assert.equal(words.props.children, 'Offered when: always · repeats ');
  assert.equal(words.props.accessibilityRole, undefined); // only ⚙→ is the act
  const add = async (name: string, told: [number, unknown] = [409, 'stale']) => {
    sent.length = 0;
    answers = [told];
    row.find((n: any) => n?.props.accessibilityLabel === name).props.onPress(stop);
    while (running()) await tick();
    return sent[1][1].op.add;
  };
  assert.deepEqual(await add('＋ Add choice'), { after: 6, kind: 'choice' });
  assert.equal(refused(), 'stale');
  assert.deepEqual(await add('＋ Add line'), { after: 2, kind: 'words' });
  SCENE = '- A #first\n  ~\n'; // a choice on the first line: no words before it
  assert.deepEqual(await add('＋ Add choice'), { after: 1, kind: 'choice' });
  assert.deepEqual(await add('＋ Add line'), { after: 0, kind: 'words' });
  const undos = ed.undoable();
  await add('＋ Add line', [200, { id: 9 }]);
  assert.deepEqual([ed.undoable() - undos, ed.last()], [1, [9]]); // one Undo entry, as the JSON path
  SCENE = was;
  label('world/cook.json');
  assert.deepEqual(pens(header(talking(), () => {})!), ['when it is offered', '＋ Add choice']);
});

// Breaks: a JSON Add choice not opening the def sheet at its choices; titled drawing a fragment or
// nothing when only the header has something to draw, or a header with no talk waiting.
test('a JSON Add choice opens the choices fold; titled draws the header alone, or nothing', () => {
  label('world/cook.json');
  let shown = '';
  const row = header(talking(), (id) => (shown = id))!;
  row.find((n: any) => n?.props.accessibilityLabel === '＋ Add choice').props.onPress(stop);
  assert.equal(shown, 'def:world/cook.json');
  assert.ok(opened.has('world/cook.json:["choices"]'));
  assert.ok(Array.isArray(titled(talking(), () => {})));
  assert.equal(
    titled({ canon: () => ({}) } as any, () => {}),
    undefined,
  );
});

// Breaks (F20, F7 of loka-hcnlh.101): a person's or item's title read by its file words alone, so
// a new `~` name (drawn with its key's marks) or a refused compile's (file words not those drawn)
// gets no name pencil; two keys bound to the same words getting one.
test("a person's or item's title gets its name pencil by the words the page bound", () => {
  const keys: (string | undefined)[] = [];
  attach({
    on: () => true,
    seen,
    said,
    redraw() {},
    focus() {},
    commit() {},
    api,
    wrote() {},
    pencil: (_shown, key) => (keys.push(key), key && 'pen'),
  });
  const title = (key: string, words: string) => {
    const shown = tagged(key, words);
    bind(seen, shown, key);
    return line({ accessibilityRole: 'header', children: shown } as any).children;
  };
  said.set('npc.wren.name', '~');
  title('npc.wren.name', '~');
  said.set('item.lamp.name', 'Old lamp'); // the refused file's words
  title('item.lamp.name', 'Lamp');
  bind(seen, 'Hen', 'item.hen.name');
  title('npc.hen.name', 'Hen');
  assert.deepEqual(keys, ['npc.wren.name', 'item.lamp.name', undefined]);
});
