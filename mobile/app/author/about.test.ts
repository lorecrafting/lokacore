// A field's schema description in the generic sheet (form.tsx `about`, loka-hcnlh.84): the panel's
// cards.test.ts :44, :70 and :104 ported. The expected words are the schema's own, read here.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { nodes, words } from '../book/__tests__/combat-book.test.ts'; // also registers the .tsx loader

const { story } = await import('./build/room.tsx');
const { sheets } = await import('./build/sheet.tsx');
await import('./build/Build.tsx'); // the app's registration of the def: sheet

const root = new URL('../../../', import.meta.url);
const read = (rel: string) => JSON.parse(readFileSync(new URL(rel, root), 'utf8'));
const defs = read('schemas/source/defs.schema.json').$defs;
const settle = () => new Promise((r) => setTimeout(r));
const every = (read('protocol/capability_registry.json') as { key: string; version: number }[]).map(
  (c) => [c.key, c.version],
);
const files = new Map<string, unknown>([
  ['cartridge.json', { requires: { capabilities: Object.fromEntries(every) } }], // every gate open
]);
/** The builder api: each file's source and its kind's `/schema/<dir>`, as write.ts answers them. */
async function api(path: string): Promise<[number, any]> {
  if (path === '/story') return [200, { map: [], graph: { nodes: [] }, files: {} }];
  if (path === '/templates' || path.startsWith('/users?')) return [200, []];
  const dir = /^\/schema\/(\w+)$/.exec(path)?.[1];
  if (dir) {
    const stub = read(`schemas/source/${dir}.schema.json`);
    return [200, { ...stub, $ref: stub.$ref.replace(/^defs\.schema\.json/, ''), $defs: defs }];
  }
  const file = decodeURIComponent(path.split('file=')[1] ?? '');
  return files.has(file)
    ? [200, { bytes: JSON.stringify(files.get(file)), sha256: 'S', kind: file.split('/')[0] }]
    : [404, null];
}
story(
  api,
  () => {},
  () => {},
  () => {},
);
await settle();

/** `doc` opened as `file`'s sheet; `press` the button whose key starts with `key`. */
async function opened(file: string, doc: unknown) {
  files.set(file, doc);
  sheets.def.body(file);
  await settle();
  await settle();
  const shown = () => nodes(sheets.def.body(file));
  const press = async (key: string) => {
    const b = shown().find((x) => x.props?.onPress && String(x.key).startsWith(key));
    assert.ok(b, `no button ${key}`);
    b.props.onPress();
    await settle();
  };
  return { shown, press };
}
const at = (s: { shown: () => any[] }, key: string) => s.shown().find((x) => x.key === key);

// Break (:44, :104): Add mechanic… shows bare field names, so the author cannot tell what `edible` or
// `sanctuary` does; or it shows the definition's words (ItemEdible's) for the field's own beside its `$ref`.
test("Add mechanic…'s options show their field's description", async () => {
  for (const [file, f, def] of [
    ['items/lute.json', 'edible', 'source.ItemDefinition'],
    ['rooms/top.json', 'sanctuary', 'source.RoomDefinition'],
  ]) {
    const s = await opened(file, { name: 'x' });
    await s.press(`mechanic ${file}:["+mechanic"]`);
    const option = s.shown().find((x) => String(x.key).startsWith(`mechanic ${f} `));
    assert.equal(words(option), `${f}${defs[def].properties[f].description}`);
    assert.equal(option.props.accessibilityLabel, f); // the description is its hint, not its name
  }
});

// Break: a nested Add… menu (an object field's absent fields) shows bare names.
test("an Add… option shows its field's description", async () => {
  const s = await opened('items/bun.json', { edible: { label: 'l', narration: 'n' } });
  await s.press('fold items/bun.json:["edible"]');
  await s.press('add items/bun.json:["edible","+"]');
  const amount = at(s, 'add amount items/bun.json:["edible","+"]');
  assert.equal(words(amount), `amount${defs.ItemEdible.properties.amount.description}`);
});

// Break (:70): a list item hides its description; the harp's one keyword is a bare `{$ref: Alias}`, so the
// words are the definition's.
test('a list item shows its description', async () => {
  const s = await opened('items/harp.json', { keywords: ['harp'] });
  await s.press('fold items/harp.json:["keywords"]');
  const item = at(s, 'items/harp.json:["keywords",0]');
  assert.ok(nodes(item).some((x) => words(x) === defs.Alias.description));
});

// Break (review): a refused mechanic, greyed with why, drops its description where the author decides
// whether to turn it on.
test("a greyed Add mechanic… row shows its field's description", async () => {
  files.set('cartridge.json', { requires: { capabilities: {} }, world: {} }); // every gate shut
  story(
    api,
    () => {},
    () => {},
    () => {},
  ); // a new /story reads cartridge.json again
  (await settle(), await settle());
  const s = await opened('items/flute.json', { name: 'x' });
  await s.press('mechanic items/flute.json:["+mechanic"]');
  const row = s.shown().find((x) => String(x.key).startsWith('mechanic edible '));
  assert.ok(
    nodes(row).some(
      (x) => words(x) === defs['source.ItemDefinition'].properties.edible.description,
    ),
  );
});
