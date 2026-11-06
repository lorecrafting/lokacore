// The schema walker (docs/rnd/gui-editor-design-2026-11-04.md §11): which fields of a source kind
// a hand-built widget claims, read off the real schemas; the expected claims are hand-checked
// against schemas/source/defs.schema.json.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { titles, uiSchema } from '../play/ui_schema.ts';

const SOURCE = join(import.meta.dirname, '../../../schemas/source');
const read = (f: string) => JSON.parse(readFileSync(join(SOURCE, f), 'utf8'));
const defs = read('defs.schema.json').$defs;
const card = (edit: string) => ({ create: 'generic', edit, delete: 'generic' });
const ui = (kind: string, registry = {}) =>
  uiSchema(kind, read(`${kind}.schema.json`), defs, registry);

// Breaks: the walker stops at the kind's if/then/else (abstract, extends) and claims nothing, keeps
// the `partial.` prefix of an extending definition, or does not follow a $ref into a definition.
test('a real kind claims its text keys, definition references, policies and steps', () => {
  const rooms = ui('rooms');
  assert.deepEqual(rooms.name, { 'ui:field': 'TextKey', 'ui:fieldReplacesAnyOrOneOf': true });
  const rules = {
    'reactions.on': card('blocks/Rules.tsx'),
    'reactions.when': card('blocks/Rules.tsx'),
  };
  const reactions = ui('reactions', rules);
  assert.equal(reactions.when['ui:field'], 'Policy');
  assert.equal(reactions.on.anyOf[2]['ui:title'], 'spoken');
  assert.deepEqual(rooms.exits.north.barrier, {
    'ui:field': 'DefinitionRef',
    'ui:fieldReplacesAnyOrOneOf': true,
  });
  assert.deepEqual(ui('dialogues').policy, {
    'ui:field': 'Policy',
    'ui:fieldReplacesAnyOrOneOf': true,
  });
  assert.deepEqual(ui('reactions').steps.items.anyOf[0], {
    'ui:field': 'Step',
    'ui:fieldReplacesAnyOrOneOf': true,
    'ui:title': 'Step',
  });
});

// Breaks: a hand-built card in the registry is not drawn, `generic` replaces rjsf's own field, the
// card keeps its `.tsx` (rjsf's fields map has no such name), another kind's row lands here, or a
// block's row replaces the walker's claims it draws through (the policy's definition, the events).
test("the registry's hand-built edit card claims its field; generic and other kinds do not", () => {
  const rooms = ui('rooms', {
    'rooms.exits': card('ExitsCard.tsx'),
    'rooms.name': card('generic'),
    'npcs.name': card('NpcName.tsx'),
  });
  assert.deepEqual(rooms.exits, { 'ui:field': 'ExitsCard' });
  assert.deepEqual(rooms.name, { 'ui:field': 'TextKey', 'ui:fieldReplacesAnyOrOneOf': true });
});

// Breaks (loka-wfrgk.11 review 2, 5): a root-level row (no field) is dropped, so the text catalog
// never gets its card; a field of an array file (layout) is claimed beside `items`, where rjsf
// never reads it; a treatment's card is never drawn on its host's `treatment` field.
test('a whole-kind, an array-file field and a treatment card are each claimed where rjsf reads', () => {
  assert.equal(ui('text', { text: card('Catalog.tsx') })['ui:field'], 'Catalog');
  const layout = ui('layout', { 'layout.room': card('RoomSpot.tsx') });
  assert.deepEqual(layout.items.room, { 'ui:field': 'RoomSpot' });
  assert.equal(layout.room, undefined);
  const scenes = ui('scenes', {
    'scenes.treatment': card('generic'),
    'treatment:reverie': card('Reverie.tsx'),
  });
  assert.deepEqual(scenes.treatment, { 'ui:field': 'Reverie' });
  assert.equal(ui('rooms', { 'treatment:reverie': card('Reverie.tsx') }).treatment, undefined);
});

// Breaks: a recursive definition never ends, loses its claims below the first level (review 3:
// depth 3 is drawn), or an anyOf branch shows rjsf's "Option 1" because
// it has no title, or a oneOf's titles land under anyOf where rjsf does not read them, or a branch is
// named by its JSON type, by a required key where a discriminating const exists, or alike its sibling.
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
        kind: {
          anyOf: [
            { properties: { kind: { const: 'opposed' } }, required: ['kind', 'a'] },
            { properties: { kind: { const: 'luck' } }, required: ['kind'] },
          ],
        },
        twin: { anyOf: [{ required: ['e'] }, { required: ['e'] }] },
      },
    },
    Gate: {},
  };
  const out = uiSchema('k', tree, nodes, {});
  assert.deepEqual(out.label, { 'ui:field': 'TextKey', 'ui:fieldReplacesAnyOrOneOf': true });
  assert.deepEqual(out.kids.items.label, {
    'ui:field': 'TextKey',
    'ui:fieldReplacesAnyOrOneOf': true,
  });
  assert.deepEqual(out.kids.items.kids.items.label, {
    'ui:field': 'TextKey',
    'ui:fieldReplacesAnyOrOneOf': true,
  });
  assert.equal(out.kids.items.kids.items.kids, undefined);
  assert.deepEqual(
    out.pick.anyOf.map((b: any) => b['ui:title']),
    ['Named', 'Gate', 'door', 'option 4', 'option 5'],
  );
  assert.deepEqual(out.one, { oneOf: [{ 'ui:title': 'A' }, { 'ui:title': 'option 2' }] });
  // a const key distinct in every branch names it before its single required key; a shared name does not stand
  assert.deepEqual(
    out.kind.anyOf.map((b: any) => b['ui:title']),
    ['opposed', 'luck'],
  );
  assert.deepEqual(
    out.twin.anyOf.map((b: any) => b['ui:title']),
    ['option 1', 'option 2'],
  );
});

// Breaks: a kind picker names two branches alike or by a JSON type ("object") where they differ by
// more than type, so the owner cannot tell them apart (docs/design/editor-chrome-rulings.md §7).
// Every union in every real source schema and definition is named.
test('every union picker in the real schemas names its branches distinctly, by type only when that is all they differ by', () => {
  const unions: any[][] = [];
  const collect = (n: unknown): void => {
    if (typeof n !== 'object' || n === null) return;
    for (const [k, v] of Object.entries(n)) {
      if ((k === 'anyOf' || k === 'oneOf') && Array.isArray(v)) unions.push(v);
      collect(v);
    }
  };
  for (const f of readdirSync(SOURCE).filter((f) => f.endsWith('.schema.json'))) collect(read(f));
  assert.ok(unions.length > 40, `${unions.length} unions found`);
  const resolve = (b: any) => (b.$ref ? defs[b.$ref.split('/').pop()] : b);
  const bad = unions.flatMap((u) => {
    const names = titles(u, defs);
    const types = u.map((b) => resolve(b).type);
    const onlyType = new Set(types).size === u.length && types.every((t) => typeof t === 'string');
    const typed = names.some((t) => /^(object|string|number|integer|boolean|array|null)$/.test(t));
    return new Set(names).size < u.length || (typed && !onlyType) ? [names.join('|')] : [];
  });
  assert.deepEqual(bad, []);
});
