// Built rooms S1 (construction@1; cartridge.md Blueprint and site declarations): the TS loader
// admits build_sampler's pinned artifact and refuses what the compiler refuses
// (test/loka/content_construction_test.exs).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { INSTALLED, loadCartridge } from '../src/index.ts';
import { encode } from '../src/foundation/canonical.ts';
import type { Obj } from '../src/content/cartridge_refs.ts';

const kat = JSON.parse(
  readFileSync(
    new URL('../../../protocol/fixtures/build_sampler_hash.json', import.meta.url),
    'utf8',
  ),
);
const load = (c: Obj) => {
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
};
const refused = (change: (c: Obj) => void) => {
  const c = structuredClone(kat.value) as Obj;
  change(c);
  const r = load(c);
  return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path];
};
const lane = (c: Obj) => c.rooms['build_sampler@0.0.1:room/lane'];
const floor = ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'];

// Breaks: the TS loader refuses, or hashes differently, the artifact the Elixir compiler emits.
test('build_sampler: the pinned artifact loads with the same content hash', () => {
  const pinned = `{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`;
  const r = loadCartridge(new TextEncoder().encode(pinned), INSTALLED);
  assert.ok(r.ok, JSON.stringify(r));
});

// Breaks: the loader admits a site direction the room has an exit in, a site blueprint the
// cartridge does not define, a blueprint text key or enter-lock fact it does not define, or construction content below kernel_api 1.99, each alone.
test('a site names no exit direction and only defined blueprints; construction needs 1.99', () => {
  assert.deepEqual(
    refused((c) => (lane(c).exits.north = { to: c.entry })),
    ['SITE_EXIT_CONFLICT', '.cartridge.rooms["build_sampler@0.0.1:room/lane"].site.directions[0]'],
  );
  assert.deepEqual(
    refused((c) => lane(c).site.blueprints.push({ ...lane(c).site.blueprints[0], key: 'shed' })),
    [
      'UNRESOLVED_REFERENCE',
      '.cartridge.rooms["build_sampler@0.0.1:room/lane"].site.blueprints[1]',
    ],
  );
  const hut = (c: Obj) => c.blueprints['build_sampler@0.0.1:blueprint/hut'];
  const at = (p: string) => `.cartridge.blueprints["build_sampler@0.0.1:blueprint/hut"]${p}`;
  assert.deepEqual(
    refused((c) => (hut(c).title = 'blueprint.hut.nope')),
    ['UNRESOLVED_REFERENCE', at('.title')],
  );
  assert.deepEqual(
    refused((c) => (hut(c).variants[0].description = 'blueprint.hut.nope')),
    ['UNRESOLVED_REFERENCE', at('.variants[0].description')],
  );
  assert.deepEqual(
    refused((c) => (hut(c).locks.enter.root.fact.key = 'nope')),
    ['UNRESOLVED_REFERENCE', at('.locks.enter.root.fact')],
  );
  const below = (c: Obj) => (c.manifest.requires.kernel_api.at_least = '1.98');
  assert.deepEqual(refused(below), floor);
  assert.deepEqual(
    refused((c) => {
      below(c);
      delete lane(c).site;
      delete c.world.construction;
    }),
    floor,
  );
  assert.deepEqual(
    refused((c) => {
      below(c);
      delete c.blueprints;
      delete c.world.construction;
    }),
    floor,
  );
  assert.deepEqual(
    refused((c) => {
      below(c);
      delete c.blueprints;
      delete lane(c).site;
    }),
    floor,
  );
});

// Breaks: the loader admits a site or world.construction from a cartridge without construction@1.
test('a site and world.construction each need construction@1', () => {
  const unowned = (c: Obj) => {
    delete c.manifest.requires.capabilities.construction;
    delete c.lock.capabilities.construction;
    delete c.blueprints;
  };
  const gate = (at: string) => ['UNDECLARED_CAPABILITY', at];
  assert.deepEqual(
    refused((c) => {
      unowned(c);
      delete c.world.construction;
    }),
    gate('.cartridge.rooms["build_sampler@0.0.1:room/lane"].site'),
  );
  assert.deepEqual(
    refused((c) => {
      unowned(c);
      delete lane(c).site;
    }),
    gate('.cartridge.world.construction'),
  );
});
