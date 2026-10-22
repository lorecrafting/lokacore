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
test('a fragment with a dangling exit is refused by the loader', () => {
  const [room] = Object.keys(f.source.rooms);
  const [dir] = Object.keys(f.source.rooms[room].exits);
  const loaded = f.load((c) => (c.rooms[room].exits[dir].to = f.ref('room', 'nowhere')));
  assert.ok(!loaded.ok);
  const { code, path, data } = loaded.diagnostic;
  assert.deepEqual(
    { code, path, data },
    {
      code: 'UNRESOLVED_REFERENCE',
      path: `.cartridge.rooms["${room}"].exits.${dir}.to`,
      data: { target: `${f.prefix}:room/nowhere` },
    },
  );
});
