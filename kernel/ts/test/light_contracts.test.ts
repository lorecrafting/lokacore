import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validate } from '../src/foundation/validate.ts';
import { read } from './read.ts';
import { createHash } from 'node:crypto';
import { encode } from '../src/foundation/canonical.ts';
import { loadCartridge, INSTALLED } from '../src/index.ts';
// Break: malformed/missing participants or unbounded fuel history cross the wire boundary.
test('light contracts share independent valid and invalid wire examples', () => {
  for (const c of read('protocol/fixtures/light_contracts.json'))
    assert.equal(validate(c.contract, c.value).length === 0, c.valid, c.name);
});

// Break: actual fuel or darkness loads under API1.18, while an unused reserved light lock is over-restricted.
test('authored light fields require API1.19 rather than merely a reserved capability lock', () => {
  const pinned = read('protocol/fixtures/missing_child_v021_hash.json').value;
  for (const fields of ['fuel', 'darkness', 'unused']) {
    const c = structuredClone(pinned);
    c.manifest.requires.kernel_api.at_least = '1.18';
    if (fields !== 'fuel') for (const item of Object.values(c.items) as any[]) delete item.fuel;
    if (fields !== 'darkness')
      for (const room of Object.values(c.rooms) as any[]) delete room.dark_description;
    const bytes = encode(c);
    const loaded = loadCartridge(
      new TextEncoder().encode(
        JSON.stringify({
          cartridge: c,
          content_hash: createHash('sha256').update(bytes).digest('hex'),
        }),
      ),
      { ...INSTALLED, kernel_api: '1.18' },
    );
    if (fields === 'unused') assert.equal(loaded.ok, true, JSON.stringify(loaded));
    else {
      assert.equal(loaded.ok, false);
      if (!loaded.ok)
        assert.deepEqual(
          [[loaded.diagnostic.code, loaded.diagnostic.path]],
          [['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least']],
        );
    }
  }
});
