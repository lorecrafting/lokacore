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

// Breaks: the TS loader refuses, or hashes differently, the artifact the Elixir compiler emits.
test('build_sampler: the pinned artifact loads with the same content hash', () => {
  const pinned = `{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`;
  const r = loadCartridge(new TextEncoder().encode(pinned), INSTALLED);
  assert.ok(r.ok, JSON.stringify(r));
});

// Breaks (Built rooms S2): the loader admits a build service whose direction is not in the
// site's directions, whose blueprint the site does not list, or whose site does not resolve.
test('a build benefit names a direction and blueprint of its resolved site', () => {
  const svc = (c: Obj) => c.services['build_sampler@0.0.1:service/raise_hut'];
  const at = (p: string) => `.cartridge.services["build_sampler@0.0.1:service/raise_hut"]${p}`;
  assert.deepEqual(
    refused((c) => (svc(c).benefit.direction = 'east')),
    ['SCHEMA_VIOLATION', at('.benefit.direction')],
  );
  assert.deepEqual(
    refused((c) => {
      const hut = 'build_sampler@0.0.1:blueprint/hut';
      c.blueprints['build_sampler@0.0.1:blueprint/shed'] = { ...c.blueprints[hut], key: 'shed' };
      svc(c).benefit.blueprint = { ...svc(c).benefit.blueprint, key: 'shed' };
    }),
    ['SCHEMA_VIOLATION', at('.benefit.blueprint')],
  );
  assert.deepEqual(
    refused((c) => (svc(c).benefit.site = { ...svc(c).benefit.site, key: 'nowhere' })),
    ['UNRESOLVED_REFERENCE', at('.benefit.site')],
  );
});

// Breaks (Built rooms S4): the loader admits a mend whose direction is not in its site's
// directions, whose site lists no blueprint with a ruin to cure, or whose site does not resolve.
test('a mend benefit names a direction of its resolved site and a site blueprint with a ruin', () => {
  const svc = (c: Obj) => c.services['build_sampler@0.0.1:service/mend_hut'];
  const at = (p: string) => `.cartridge.services["build_sampler@0.0.1:service/mend_hut"]${p}`;
  assert.deepEqual(
    refused((c) => (svc(c).benefit.direction = 'east')),
    ['SCHEMA_VIOLATION', at('.benefit.direction')],
  );
  assert.deepEqual(
    refused((c) => delete c.blueprints['build_sampler@0.0.1:blueprint/hut'].ruin),
    ['SCHEMA_VIOLATION', at('.benefit.site')],
  );
  assert.deepEqual(
    refused((c) => (svc(c).benefit.site = { ...svc(c).benefit.site, key: 'nowhere' })),
    ['UNRESOLVED_REFERENCE', at('.benefit.site')],
  );
  assert.deepEqual(
    refused((c) => delete c.text['service.nothing_to_mend']),
    ['UNRESOLVED_REFERENCE', at('.target')],
  );
});

// Breaks (Built rooms S5): the loader admits a raze whose direction is not in its site's
// directions or whose site does not resolve, or a raze without its two refusal texts.
test('a raze benefit names a direction of its resolved site and has its refusal texts', () => {
  const svc = (c: Obj) => c.services['build_sampler@0.0.1:service/raze_hut'];
  const at = (p: string) => `.cartridge.services["build_sampler@0.0.1:service/raze_hut"]${p}`;
  assert.deepEqual(
    refused((c) => (svc(c).benefit.direction = 'east')),
    ['SCHEMA_VIOLATION', at('.benefit.direction')],
  );
  assert.deepEqual(
    refused((c) => (svc(c).benefit.site = { ...svc(c).benefit.site, key: 'nowhere' })),
    ['UNRESOLVED_REFERENCE', at('.benefit.site')],
  );
  for (const [key, path] of [
    ['service.nothing_to_raze', '.target'],
    ['service.occupied', '.occupied'],
  ])
    assert.deepEqual(
      refused((c) => delete c.text[key]),
      ['UNRESOLVED_REFERENCE', at(path)],
    );
});

// Breaks (Built rooms S3): the loader admits a claim on a build commission (it has no output to
// hand over; the room is raised at completion), or a build commission whose fact is not a false-default player bool;
// row kgd.70: a free build admitted (price 0 is for an entitlement barter only).
test('a build commission cannot be claimed or free and its fact is a player bool', () => {
  const sv = (c: Obj, k: string) => c.services[`build_sampler@0.0.1:service/${k}`];
  assert.deepEqual(
    refused((c) => (sv(c, 'cancel_hut').benefit.kind = 'claim')),
    [
      'SCHEMA_VIOLATION',
      '.cartridge.services["build_sampler@0.0.1:service/cancel_hut"].benefit.service',
    ],
  );
  assert.deepEqual(
    refused((c) => {
      sv(c, 'raise_hut').price = 0;
      c.manifest.requires.kernel_api.at_least = '1.102';
    }),
    ['SCHEMA_VIOLATION', '.cartridge.services["build_sampler@0.0.1:service/raise_hut"].price'],
  );
  assert.deepEqual(
    refused((c) => (c.facts['build_sampler@0.0.1:fact/hut_ordered'].value_type.default = true)),
    [
      'SCHEMA_VIOLATION',
      '.cartridge.services["build_sampler@0.0.1:service/raise_hut"].benefit.fact',
    ],
  );
});
