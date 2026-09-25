// The loader on loka-cartridge-v2 (protocol/cartridge.schema.json DiagnosticCode: rooms, entry
// and text). Artifacts derive from protocol/fixtures/cartridge_rooms_hash.json; each mutant's
// content_hash is recomputed with node:crypto over sorted-key JSON.stringify (the canonical
// form for these ASCII-and-one-dash values), never by the kernel; expected diagnostics are
// hand-written literals.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { loadCartridge, type Installed } from '../src/cartridge.ts';
import { read } from './read.ts';

const kat = read('protocol/fixtures/cartridge_rooms_hash.json');
const installed: Installed = {
  kernel_api: '1.0',
  capabilities: { movement: [1], description_variant: [1], fact: [1] },
  content_schema: 1,
  rule_ir: 1,
  client_features: [],
};
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
const load = (cartridge: any) => {
  const text = JSON.stringify(sorted(cartridge));
  const hash = createHash('sha256').update(text).digest('hex');
  const artifact = `{"cartridge":${text},"content_hash":"${hash}"}`;
  return loadCartridge(new TextEncoder().encode(artifact), installed);
};
const fails = (
  cartridge: any,
  code: string,
  path: string,
  data: object,
  suggested: string[] = [],
) =>
  assert.deepEqual(load(cartridge), {
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
const mutant = (f: (c: any) => void) => {
  const c = structuredClone(kat.value);
  f(c);
  return c;
};
const FL = 'ashmere_rooms@0.0.1:room/ferry_landing';

test('the v2 known answer loads with its fixture hash', () => {
  const result = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`),
    installed,
  );
  assert.ok(result.ok);
  assert.equal(result.hash, kat.sha256);
});

// Breaks: the loader trusts compiled references (an exit to nowhere reaches the rules).
test('an exit or entry naming no room of this cartridge is UNRESOLVED_REFERENCE', () => {
  const to = { cartridge_id: 'ashmere_rooms', cartridge_version: '0.0.1', kind: 'room', key: 'x' };
  fails(
    mutant((c) => (c.rooms[FL].exits.north.to = to)),
    'UNRESOLVED_REFERENCE',
    `.cartridge.rooms["${FL}"].exits.north.to`,
    { target: 'ashmere_rooms@0.0.1:room/x' },
  );
  fails(
    mutant((c) => (c.entry = { ...c.entry, cartridge_id: 'other' })),
    'UNRESOLVED_REFERENCE',
    '.cartridge.entry',
    { target: 'other@0.0.1:room/ferry_landing' },
  );
  fails(
    mutant((c) => (c.entry = { ...c.entry, kind: 'fact' })),
    'UNRESOLVED_REFERENCE',
    '.cartridge.entry',
    { target: 'ashmere_rooms@0.0.1:fact/ferry_landing' },
  );
});

// Breaks: play would print a raw key.
test('a room text key missing from the catalog is UNRESOLVED_REFERENCE', () =>
  fails(
    mutant((c) => delete c.text['room.ferry_landing.title']),
    'UNRESOLVED_REFERENCE',
    `.cartridge.rooms["${FL}"].title`,
    { target: 'room.ferry_landing.title' },
  ));

// Breaks: rooms load when their owning capability is not locked (05 §6).
test('rooms without movement in the lock are UNDECLARED_CAPABILITY', () =>
  fails(
    mutant((c) => {
      delete c.manifest.requires.capabilities.movement;
      delete c.lock.capabilities.movement;
    }),
    'UNDECLARED_CAPABILITY',
    '.cartridge.rooms["ashmere_rooms@0.0.1:room/boathouse"]',
    { capability: 'movement' },
    ['movement@1'],
  ));

// Breaks: the key stage skips the rooms map.
test("a room map key that disagrees with the room's key is ARTIFACT_DEFINITION_KEY_MISMATCH", () =>
  fails(
    mutant((c) => (c.rooms[FL].key = 'dock')),
    'ARTIFACT_DEFINITION_KEY_MISMATCH',
    `.cartridge.rooms["${FL}"]`,
    { field: 'key', declared: 'ferry_landing', expected: 'dock' },
  ));

// Breaks: v1 accepts v2's fields (the v1 hash domain would change meaning).
test('a v1 artifact carrying rooms is UNKNOWN_FIELD', () =>
  fails(
    mutant((c) => (c.format = 'loka-cartridge-v1')),
    'UNKNOWN_FIELD',
    '.cartridge.entry',
    {},
  ));
