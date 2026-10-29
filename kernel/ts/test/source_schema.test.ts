// The source JSON Schemas (schemas/source, written by `mix loka.source_schema`) accept
// every committed cartridge source file and refuse the shortcut mistakes an author makes.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';

const root = join(import.meta.dirname, '../../..');
const dir = join(root, 'schemas/source');
const read = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));
const files = readdirSync(dir).filter((name) => name.endsWith('.schema.json'));
const ajv = new Ajv2020({ allErrors: true });
for (const name of files) ajv.addSchema(read(join(dir, name)) as object, name);
const check = (kind: string, value: unknown) => {
  const valid = ajv.getSchema(kind.includes('#') ? kind : `${kind}.schema.json`)!;
  return valid(value) ? [] : valid.errors!;
};

test('every committed cartridge source file validates against its kind schema', () => {
  let count = 0;
  for (const cart of readdirSync(join(root, 'cartridges'))) {
    const base = join(root, 'cartridges', cart);
    for (const entry of readdirSync(base)) {
      const path = join(base, entry);
      const sources = statSync(path).isDirectory()
        ? readdirSync(path).map((name) => [entry, join(path, name)])
        : [[entry.replace(/\.json$/, ''), path]];
      for (const [kind, file] of sources.filter(([, file]) => file.endsWith('.json'))) {
        count += 1;
        assert.deepEqual(check(kind, read(file)), [], file.slice(root.length));
      }
    }
  }
  assert.ok(count > 2000, `walked ${count} files`);
});

test('every $ref in the source schemas resolves', () => {
  const defs = (read(join(dir, 'defs.schema.json')) as { $defs: object }).$defs;
  const refs: string[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object')
      for (const [k, v] of Object.entries(node)) k === '$ref' ? refs.push(v as string) : walk(v);
  };
  for (const name of files) walk(read(join(dir, name)));
  assert.ok(refs.length > 100);
  for (const ref of refs) {
    const [file, pointer] = ref.split('#/$defs/');
    assert.ok(file === '' || file === 'defs.schema.json', ref);
    assert.ok(pointer in defs, ref);
  }
});

const room = { name: 'hall.title', description: 'hall.description', exits: {} };
const step = { op: 'fact.assign', fact: 'known', value: true };
const entered = { on: { event: 'entity_entered_room', room: 'hall' }, apply: [step] };
const zoned = { zone: 'priory', on: { event: 'entity_entered_room' }, apply: [step] };
const defs = 'defs.schema.json#/$defs/';
const discount = { numerator: 1, denominator: 2, minimum: 1, skill: 'haggle' };
const consume = { items: ['log'], quantity: 1, to: { in: 'room', room: 'yard' } };
const fact = {
  version: 1,
  value_type: { type: 'bool', default: false },
  scopes: ['player'],
  meaning: 'm',
};

// Each pair: a file the schema accepts, then the same file with one mistake. The corpus
// covers every other shortcut; no committed cartridge extends a scene,
// dialogue choice or nested npc member yet. The defs rows pin the contract's
// exactlyOneRequired and requiredUnless translations.
test('the schemas refuse a misspelled field and each shortcut written wrong', () => {
  const pairs: [string, unknown, unknown][] = [
    ['rooms', room, { ...room, titel: 'hall.title' }],
    ['rooms', { ...room, title: { prose: 'Hall' } }, { ...room, title: { prose: '' } }],
    ['rooms', { extends: 'hall' }, { extends: 1 }],
    [
      'npcs',
      { extends: 'deer', behaviours: ['spoils'] },
      { extends: 'deer', behaviours: 'spoils' },
    ],
    ['reactions', entered, { ...entered, on: { event: 'entity_entered_room' } }],
    ['reactions', zoned, { ...zoned, on: entered.on }],
    ['behaviours', { reactions: {}, params: ['who'] }, { reactions: {}, params: ['holder'] }],
    ['behaviours', { reactions: {} }, { params: [] }],
    ['areas', { rooms: { hall: room } }, { rooms: { hall: { ...room, titel: 'x' } } }],
    ['reactions', { extends: 'p', on: { room: 'mill' } }, { extends: 'p', on: { rom: 'mill' } }],
    [
      'npcs',
      { extends: 'deer', room: { key: 'mill' } },
      { extends: 'deer', room: { kee: 'mill' } },
    ],
    [
      'items',
      { extends: 'pie', behaviours: [{ behaviour: 'spoils', with: {} }] },
      { extends: 'pie', behaviours: [{ with: {} }] },
    ],
    ['scenes', { extends: 'intro' }, { extends: 'intro', titel: 'x' }],
    [
      'npcs',
      { extends: 'deer', attack: { crit: { chance: 5 } } },
      { extends: 'deer', attack: { crit: { chance: 0 } } },
    ],
    [
      'dialogues',
      { extends: 'talk', choices: { ask: { check: {} } } },
      { extends: 'talk', choices: { ask: { chek: {} } } },
    ],
    [defs + 'Shop/properties/buy_discount', discount, { ...discount, friendly: true }],
    [defs + 'DialogueChoice/properties/story_point', 'lantern_resolved/carry', 'lantern_resolved'],
    [defs + 'RecipeCraft', { consume }, {}],
    ['facts', { facts: { lit: fact } }, { facts: { lit: { ...fact, colour: 'red' } } }],
  ];
  for (const [kind, good, bad] of pairs) {
    assert.deepEqual(check(kind, good), [], JSON.stringify(good));
    assert.notDeepEqual(check(kind, bad), [], JSON.stringify(bad));
  }
});
