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
// cartridge does not define, a (S4) weathering or ruin status it does not define, or construction content below kernel_api 1.99, each alone.
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
  for (const f of ['weathering', 'ruin'])
    assert.deepEqual(
      refused((c) => (hut(c)[f].key = 'nope')),
      ['UNRESOLVED_REFERENCE', at(`.${f}`)],
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
    // the S2 build service names a blueprint; without one it is unresolved, not ungated
    delete c.services['build_sampler@0.0.1:service/raise_hut'];
    delete c.services['build_sampler@0.0.1:service/cancel_hut'];
    delete c.services['build_sampler@0.0.1:service/mend_hut'];
    delete c.services['build_sampler@0.0.1:service/raze_hut'];
    delete c.npcs['build_sampler@0.0.1:npc/carpenter'].services;
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
