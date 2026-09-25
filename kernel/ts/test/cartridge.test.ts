// Cartridge loader (protocol/cartridge.schema.json DiagnosticCode). Expected values are the
// frozen fixtures, read with JSON.parse, and hand-written literals; never the loader's output.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadCartridge, type Installed } from '../src/cartridge.ts';
import { read } from './read.ts';

const bytes = (text: string) => new TextEncoder().encode(text);
const corpus = read('protocol/fixtures/cartridge_loader.json');
const installed: Installed = corpus.cases.find(
  (c: { name: string }) => c.name === 'hash_mismatch',
).installed;
const diagnostic = (code: string, path: string, data: object) => ({
  severity: 'error',
  code,
  path,
  message_key: `diagnostics.${code.toLowerCase()}`,
  data,
  suggested_capabilities: [],
});

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

// Each case's `break` names the bug it catches.
test('each invalid artifact yields exactly its hand-written diagnostic', () => {
  for (const c of corpus.cases)
    assert.deepEqual(
      loadCartridge(bytes(c.artifact), c.installed),
      { ok: false, diagnostic: c.expected },
      `${c.name}: ${c.break}`,
    );
});

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
