// The generic card's logic (play/card.ts): every expected answer is a hand-checked literal, the
// diagnostics are copied from `mix loka.compile --json`, the branches from schemas/source.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { getDefaultFormState, type RJSFSchema } from '@rjsf/utils';
import { customizeValidator } from '@rjsf/validator-ajv8';
import { Ajv2020 } from 'ajv/dist/2020.js';
import {
  FORM_DEFAULTS,
  addable,
  branchOf,
  diff,
  fieldErrors,
  hidden,
  proseKey,
  start,
} from '../play/card.ts';
import { change } from '../play/edit_model.ts';
import { json } from '../play/write.ts';

const SOURCE = join(import.meta.dirname, '../../../schemas/source');
const read = (f: string) => JSON.parse(readFileSync(join(SOURCE, f), 'utf8'));
const defs = read('defs.schema.json').$defs;
// as write.ts's GET /schema/<dir> serves it
const served = (dir: string) => {
  const stub = read(`${dir}.schema.json`);
  return { ...stub, $ref: stub.$ref.replace(/^defs\.schema\.json/, ''), $defs: defs };
};

// Break: rjsf invents values in a definition nobody wrote (a `const` such as `dark: true`, an empty
// `exits.*.locks` tree), which the first blur would post. Red controls: without constAsDefaults
// the room is dark; without emptyObjectFields it grows exits.
test("an empty room's defaults are {}", () => {
  const room = served('rooms') as RJSFSchema;
  const validator = customizeValidator({ AjvClass: Ajv2020 as never }) as never;
  assert.deepEqual(getDefaultFormState(validator, room, {}, room, false, FORM_DEFAULTS), {});
});

// Break: an edit posts the whole document (or a sibling) instead of the one field, a dropped key is
// not deleted, or a new key is not added; the file then differs beyond the edit.
test('an edit through the card round-trips to the file, one op per changed field', () => {
  const bytes =
    '{\n  "name": "npc.ada.name",\n  "hp": {\n    "start": 10,\n    "maximum": 10\n  },\n  "room": "square"\n}\n';
  const doc = JSON.parse(bytes);
  const draft = { name: 'npc.ada.name', hp: { start: 7, maximum: 10 }, short: 'npc.ada.short' };
  const ops = diff(doc, draft);
  assert.deepEqual(ops, [
    { path: ['hp', 'start'], value: 7 },
    { path: ['room'], delete: true },
    { path: ['short'], value: 'npc.ada.short' },
  ]);
  change(doc, ops);
  assert.equal(
    json(doc),
    '{\n  "name": "npc.ada.name",\n  "hp": {\n    "start": 7,\n    "maximum": 10\n  },\n  "short": "npc.ada.short"\n}\n',
  );
  assert.deepEqual(diff(doc, structuredClone(doc)), []);
});

// Break: a refusal lands on the wrong field or is lost (another file's, a quoted file name, an
// index or a quoted step misread), or one that names no field is dropped instead of shown on top.
test("the compiler's refusals show at their field", () => {
  const hp =
    '`hp` must be an object with fields: gain, maximum, minimum, start. The full shape is in schemas/source/defs.schema.json.';
  const room = 'Nothing defines the room `nowhere`. Create it or fix the spelling.';
  const rel = 'npcs/ada.json';
  const errors = fieldErrors(
    [
      { path: 'npcs/ada.hp', rel, words: hp },
      { path: 'npcs/ada.room', rel, words: room },
      { path: 'npcs/ada.ask.answers[2]["odd key"]', rel, words: 'deep' },
      { path: 'npcs/ada', rel, words: 'whole' },
      { path: 'npcs/bram.hp', rel: 'npcs/bram.json', words: 'other file' },
    ],
    rel,
  );
  assert.deepEqual(errors, {
    hp: { __errors: [hp] },
    room: { __errors: [room] },
    ask: { answers: { 2: { 'odd key': { __errors: ['deep'] } } } },
    __errors: ['whole'],
  });
  assert.deepEqual(
    fieldErrors(
      [{ path: '"npcs/Ada.json".hp', rel: 'npcs/Ada.json', words: 'w' }],
      'npcs/Ada.json',
    ),
    { hp: { __errors: ['w'] } },
  );
});

const card = { create: 'generic', edit: 'generic', delete: 'generic' };
const registry = {
  npcs: card,
  'npcs.hp': card,
  'npcs.room': card,
  'npcs.short': card,
  'npcs_extra.x': card,
  'rooms.dark': card,
};

// Break: the menu lists a field the definition has, one already revealed, another kind's (a shared
// prefix), the whole-kind row, or offers fields on a file that is not an object.
test("the add menu lists exactly the registry's fields the definition lacks", () => {
  assert.deepEqual(addable('npcs', registry, { room: 'square' }, ['short']), ['hp']);
  assert.deepEqual(addable('npcs', registry, [], []), []);
});

// Break: an absent field is drawn as an empty input, or a revealed field loses the walker's card.
test('absent fields are hidden until revealed; a revealed one keeps its card', () => {
  const ui = { room: { 'ui:field': 'DefinitionRef' }, short: { 'ui:field': 'TextKey' } };
  assert.deepEqual(hidden(ui, 'npcs', registry, { room: 'square' }, ['short']), {
    room: { 'ui:field': 'DefinitionRef' },
    short: { 'ui:field': 'TextKey' },
    hp: { 'ui:field': 'Hidden', 'ui:widget': 'hidden' },
  });
});

// Break: a step is drawn as the wrong op (first branch, or by shape), a `wait` is not told apart
// from a step, or a step whose op the outer union does not name falls out as -1.
test('a value is drawn in the branch its op names', () => {
  const step = defs.Step.anyOf;
  assert.equal(branchOf(step, { op: 'quest.activate', quest: 'q' }), 2);
  const outer = defs['source.ReactionRule'].properties.steps.items.anyOf;
  assert.equal(branchOf(outer, { op: 'wait', seconds: 5 }), 1);
  assert.equal(branchOf(outer, { op: 'narrate' }), 0);
  assert.equal(branchOf(outer, undefined), -1);
  assert.deepEqual(start(step[2]), { op: 'quest.activate' });
  assert.equal(start(outer[0]), undefined);
});

// Break: the in-Book edit opens the wrong text key (plural kind, a missing `room_line` alias, an
// index not in decimal), or a field that already names its key is given a generated one.
test("a prose field opens its text key (cartridge.md's examples)", () => {
  assert.equal(proseKey({ prose: 'x' }, 'npc', 'elder', ['name']), 'npc.elder.name');
  assert.equal(
    proseKey({ prose: 'x' }, 'dialogue', 'elder_ward', ['choices', 'thank', 'label']),
    'dialogue.elder_ward.choices.thank.label',
  );
  assert.equal(
    proseKey({ prose: 'x' }, 'room', 'lane', ['variants', 0, 'description']),
    'room.lane.variants.0.description',
  );
  assert.equal(proseKey({ prose: 'x' }, 'npc', 'bram', ['room_line']), 'npc.bram.room');
  assert.equal(proseKey('npc.ada.title', 'npc', 'bram', ['name']), 'npc.ada.title');
});
