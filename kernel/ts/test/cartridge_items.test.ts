// The loader on items and NPCs (R5 S4; protocol/cartridge.schema.json DiagnosticCode). Mutants
// of the items known answer (protocol/fixtures/cartridge_items_hash.json) are re-hashed with
// node:crypto over sorted-key JSON.stringify (the canonical form for these values), never by
// the kernel; expected diagnostics are hand-written.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { loadCartridge } from '../src/content/cartridge.ts';
import { INSTALLED } from '../src/runtime/world.ts';
import { read } from './read.ts';
import { validate } from '../src/foundation/validate.ts';

const kat = read('protocol/fixtures/cartridge_items_hash.json');
const sorted = (v: any): any =>
  Array.isArray(v)
    ? v.map(sorted)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, sorted(v[k])]),
        )
      : v;
const load = (f: (c: any) => void, installed = INSTALLED) => {
  const c = structuredClone(kat.value);
  f(c);
  const text = JSON.stringify(sorted(c));
  const hash = createHash('sha256').update(text).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${text},"content_hash":"${hash}"}`),
    installed,
  );
};
const fails = (
  f: (c: any) => void,
  code: string,
  path: string,
  data = {},
  suggested: string[] = [],
) =>
  assert.deepEqual(load(f), {
    ok: false,
    diagnostic: {
      severity: 'error',
      code,
      path,
      message_key: `diagnostics.${code.toLowerCase()}`,
      data,
      suggested_capabilities: suggested,
    },
  });
const ID = 'ashmere_items@0.0.1';
const item = (key: string) => `.cartridge.items["${ID}:item/${key}"]`;
const ref = (kind: string, key: string) => ({
  cartridge_id: 'ashmere_items',
  cartridge_version: '0.0.1',
  kind,
  key,
});
const at = (c: any, key: string) => c.items[`${ID}:item/${key}`];

// Breaks: items or NPCs rejected, or hashed other than the Python known answer.
test('the items known answer loads', () => {
  const r = load(() => {});
  assert.ok(r.ok);
  assert.equal(r.hash, kat.sha256);
});

// Breaks: a location, NPC room or has_item item that names nothing still loads (the kernel
// would place the entity nowhere or read an undefined item).
test('a location, NPC room or has_item item naming no definition is UNRESOLVED_REFERENCE', () => {
  fails(
    (c) => (at(c, 'lantern').location.room = ref('room', 'nowhere')),
    'UNRESOLVED_REFERENCE',
    `${item('lantern')}.location.room`,
    { target: `${ID}:room/nowhere` },
  );
  fails(
    (c) => (at(c, 'lantern').location = { in: 'npc', npc: ref('npc', 'satchel') }),
    'UNRESOLVED_REFERENCE',
    `${item('lantern')}.location.npc`,
    { target: `${ID}:npc/satchel` },
  );
  fails(
    (c) => (c.npcs[`${ID}:npc/bram`].room = ref('room', 'river')),
    'UNRESOLVED_REFERENCE',
    `.cartridge.npcs["${ID}:npc/bram"].room`,
    { target: `${ID}:room/river` },
  );
  fails(
    (c) => (at(c, 'lantern').room_line_variants[0].when.root.item = ref('item', 'coin')),
    'UNRESOLVED_REFERENCE',
    `${item('lantern')}.room_line_variants[0].when.root.item`,
    { target: `${ID}:item/coin` },
  );
  fails(
    (c) => (at(c, 'lantern').short = 'item.nothing'),
    'UNRESOLVED_REFERENCE',
    `${item('lantern')}.short`,
    { target: 'item.nothing' },
  );
  fails(
    (c) => (c.npcs[`${ID}:npc/bram`].room_line = 'npc.nothing'),
    'UNRESOLVED_REFERENCE',
    `.cartridge.npcs["${ID}:npc/bram"].room_line`,
    { target: 'npc.nothing' },
  );
});

// Owner decision Q3 (the compiler's twin in test/loka/content_items_test.exs). Breaks: a link
// target that names nothing, a bare link in a room's own text, or a detail linked from an
// item's text loads; or a link to an item, an NPC or the text's own thing is refused.
test('a touch link naming no detail, item or NPC it may name is UNRESOLVED_REFERENCE', () => {
  const room = `.cartridge.rooms["${ID}:room/ferry_landing"]`;
  const linking = (key: string, s: string) => (c: any) => (c.text[key] = s);
  const ok = linking('detail.mooring_post', 'The [post] and a [lantern](lantern) by [Bram](bram).');
  assert.ok(load(ok).ok);
  const fail = (key: string, s: string, path: string, target: string) =>
    fails(linking(key, s), 'UNRESOLVED_REFERENCE', path, { target });
  fail('room.ferry_landing.description', 'A [crate](crate).', `${room}.description`, 'crate');
  fail('room.ferry_landing.description', 'The [water].', `${room}.description`, '[water]');
  fail(
    'item.satchel.room',
    'By the [post](mooring_post).',
    `${item('satchel')}.room_line`,
    'mooring_post',
  );
  fail(
    'item.lantern.room_oil',
    'A [lantern](lamp).',
    `${item('lantern')}.room_line_variants[0].description`,
    'lamp',
  );
});

// Breaks: a cyclic or overfull start loads, so newWorld builds a world whose containers never
// reach a room or hold more than their capacity.
test('items that start in a cycle or over a capacity are rejected', () => {
  fails(
    (c) => (at(c, 'satchel').location = { in: 'item', item: ref('item', 'lamp_oil') }),
    'CONTAINMENT_CYCLE',
    `${item('lamp_oil')}.location.item`, // each item on the cycle; the first in path order
  );
  fails(
    (c) => (at(c, 'lantern').location = { in: 'item', item: ref('item', 'lantern') }),
    'CONTAINMENT_CYCLE',
    `${item('lantern')}.location.item`,
  );
  fails(
    (c) => (at(c, 'lantern').location = { in: 'item', item: ref('item', 'satchel') }),
    'CAPACITY_EXCEEDED',
    `${item('satchel')}.capacity`,
    { capacity: 1, held: 2 },
  );
  fails(
    (c) => {
      for (const key of ['lantern', 'satchel'])
        at(c, key).location = { in: 'npc', npc: ref('npc', 'bram') };
    },
    'CAPACITY_EXCEEDED',
    `.cartridge.npcs["${ID}:npc/bram"].capacity`,
    { capacity: 1, held: 2 },
  );
  assert.ok(load((c) => (at(c, 'lantern').location = { in: 'npc', npc: ref('npc', 'bram') })).ok);
});

// Breaks: items and NPCs loading without containment in the lock, or a map key that
// disagrees with its item.
test('items and NPCs need containment, and their map keys their keys', () => {
  fails(
    (c) => {
      delete c.lock.capabilities.containment;

      delete c.manifest.requires.capabilities.containment;
    },
    'UNDECLARED_CAPABILITY',
    item('lamp_oil'),
    { capability: 'containment' },
    ['containment@1'],
  );
  fails(
    (c) => (at(c, 'lantern').key = 'lamp'),
    'ARTIFACT_DEFINITION_KEY_MISMATCH',
    item('lantern'),
    { field: 'key', declared: 'lantern', expected: 'lamp' },
  );
});

const carryingContent = (c: any) => {
  c.world = { carry: { max_grams: 0 } };
  c.manifest.requires.kernel_api.at_least = '1.3';
  for (const item of Object.values(c.items) as any[]) item.mass_grams = 0;
};

// Breaks: a nested omitted mass silently becomes zero; explicit zero is mistaken for omission.
test('carrying loader requires every mass while preserving explicit zero', () => {
  assert.ok(load(carryingContent).ok);
  fails(
    (c) => {
      carryingContent(c);
      delete at(c, 'lamp_oil').mass_grams;
    },
    'SCHEMA_VIOLATION',
    `${item('lamp_oil')}.mass_grams`,
    { error: 'missing_property' },
  );
});

// Breaks: malformed mass/carry values or unknown fields bypass the cartridge boundary.
test('carrying loader and validator reject malformed numbers and fields', () => {
  for (const [value, error] of [
    [-1, 'below_minimum'],
    [2147483648, 'above_maximum'],
    ['0', 'invalid_type'],
  ] as const)
    fails(
      (c) => {
        carryingContent(c);
        at(c, 'lantern').mass_grams = value;
      },
      'SCHEMA_VIOLATION',
      `${item('lantern')}.mass_grams`,
      { error },
    );
  fails(
    (c) => {
      carryingContent(c);
      c.world.carry.max_grams = -1;
    },
    'SCHEMA_VIOLATION',
    '.cartridge.world.carry.max_grams',
    { error: 'below_minimum' },
  );
  for (const value of [0.5, 9007199254740992])
    fails(
      (c) => {
        carryingContent(c);
        c.world.carry.max_grams = value;
      },
      'INVALID_JSON',
      '',
    );
  assert.deepEqual(validate('GameError', { code: 'too_heavy' }), []);
  assert.deepEqual(validate('WorldSettings', { carry: { max_grams: 9007199254740991 } }), []);
  assert.deepEqual(validate('WorldSettings', { carry: { max_grams: 9007199254740992 } }), [
    { path: '/carry/max_grams', code: 'invalid_type' },
  ]);
  assert.deepEqual(validate('WorldSettings', { carry: { max_grams: 0, extra: 0 } }), [
    { path: '/carry/extra', code: 'unknown_property' },
  ]);
  assert.deepEqual(validate('WorldSettings', { carry: {} }), [
    { path: '/carry/max_grams', code: 'missing_property' },
  ]);
});

// Breaks: opting in keeps an old minimum or permits an older installed implementation.
test('carrying loader requires API 1.3 and containment', () => {
  fails(
    (c) => {
      carryingContent(c);
      c.manifest.requires.kernel_api.at_least = '1.2';
    },
    'KERNEL_API_RANGE_INVALID',
    '.cartridge.manifest.requires.kernel_api.at_least',
  );
  fails(
    (c) => {
      carryingContent(c);
      delete c.manifest.requires.capabilities.containment;
      delete c.lock.capabilities.containment;
      c.items = {};
      c.npcs = {};
      c.policies = {};
      c.actions = {};
      const ferry = c.rooms[`${ID}:room/ferry_landing`];
      c.rooms = {
        [`${ID}:room/ferry_landing`]: {
          key: ferry.key,
          title: ferry.title,
          description: ferry.description,
          exits: {},
        },
      };
      for (const key of Object.keys(c.text)) c.text[key] = 'plain';
    },
    'UNDECLARED_CAPABILITY',
    '.cartridge.world.carry',
    { capability: 'containment' },
    ['containment@1'],
  );
  const old = load(carryingContent, { ...INSTALLED, kernel_api: '1.2' });
  assert.ok(!old.ok);
  if (!old.ok)
    assert.deepEqual(
      [old.diagnostic.code, old.diagnostic.path, old.diagnostic.data],
      ['KERNEL_API_UNSUPPORTED', '.cartridge.manifest.requires.kernel_api', { installed: '1.2' }],
    );
});
