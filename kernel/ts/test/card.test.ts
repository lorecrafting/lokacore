// size: allow 570, one suite per card step; the generic, Room, World, NPC and item cards and the Rules block share the pure helpers
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
  added,
  addedHere,
  allowed,
  apart,
  applied,
  branchOf,
  choices,
  diff,
  editable,
  entered,
  fieldErrors,
  hidden,
  minimal,
  pickKind,
  pickable,
  placed,
  placement,
  proseKey,
  rebase,
  refuseKey,
  refusePick,
  removed,
  rootNames,
  rootStamp,
  ROOTS,
  start,
  constraintOnly,
  tagHidden,
  worldFile,
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
  assert.deepEqual(start(step, 2), { op: 'quest.activate' });
  assert.equal(start(outer, 0), undefined);
});

// Break: a trigger or check is drawn in the first branch whatever its event or kind (it names no
// `op`), a new pick writes no tag at all, or a check's key is lost (or a field of another schema
// kept) when the author switches its kind.
test('a trigger and a check are drawn and switched by their event and kind', () => {
  const on = defs['source.ReactionRule'].properties.on.anyOf;
  assert.equal(branchOf(on, { event: 'spoken', word: 'hello' }), 2);
  assert.deepEqual(start(on, 15, { event: 'spoken', npc: 'ada', word: 'hi' }), {
    event: 'action_completed',
  });
  const check = defs.Check.anyOf;
  const luck = { kind: 'luck', key: 'fish', chance: 50 };
  assert.equal(branchOf(check, { kind: 'threshold', key: 'k' }), 1);
  assert.deepEqual(start(check, 1, luck), { kind: 'threshold', key: 'fish' });
});

// Break: an `extends` partial naming no kind (`check: {chance: 70}`) draws only the picker and
// hides its fields; a switch from a value no branch fits drops its fields; a field whose schema
// differs between the two branches is kept; an untagged union hides an `op` field.
test('a tagless or unknown value keeps its fields', () => {
  assert.equal(branchOf(defs['partial.Check'].anyOf, { chance: 70 }), 0);
  assert.equal(branchOf([{ type: 'string' }, { properties: { a: {} } }], { a: 1 }), 1);
  assert.equal(branchOf(defs.Check.anyOf, null), -1);
  assert.deepEqual(start(defs.Check.anyOf, 1, { key: 'fish', zz: 1 }), {
    kind: 'threshold',
    key: 'fish',
  });
  const two = [
    { properties: { kind: { const: 'a' }, n: { type: 'string' } } },
    { properties: { kind: { const: 'b' }, n: { type: 'integer' } } },
  ];
  assert.deepEqual(start(two, 1, { kind: 'a', n: 'x' }), { kind: 'b' });
  assert.deepEqual(tagHidden([{ type: 'object', properties: { op: { type: 'string' } } }]), {});
});

// Break: has_tag's one-subject rule (branches that only require a field) is drawn as a picker of
// empty forms, which rjsf cannot draw.
test('a union of bare requirements draws nothing', () => {
  assert.equal(constraintOnly([{ required: ['subject'] }, { required: ['item'] }]), true);
  assert.equal(constraintOnly(defs.Check.anyOf), false);
  assert.equal(constraintOnly([{ properties: { a: {} } }]), false);
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
  // a default pool is a resource with no resources.json entry; no keys yet (no compile) is free text
  const coin = pickable(['currency'], nodes, { resource: ['coin'] });
  assert.deepEqual(
    [refusePick(coin, 'mv'), refusePick(coin, 'gold'), refusePick(pickable(['room'], [], {}), 'x')],
    [undefined, 'no resource gold', undefined],
  );
  assert.equal(pickable(['title'], nodes, {}), undefined);
  assert.equal(pickable(['room'], nodes, {}, { global: 'x' }), undefined); // a global ref's object
  assert.deepEqual(
    [refuseKey('gold', { coin: {} }), refuseKey('gold', { gold: {} }), refuseKey('Gold', {})],
    [undefined, 'already gold', 'a key is up to 64 lowercase letters, digits and _'],
  );
  assert.deepEqual(
    [refuseKey('g', {}), refuseKey('g'.repeat(64), {}), refuseKey('g'.repeat(65), {})],
    [undefined, undefined, 'a key is up to 64 lowercase letters, digits and _'],
  );
});

// Break: the World card opens the wrong files (a room, or a nested population folder missed), reads
// its picker's keys from the wrong field, misses a root-file write (stale keys) or refetches on any
// write, writes '' into an emptied field, or a new entry starts at an invented non-zero amount.
test('the World card opens the world files, keys its pickers from the root files, and enters typed values', () => {
  assert.deepEqual(
    [
      'cartridge.json',
      'areas/a/populations/goblins.json',
      'transports/boat.json',
      'rooms/hut.json',
      'npcs/cartridge.json',
    ].map((r) => worldFile(r)),
    [true, true, true, false, false],
  );
  assert.deepEqual(
    [worldFile('resources.json', true), worldFile('barriers/gate.json', true)],
    [true, false],
  );
  assert.deepEqual(rootNames([{ resources: { coin: {} } }, {}]), {
    resource: ['coin'],
    attribute: [],
  });
  const write = (file: string) => ({ file, sha256: file.length.toString() });
  assert.equal(rootStamp([write('rooms/hut.json')]), '');
  assert.notEqual(rootStamp([write('attributes.json')]), '');
  assert.deepEqual(
    [entered(''), entered('a'), entered('', true), entered('7', true)],
    [undefined, 'a', undefined, 7],
  );
  assert.ok(ROOTS.every((r) => Object.values(r.blank).every((v) => v === 0)));
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

// Break: the Room card's add (and the Book's add-here) writes a mechanic the compiler refuses, or
// invents words or choices: each new text key is `~`, a key or enum the author has to pick leaves
// the field unwritten (only revealed). Literals hand-checked against source.RoomDefinition.
test("a room mechanic's added value is the least valid one, its words `~`", () => {
  const room = defs['source.RoomDefinition'].properties;
  const tilde = { prose: '~' };
  const added = Object.fromEntries(
    Object.keys(room).map((f) => [f, minimal(room[f], defs)] as const),
  );
  assert.deepEqual(added, {
    actions: undefined, // an action's key is the author's
    ambient: [{ lines: [tilde], every: 1 }],
    cues: undefined, // a cue's sense is chosen
    dark: true,
    dark_description: tilde,
    description: tilde,
    details: {},
    exits: {},
    locks: {},
    name: tilde,
    sanctuary: true,
    site: undefined,
    sound: undefined,
    tags: undefined,
    variants: [{ description: tilde }],
    zones: [],
  });
  // a branch that has no least value gives way to the next one
  assert.equal(minimal({ anyOf: [{ type: 'string' }, { type: 'boolean' }] }, defs), true);
  const validate = new Ajv2020({ strict: false }).compile(served('rooms'));
  for (const [f, value] of Object.entries(added)) {
    if (value === undefined) continue;
    const doc = { name: 'room.a.name', description: 'room.a.description', exits: {} };
    change(doc, [{ path: [f], value }]);
    assert.ok(validate(doc), `${f}: ${JSON.stringify(validate.errors)}`);
  }
});

// Break: the Room card's add overwrites a present field or writes one the author must choose, an NPC's hp
// starts below zero, its
// remove drops another field, or a Book "Add here" pick adds to another room or a field not offered.
test('a field is added once (hp at the sampler pool), removed alone, added here only in its room', () => {
  const doc = { name: 'room.a.name', dark: false };
  const R = 'source.RoomDefinition';
  assert.deepEqual(added(doc, 'sanctuary', defs, R), { ...doc, sanctuary: true });
  assert.equal(added(doc, 'dark', defs, R), undefined); // present
  assert.equal(added(doc, 'sound', defs, R), undefined); // the author picks the tag
  assert.equal(added(doc, 'abstract', defs, R), undefined); // not a RoomDefinition field
  // the schema's least hp (-2147483648) is BODY_BELOW_ZERO (resources.ex:246): the sampler's pool instead
  const hp = { minimum: 0, maximum: 20, start: 20, gain: 5 };
  assert.deepEqual(added({}, 'hp', defs, 'source.NpcDefinition'), { hp });
  assert.equal(added({}, 'hp', defs, R), undefined); // no room hp
  assert.deepEqual(removed(doc, 'dark'), { name: 'room.a.name' });
  assert.equal(addedHere({ kind: 'dark', room: 'lane' }, 'lane', ['dark']), 'dark');
  assert.equal(addedHere({ kind: 'dark', room: 'well' }, 'lane', ['dark']), undefined);
  assert.equal(addedHere({ kind: 'tags', room: 'lane' }, 'lane', ['dark']), undefined);
});

// Break: the add menu offers a field whose owning capability the cartridge does not require, so the
// world stops compiling (UNDECLARED_CAPABILITY), or hides one that needs none. Owners hand-copied
// from lib/loka/content/room_parts.ex parts/1, cues.ex and construction.ex.
test("a room's add menu offers only fields the cartridge's capabilities allow", () => {
  const menu = [
    'cues',
    'dark',
    'dark_description',
    'details',
    'sanctuary',
    'site',
    'tags',
    'variants',
  ];
  assert.deepEqual(allowed('rooms', menu, { movement: 1 }), ['sanctuary']);
  assert.deepEqual(allowed('rooms', menu, { light: 1, tag: 1 }), [
    'dark',
    'dark_description',
    'sanctuary',
    'tags',
  ]);
  const rest = { sense_cue: 1, inspectable_detail: 1, construction: 1, description_variant: 1 };
  assert.deepEqual(allowed('rooms', menu, rest), [
    'cues',
    'details',
    'sanctuary',
    'site',
    'variants',
  ]);
});

// Break: an NPC or item card's add menu offers a field whose capability the cartridge lacks (the
// world stops compiling), or an ask that needs speech but not topic. Owners hand-copied from
// lib/loka/content/entities.ex parts/1, cues.ex @holders, asks.ex:21 and capability_registry.json.
test("an NPC's and an item's add menus offer only fields every owning capability allows", () => {
  const npc = ['ask', 'attack', 'daily_schedule', 'hp', 'name_variants', 'shop'];
  assert.deepEqual(allowed('npcs', npc, { speech: 1 }), ['hp']);
  const all = { speech: 1, topic: 1, commerce: 1, combat: 1 };
  const combat = { combat: { round_seconds: 3 } };
  assert.deepEqual(allowed('npcs', npc, all, { hp: 5 }, combat), ['ask', 'attack', 'hp', 'shop']);
  // combat.ex npc_profiles: attack without world.combat, or without the NPC's hp, does not compile
  assert.deepEqual(allowed('npcs', npc, all, { hp: 5 }, {}), ['ask', 'hp', 'shop']);
  assert.deepEqual(allowed('npcs', npc, all, {}, combat), ['ask', 'hp', 'shop']);
  assert.deepEqual(allowed('npcs', npc, { schedule: 1, description_variant: 1 }), [
    'daily_schedule',
    'hp',
    'name_variants',
  ]);
  const item = ['affects', 'bandage', 'edible', 'fuel', 'mass_grams', 'readable', 'slot', 'tags'];
  assert.deepEqual(allowed('items', item, {}), ['mass_grams']);
  assert.deepEqual(
    allowed('items', item, { food: 1, light: 1, equipment: 1, bleed: 1, combat: 1 }),
    ['edible', 'fuel', 'mass_grams', 'slot'],
  );
  assert.deepEqual(
    allowed('items', item, { bleed: 1, combat: 1, skill: 1, food: 1, attribute: 1 }),
    ['affects', 'bandage', 'edible', 'mass_grams'],
  );
});

// Break: a reorder, remove or add of shop offer rows diffs to ops that leave a moved row's field
// behind (a stock on the wrong offer) or drop the wrong row, so the file is not the table drawn.
test('offer rows reordered, removed or added write exactly the table drawn', () => {
  const rope = { item: 'rope', buy: 3, sell: 1 };
  const lamp = { item: 'lamp', buy: 5, sell: 2, stock: { items: ['lamp_1'] } };
  const saved = { name: 'npc.smith.name', shop: { offers: [rope, lamp] } };
  const shop = (offers: object[]) => ({ ...saved, shop: { offers } });
  const at = (...p: (string | number)[]) => ['shop', 'offers', ...p];
  assert.deepEqual(diff(saved, shop([lamp, rope])), [
    { path: at(0, 'item'), value: 'lamp' },
    { path: at(0, 'buy'), value: 5 },
    { path: at(0, 'sell'), value: 2 },
    { path: at(0, 'stock'), value: { items: ['lamp_1'] } },
    { path: at(1, 'item'), value: 'rope' },
    { path: at(1, 'buy'), value: 3 },
    { path: at(1, 'sell'), value: 1 },
    { path: at(1, 'stock'), delete: true },
  ]);
  const kit = { item: 'kit', buy: 9, sell: 4 };
  for (const draft of [shop([lamp, rope]), shop([lamp]), shop([rope, lamp, kit])]) {
    const doc = structuredClone(saved);
    change(doc, diff(saved, draft));
    assert.deepEqual(doc, draft);
  }
});

// Break: placing an item keeps its old holder (location.npc beside location.room, which the schema
// refuses), writes the key under the wrong kind, an NPC is placed through an item's location, or the
// card shows a holder other than the file's (training_sword held by aldous over an empty room box).
test('placement writes one holder of the kind picked and reads back the file', () => {
  const sword = { name: 'item.sword.name', location: { in: 'npc', npc: 'smith' } };
  const draft = placed(sword, 'items', 'room', 'yard');
  assert.deepEqual(draft, { name: 'item.sword.name', location: { in: 'room', room: 'yard' } });
  const doc = structuredClone(sword);
  change(doc, diff(sword, draft));
  assert.deepEqual(doc, draft);
  assert.deepEqual(placed(draft, 'items', 'item', 'chest').location, { in: 'item', item: 'chest' });
  assert.deepEqual(placed({ room: 'start' }, 'npcs', 'room', 'yard'), { room: 'yard' });
  assert.deepEqual(placement(sword, 'items'), { kind: 'npc', key: 'smith' });
  assert.deepEqual(placement({ location: { in: 'template' } }, 'items'), {
    kind: 'template',
    key: undefined,
  });
  assert.deepEqual(placement({}, 'items'), { kind: 'room', key: undefined });
  assert.deepEqual(placement({ room: 'yard', location: sword.location }, 'npcs'), {
    kind: 'room',
    key: 'yard',
  });
});

// Break: a picker offers or accepts ids of another kind (an offer's item from the rooms), or an
// unknown id is written to the file instead of refused at the field.
test('a reference picker takes the kind its field names and refuses an unknown id', () => {
  assert.equal(pickKind(['shop', 'offers', 0, 'item']), 'item');
  assert.equal(pickKind(['daily_schedule', '8', 'room']), 'room');
  assert.equal(pickKind(['services', 1]), 'service');
  assert.equal(pickKind(['items', '2']), 'item'); // a form's index arrives as a digit string
  assert.equal(pickKind(['location', 'npc']), 'npc');
  assert.equal(pickKind(['policy', 'with']), 'npc'); // leaf_refs.ex: a policy's `with` names an npc
  assert.equal(pickKind(['constructor']), 'constructor'); // a field name is never read off the prototype
  const items = { kind: 'item', keys: ['rope', 'lamp'] };
  assert.ok(refusePick(items, 'ropes'));
  assert.equal(refusePick(items, 'rope'), undefined);
  assert.equal(refusePick(items, ''), undefined); // cleared: the field is removed, not refused
  assert.equal(refusePick({ kind: 'fact', keys: [] }, 'any'), undefined); // no keys known: free text
});
