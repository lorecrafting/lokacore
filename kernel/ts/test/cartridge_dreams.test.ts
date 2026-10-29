import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadCartridge, INSTALLED } from '../src/index.ts';
import { bundle, prefix, ref } from './dream_fixture.ts';
const load = (change: (c: any) => void = () => {}) => {
  const b = bundle(change);
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${b.canonical},"content_hash":"${b.sha256}"}`),
    INSTALLED,
  );
};
// Breaks: another producer is permitted for a dream's sole memory write or quest acceptance.
test('loader refuses a second producer for a dream consequence', () => {
  assert.equal(load().ok, true);
  for (const [name, change] of [
    [
      'inherited quest producer',
      (c: any) =>
        (c.dialogues[`${prefix}:dialogue/bram`].choices.carry.accept = ref('quest', 'a_room')),
    ],
  ] as const)
    assert.match(JSON.stringify(load(change)), /"ok":false.*dialogue\/bram/, name);
});
