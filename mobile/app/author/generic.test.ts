// The generic sheet (author/build/generic.tsx, form.tsx; design §7, slice 2.3): every field of the
// generic baseline (test/loka/editor_generic_baseline.txt) is added, edited and removed by the
// sheet, each a `/change` op at the baseline line's own path.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { nodes, words } from '../book/__tests__/combat-book.test.ts'; // also registers the .tsx loader

const { story } = await import('./build/room.tsx');
const { sheets } = await import('./build/sheet.tsx');
await import('./build/generic.tsx');

const root = new URL('../../../', import.meta.url);
const read = (rel: string) => JSON.parse(readFileSync(new URL(rel, root), 'utf8'));
const defs = read('schemas/source/defs.schema.json').$defs;
const ROOTS = ['facts', 'layout', 'text']; // the baseline's single-file kinds
const settle = () => new Promise((r) => setTimeout(r));

const files = new Map<string, unknown>();
const posts: { file: string; ops: { path: unknown[]; value?: unknown; delete?: true }[] }[] = [];
/** The builder api: each file's source and its kind's `/schema/<dir>` as write.ts answers it. */
async function api(path: string, sent?: any): Promise<[number, any]> {
  if (sent) return (posts.push(sent), [200, { id: 1 }]);
  if (path === '/story') return [200, { map: [], graph: { nodes: [] }, files: {} }];
  if (path === '/templates') return [200, []];
  const dir = /^\/schema\/(\w+)$/.exec(path)?.[1];
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
story(
  api,
  () => {},
  () => {},
  () => {},
);
await settle();

let n = 0;
/** `doc` opened as a fresh file of `kind`: its sheet's nodes, redrawn on each call. */
async function opened(kind: string, doc: unknown) {
  const file = ROOTS.includes(kind) ? `${kind}.json` : `${kind}/f${n++}.json`;
  files.set(file, doc);
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
const input = (s: { shown: () => any[] }, label: string) =>
  s.shown().find((x) => x.props?.onBlur && x.props.accessibilityLabel === label);

/** The writes one gesture on field `f` of `doc` sends, the field found as `op` needs it. */
async function gesture(kind: string, f: string, op: string, doc: Record<string, unknown>) {
  const s = await opened(kind, doc);
  sent();
  if (op === 'delete') return (await s.press(`remove ${s.file}:${JSON.stringify([f])}`), sent());
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
async function edit(s: { file: string; shown: () => any[] }, path: unknown[]) {
  const key = `${s.file}:${JSON.stringify(path)}`;
  const inside = () => nodes(s.shown().find((x) => x.key === key)?.props.children);
  const hit = (pred: (x: any) => boolean) =>
    inside().find((x) => x.props?.accessibilityRole === 'button' && pred(x));
  const press = async (x: any) => x && (x.props.onPress(), await settle(), true);
  if (await press(hit((x) => String(x.key) === `fold ${key}`))) void 0;
  const typed = inside().find((x) => x.props?.onBlur);
  if (typed) return (typed.props.onChangeText('7'), typed.props.onBlur(), await settle());
  if (await press(hit((x) => x.props.accessibilityState?.selected === false))) return;
  if (await press(hit((x) => words(x) === 'Add item'))) return;
  if (await press(hit((x) => words(x) === 'Add…')))
    await press(hit((x) => String(x.key).startsWith('add ') && words(x) !== 'Add…'));
}

const baseline = readFileSync(new URL('test/loka/editor_generic_baseline.txt', root), 'utf8')
  .trim()
  .split('\n');
for (const line of baseline) {
  const [kind, ...rest] = line.split('.');
  const op = rest.pop()!;
  const f = rest[0];
  test(line, async () => {
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
