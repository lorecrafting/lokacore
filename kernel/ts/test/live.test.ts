// Fast loop: only a change confined to text values travels as an overlay; anything structural
// does not (docs/system/cartridge.md#author-preview).
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { serve, textOnly } from '../play/live.ts';

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

// Checkpoints are the one file the page writes. Breaks: a name that is a path writes outside
// `checkpoints/`; a body without a steps array is saved and breaks the next replay.
test('checkpoints: a name is a file under checkpoints/, the body a steps array', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-live-'));
  const port = 20000 + Math.floor(Math.random() * 20000);
  const server = serve(port, dir);
  t.after(() => server.close());
  const at = (path: string, init?: RequestInit) => fetch(`http://127.0.0.1:${port}${path}`, init);
  const steps = [{ advance: 1 }];
  assert.equal(
    (await at('/checkpoints/cellar-1', { method: 'PUT', body: '{"steps":"x"}' })).status,
    400,
  );
  assert.equal(
    (await at('/checkpoints/cellar-1', { method: 'PUT', body: JSON.stringify({ steps }) })).status,
    204,
  );
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'checkpoints/cellar-1.json'), 'utf8')), {
    steps,
  });
  assert.deepEqual(await (await at('/checkpoints')).json(), ['cellar-1']);
  assert.deepEqual(await (await at('/checkpoints/cellar-1')).json(), { steps });
  assert.equal((await at('/checkpoints/other')).status, 404);
  for (const bad of ['/checkpoints/../x', '/checkpoints/a%2F..%2Fx', '/checkpoints/A.B'])
    assert.equal((await at(bad, { method: 'PUT', body: JSON.stringify({ steps }) })).status, 404);
  assert.deepEqual(readdirSync(dir), ['checkpoints']);
});
