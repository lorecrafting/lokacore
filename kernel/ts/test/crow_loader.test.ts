import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bundle, prefix } from './transport_fixture.ts';
import { INSTALLED, loadCartridge } from '../src/index.ts';
const coinRef = `${prefix}:item/old_coin`;

// Breaks: a declared shiny container or protected root loads and lets its descendants/quest property travel.
test('crow allowlist rejects containers, wearable and protected item definitions', () => {
  for (const patch of [
    { container: true, capacity: 2 },
    { give_allowed: false },
    { slot: 'cloak' },
  ]) {
    const b = bundle((c: any) => Object.assign(c.items[coinRef], patch));
    const loaded = loadCartridge(
      new TextEncoder().encode(`{"cartridge":${b.canonical},"content_hash":"${b.sha256}"}`),
      INSTALLED,
    );
    assert.equal(loaded.ok, false);
    if (!loaded.ok) {
      assert.equal(loaded.diagnostic.code, 'SCHEMA_VIOLATION');
      assert.ok(loaded.diagnostic.path.endsWith('.scavenge'));
    }
  }
});
// Breaks: a one-way authored transport corridor loads and strands a crow on its return.
test('loader refuses a crow corridor without its reciprocal return edge', () => {
  const b = bundle((c: any) => {
    delete c.rooms[`${prefix}:room/well_lane`].exits.south;
  });
  const loaded = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${b.canonical},"content_hash":"${b.sha256}"}`),
    INSTALLED,
  );
  assert.equal(loaded.ok, false);
  if (!loaded.ok) {
    assert.equal(loaded.diagnostic.code, 'SCHEMA_VIOLATION');
    assert.ok(loaded.diagnostic.path.endsWith('.scavenge'));
  }
});
