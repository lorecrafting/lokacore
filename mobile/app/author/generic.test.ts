// The generic sheet (author/build/generic.tsx, form.tsx; design §7, slice 2.3): every registry row
// whose book verb is `generic` (kernel/ts/play/registry.json, held by bin/editor_gate.exs) is
// added, edited or removed by the sheet, each a `/change` op at the row's own path.
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
// kernel/ts/play/guard.ts ROOTS: one file each (mobile/app reaches the kernel only through local-story)
const ROOTS = ['cartridge', 'facts', 'text', 'resources', 'attributes', 'layout'];
const settle = () => new Promise((r) => setTimeout(r));

const files = new Map<string, unknown>();
const posts: { file: string; ops: { path: unknown[]; value?: unknown; delete?: true }[] }[] = [];
/** The builder api: each file's source and its kind's `/schema/<dir>` as write.ts answers it. */
async function api(path: string, sent?: any): Promise<[number, any]> {
  if (sent) return (posts.push(sent), [200, { id: 1 }]);
  if (path === '/story') return [200, { map: [], graph: { nodes: [] }, files: {} }];
  if (path === '/templates') return [200, []];
  const dir = /^\/schema\/(\w+)$/.exec(path)?.[1];
  if (dir === 'outline') return [404, null]; // write.ts serves no /schema/outline (guard.ts DIRS)
  if (dir) {
    const stub = read(`schemas/source/${dir}.schema.json`);
    return [200, { ...stub, $ref: stub.$ref.replace(/^defs\.schema\.json/, ''), $defs: defs }];
  }
  const file = decodeURIComponent(path.split('file=')[1]);
  const kind = file.split(/[/.]/)[0];
  return files.has(file)
    ? [200, { bytes: JSON.stringify(files.get(file)), sha256: 'S', kind }]
    : [404, null];
}
const load = () =>
  story(
    api,
    () => {},
    () => {},
    () => {},
  );
load();
await settle();

let n = 0;
/** `doc` opened as a fresh file of `kind`: its sheet's nodes, redrawn on each call. */
async function opened(kind: string, doc: unknown) {
  const file = ROOTS.includes(kind) ? `${kind}.json` : `${kind}/f${n++}.json`;
  files.set(file, doc);
  if (ROOTS.includes(kind)) (load(), await settle()); // a new /story: the sheet reads the file again
  sheets.def.body(file);
  await settle();
  await settle();
  const shown = () => nodes(sheets.def.body(file));
  const press = async (key: string) => {
    const b = shown().find(
      (x) => x.props?.accessibilityRole === 'button' && String(x.key).startsWith(key),
    );
    if (!b) return false;
    b.props.onPress();
    await settle();
    return true;
  };
  return { file, shown, press };
}

const VARIANTS = [{}, { command: 'x' }, { abstract: true }, { extends: 'x' }]; // definitionOf's branches
const button = (s: { shown: () => any[] }, w: string) =>
  s.shown().find((x) => x.props?.accessibilityRole === 'button' && words(x) === w);
const sent = () => posts.splice(0).flatMap((p) => p.ops);
/** The nodes inside the block at `path`. */
const within = (s: { file: string; shown: () => any[] }, path: unknown[]) =>
  nodes(s.shown().find((x) => x.key === `${s.file}:${JSON.stringify(path)}`)?.props.children);
/** `t` typed into the block at `path`'s input, then the input left: the ops it sends. */
async function typeIn(s: { file: string; shown: () => any[] }, path: unknown[], t: string) {
  const input = within(s, path).find((x) => x.props?.onBlur);
  input.props.onChangeText(t);
  input.props.onBlur();
  await settle();
  return sent();
}

/** The writes one gesture on field `f` of `doc` sends, the field found as `op` needs it. */
async function gesture(kind: string, f: string, op: string, doc: Record<string, unknown>) {
  const s = await opened(kind, doc);
  sent();
  if (op === 'delete') {
    if (await s.press(`remove ${s.file}:${JSON.stringify([f])}`)) return sent();
    const entry = (await edit(s, [f]), sent()).find((o) => o.path.length === 2); // a required map: one entry
    if (!entry) return [];
    const t = await opened(kind, { ...doc, [f]: { [entry.path[1]]: entry.value } });
    await edit(t, [f], () => {});
    sent();
    return (await t.press(`remove ${t.file}:${JSON.stringify(entry.path)}`), sent());
  }
  if (op === 'create') {
    button(s, 'Add…')?.props.onPress();
    await settle();
    const b = button(s, f);
    if (!b) return [];
    b.props.onPress();
    await settle();
    const got = sent();
    if (got.length) return got;
  }
  return (await edit(s, [f]), sent());
}

/** One edit inside the block at `path`: typed into its input, else a pick, an Add item or an Add… field. */
async function edit(s: { file: string; shown: () => any[] }, path: unknown[], then?: () => void) {
  const key = `${s.file}:${JSON.stringify(path)}`;
  const inside = () => within(s, path);
  const hit = (pred: (x: any) => boolean) =>
    inside().find((x) => x.props?.accessibilityRole === 'button' && pred(x));
  const press = async (x: any) => x && (x.props.onPress(), await settle(), true);
  await press(hit((x) => String(x.key) === `fold ${key}` && !x.props.accessibilityState?.expanded));
  if (then) return then();
  const typed = inside().find((x) => x.props?.onBlur);
  const t = typed?.props.defaultValue === '7' ? '8' : '7'; // a change: the same words write nothing
  if (typed) return (typed.props.onChangeText(t), typed.props.onBlur(), await settle());
  const named = inside().find((x) => x.props?.accessibilityLabel === 'Key');
  if (named) named.props.onChangeText('k');
  if (named && (await press(hit((x) => String(x.key).startsWith('entry '))))) return;
  if (await press(hit((x) => x.props.accessibilityState?.selected === false))) return;
  if (await press(hit((x) => words(x) === 'Add item'))) return;
  if (!(await press(hit((x) => words(x) === 'Add…')))) return;
  await press(hit((x) => String(x.key).startsWith('add ') && words(x) !== 'Add…'));
  if (!posts.length) await press(hit((x) => x.props.accessibilityState?.selected === false)); // drawn empty: pick its value
}

const rows = Object.entries(read('kernel/ts/play/registry.json') as Record<string, any>).flatMap(
  ([p, r]) =>
    Object.keys(r.book ?? {})
      .filter((op) => r.book[op] === 'generic')
      .map((op) => [p, op]),
);
assert.ok(rows.length > 0);
for (const [p, op] of rows) {
  const [kind, f] = p.split('.');
  test(`${p}.book.${op}`, async () => {
    let ops: any[] = [];
    for (const v of ROOTS.includes(kind) ? [{}] : VARIANTS) {
      ops = await gesture(kind, f, 'create', { ...v });
      if (op !== 'create') ops = await gesture(kind, f, op, { ...v, [f]: ops[0]?.value ?? '7' });
      if (ops.length) break;
    }
    assert.deepEqual(
      ops.map((o) => o.path[0]),
      [f],
    );
    if (op === 'delete') assert.equal(ops[0].delete, true);
  });
}

// Breaks: a number written as text, or rewritten unchanged; an optional constant's On or Off, a
// list's Move up or Copy, or a text's words writing the wrong value or path; a union's picker
// marking the wrong branch; a map's Add over an existing key.
test('each gesture writes the exact value at the exact path', async () => {
  const s = await opened('statuses', {
    fear: true,
    tick_every: 5,
    allows: ['a', 'b'],
    duration: 'permanent',
    name: { prose: 'x' },
  });
  sent();
  assert.deepEqual(await typeIn(s, ['tick_every'], '5'), []);
  assert.deepEqual(await typeIn(s, ['tick_every'], 'six'), []);
  assert.deepEqual(await typeIn(s, ['tick_every'], '6'), [{ path: ['tick_every'], value: 6 }]);
  assert.deepEqual(await typeIn(s, ['name'], 'y'), [{ path: ['name'], value: { prose: 'y' } }]);
  await s.press(`on ${s.file}:["fear"]`);
  await s.press(`remove ${s.file}:["fear"]`);
  assert.deepEqual(sent(), [
    { path: ['fear'], value: true },
    { path: ['fear'], delete: true },
  ]);
  const selected = within(s, ['duration']).filter((x) => x.props?.accessibilityState?.selected);
  assert.deepEqual(
    selected.map((x) => String(x.key)),
    ['branch 1'],
  );
  await edit(s, ['allows'], () => {}); // unfolded
  const list = () => within(s, ['allows']);
  for (const k of ['up 1', 'copy 0']) {
    list()
      .find((x) => x.key === k)
      .props.onPress();
    await settle();
    await settle();
  }
  assert.deepEqual(sent(), [
    { path: ['allows'], value: ['b', 'a'] },
    { path: ['allows'], value: ['a', 'a', 'b'] },
  ]);
  const f = await opened('facts', { facts: { lit: { type: 'boolean', initial: false } } });
  await edit(f, ['facts'], () => {}); // unfolded
  sent();
  for (const k of ['lit', 'new']) {
    within(f, ['facts'])
      .find((x) => x.props?.accessibilityLabel === 'Key')
      .props.onChangeText(k);
    within(f, ['facts'])
      .find((x) => String(x.key).startsWith('entry '))
      .props.onPress();
    await settle();
  }
  assert.deepEqual(
    sent().map((o) => o.path),
    [['facts', 'new']],
  );
});
