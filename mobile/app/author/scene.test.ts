// A scene's rows in Build (slice 5.2, scene-structure-rulings §1, §3-§5): `.scene` line acts and
// `.cut` page acts through one /restructure on the shown bytes, a refused act greyed with why and
// sending nothing, a modal trigger's switch and the op's Undo.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nodes } from '../book/__tests__/combat-book.test.ts'; // the React Native stand-ins

Object.assign(globalThis, { localStorage: { getItem: () => null, setItem() {} } });
const { lines, pages, scenic } = await import('./build/scene.tsx');
const { known } = await import('./build/room.tsx');
const { onSaved, refused, running, wire } = await import('./build/roomedit.tsx');
const { opened } = await import('./build/formwrite.ts');
const { ink } = await import('./build/build.ts');

const files: Record<string, string> = {};
const sent: [string, any][] = [];
let answer: [number, unknown] = [409, 'stale'];
const tick = () => new Promise((r) => setTimeout(r));
const api = async (path: string, body?: any): Promise<[number, any]> => {
  if (path.startsWith('/source')) {
    const file = decodeURIComponent(path.split('file=')[1] ?? '');
    return file in files ? [200, { bytes: files[file], sha256: `sha ${file}` }] : [404, 'gone'];
  }
  sent.push([path.split('?')[0], body]);
  return answer;
};
wire(
  api,
  () => {},
  () => {},
);
const stop = { stopPropagation() {} };
let prevented = 0;
/** A keydown on line `n`'s row, its target a `tag`. */
async function key(all: any[], file: string, n: number, k: string, alt = true, tag = 'DIV') {
  sent.length = 0;
  const row = all.find((x) => x.key === `${file}:${n}`).props.children[0];
  row.props.onKeyDown({
    altKey: alt,
    key: k,
    target: { tagName: tag },
    preventDefault: () => prevented++,
  });
  while (running()) await tick();
}
const ops = () => sent.map(([, b]) => b.op);

/** `file`'s drawn rows once its bytes are read, with line `n` opened. */
async function drawn(draw: () => unknown, file: string, n: number) {
  known.files = {}; // a new /story: read again
  draw();
  await tick();
  opened.add(`${file}:${n}`);
  return nodes(draw());
}
/** The act or greyed act named `name`: a button whose first words are it. */
const named = (all: any[], name: string) =>
  all.find(
    (x) =>
      x.props?.accessibilityRole === 'button' &&
      nodes(x.props.children)[0]?.props?.children === name,
  );
async function press(el: any) {
  sent.length = 0;
  el.props.onPress(stop);
  while (running()) await tick();
}

// Breaks: a move aimed at the wrong line or direction, or sent at a hash other than the bytes shown.
test('Move down on line 3 sends one /restructure of {move:3, by:1} at the shown sha', async () => {
  files['scenes/a.scene'] = 'npc: bram\n\n- A #a\n  * x\n- B #b\n  * y\n';
  const all = await drawn(() => lines('scenes/a.scene'), 'scenes/a.scene', 3);
  await press(named(all, 'Move down line 3'));
  assert.deepEqual(sent, [
    [
      '/restructure',
      { file: 'scenes/a.scene', was: 'sha scenes/a.scene', op: { move: 3, by: 1 }, carry: [] },
    ],
  ]);
  opened.add('scenes/a.scene:5');
  await press(named(nodes(lines('scenes/a.scene')), 'Move up line 5'));
  assert.deepEqual(ops(), [{ move: 5, by: -1 }]);
});

// Breaks: Alt-arrows not moving the line, a plain arrow or a key typed in an input moving it, or the
// page scrolling as well (no preventDefault).
test('Alt-ArrowUp on a row moves its line; without Alt or inside an input it does nothing', async () => {
  const file = 'scenes/a.scene';
  const all = await drawn(() => lines(file), file, 5);
  await key(all, file, 5, 'ArrowUp', false);
  await key(all, file, 5, 'ArrowUp', true, 'INPUT');
  assert.deepEqual([ops(), prevented], [[], 0]);
  await key(all, file, 5, 'ArrowUp');
  assert.deepEqual([ops(), prevented], [[{ move: 5, by: -1 }], 1]);
});

// Breaks: bytes changed under a new /story still drawn as first read; Add's kinds not opening or
// sending the wrong kind; a kind's label (`words line`, a bare `choice`) mangled.
test('a new /story re-reads the lines; Add after, words line sends {add:{after, kind}}', async () => {
  const file = 'scenes/a.scene';
  files[file] = 'npc: bram\n\n- A #a\n  * x\n- C #c\n  * y\n';
  let all = await drawn(() => lines(file), file, 3);
  assert.ok(named(all, 'Move up line 5'));
  assert.ok(
    nodes(all).some((x) => x.props?.children === '- C #c'),
    'the old bytes still drawn',
  );
  await press(named(all, 'Add after line 3'));
  all = nodes(lines(file));
  assert.ok(named(all, 'choice') && !named(all, 'choice line'), 'a kind not a line is bare');
  await press(named(all, 'words line'));
  assert.deepEqual(ops(), [{ add: { after: 3, kind: 'words' } }]);
});

// Breaks: a refused act drawn pressable, without its reason, or sending anyway (by press or Alt-key).
test('a cross-depth move and an empty cut are greyed with the refusal and send nothing', async () => {
  files['scenes/b.scene'] = '- A #a\n  * x\n  - Deep #d\n- B #b\n';
  let all = await drawn(() => lines('scenes/b.scene'), 'scenes/b.scene', 3);
  const down = named(all, 'Move down line 3');
  assert.deepEqual(
    [down.props.disabled, nodes(down).at(-1).props.children],
    [true, 'no choice below'],
  );
  await key(all, 'scenes/b.scene', 3, 'ArrowDown');
  assert.deepEqual([sent, refused()], [[], 'no choice below']);
  files['scenes/c.cut'] = 'Mist.\n---\n';
  all = await drawn(() => pages('scenes/c.cut', false), 'scenes/c.cut', 1);
  const remove = named(all, 'Remove page 1');
  assert.deepEqual(
    [remove.props.disabled, nodes(remove).at(-1).props.children],
    [true, 'a cut needs a page'],
  );
});

// Breaks: Split offered on a page's first line, aimed at the wrong line, or not sent.
test('Split at a page’s second line sends {split: n}', async () => {
  files['scenes/d.cut'] = 'A.\n\nB.\nC.\n---\n';
  const all = await drawn(() => pages('scenes/d.cut', false), 'scenes/d.cut', 4);
  await press(named(all, 'Split page 2 at line 4'));
  assert.deepEqual(
    sent.map(([p, b]) => [p, b.op]),
    [['/restructure', { split: 4 }]],
  );
});

// Breaks: a page line drawn twice, a page's caption missing, misnumbered or after its first line, or
// the end mark drawn as a page (captioned, with acts); a page's Move up or Alt-ArrowDown aimed at the
// wrong line or direction.
test('a cut draws each line once under its page caption, its end mark bare; page moves send {move, by}', async () => {
  const file = 'scenes/d.cut';
  opened.add(`${file}:5`);
  const all = await drawn(() => pages(file, false), file, 3);
  assert.deepEqual(
    all
      .filter((x) => String(x.key).includes(file))
      .map((x) => [x.key, x.type, x.type === 'Text' ? x.props.children : '']),
    [
      [`page ${file}:1`, 'Text', 'page 1'],
      [`${file}:1`, 'View', ''],
      [`page ${file}:2`, 'Text', 'page 2'],
      [`${file}:3`, 'View', ''],
      [`${file}:4`, 'View', ''],
      [`${file}:5`, 'Text', '---'],
    ],
  );
  await press(named(all, 'Move up page 2'));
  assert.deepEqual(ops(), [{ move: 3, by: -1 }]);
  await key(all, file, 1, 'ArrowDown');
  assert.deepEqual(ops(), [{ move: 1, by: 1 }]);
  await key(all, file, 3, 'ArrowUp');
  assert.deepEqual(ops(), [{ move: 3, by: -1 }]);
});

// Breaks: after a move the row's acts closed or left on its old line, focus not following the row to
// its new line (above or below, a choice with its block, a page with its lines), or an added line
// not taking focus; a refused op moving either.
test('a moved row stays open and takes focus at its new line; an added line takes focus', async () => {
  const file = 'scenes/f.scene';
  const cutFile = 'scenes/f.cut';
  files[file] = 'npc: bram\n\n- A #a\n  * x\n- B #b\n  * y\n- C #c\n';
  files[cutFile] = 'A.\n\nB.\nC.\n---\n';
  /** Which drawn row of `draw` takes focus once drawn, and which rows of `file` are open. */
  const focused = (draw: () => unknown, f: string) => {
    let got = '';
    for (const x of nodes(draw()).filter((x) => String(x.key).startsWith(f)))
      x.props.children[0]?.props?.ref?.({ focus: () => (got = x.key) });
    return [got, [...opened].filter((k) => k.startsWith(f))];
  };
  let all = await drawn(() => lines(file), file, 3);
  answer = [409, 'stale'];
  await press(named(all, 'Move down line 3'));
  assert.deepEqual(
    focused(() => lines(file), file),
    ['', [`${file}:3`]],
  );
  answer = [200, { id: 8 }];
  await press(named(all, 'Move down line 3'));
  assert.deepEqual(
    focused(() => lines(file), file),
    [`${file}:5`, [`${file}:5`]],
  );
  await press(named(nodes(lines(file)), 'Move up line 5'));
  assert.deepEqual(
    focused(() => lines(file), file),
    [`${file}:3`, [`${file}:3`]],
  );
  await press(named(nodes(lines(file)), 'Add after line 3'));
  await press(named(nodes(lines(file)), 'words line'));
  opened.clear();
  assert.deepEqual(focused(() => lines(file), file)[0], `${file}:4`);
  all = await drawn(() => pages(cutFile, false), cutFile, 1);
  await press(named(all, 'Move down page 1'));
  assert.deepEqual(
    focused(() => pages(cutFile, false), cutFile),
    [`${cutFile}:4`, [`${cutFile}:4`]],
  );
  answer = [409, 'stale'];
});

// Breaks: a switch merging into the old on (its point and outcome left behind), or the trigger and
// treatment drawn for a scene that is not modal.
test('a trigger switch writes the whole new on; neither shows unless modal', async () => {
  known.story = { triggers: { points: {}, actions: {}, taken: {}, named: {} } } as any;
  const on = { story_point: 'lantern_resolved', outcome: 'carry' };
  files['scenes/dawn.json'] = JSON.stringify({ control: 'modal', on });
  const at = { file: 'scenes/dawn.json', was: 'sha scenes/dawn.json', defs: {}, seen: [] };
  assert.equal(scenic({ on })(at, ['treatment'], undefined, 'fade', true), null);
  assert.notEqual(scenic({ on })(at, ['on'], { type: 'object' }, on, false), null, 'the form’s on');
  const treatment = scenic({ control: 'modal', on })(
    at,
    ['treatment'],
    { type: 'string' },
    'fade',
    true,
  );
  assert.ok(
    !nodes(treatment).some((x) => x.key === 'kind start'),
    'the treatment is not a trigger',
  );
  const all = nodes(scenic({ control: 'modal', on })(at, ['on'], undefined, on, false));
  await press(all.find((x) => x.key === 'kind start'));
  assert.deepEqual(sent, [
    [
      '/change',
      {
        file: 'scenes/dawn.json',
        was: 'sha scenes/dawn.json',
        ops: [{ path: ['on'], value: { start: true } }],
      },
    ],
  ]);
});

// Breaks: an op leaving no Undo chip, or the chip holding some other id or more than one.
test('a page op raises the Undo chip with that op’s one id', async () => {
  let chip: number[] = [];
  onSaved((ids) => (chip = ids));
  files['scenes/e.cut'] = 'A.\nB.\n---\n';
  const all = await drawn(() => pages('scenes/e.cut', false), 'scenes/e.cut', 2);
  answer = [200, { id: 7 }];
  await press(named(all, 'Split page 1 at line 2'));
  assert.deepEqual(chip, [7]);
});

const AT = { file: 'scenes/dawn.json', was: 'sha scenes/dawn.json', defs: {}, seen: [] };
/** A modal dawn's trigger on `on`, under triggers `t` and graph nodes `ns`. */
function trigger(on: object, t: object, ns: object[]) {
  known.story = { triggers: { points: {}, actions: {}, taken: {}, named: {}, ...t } } as any;
  known.nodes = ns as any;
  return nodes(scenic({ control: 'modal', on })(AT, ['on'], undefined, on, false));
}
const lit = (x: any) => x?.props.accessibilityState?.selected;
const wrote = () => sent.map(([, b]) => b.ops[0].value);

// Breaks: a value pick writing another point's offer, an outcome pick writing another point, the
// lit kind or value not lit or drawn like the rest (not Map's selected box: the action fill, its
// words in the background colour), unoffered kinds drawn, or a press on the lit kind rewriting the on.
test('a point trigger: its kinds, values and outcomes lit and each pick writes its own on', async () => {
  const sp = (r: string) => ({ ref: `story_point/${r}`, kind: 'story_point' });
  const draw = () =>
    trigger({ story_point: 'p', outcome: 'a' }, { points: { p: ['a', 'b'], q: ['c'] } }, [
      sp('p'),
      sp('q'),
    ]);
  const all = draw();
  assert.deepEqual(
    all.filter((x) => /^kind /.test(x.key)).map((x) => [x.key, lit(x)]),
    [
      ['kind start', false],
      ['kind story_point', true],
    ],
  );
  assert.deepEqual(
    [lit(all.find((x) => x.key === 'value p')), lit(all.find((x) => x.key === 'value q'))],
    [true, false],
  );
  const box = (x: any) => [x.props.style.backgroundColor, x.props.children.props.style.color];
  assert.deepEqual(
    ['value p', 'value q'].map((k) => box(all.find((x) => x.key === k))),
    [
      [ink('action'), ink('bg')],
      [undefined, ink('action')],
    ],
  );
  await press(all.find((x) => x.key === 'kind story_point'));
  assert.deepEqual(sent, []);
  await press(all.find((x) => x.key === 'value q'));
  assert.deepEqual(wrote(), [{ story_point: 'q', outcome: 'c' }]);
  await press(draw().find((x) => x.key === 'outcome b'));
  assert.deepEqual(wrote(), [{ story_point: 'p', outcome: 'b' }]);
});

// Breaks: a quest's typed outcome not written on leaving the field, an unchanged or refused one
// written, the field missing, or the quest the scene left (`~ q`) not shown.
test('a quest trigger writes a typed outcome on blur, refuses a bad one, shows the quest left', async () => {
  const draw = () =>
    trigger(
      { quest: 'other_quest', outcome: 'completed' },
      { named: { dawn_quest: ['scene/dawn'] } },
      [],
    );
  const type = async (t: string) => {
    sent.length = 0;
    const input = draw().find((x) => x.props?.accessibilityLabel === 'outcome');
    input.props.onChangeText(t);
    input.props.onBlur();
    while (running()) await tick();
  };
  assert.ok(draw().some((x) => x.type === 'Text' && x.props.children === '~ dawn_quest'));
  await type('completed');
  assert.deepEqual(sent, []);
  await type('Not a key!');
  assert.deepEqual([sent, refused()], [[], 'not a key, or another scene starts on it']);
  await type('failed');
  assert.deepEqual(wrote(), [{ quest: 'other_quest', outcome: 'failed' }]);
});
