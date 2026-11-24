// The author server under `bin/author.sh --lan` (editing.ts `foreign`, in-game builder §6.8): a LAN
// Host or a POST with no Origin passes only with the pairing token the preview adds.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { serve } from '../play/live.ts';
import { sha256 } from '../play/guard.ts';

const ROOM = '{\n  "name": "room.a",\n  "exits": {}\n}\n';
const TOKEN = '0123456789abcdef0123456789abcdef';
const LAN = '192.168.1.5:19006';

test('a LAN Host or an Origin-less POST needs the token header; the paired phone writes', async (t) => {
  // Breaks: the LAN Host is taken without the token (any LAN device reads the tree); a header longer
  // in bytes than in characters throws; a native-style POST with no Origin writes in --lan mode; the
  // token waives the Origin check (another page on the phone writes); the paired page is refused.
  const dir = mkdtempSync(join(tmpdir(), 'loka-lan-'));
  mkdirSync(join(dir, 'rooms'));
  writeFileSync(join(dir, 'rooms/a.json'), ROOM);
  const live = serve(0, dir, join(dir, 'none.json'), { pair: TOKEN });
  const port = await live.port;
  t.after(() => {
    live.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const ask = (path: string, headers: Record<string, string>, sent?: unknown) =>
    new Promise<number>((done, fail) => {
      const method = sent === undefined ? 'GET' : 'POST';
      request({ port, path, method, headers }, (res) => done(res.resume().statusCode!))
        .on('error', fail)
        .end(sent === undefined ? undefined : JSON.stringify(sent));
    });
  const local = `localhost:${port}`;
  const source = '/source?file=rooms/a.json';
  assert.equal(await ask(source, { host: LAN }), 403);
  assert.equal(
    await ask(source, { host: LAN, 'x-loka-pair': 'fedcba9876543210fedcba9876543210' }),
    403,
  );
  assert.equal(await ask(source, { host: LAN, 'x-loka-pair': '0123' }), 403);
  assert.equal(await ask(source, { host: LAN, 'x-loka-pair': `\u00e9${'a'.repeat(31)}` }), 403);
  assert.equal(await ask(source, { host: LAN, 'x-loka-pair': TOKEN }), 200);
  assert.equal(await ask(source, { host: local }), 200); // loopback GET: as before
  const sent = { file: 'rooms/a.json', was: sha256(ROOM), ops: [{ path: ['name'], value: 'x' }] };
  assert.equal(await ask('/change', { host: local }, sent), 403); // no Origin, no token
  assert.equal(await ask('/change', { host: LAN, origin: `http://${LAN}` }, sent), 403);
  assert.equal(readFileSync(join(dir, 'rooms/a.json'), 'utf8'), ROOM);
  const other = { host: LAN, origin: 'http://192.168.1.5:3000', 'x-loka-pair': TOKEN };
  assert.equal(await ask('/change', other, sent), 403);
  assert.equal(readFileSync(join(dir, 'rooms/a.json'), 'utf8'), ROOM);
  const phone = { host: LAN, origin: `http://${LAN}`, 'x-loka-pair': TOKEN };
  assert.equal(await ask('/change', phone, sent), 200);
  assert.match(readFileSync(join(dir, 'rooms/a.json'), 'utf8'), /"name": "x"/);
});
