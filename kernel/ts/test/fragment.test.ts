import assert from 'node:assert/strict';
import test from 'node:test';
import { fragment } from './fragment.ts';
import { read } from './read.ts';

const KAT = 'protocol/fixtures/cartridge_rooms_hash.json';
const f = fragment(KAT);

test('an unchanged fragment re-encodes to its KAT bytes and loads', () => {
  const kat = read(KAT);
  assert.deepEqual(f.bundle(), { canonical: kat.canonical, sha256: kat.sha256 });
  const w = f.genesis();
  assert.ok(w.roomIds[`${f.prefix}:room/${kat.value.entry.key}`]);
});

test('a fragment with a dangling exit is refused by the loader', () => {
  const [room] = Object.keys(f.source.rooms);
  const loaded = f.load((c) => {
    const exit: any = Object.values(c.rooms[room].exits)[0];
    exit.to = f.ref('room', 'nowhere');
  });
  assert.equal(loaded.ok, false);
  assert.equal(
    !loaded.ok && loaded.diagnostic.code,
    'UNRESOLVED_REFERENCE',
    JSON.stringify(loaded),
  );
});
