// Fast loop: only a change confined to text values travels as an overlay; anything structural
// does not (docs/system/cartridge.md#author-preview).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { textOnly } from '../play/live.ts';

const was = { format: 1, rooms: { a: { name: 'room.a' } }, text: { 'room.a': 'line one' } };

test('changed and new text values form the overlay; a removed key is not in it', () => {
  // Break: sending every text value (the page would re-resolve nothing it lacks, but a 2 MB
  // overlay per keystroke), or dropping the new key.
  const next = { ...was, text: { 'room.a': 'line two', 'room.b': 'line three' } };
  assert.deepEqual(textOnly(was, next), { 'room.a': 'line two', 'room.b': 'line three' });
  assert.deepEqual(textOnly(was, { ...was, text: {} }), {});
  assert.deepEqual(textOnly(was, was), {});
});

test('a change outside text is not text-only, even with the same text', () => {
  // Break: comparing only key sets, or only the text, so a room edit never reaches the artifact.
  assert.equal(textOnly(was, { ...was, rooms: { a: { name: 'room.b' } } }), undefined);
  assert.equal(textOnly(was, { ...was, format: 2 }), undefined);
});
