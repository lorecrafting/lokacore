import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validate } from '../src/foundation/validate.ts';
import { read } from './read.ts';
import { loadCartridge, INSTALLED } from '../src/index.ts';
import { f, light } from './light_fixture.ts';
// Break: malformed/missing participants or unbounded fuel history cross the wire boundary.
test('light contracts share independent valid and invalid wire examples', () => {
  for (const c of read('protocol/fixtures/light_contracts.json'))
    assert.equal(validate(c.contract, c.value).length === 0, c.valid, c.name);
});

// Break: actual fuel or darkness loads under API1.18, while an unused reserved light lock is over-restricted.
test('authored light fields require API1.19 rather than merely a reserved capability lock', () => {
  for (const fields of ['fuel', 'darkness', 'unused']) {
    const b = f.bundle((c) => {
      light(c);
      c.manifest.requires.kernel_api.at_least = '1.18';
      if (fields !== 'fuel') for (const item of Object.values(c.items) as any[]) delete item.fuel;
      if (fields !== 'darkness')
        for (const room of Object.values(c.rooms) as any[]) delete room.dark_description;
    });
    const loaded = loadCartridge(
      new TextEncoder().encode(`{"cartridge":${b.canonical},"content_hash":"${b.sha256}"}`),
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

// Break: a room's dark flag (loka-x6t.36) loads without light@1 in the lock.
test('a room dark flag needs light@1', () => {
  const b = f.bundle((c) => {
    for (const caps of [c.manifest.requires.capabilities, c.lock.capabilities]) delete caps.light;
    c.manifest.requires.kernel_api.at_least = '1.114';
    (Object.values(c.rooms)[0] as any).dark = true;
  });
  const loaded = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${b.canonical},"content_hash":"${b.sha256}"}`),
    INSTALLED,
  );
  assert.equal(loaded.ok, false);
  if (!loaded.ok) {
    assert.equal(loaded.diagnostic.code, 'UNDECLARED_CAPABILITY');
    assert.match(loaded.diagnostic.path, /^\.cartridge\.rooms\[.*\]\.dark$/);
  }
});
