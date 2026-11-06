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
  apart,
  applied,
  branchOf,
  choices,
  diff,
  editable,
  fieldErrors,
  hidden,
  pickable,
  proseKey,
  rebase,
  refuseKey,
  refusePick,
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
  const validator = customizeValidator<unknown, RJSFSchema>({ AjvClass: Ajv2020 });
  assert.deepEqual(
    getDefaultFormState<unknown, RJSFSchema>(validator, room, {}, room, false, FORM_DEFAULTS),
    {},
  );
});

// Break: an edit posts the whole document (or a sibling) instead of the one field, a dropped key is
// not deleted, a new key is not added, or rjsf's `{}` for a drawn absent object field is written.
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
  assert.deepEqual(
    diff(doc, { ...doc, ask: {}, attack: { crit: {}, on_hit: { x: undefined } } }),
    [],
  );
  assert.deepEqual(diff({ hp: { start: 1 } }, { hp: 3 }), [{ path: ['hp'], value: 3 }]);
  assert.deepEqual(applied(doc, { ...doc, room: 'gate', ask: {} }), { ...doc, room: 'gate' });
  // an array item's fills are not written; an item's change is one op at its index
  const steps = { steps: [{ op: 'wait' }, { op: 'say', n: 1 }] };
  assert.deepEqual(
    diff(steps, {
      steps: [
        { op: 'wait', at: {} },
        { op: 'say', n: 2 },
      ],
    }),
    [{ path: ['steps', 1, 'n'], value: 2 }],
  );
  assert.deepEqual(diff(steps, { steps: [{ op: 'wait' }] }), [
    { path: ['steps', 1], delete: true },
  ]);
});

// Break: an array whose length changed diffs to one replace at its own path, which is [] for a
// file that is an array (layout, scenes, outline) and the edit model refuses, so no row is added.
test('a row added to or dropped from an array is one op the edit model applies, root arrays too', () => {
  const rows = [{ a: 1 }, { a: 2 }, { a: 3 }];
  assert.deepEqual(diff(rows, [...rows, { a: 4, b: {} }]), [{ path: [3], value: { a: 4, b: {} } }]);
  assert.deepEqual(diff(rows, [{ a: 1 }]), [
    { path: [2], delete: true },
    { path: [1], delete: true },
  ]);
  for (const draft of [[...rows, { a: 4 }, { a: 5 }], [{ a: 9 }], []]) {
    const doc = structuredClone(rows);
    change(doc, diff(rows, draft));
    assert.deepEqual(doc, draft);
  }
});

// Break: the reload after a post sets the file over the draft, so what was typed into the next
// field while the post was in flight is lost; or an edit the file refused comes back.
test('a reload keeps the edits that were not sent and drops the sent ones', () => {
  const base = { value: 5, keywords: ['weak'] };
  const now = { value: 8, keywords: ['weakzz'] };
  const sent = diff(base, { value: 8, keywords: ['weak'] });
  assert.deepEqual(rebase(base, now, { value: 8, keywords: ['weak'] }, sent), now);
  // a refused send: the file is unchanged, the sent edit is dropped, the later one kept
  assert.deepEqual(rebase(base, now, base, sent), { value: 5, keywords: ['weakzz'] });
  // the file lost what the kept edit changes: the reloaded file alone
  assert.deepEqual(rebase(base, now, { value: 8 }, sent), { value: 8 });
  assert.deepEqual(rebase(undefined, undefined, base, []), base);
});

// Break: a half-made branch's schema error holds every later edit, so a step edit is never written;
// or an edit inside the errored field, or a root error, is written anyway.
test('a schema error holds only the edits inside its top-level field', () => {
  const ops = diff(
    { policy: { items: 'any' }, steps: [{ fact: 'a' }] },
    { policy: { items: {} }, steps: [{ fact: 'b' }] },
  );
  assert.deepEqual(apart(ops, [{ property: '.policy.items' }]), [
    { path: ['steps', 0, 'fact'], value: 'b' },
  ]);
  assert.deepEqual(apart(ops, []), ops);
  assert.deepEqual(apart(ops, [{ property: '' }]), []);
  // the root `if`/`else` errors Ajv adds for a branch's error do not hold the step
  assert.deepEqual(apart(ops, [{ property: '.policy.items' }, { property: '' }]), [
    { path: ['steps', 0, 'fact'], value: 'b' },
  ]);
  assert.deepEqual(
    apart(diff([{ x: 1 }, { x: 2 }], [{ x: 0 }, { x: 3 }]), [{ property: '.0.x' }]),
    [{ path: [1, 'x'], value: 3 }],
  );
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
      { path: 'npcs/bob.hp', rel, words: 'other source' },
      { path: 'npcs/ada!', rel, words: 'unread step' },
      { path: 'npcs/bram.hp', rel: 'npcs/bram.json', words: 'other file' },
    ],
    rel,
  );
  assert.deepEqual(errors, {
    hp: { __errors: [hp] },
    room: { __errors: [room] },
    ask: { answers: { 2: { 'odd key': { __errors: ['deep'] } } } },
    __errors: ['whole', 'other source', 'unread step'],
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
  assert.equal(branchOf(step, { op: 'fact.assign' }), 0);
  assert.deepEqual(start(step[2]), { op: 'quest.activate' });
  assert.equal(start(outer[0]), undefined);
});

// Break: an untagged value is drawn in a branch of another type (a number not taken as integer,
// null as an object), or a branch with no type is skipped.
test('a value with no op is drawn in the first branch its type fits', () => {
  const typed = [{ type: 'string' }, { type: 'integer' }, { type: 'null' }];
  assert.equal(branchOf(typed, 3), 1);
  assert.equal(branchOf(typed, null), 2);
  assert.equal(branchOf(typed, true), -1);
  assert.equal(branchOf([{}], true), 0);
});

// Break: the World card's picker takes a key no definition has (a typo'd room or resource is
// written and only the compile refuses it), names the wrong kind for a field (an array item's
// index, not its field, picks), or offers a story node for a root-file kind; a bad new key passes.
test('a World picker refuses an unknown id at the field; a new entry key must be new and lowercase', () => {
  const nodes = [
    { ref: 'c@0.1:room/square', kind: 'room' },
    { ref: 'c@0.1:npc/ada', kind: 'npc' },
  ];
  const room = pickable(['recovery_rooms', 0], nodes, {});
  assert.deepEqual(room, { kind: 'room', keys: ['square'] });
  assert.deepEqual(
    [refusePick(room, 'squaer'), refusePick(room, 'square'), refusePick(room, '')],
    ['no room squaer', undefined, undefined],
  );
  const theft = pickable(['world', 'theft', 'attribute'], nodes, { attribute: ['grit'] });
  assert.deepEqual(
    [refusePick(theft, 'grit'), refusePick(theft, 'ada')],
    [undefined, 'no attribute ada'],
  );
  assert.equal(refusePick(pickable(['currency'], nodes, {}), 'gold'), 'no resource gold');
  assert.equal(pickable(['title'], nodes, {}), undefined);
  assert.deepEqual(
    [refuseKey('gold', { coin: {} }), refuseKey('gold', { gold: {} }), refuseKey('Gold', {})],
    [undefined, 'already gold', 'a key is lowercase letters, digits and _'],
  );
});

// Break: a reference field offers another kind's keys, or the ref's cartridge prefix; a `.scene`
// (or no file) gets a card.
test('a picker offers the bare keys of its kind; only .json files have a card', () => {
  const nodes = [
    { ref: 'c@0.1:room/square', kind: 'room' },
    { ref: 'c@0.1:npc/ada', kind: 'npc' },
  ];
  assert.deepEqual(choices('room', nodes), ['square']);
  assert.deepEqual(
    [editable('npcs/a.json'), editable('rooms/a.scene'), editable(undefined)],
    [true, false, false],
  );
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
