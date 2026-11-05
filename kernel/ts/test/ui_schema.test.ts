// The schema walker (docs/rnd/gui-editor-design-2026-11-04.md §11): which fields of a source kind
// a hand-built widget claims, read off the real schemas; the expected claims are hand-checked
// against schemas/source/defs.schema.json.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { uiSchema } from '../play/ui_schema.ts';

const SOURCE = join(import.meta.dirname, '../../../schemas/source');
const read = (f: string) => JSON.parse(readFileSync(join(SOURCE, f), 'utf8'));
const defs = read('defs.schema.json').$defs;
const ui = (kind: string, registry = {}) =>
  uiSchema(kind, read(`${kind}.schema.json`), defs, registry);

// Breaks: the walker stops at the kind's if/then/else (abstract, extends) and claims nothing, keeps
// the `partial.` prefix of an extending definition, or does not follow a $ref into a definition.
test('a real kind claims its text keys, definition references, policies and steps', () => {
  const rooms = ui('rooms');
  assert.deepEqual(rooms.name, { 'ui:field': 'TextKey' });
  assert.deepEqual(rooms.exits.north.barrier, { 'ui:field': 'DefinitionRef' });
  assert.deepEqual(ui('dialogues').policy, { 'ui:field': 'Policy' });
  assert.deepEqual(ui('reactions').steps.items.anyOf[0], {
    'ui:field': 'Step',
    'ui:title': 'Step',
  });
});

// Breaks: a hand-built card in the registry is not drawn, `generic` replaces rjsf's own field, or
// another kind's row lands on this one.
test("the registry's hand-built edit card claims its field; generic and other kinds do not", () => {
  const card = (edit: string) => ({ create: 'generic', edit, delete: 'generic' });
  const rooms = ui('rooms', {
    'rooms.exits': card('ExitsCard.tsx'),
    'rooms.name': card('generic'),
    'npcs.name': card('NpcName.tsx'),
  });
  assert.deepEqual(rooms.exits, { 'ui:field': 'ExitsCard.tsx' });
  assert.deepEqual(rooms.name, { 'ui:field': 'TextKey' });
});

// Breaks: a recursive definition never ends, or an anyOf branch shows rjsf's "Option 1" because
// it has no title, or a oneOf's titles land under anyOf where rjsf does not read them.
test('a recursive definition ends and every anyOf branch is titled', () => {
  const tree = {
    $ref: '#/$defs/Node',
  };
  const nodes = {
    Node: {
      properties: {
        label: { $ref: '#/$defs/TextKey' },
        kids: { items: { $ref: '#/$defs/Node' } },
        pick: {
          anyOf: [
            { title: 'Named' },
            { $ref: '#/$defs/Gate' },
            { required: ['door'] },
            { type: 'string' },
            {},
          ],
        },
        one: { oneOf: [{ title: 'A' }, {}] },
      },
    },
    Gate: {},
  };
  const out = uiSchema('k', tree, nodes, {});
  assert.deepEqual(out.label, { 'ui:field': 'TextKey' });
  assert.equal(out.kids, undefined);
  assert.deepEqual(
    out.pick.anyOf.map((b: any) => b['ui:title']),
    ['Named', 'Gate', 'door', 'string', 'option 5'],
  );
  assert.deepEqual(out.one, { oneOf: [{ 'ui:title': 'A' }, { 'ui:title': 'option 2' }] });
});
