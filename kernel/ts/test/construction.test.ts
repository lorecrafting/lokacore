// Built rooms S1 (construction@1; cartridge.md Blueprint and site declarations): the TS loader
// admits build_sampler's pinned artifact (test/loka/content_construction_test.exs).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { INSTALLED, loadCartridge } from '../src/index.ts';

const kat = JSON.parse(
  readFileSync(
    new URL('../../../protocol/fixtures/build_sampler_hash.json', import.meta.url),
    'utf8',
  ),
);

// Breaks: the TS loader refuses, or hashes differently, the artifact the Elixir compiler emits.
test('build_sampler: the pinned artifact loads with the same content hash', () => {
  const pinned = `{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`;
  const r = loadCartridge(new TextEncoder().encode(pinned), INSTALLED);
  assert.ok(r.ok, JSON.stringify(r));
});
