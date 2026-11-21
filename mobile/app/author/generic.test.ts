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
const { WORDS } = await import('./build/form.tsx');

const root = new URL('../../../', import.meta.url);
const read = (rel: string) => JSON.parse(readFileSync(new URL(rel, root), 'utf8'));
const defs = read('schemas/source/defs.schema.json').$defs;
// kernel/ts/play/guard.ts ROOTS: one file each (mobile/app reaches the kernel only through local-story)
const ROOTS = ['cartridge', 'facts', 'text', 'resources', 'attributes', 'layout'];
const settle = () => new Promise((r) => setTimeout(r));

const files = new Map<string, unknown>();
const every = Object.fromEntries(
  (read('protocol/capability_registry.json') as { key: string; version: number }[]).map((c) => [
    c.key,
    c.version,
  ]),
);
const CART = { requires: { capabilities: every }, world: { combat: {} } }; // every gate open: rows sit in Add mechanic…
files.set('cartridge.json', CART);
let hash = 'S'; // every file's sha256 now
const stale = new Set<string>(); // files changed on disk since the sheet read them
const posts: { file: string; ops: { path: unknown[]; value?: unknown; delete?: true }[] }[] = [];
/** The builder api: each file's source and its kind's `/schema/<dir>` as write.ts answers it. */
async function api(path: string, sent?: any): Promise<[number, any]> {
  if (sent)
    return sent.was === hash && !stale.has(sent.file)
      ? (posts.push(sent), [200, { id: 1 }])
      : [409, { bytes: '{}', sha256: hash }]; // write.ts's stale answer: the file changed since read
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
    ? [200, { bytes: JSON.stringify(files.get(file)), sha256: hash, kind }]
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
// allowed.ts NEEDS: a field Add mechanic… greys until the field it depends on is there
const FIRST: Record<string, object> = {
  liquids: { resource: 'hp' },
  skills: { prerequisite: 'x', growth: [1] },
};
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
    button(s, WORDS.add)?.props.onPress();
    await settle();
    if (!button(s, f)) await s.press(`mechanic ${s.file}`); // a mechanic row: Add mechanic… opens it
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
  if (await press(hit((x) => words(x) === WORDS.item))) return;
  if (!(await press(hit((x) => words(x) === WORDS.add)))) return;
  await press(hit((x) => String(x.key).startsWith('add ') && words(x) !== WORDS.add));
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
    for (const v of ROOTS.includes(kind) ? [{}] : [...VARIANTS, FIRST[kind] ?? {}]) {
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
// list's Move up or Copy, a text's words, a text key or a definition key writing the wrong value
// or path; a boolean not shown as two picks; a field's name, label, Off or Remove words, a
// required constant's value, a list's folding or Move up on its first item shown wrongly; a
// union's picker marking the wrong branch; a map's Add over an existing key.
test('each gesture writes the exact value at the exact path', async () => {
  const s = await opened('statuses', {
    fear: true,
    tick_every: 5,
    allows: ['a', 'b', 'c'],
    duration: 'permanent',
    name: { prose: 'x' },
    resource: 'hp',
    narration: { applied: 'k.a' },
  });
  sent();
  const tick = within(s, ['tick_every']);
  assert.ok(tick.some((x) => words(x) === 'tick_every' && !x.props?.onPress)); // its name
  assert.ok(tick.some((x) => x.props?.accessibilityLabel === 'tick_every')); // its input
  assert.ok(within(s, ['duration']).some((x) => words(x) === 'permanent')); // a required constant
  assert.equal(words(button(s, WORDS.off)), WORDS.off);
  assert.equal(
    words(s.shown().find((x) => x.key === `remove ${s.file}:["resource"]`)),
    WORDS.remove,
  );
  assert.deepEqual(await typeIn(s, ['tick_every'], '5'), []);
  assert.deepEqual(await typeIn(s, ['tick_every'], 'six'), []);
  assert.deepEqual(await typeIn(s, ['tick_every'], '6'), [{ path: ['tick_every'], value: 6 }]);
  assert.deepEqual(await typeIn(s, ['name'], 'y'), [{ path: ['name'], value: { prose: 'y' } }]);
  assert.deepEqual(await typeIn(s, ['resource'], 'mp'), [{ path: ['resource'], value: 'mp' }]);
  await edit(s, ['narration'], () => {}); // unfolded
  assert.deepEqual(await typeIn(s, ['narration', 'applied'], 'k.b'), [
    { path: ['narration', 'applied'], value: 'k.b' },
  ]);
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
  const list = () => within(s, ['allows']);
  assert.ok(!list().some((x) => x.key === 'up 1')); // folded
  await edit(s, ['allows'], () => {}); // unfolded
  assert.deepEqual(
    list()
      .map((x) => String(x.key))
      .filter((k) => k.startsWith('up ')),
    ['up 1', 'up 2'],
  ); // every item but the first moves up
  for (const k of ['up 2', 'copy 0']) {
    list()
      .find((x) => x.key === k)
      .props.onPress();
    await settle();
    await settle();
  }
  assert.deepEqual(sent(), [
    { path: ['allows'], value: ['a', 'c', 'b'] },
    { path: ['allows'], value: ['a', 'a', 'b', 'c'] },
  ]);
  const d = await opened('dialogues', { entry: true }); // a boolean field: two picks
  within(d, ['entry'])
    .find((x) => x.key === 'false')
    .props.onPress();
  await settle();
  assert.deepEqual(sent(), [{ path: ['entry'], value: false }]);
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

// Breaks: a refused write (write.ts's 409 for a file changed behind the sheet) silent once the
// sheet has read its file.
test('a write refused after the file is read shows in the sheet', async () => {
  const s = await opened('statuses', { tick_every: 5 });
  hash = 'T'; // the file changed on disk since the sheet read it
  assert.deepEqual(await typeIn(s, ['tick_every'], '6'), []);
  const alert = s.shown().find((x) => x.props?.accessibilityRole === 'alert');
  assert.equal(words(alert), 'a file changed since the map read it');
  hash = 'S';
});

/** `doc` of `kind` opened under a cartridge whose capabilities are only speech, Add mechanic… open. */
async function narrow(kind: string, doc: object) {
  files.set('cartridge.json', { requires: { capabilities: { speech: 1 } }, world: {} });
  (load(), await settle()); // a new /story reads cartridge.json again
  const s = await opened(kind, doc);
  await s.press(`mechanic ${s.file}`);
  sent();
  files.set('cartridge.json', CART);
  return s;
}

// Breaks: a refused row pressable with no turn-on, or showing no reason; the turn-on missing the
// capability write, writing it after the field, at the wrong path or version, or into the sheet's file;
// a field with no least value revealed only in memory, so web's reload drops it (a second press);
// Remove on such a field writing a delete of nothing and leaving it revealed.
test('a greyed mechanic turns its capability on in cartridge.json, then adds the field', async (t) => {
  const s = await narrow('actions', {});
  const row = s.shown().find((x) => String(x.key).startsWith('mechanic policy '));
  assert.ok(words(row).includes(WORDS.needs(['policy'])));
  await s.press('mechanic policy ');
  assert.deepEqual(
    posts.splice(0).map((p) => [p.file, p.ops.map((o) => o.path)]),
    [
      ['cartridge.json', [['requires', 'capabilities', 'policy']]],
      [s.file, [['policy']]],
    ],
  );
  const l = await narrow('liquids', {}); // amount needs resource first: no write turns it on
  const amount = l.shown().find((x) => String(x.key).startsWith('mechanic amount '));
  assert.deepEqual([amount.props.disabled, amount.props.accessibilityState.disabled], [true, true]);
  assert.equal(words(amount).includes(WORDS.first), true);
  // slot has no least value: revealed empty once equipment is on, and kept where web's reload
  // after the cartridge.json write (App.tsx) finds it: the page's sessionStorage
  const kept = new Map<string, string>();
  Object.assign(globalThis, {
    sessionStorage: { getItem: (k: string) => kept.get(k) ?? null, setItem: kept.set.bind(kept) },
  });
  t.after(() => delete (globalThis as { sessionStorage?: unknown }).sessionStorage);
  const i = await narrow('items', {});
  (await i.press('mechanic slot '), await settle());
  assert.deepEqual(
    posts.splice(0).map((p) => p.file),
    ['cartridge.json'],
  );
  assert.ok(i.shown().some((x) => String(x.key).includes('"slot"')));
  const slot = `${i.file}:${JSON.stringify(['slot'])}`;
  assert.ok(JSON.parse(kept.get('loka-build-revealed')!).includes(slot)); // a reload keeps this
  assert.ok(await i.press(`remove ${slot}`));
  assert.deepEqual(posts.splice(0), []);
  assert.ok(!i.shown().some((x) => String(x.key).includes('"slot"')));
});

// Breaks: Add… listing a mechanic field too; an empty Add mechanic… drawn; a stale or missing cartridge's menu.
test('Add… lists no mechanic field; no mechanic to add, or an unread cartridge.json, draws no Add mechanic…', async () => {
  const s = await opened('actions', {});
  await s.press(`add ${s.file}`);
  const keys = s.shown().map((x) => String(x.key));
  assert.ok(
    keys.some((k) => k.startsWith('add ')) && !keys.some((k) => k.startsWith('add policy ')),
  );
  const x = await opened('text', {}); // text has no mechanic to add
  assert.ok(!x.shown().some((n) => String(n.key).startsWith(`mechanic ${x.file}`)));
  files.delete('cartridge.json');
  (load(), await settle());
  const t = await opened('actions', {});
  assert.ok(!t.shown().some((x) => String(x.key).startsWith(`mechanic ${t.file}`)));
  (files.set('cartridge.json', CART), load(), await settle());
});

// Breaks: the field written when the cartridge.json write is refused (two gestures, not one), or the
// refusal silent; a refused field with no least value left revealed as if added.
test('a turn-on refused as stale writes nothing and shows the refusal', async () => {
  const s = await narrow('actions', {});
  stale.add('cartridge.json');
  await s.press('mechanic policy ');
  assert.deepEqual(posts.splice(0), []);
  assert.ok(s.shown().some((x) => x.props?.accessibilityRole === 'alert'));
  const i = await narrow('items', {});
  (await i.press('mechanic slot '), await settle());
  stale.clear();
  assert.ok(!i.shown().some((x) => String(x.key).includes('"slot"')));
});
