// The Dialogue sheet (author/build/choices.tsx, generic.tsx's gate; slice 5.1a) and the Person
// sheet's Add dialogue (thing.tsx): each gesture's posts on a fake builder api, literal values.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { nodes } from '../book/__tests__/combat-book.test.ts'; // also registers the .tsx loader

const { known, story } = await import('./build/room.tsx');
const { sheets } = await import('./build/sheet.tsx');
const { ed, refused } = await import('./build/roomedit.tsx');
const { BUSY } = await import('./build/formwrite.ts');
const store = { getItem: () => null, setItem() {} }; // Build's Undo chip keeps its state there
Object.assign(globalThis, { localStorage: store });
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
let held: Promise<void> | undefined;
let refuseOnce = false; // the next write is refused as stale, after held
const posts: { route: string; sent: any }[] = [];
const opens: string[] = [];
async function api(path: string, sent?: any): Promise<[number, any]> {
  if (path === '/new') {
    posts.push({ route: 'new', sent });
    const made = `areas/a/dialogues/${sent.name}.json`; // not dialogues/: the sheet takes /new's path
    files.set(made, { choices: { a: { label: 'x.a', narration: 'x.n' } } });
    return [200, { id: 2, files: [made] }];
  }
  if (sent) {
    posts.push({ route: path.slice(1), sent });
    await held; // a save still out while the test presses again
    if (refuseOnce) return ((refuseOnce = false), [409, 'stale']);
    return [200, { id: 1 }];
  }
  if (path === '/story')
    return [200, { map: [], graph: { nodes: NODES }, files: FILES, hidden: ['h'], unlinkable: {} }];
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

// Breaks: a choice's Flow opening a walk on anything but its own dialogue's node, or drawn on a
// dialogue /story names no node for.
test("a choice's Flow opens the walk on its dialogue's node; an unnamed file draws none", async () => {
  const s = await sheet(ONE, 'a');
  const flow = `flow ${s.file}:["choices","a"]`;
  assert.equal(s.shown().filter((x) => x.key === flow).length, 0);
  known.files['c:dialogue/flowing'] = s.file;
  await s.press(flow);
  assert.equal(opens.at(-1), 'flow:c:dialogue/flowing');
  delete known.files['c:dialogue/flowing'];
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

// Breaks: Add dialogue posting another kind or name, the npc or its role written as anything but
// the person's key (the starter's roles name another npc, so it would not compile) or to a file
// other than /new's, the two writes not one Undo step, or the new sheet not opened.
test('Add dialogue posts /new dialogues dialogue_1, then sets its npc and role and opens it', async () => {
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
        file: 'areas/a/dialogues/dialogue_1.json',
        was: 'S',
        ops: [
          { path: ['npc'], value: 'smith' },
          { path: ['roles'], value: { smith: { role: 'npc', npc: 'smith' } } },
        ],
      },
    },
  ]);
  assert.deepEqual([ed.last(), opens.at(-1)], [[2, 1], 'def:areas/a/dialogues/dialogue_1.json']);
});

// Breaks: a refusal from a press while a save is out dropped (run() returns early when busy).
test('a refusal pressed while a save is out is kept and shown', async () => {
  const s = await sheet(ONE, 'a', 'a.then');
  let release = () => {};
  held = new Promise((r) => (release = r));
  await s.press(`link side_set ${s.file}:["choices","a","then"]`);
  await s.press(`remove choice ${s.file}:["choices","a"]`);
  release();
  held = undefined;
  await settle();
  assert.deepEqual([posts.length, refused()], [1, 'a dialogue keeps one choice at least']);
});

// Breaks: a root Add… or Add mechanic… offering a field whose write the gate refuses (a name on a
// dialogue that teaches a hidden skill).
test('the root menus offer no field the gate would refuse', async () => {
  const doc = { choices: { a: { label: 'x.a', narration: 'x.n', steps: [{ skill: 'h' }] } } };
  const s = await sheet(doc);
  await s.press(`add ${s.file}:["+"]`);
  await s.press(`mechanic ${s.file}:["+mechanic"]`);
  const names = s
    .shown()
    .map((b) => b.key)
    .filter((k) => /^(add|mechanic) name /.test(k ?? ''));
  assert.deepEqual(names, []);
});

// Breaks: an Add… pick of a choice field written at another path or value, or an asked field
// (`sitting`) written instead of revealed.
test("a choice's Add… writes the picked field, and reveals an asked one unwritten", async () => {
  const s = await sheet(ONE, 'a');
  const menu = `${s.file}:["choices","a","+"]`;
  await s.press(`add ${menu}`);
  await s.press(`add sitting ${menu}`);
  await s.press(`add once ${menu}`);
  const op = { path: ['choices', 'a', 'once'], value: true };
  const sitting = s.shown().some((b) => b.key === `${s.file}:["choices","a","sitting"]`);
  assert.deepEqual(posts, [{ route: 'change', sent: { file: s.file, was: 'S', ops: [op] } }]);
  assert.equal(sitting, true);
});

// Breaks: an Add choice pressed while another save is out losing its typed key (loka-x1frg).
test('an Add choice pressed while a save is out keeps its key; Add again writes it', async () => {
  const s = await sheet(ONE, 'a', 'a.then');
  let release = () => {};
  held = new Promise((r) => (release = r));
  await s.press(`link side_set ${s.file}:["choices","a","then"]`);
  typeKey(s, 'no');
  await s.press(`add choice ${s.file}:["choices","+"]`);
  assert.equal(refused(), BUSY, 'the dropped Add said nothing');
  release();
  held = undefined;
  await settle();
  posts.length = 0;
  await s.press(`add choice ${s.file}:["choices","+"]`);
  assert.deepEqual(
    posts.map((p) => p.sent.ops[0].path),
    [['choices', 'no']],
    'the typed key was forgotten',
  );
});

// Breaks: a refusal arriving after newer typing puts the old key back over it, so the next Add writes
// the refused key while the field shows the new one (loka-x1frg review finding 2).
test('an Add refused after newer typing keeps the newer key; Add again writes it', async (t) => {
  const s = await sheet(ONE, 'a', 'a.then');
  let release = () => {};
  held = new Promise((r) => (release = r));
  t.after(() => (release(), (held = undefined), (refuseOnce = false))); // a failed assert leaks neither
  refuseOnce = true;
  typeKey(s, 'no');
  await s.press(`add choice ${s.file}:["choices","+"]`);
  typeKey(s, 'maybe');
  release();
  held = undefined;
  await settle();
  posts.length = 0;
  await s.press(`add choice ${s.file}:["choices","+"]`);
  assert.deepEqual(
    posts.map((p) => p.sent.ops[0].path),
    [['choices', 'maybe']],
    'the refused key overwrote the newer one',
  );
});
