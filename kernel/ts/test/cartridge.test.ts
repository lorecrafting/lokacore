// Cartridge loader (protocol/cartridge.schema.json DiagnosticCode). Expected values are the
// frozen fixtures, read with JSON.parse, and hand-written literals; never the loader's output.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { DEFINITION_MAPS, loadCartridge, type Installed } from '../src/content/cartridge.ts';
import { INSTALLED } from '../src/runtime/world.ts';
import { read } from './read.ts';

const bytes = (text: string) => new TextEncoder().encode(text);
const corpus = read('protocol/fixtures/cartridge_loader.json');
// The hello and fact v2 fixtures' capabilities, each at version 1.
const hello =
  'movement containment inspectable_detail description_variant equipment fact policy target_resolution narration quest dialogue topic check schedule resource';
const installed: Installed = {
  kernel_api: INSTALLED.kernel_api,
  capabilities: Object.fromEntries(hello.split(' ').map((k) => [k, [1]])),
  content_schema: 1,
  rule_ir: 1,
  client_features: [],
};
const diagnostic = (code: string, path: string, data: object) => ({
  severity: 'error',
  code,
  path,
  message_key: `diagnostics.${code.toLowerCase()}`,
  data,
  suggested_capabilities: [],
});
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
  const content_hash = createHash('sha256').update(text).digest('hex');
  return loadCartridge(
    bytes(JSON.stringify({ cartridge: sorted(cartridge), content_hash })),
    installed,
  );
};

// Breaks: the hash is taken over other bytes (the artifact, a re-ordered encoding), or a valid
// artifact is rejected by some stage.
test('the known-answer cartridge loads and its hash is the fixture literal', () => {
  const { canonical, sha256, value } = read('protocol/fixtures/cartridge_hash.json');
  const artifact = `{"cartridge":${canonical},"content_hash":"${sha256}"}`;
  const result = loadCartridge(bytes(artifact), installed);
  assert.ok(result.ok);
  assert.equal(result.hash, sha256);
  assert.deepEqual(JSON.parse(JSON.stringify(result.cartridge)), value); // plain prototypes
});

// One test per corpus case; each case's `break` names the bug it catches.
for (const c of corpus.cases)
  test(`corpus ${c.name}: yields exactly its hand-written diagnostic`, () =>
    assert.deepEqual(
      loadCartridge(bytes(c.artifact), c.installed),
      { ok: false, diagnostic: c.expected },
      c.break,
    ));

// Breaks: the cap is checked after decoding (over-cap bytes are also undecodable, so a late
// check reports INVALID_JSON), or the cap is exclusive.
test('the byte cap applies to the raw length before decoding', () => {
  const over = new Uint8Array(4194305).fill(0xff);
  assert.deepEqual(loadCartridge(over, installed), {
    ok: false,
    diagnostic: diagnostic('ARTIFACT_TOO_LARGE', '', { bytes: 4194305, maximum: 4194304 }),
  });
  const at = new Uint8Array(4194304).fill(0xff);
  assert.deepEqual(loadCartridge(at, installed), {
    ok: false,
    diagnostic: diagnostic('INVALID_JSON', '', {}),
  });
});

// Break: bytes that are not UTF-8 decode leniently (replacement characters, overlong or
// surrogate forms) and load. Each is a JSON string `"…"` around the bad bytes.
test('artifact bytes that are not strict UTF-8 are INVALID_JSON', () => {
  const bad = [
    [0xc3, 0x28], // continuation missing
    [0xc0, 0xaf], // overlong '/'
    [0xed, 0xa0, 0x80, 0xed, 0xb0, 0x80], // surrogate pair encoded separately (CESU-8)
    [0xed, 0xb0, 0x80], // lone low surrogate
    [0xf4, 0x90, 0x80, 0x80], // above U+10FFFF
    [0xe2, 0x82], // truncated
  ];
  for (const b of bad)
    assert.deepEqual(
      loadCartridge(new Uint8Array([0x22, ...b, 0x22]), installed),
      { ok: false, diagnostic: diagnostic('INVALID_JSON', '', {}) },
      b.map((x) => x.toString(16)).join(' '),
    );
});

// Breaks: a new definition map in the schema (keyed id@version:kind/key) is left out of the loader's
// key stage, so its map key and definition key may disagree (emotes in #509, populations before it).
test('every definition map of the cartridge schema is in the key stage', () => {
  const branches = read('protocol/cartridge.schema.json').$defs.CompiledCartridge.oneOf;
  const maps = branches.flatMap((b: any) =>
    Object.entries(b.properties)
      .filter(([, v]: [string, any]) => /@.*:[a-z_]+\/\[/.test(v.propertyNames?.pattern ?? ''))
      .map(([k]) => k),
  );
  assert.ok(maps.includes('facts'), 'the schema walk found no map');
  assert.deepEqual(
    maps.filter((m: string) => !DEFINITION_MAPS.includes(m)),
    [],
  );
  // The other way round (loka-k5z4): the key stage parses each key without a guard, so a map in it
  // without a pattern lets a bad key reach that parse and throw a TypeError, not a diagnostic.
  assert.deepEqual(
    DEFINITION_MAPS.filter((m) => !maps.includes(m)),
    [],
  );
});
