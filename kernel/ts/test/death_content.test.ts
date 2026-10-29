import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { bundle } from './death_fixture.ts';
import { INSTALLED, loadCartridge } from '../src/index.ts';
import { encode } from '../src/foundation/canonical.ts';

// Breaks: the artifact boundary admits a corpse template with no mass, which fresh cannot place.
// The corpse, shrine and restoration rules are the compiler's (content_death_test.exs).
test('a corpse template without a mass is refused', () => {
  const c = structuredClone(bundle.value);
  delete c.items['cellar_sampler@0.0.8:item/player_corpse'].mass_grams;
  const result = loadCartridge(
    new TextEncoder().encode(
      JSON.stringify({
        cartridge: c,
        content_hash: createHash('sha256').update(encode(c)).digest('hex'),
      }),
    ),
    INSTALLED,
  );
  assert.equal(result.ok ? 'loaded' : result.diagnostic.code, 'SCHEMA_VIOLATION');
});
