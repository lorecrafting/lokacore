import assert from 'node:assert/strict';
import test from 'node:test';
import { fragment } from './fragment.ts';
import { read } from './read.ts';

const KAT = 'protocol/fixtures/cartridge_rooms_hash.json';
const f = fragment(KAT);

// Breaks: the helper re-encodes or re-hashes the KAT differently from its frozen bytes.
test('an unchanged fragment re-encodes to its KAT bytes and loads', () => {
  const kat = read(KAT);
  assert.deepEqual(f.bundle(), { canonical: kat.canonical, sha256: kat.sha256 });
  f.genesis();
});

// Breaks: the change misses the loaded bytes (loads ok) or the re-hash (CONTENT_HASH_MISMATCH).
test('a fragment whose room key disagrees with its map key is refused by the loader', () => {
  const [room] = Object.keys(f.source.rooms);
  const loaded = f.load((c) => (c.rooms[room].key = 'nowhere'));
  assert.ok(!loaded.ok);
  const { code, path, data } = loaded.diagnostic;
  assert.deepEqual(
    { code, path, data },
    {
      code: 'ARTIFACT_DEFINITION_KEY_MISMATCH',
      path: `.cartridge.rooms["${room}"]`,
      data: { field: 'key', declared: room.split('/')[1], expected: 'nowhere' },
    },
  );
});
