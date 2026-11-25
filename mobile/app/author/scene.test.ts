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
  sent.length = 0;
  const row = all.find((x) => x.key === 'scenes/b.scene:3').props.children[0];
  row.props.onKeyDown({ altKey: true, key: 'ArrowDown', target: { tagName: 'DIV' } });
  while (running()) await tick();
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

// Breaks: a switch merging into the old on (its point and outcome left behind), or the trigger and
// treatment drawn for a scene that is not modal.
test('a trigger switch writes the whole new on; neither shows unless modal', async () => {
  known.story = { triggers: { points: {}, actions: {}, taken: {}, named: {} } } as any;
  const on = { story_point: 'lantern_resolved', outcome: 'carry' };
  files['scenes/dawn.json'] = JSON.stringify({ control: 'modal', on });
  const at = { file: 'scenes/dawn.json', was: 'sha scenes/dawn.json', defs: {}, seen: [] };
  assert.equal(scenic({ on })(at, ['treatment'], undefined, 'fade', true), null);
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
