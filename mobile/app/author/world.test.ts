// The World tab and the World card's block (author/build/world.tsx, slice 6.1a): a resource's new
// entry as newEntry makes it, a cartridge field picking a root file's key, and a capability's Turn
// on, after which Add mechanic… offers its field.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { nodes, words } from '../book/__tests__/combat-book.test.ts'; // also registers the .tsx loader

const { story } = await import('./build/room.tsx');
const { sheets } = await import('./build/sheet.tsx');
Object.assign(globalThis, { localStorage: { getItem: () => null, setItem() {} } }); // Build's Undo chip
await import('./build/Build.tsx'); // the app's registration of the def: and contents sheets
const { WORDS } = await import('./build/form.tsx');
const WORLD = (await import('./build/world.tsx')).WORDS;

const root = new URL('../../../', import.meta.url);
const read = (rel: string) => JSON.parse(readFileSync(new URL(rel, root), 'utf8'));
const defs = read('schemas/source/defs.schema.json').$defs;
const settle = () => new Promise((r) => setTimeout(r));

const caps = Object.fromEntries(
  (read('protocol/capability_registry.json') as { key: string; version: number }[]).map((c) => [
    c.key,
    c.version,
  ]),
);
const { commerce, ...lacking } = caps; // the fixture cartridge lacks commerce only
const files = new Map<string, any>([
  [
    'cartridge.json',
    {
      requires: { capabilities: lacking },
      entry: 'r1',
      world: { movement: { cost: { resource: 'mv' } } },
    },
  ],
  ['facts.json', { facts: {} }],
  ['resources.json', { resources: { gold: {} } }],
]);
const posts: { file: string; ops: { path: string[]; value?: unknown; delete?: true }[] }[] = [];
/** The builder api: a /change lands in `files` (as write.ts writes it), so the next /story rereads it. */
async function api(path: string, sent?: any): Promise<[number, any]> {
  if (sent) {
    posts.push(sent);
    for (const { path: p, value } of sent.ops) {
      let o = files.get(sent.file);
      for (const k of p.slice(0, -1)) o = o[k] ??= {};
      o[p.at(-1)] = structuredClone(value);
    }
    return [200, { id: posts.length }];
  }
  if (path === '/story')
    return [
      200,
      {
        map: [],
        graph: { nodes: [{ ref: 'r1', kind: 'room' }] },
        files: {}, // the /story names no root file (it maps ids to files)
      },
    ];
  if (path === '/templates' || path.startsWith('/fights')) return [200, []];
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
  () => {},
);
await settle();

/** Sheet `id`'s nodes once its reads settle, and a press on the button whose key starts `key`. */
async function opened(id: string) {
  const [name, arg] = id.startsWith('def:') ? ['def', id.slice(4)] : [id, undefined];
  const shown = () => nodes((sheets as any)[name].body(arg));
  const drawn = async () => {
    for (let i = 0; i < 4; i++) (shown(), await settle()); // each read a file's sheet starts
  };
  await drawn();
  const find = (key: string) =>
    shown().find((x) => x.props?.accessibilityRole === 'button' && String(x.key).startsWith(key));
  const press = async (key: string) => (find(key).props.onPress(), await drawn());
  return { shown, find, press };
}
/** The cartridge sheet with world.movement.cost unfolded. */
async function cartridge() {
  const s = await opened('def:cartridge.json');
  for (const path of [['world'], ['world', 'movement'], ['world', 'movement', 'cost']])
    if (
      s.find(`fold cartridge.json:${JSON.stringify(path)}`)?.props.accessibilityState?.expanded ===
      false
    )
      await s.press(`fold cartridge.json:${JSON.stringify(path)}`);
  return s;
}
const sent = () => posts.splice(0).flatMap((p) => p.ops.map((o) => [o.path.join('.'), o.value]));
/** Key `k` typed into sheet `s`'s new-entry field (its map unfolded at `fold` first), then Add. */
async function added(s: Awaited<ReturnType<typeof opened>>, fold: string, k: string) {
  const id = `${fold.slice(0, -1)},"+key"]`;
  const key = () =>
    nodes(s.shown().find((x) => x.key === id)?.props.children).find(
      (x) => x.props?.accessibilityLabel === WORDS.key,
    );
  if (!key()) await s.press(`fold ${fold}`);
  key().props.onChangeText(k);
  await s.press(`entry ${id}`);
}

// break: an unread resources.json counts as one with no keys, so a real key is refused (code review)
test('with resources.json unread, a cartridge resource field takes gold as free text', async () => {
  const [kept, cart] = [files.get('resources.json'), structuredClone(files.get('cartridge.json'))];
  files.delete('resources.json'); // before any test reads it
  const s = await cartridge();
  sent();
  const input = s.shown().find((x) => x.props?.defaultValue === 'mv' && x.props.onBlur);
  input.props.onChangeText('gold');
  input.props.onBlur();
  await settle();
  assert.deepEqual(sent(), [['world.movement.cost.resource', 'gold']]);
  files.set('resources.json', kept).set('cartridge.json', cart); // the /story test 3 sends rereads both
});

// break: a resource's new entry is the schema's least value, not the World card's (newEntry)
test('a resource New hp writes {}, focus the blank row, a key inside gold the least value', async () => {
  const s = await opened('def:resources.json');
  sent();
  await added(s, 'resources.json:["resources"]', 'hp');
  await added(await opened('def:resources.json'), 'resources.json:["resources"]', 'focus');
  await added(await opened('def:resources.json'), 'resources.json:["resources","gold"]', 'note');
  assert.deepEqual(sent(), [
    ['resources.hp', {}],
    ['resources.focus', { minimum: 0, maximum: 0, start: 0, gain: 0 }],
    ['resources.gold.note', ''], // a key inside an entry is not a new resource
  ]);
});

// break: Turn on writes elsewhere, or the cartridge is not read again, so shop stays greyed
test('Turn on commerce: one op at requires.capabilities.commerce, then npcs.shop is offered', async () => {
  files.set('npcs/n.json', {});
  story(
    api,
    () => {},
    () => {},
    () => {},
  );
  await settle();
  const shop = async () => {
    const s = await opened('def:npcs/n.json');
    if (!s.find('mechanic shop ')) await s.press('mechanic npcs/n.json');
    return s.find('mechanic shop ').props.accessibilityState;
  };
  assert.ok('disabled' in (await shop()), 'greyed before');
  const c = await opened('contents');
  await c.press(WORLD.tab);
  const keys = (pre: string) =>
    c
      .shown()
      .filter((x) => String(x.key).startsWith(pre))
      .map((x) => String(x.key));
  assert.deepEqual(keys('on '), ['on commerce']); // only what the cartridge lacks
  assert.deepEqual(
    c
      .shown()
      .filter((x) => /\.json$/.test(words(x)) && x.props?.onPress)
      .map(words),
    ['cartridge.json', 'facts.json', 'resources.json'], // the root files that read, in order
  );
  sent();
  await c.press('on commerce');
  assert.deepEqual(sent(), [['requires.capabilities.commerce', commerce]]);
  assert.ok(!('disabled' in ((await shop()) ?? {})), 'offered after');
});

// break: a resource field offers no keys, offers a room's, or takes a key no resources.json entry has
test('a cartridge resource field picks hp, ma, mv and resources.json keys; a room stays free text', async () => {
  files.get('resources.json').resources.focus ??= {}; // its own, so it runs alone
  const s = await cartridge();
  const at = (path: string[]) =>
    s.shown().find((x) => x.key === `picks cartridge.json:${JSON.stringify(path)}`);
  const picks = nodes(at(['world', 'movement', 'cost', 'resource'])?.props.children).filter(
    (x) => x.props?.onPress,
  );
  assert.deepEqual(picks.map(words), ['hp', 'ma', 'mv', 'gold', 'focus']); // the pools, then resources.json
  assert.equal(at(['entry']), undefined);
  sent();
  const input = s.shown().find((x) => x.props?.defaultValue === 'mv' && x.props.onBlur);
  input.props.onChangeText('nope');
  input.props.onBlur();
  await settle();
  assert.deepEqual(sent(), []);
  assert.ok(
    s.shown().some((x) => words(x) === 'no resource nope'),
    'the refusal shown',
  );
});
