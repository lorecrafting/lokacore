// The loader on loka-cartridge-v2 (protocol/cartridge.schema.json DiagnosticCode: rooms, entry,
// details and text). Artifacts derive from protocol/fixtures/cartridge_rooms_hash.json and
// cartridge_details_hash.json; each mutant's content_hash is recomputed with node:crypto over
// sorted-key JSON.stringify (the canonical form for these ASCII-and-one-dash values), never by
// the kernel; expected diagnostics are hand-written literals.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { loadCartridge, type Installed } from '../src/content/cartridge.ts';
import { INSTALLED } from '../src/runtime/world.ts';
import { read } from './read.ts';

const kat = read('protocol/fixtures/cartridge_rooms_hash.json');
const installed: Installed = {
  kernel_api: INSTALLED.kernel_api,
  capabilities: {
    movement: [1],
    description_variant: [1],
    fact: [1],
    policy: [1],
    inspectable_detail: [1],
    readable: [1],
    resource: [1],
    schedule: [1],
  },
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
const FL = 'rooms_sampler@0.0.1:room/ferry_landing';

test('the v2 known answer loads with its fixture hash', () => {
  const result = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`),
    installed,
  );
  assert.ok(result.ok);
  assert.equal(result.hash, kat.sha256);
});

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

// R5 S2 details (room.schema.json InspectableDetail), from cartridge_details_hash.json.
const details = read('protocol/fixtures/cartridge_details_hash.json');
const DFL = 'details_sampler@0.0.1:room/ferry_landing';
const withDetails = (f: (c: any) => void) => {
  const c = structuredClone(details.value);
  f(c);
  return c;
};

test('the details known answer loads with its fixture hash', () => {
  const bytes = `{"cartridge":${details.canonical},"content_hash":"${details.sha256}"}`;
  const result = loadCartridge(new TextEncoder().encode(bytes), installed);
  assert.ok(result.ok);
  assert.equal(result.hash, details.sha256);
});

// Breaks: a locked readable whose label and text resolve is refused.
test('a locked readable with its label and text loads', () => {
  const c = withDetails((c) => {
    c.rooms[DFL].details.notice.readable = { label: 'read.label', text: 'read.text' };
    c.text['read.label'] = 'Read notice';
    c.text['read.text'] = 'The ferry leaves at dawn.';
  });
  c.manifest.requires.capabilities.readable = 1;
  c.lock.capabilities.readable = 1;
  assert.ok(load(c).ok);
});
