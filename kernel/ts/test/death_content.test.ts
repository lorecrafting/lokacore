import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { bundle } from './death_fixture.ts';
import { INSTALLED, loadCartridge } from '../src/index.ts';
import { encode } from '../src/foundation/canonical.ts';

// Breaks: the artifact boundary admits invalid templates that fresh/hydration cannot place safely.
test('corpse content requires templates, valid shrine/restoration and its capability/API contract', () => {
  const player = 'ashmere_sampler@0.0.8:item/player_corpse';
  for (const [name, mutate, code] of [
    [
      'old API',
      (c: any) => {
        c.manifest.requires.kernel_api.at_least = '1.4';
      },
      'KERNEL_API_RANGE_INVALID',
    ],
    [
      'missing death capability',
      (c: any) => {
        delete c.lock.capabilities.death;
        delete c.manifest.requires.capabilities.death;
      },
      'UNDECLARED_CAPABILITY',
    ],
    [
      'missing settings',
      (c: any) => {
        delete c.world.death;
      },
      'SCHEMA_VIOLATION',
    ],
    [
      'wrong reference kind',
      (c: any) => {
        c.world.death.shrine.kind = 'item';
      },
      'UNRESOLVED_REFERENCE',
    ],
    [
      'unknown shrine',
      (c: any) => {
        c.world.death.shrine.key = 'missing';
      },
      'UNRESOLVED_REFERENCE',
    ],
    [
      'ordinary item as corpse',
      (c: any) => {
        c.world.death.player_corpse.key = 'lantern';
      },
      'SCHEMA_VIOLATION',
    ],
    [
      'ambiguous corpse kind',
      (c: any) => {
        c.world.death.npc_corpse = c.world.death.player_corpse;
      },
      'SCHEMA_VIOLATION',
    ],
    [
      'authored child in template',
      (c: any) => {
        c.items['ashmere_sampler@0.0.8:item/lantern'].location = {
          in: 'item',
          item: c.world.death.player_corpse,
        };
      },
      'SCHEMA_VIOLATION',
    ],
    [
      'finite capacity',
      (c: any) => {
        c.items[player].capacity = 1;
      },
      'SCHEMA_VIOLATION',
    ],
    [
      'slot',
      (c: any) => {
        c.items[player].slot = 'cloak';
      },
      'SCHEMA_VIOLATION',
    ],
    [
      'barrier',
      (c: any) => {
        c.items[player].barrier = c.items['ashmere_sampler@0.0.8:item/trunk'].barrier;
        delete c.items['ashmere_sampler@0.0.8:item/trunk'].barrier;
      },
      'SCHEMA_VIOLATION',
    ],
    [
      'missing mass',
      (c: any) => {
        delete c.items[player].mass_grams;
      },
      'SCHEMA_VIOLATION',
    ],
    [
      'restoration outside HP bounds',
      (c: any) => {
        c.world.death.restore.hp = 11;
      },
      'SCHEMA_VIOLATION',
    ],
    [
      'missing restoration pool',
      (c: any) => {
        delete c.resources['ashmere_sampler@0.0.8:resource/mv'];
        delete c.world.movement;
      },
      'SCHEMA_VIOLATION',
    ],
  ] as const) {
    const c = structuredClone(bundle.value);
    mutate(c);
    const result = loadCartridge(
      new TextEncoder().encode(
        JSON.stringify({
          cartridge: c,
          content_hash: createHash('sha256').update(encode(c)).digest('hex'),
        }),
      ),
      INSTALLED,
    );
    assert.ok(!result.ok, name);
    if (!result.ok) assert.equal(result.diagnostic.code, code, name);
  }
});
