// Shop declaration checks (src/content/cartridge_commerce.ts) on the compiled prices sampler: the
// fishmonger's one offer is fish_a (buy 5, sell 1), she holds fish_a and starts with 20 pennies.
// Exchange behaviour is test/prices.test.ts and test/showcase_economy.test.ts.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge } from '../src/index.ts';
import { encode } from '../src/foundation/canonical.ts';
import { commerce } from '../src/content/cartridge_commerce.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-commerce-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/prices_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const S = 'prices_sampler@0.0.1';
const at = `.cartridge.npcs["${S}:npc/fishmonger"].shop`;

function refused(edit: (c: any, shop: any) => void) {
  const c = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  edit(c, c.npcs[`${S}:npc/fishmonger`].shop);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  const r = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
  return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path];
}

// Breaks: a duplicated offer, an offer item the seller does not hold, an unfunded seller, or a
// shop below kernel_api 1.16 loads.
test('loader independently rejects malformed shop stock and funding', () => {
  assert.equal(
    refused(() => {}),
    'loaded',
  );
  assert.deepEqual(
    refused((_, shop) => shop.offers.push(shop.offers[0])),
    ['DUPLICATE_DEFINITION', at],
  );
  assert.deepEqual(
    refused((c) => (c.items[`${S}:item/fish_a`].location = { in: 'room', room: c.entry })),
    ['UNRESOLVED_REFERENCE', at],
  );
  assert.deepEqual(
    refused((c) => delete c.npcs[`${S}:npc/fishmonger`].resource_starts),
    ['RESOURCE_SPEC_INVALID', at],
  );
  // Earlier floors of the sampler mask the shop's own at the loader, so call its check directly.
  const c = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  delete c.npcs[`${S}:npc/fishmonger`].shop.offers[0].stock;
  assert.deepEqual(commerce(c), []);
  c.manifest.requires.kernel_api.at_least = '1.15';
  assert.deepEqual(
    commerce(c).map((d) => [d.code, d.path]),
    [['KERNEL_API_RANGE_INVALID', at]],
  );
});
