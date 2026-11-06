// The editor's edit model (docs/rnd/gui-editor-design-2026-11-04.md §11): ops and their undo on
// every real cartridge source file, the refused paths, and the kind schema's verdict.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { apply, change, Refused, type Op } from '../play/edit_model.ts';
import { validator } from '../play/edit_validator.ts';

const ROOT = join(import.meta.dirname, '../../..');
const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n';
const schemas = (dir = join(ROOT, 'schemas/source')) =>
  Object.fromEntries(
    readdirSync(dir).map((f) => [f, JSON.parse(readFileSync(join(dir, f), 'utf8'))]),
  );

/** Edits that touch every undo shape the file allows: a key delete, a set over a key and a new key,
 *  an array element delete and an append. */
function edits(doc: unknown): Op[] {
  if (Array.isArray(doc))
    return doc.length
      ? [
          { path: [0], delete: true },
          { path: [doc.length - 1], value: 'e4a' },
        ]
      : [];
  const keys = Object.keys(doc as object);
  const list = keys.find(
    (k, i) => i > 0 && (doc as any)[k]?.length > 0 && Array.isArray((doc as any)[k]),
  );
  const ops: Op[] = [
    { path: [keys[0]], delete: true },
    { path: ['e4a'], value: { a: [1] } },
  ];
  if (keys[1] && keys[1] !== list) ops.push({ path: [keys[1]], value: null });
  if (list) {
    const n = (doc as any)[list].length;
    ops.push({ path: [list, 0], delete: true }, { path: [list, n - 1], value: 'e4a' });
  }
  return ops;
}

// Breaks: an undo that loses a deleted key's place in key order, restores an array element at the
// wrong index or drops one, sets a new key back to undefined instead of deleting it, or replays the
// undo groups in the order they were made.
test('every cartridge source file comes back byte for byte after an edit and its undo', () => {
  const files = readdirSync(join(ROOT, 'cartridges'), { recursive: true, encoding: 'utf8' }).filter(
    (f) => f.endsWith('.json'),
  );
  assert.ok(files.length > 1000, `${files.length} files`);
  for (const f of files) {
    const raw = readFileSync(join(ROOT, 'cartridges', f), 'utf8');
    const doc = JSON.parse(raw);
    if (typeof doc !== 'object' || doc === null || !Object.keys(doc).length) continue;
    const back = change(doc, edits(doc));
    assert.notEqual(json(doc), json(JSON.parse(raw)), f);
    for (const op of back) apply(doc, op);
    assert.equal(json(doc), json(JSON.parse(raw)), f);
  }
});

// Break: the undo of deleting a key that is not there sets it (to undefined), so the undo changes
// the file.
test('deleting a missing key has no undo; a key set over keeps its place', () => {
  const doc = { a: 1, b: { c: 2 }, d: 3 };
  assert.deepEqual(change(doc, [{ path: ['x'], delete: true }]), []);
  assert.deepEqual(change(doc, [{ path: ['b', 'c'], value: 9 }]), [{ path: ['b', 'c'], value: 2 }]);
  assert.deepEqual(doc, { a: 1, b: { c: 9 }, d: 3 });
});

// Break: the doc holds the op's own object, so a card that edits its draft afterwards, or a later
// nested edit to an undo value, changes the file with no op and no undo.
test("an op's value is copied into the file", () => {
  const draft = { c: 1 };
  const doc: { b?: { c: number } } = {};
  change(doc, [{ path: ['b'], value: draft }]);
  draft.c = 2;
  assert.deepEqual(doc, { b: { c: 1 } });
});

// Break: a refused op leaves the ops before it applied, so a half edit is saved.
test('a change with a refused op puts back the ops before it', () => {
  const doc = { a: 1, l: ['x'] };
  const ops: Op[] = [
    { path: ['a'], delete: true },
    { path: ['l', 0], value: 'y' },
    { path: ['l', 5], value: 'z' },
  ];
  assert.throws(() => change(doc, ops), Refused);
  assert.equal(json(doc), json({ a: 1, l: ['x'] }));
});

// Breaks: a dropped check lets an op write to the prototype, through a scalar, past an array's
// end, at a negative or string index, or apply an op that neither sets nor deletes.
test('a path that names no field of the file is refused and changes nothing', () => {
  const bad: Op[] = [
    { path: [], value: 1 },
    { path: ['__proto__', 'x'], value: 1 },
    { path: ['constructor'], value: 1 },
    { path: ['n', 'x'], value: 1 },
    { path: ['z', 'x', 'y'], value: 1 },
    { path: ['l', 3], value: 1 },
    { path: ['l', 2], delete: true },
    { path: ['l', -1], value: 1 },
    { path: ['l', '0'], value: 1 },
    { path: ['l', 1.5], value: 1 },
    { path: ['n'] },
    { path: [true as any], value: 1 },
  ];
  for (const op of bad) {
    const doc = { n: 1, z: null, l: ['a', 'b'] };
    assert.throws(() => apply(doc, op), Refused, JSON.stringify(op));
    assert.deepEqual(doc, { n: 1, z: null, l: ['a', 'b'] });
  }
  const doc = { n: 1, l: ['a', 'b'] };
  apply(doc, { path: ['l', 2], value: 'c' });
  apply(doc, { path: ['l', 1], delete: true });
  assert.deepEqual(doc, { n: 1, l: ['a', 'c'] });
});

// Breaks: the validator answers [] for every file (an edit that breaks the schema is saved), or
// checks against the wrong kind's schema, or takes `defs` (whose root accepts anything) for a kind.
test("an edited file is checked against its kind's source schema", () => {
  const valid = validator(schemas());
  const room = { name: 'room.a.title', description: 'room.a.description', exits: {} };
  assert.deepEqual(valid('rooms', room), []);
  const errors = valid('rooms', { description: 'room.a.description', exits: {} });
  assert.ok(errors.includes("/ must have required property 'name'"), errors.join('\n'));
  assert.notDeepEqual(valid('items', room), []);
  assert.throws(() => valid('nosuch', room), Refused);
  assert.throws(() => valid('defs', room), Refused);
});
