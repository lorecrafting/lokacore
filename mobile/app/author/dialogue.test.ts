// The Dialogue sheet (author/build/choices.tsx, generic.tsx's gate; slice 5.1a) and the Person
// sheet's Add dialogue (thing.tsx): each gesture's posts on a fake builder api, literal values.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { nodes } from '../book/__tests__/combat-book.test.ts'; // also registers the .tsx loader

const { story } = await import('./build/room.tsx');
const { sheets } = await import('./build/sheet.tsx');
const { refused } = await import('./build/roomedit.tsx');
await import('./build/Build.tsx'); // the app's registration of the def: and npc: sheets

const root = new URL('../../../', import.meta.url);
const read = (rel: string) => JSON.parse(readFileSync(new URL(rel, root), 'utf8'));
const defs = read('schemas/source/defs.schema.json').$defs;
const settle = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r));
};

const files = new Map<string, unknown>([
  ['cartridge.json', { requires: { capabilities: {} } }],
  ['npcs/smith.json', { room: 'r' }],
  ['dialogues/side_set.json', { entry: false, prompt: 'side.p', choices: {} }],
]);
const NODES = [
  { kind: 'npc', ref: 'c:npc/smith' },
  { kind: 'dialogue', ref: 'c:dialogue/side_set' },
];
const FILES = {
  'c:npc/smith': 'npcs/smith.json',
  'c:dialogue/side_set': 'dialogues/side_set.json',
};
const posts: { route: string; sent: any }[] = [];
const opens: string[] = [];
async function api(path: string, sent?: any): Promise<[number, any]> {
  if (path === '/new') {
    posts.push({ route: 'new', sent });
    files.set(`dialogues/${sent.name}.json`, {
      choices: { a: { label: 'x.a', narration: 'x.n' } },
    });
    return [200, { id: 1, files: [`dialogues/${sent.name}.json`] }];
  }
  if (sent) return (posts.push({ route: path.slice(1), sent }), [200, { id: 1 }]);
  if (path === '/story')
    return [200, { map: [], graph: { nodes: NODES }, files: FILES, hidden: [], unlinkable: {} }];
  const dir = /^\/schema\/(\w+)$/.exec(path)?.[1];
  if (dir) {
    const stub = read(`schemas/source/${dir}.schema.json`);
    return [200, { ...stub, $ref: stub.$ref.replace(/^defs\.schema\.json/, ''), $defs: defs }];
  }
  const file = decodeURIComponent(path.split('file=')[1]);
  return files.has(file)
    ? [200, { bytes: JSON.stringify(files.get(file)), sha256: 'S', kind: file.split(/[/.]/)[0] }]
    : [404, null];
}
story(
  api,
  () => {},
  () => {},
  (id) => opens.push(id),
);
await settle();

let n = 0;
/** Dialogue `doc` on a fresh sheet with its choices block (and `fold`s) open; nothing sent yet. */
async function sheet(doc: object, ...fold: string[]) {
  const file = `dialogues/d${n++}.json`;
  files.set(file, doc);
  sheets.def.body(file);
  await settle();
  const shown = () => nodes(sheets.def.body(file));
  const press = async (key: string) => {
    const b = shown().find((x) => x.props?.accessibilityRole === 'button' && x.key === key);
    assert.ok(b, `no button ${key}`);
    b.props.onPress();
    await settle();
  };
  for (const p of [['choices'], ...fold.map((k) => ['choices', ...k.split('.')])])
    await press(`fold ${file}:${JSON.stringify(p)}`);
  posts.length = 0;
  return { file, shown, press };
}
const ONE = { choices: { a: { label: 'x.a', narration: 'x.n' } } };
const typeKey = (s: Awaited<ReturnType<typeof sheet>>, k: string) =>
  s
    .shown()
    .find((x) => x.props?.accessibilityLabel === 'Choice key')
    .props.onChangeText(k);

// Breaks: Add choice writing anything but the schema's least choice (both text keys `~`), at
// another path, or as more than one /change.
test('Add choice yes sends one /change of the least choice at choices.yes', async () => {
  const s = await sheet(ONE);
  typeKey(s, 'yes ');
  await s.press(`add choice ${s.file}:["choices","+"]`);
  assert.deepEqual(posts, [
    {
      route: 'change',
      sent: {
        file: s.file,
        was: 'S',
        ops: [
          { path: ['choices', 'yes'], value: { label: { prose: '~' }, narration: { prose: '~' } } },
        ],
      },
    },
  ]);
});

// Breaks: a taken key, a link a quest dialogue refuses, the last choice's Remove or a root write
// adding a compile refusal (generic.tsx's gate) still sent, or its refusal not shown.
test('a refused key, link, remove or gated write sends nothing and shows why', async () => {
  const s = await sheet(ONE, 'a');
  typeKey(s, 'a');
  await s.press(`add choice ${s.file}:["choices","+"]`);
  assert.deepEqual([posts.length, refused()], [0, 'already a']);
  await s.press(`remove choice ${s.file}:["choices","a"]`);
  assert.deepEqual([posts.length, refused()], [0, 'a dialogue keeps one choice at least']);
  const q = await sheet({ ...ONE, quest: 'q' }, 'a', 'a.then');
  await q.press(`link side_set ${q.file}:["choices","a","then"]`);
  assert.deepEqual([posts.length, refused()], [0, 'a quest ends the talk: no then']);
  const c = await sheet({ choices: { a: { label: 'x.a', narration: 'x.n', check: {} } } });
  await c.press(`mechanic ${c.file}:["+mechanic"]`);
  await c.press(`mechanic quest ${c.file}:["+mechanic"]`); // revealed empty: nothing to write yet
  const quest = c.shown().find((x) => x.props?.accessibilityLabel === 'quest');
  quest.props.onChangeText('q');
  quest.props.onBlur();
  await settle();
  assert.deepEqual(
    [posts.length, refused()],
    [0, 'a: a check choice is never in a dialogue with a quest'],
  );
});

// Breaks: a picked target not written at the link's path, Clear writing anything but a delete, a
// choice's own field hidden, the linked target not marked or its nested set not drawn, or
// then_failed drawn without a check (or hidden with one).
test("then: 'side_set' is written, and Clear drops the field", async () => {
  const s = await sheet(ONE, 'a', 'a.then');
  await s.press(`link side_set ${s.file}:["choices","a","then"]`);
  const set = posts.map((p) => p.sent.ops);
  const t = await sheet(
    { choices: { a: { label: 'x.a', narration: 'x.n', then: 'side_set' } } },
    'a',
    'a.then',
  );
  const keys = (x: typeof s) => x.shown().map((b) => b.key);
  const failed = (x: typeof s) => keys(x).includes(`fold ${x.file}:["choices","a","then_failed"]`);
  const link = t.shown().find((b) => b.key === `link side_set ${t.file}:["choices","a","then"]`);
  assert.deepEqual(
    [
      keys(s).includes(`${s.file}:["choices","a","label"]`),
      link.props.accessibilityState,
      keys(t).includes('open side_set'),
      failed(t),
      failed(await sheet({ choices: { a: { ...ONE.choices.a, check: {} } } }, 'a')),
    ],
    [true, { selected: true }, true, false, true],
  );
  await t.press(`clear ${t.file}:["choices","a","then"]`);
  assert.deepEqual(
    [...set, ...posts.map((p) => p.sent.ops)],
    [
      [{ path: ['choices', 'a', 'then'], value: 'side_set' }],
      [{ path: ['choices', 'a', 'then'], delete: true }],
    ],
  );
});

// Breaks: Add dialogue posting another kind or name, the npc written as anything but the person's
// key or to another file, or the new sheet not opened.
test('Add dialogue posts /new dialogues dialogue_1, then sets its npc and opens it', async () => {
  posts.length = 0;
  sheets.npc.body('smith');
  await settle();
  const b = nodes(sheets.npc.body('smith')).find((x) => x.key === 'dialogue smith');
  b.props.onPress();
  await settle();
  assert.deepEqual(posts.splice(0), [
    { route: 'new', sent: { kind: 'dialogues', name: 'dialogue_1' } },
    {
      route: 'change',
      sent: {
        file: 'dialogues/dialogue_1.json',
        was: 'S',
        ops: [{ path: ['npc'], value: 'smith' }],
      },
    },
  ]);
  assert.deepEqual(opens.at(-1), 'def:dialogues/dialogue_1.json');
});
