// The World card's writes (tools/author-panel/src/edit/cards/World.tsx): its form's draft goes
// through the card's diff into POST /change on cartridge.json and resources.json, then /undo.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { diff } from '../play/card.ts';
import { sha256 } from '../play/guard.ts';
import { serve } from '../play/live.ts';
import { reachable } from '../play/world_card.ts';

// hand-formatted, not the canonical layout a write produces: undo must restore these bytes
const CARTRIDGE = '{"id": "c", "title": "t",\n "world": {"theft": {"attribute": "grit"}}}\n';
const RESOURCES = '{ "resources": { "coin": {"minimum":0,"maximum":9,"start":1,"gain":0} } }\n';

test('a World card edit round-trips to its file and undo restores the bytes', async (t) => {
  // Breaks: a nested setting or an added resource lost or misplaced on the way to the file
  // (the card's diff, /change's op path), or undo leaving the rewritten layout behind.
  const src = realpathSync(mkdtempSync(join(tmpdir(), 'loka-world-')));
  writeFileSync(join(src, 'cartridge.json'), CARTRIDGE);
  writeFileSync(join(src, 'resources.json'), RESOURCES);
  const live = serve(0, src, join(src, 'none.json'), {});
  const port = await live.port;
  t.after(() => (live.close(), rmSync(src, { recursive: true, force: true })));
  const ask = (path: string, sent: unknown) =>
    new Promise<{ status: number; body: any }>((done, fail) => {
      const req = request({ port, path, method: 'POST', headers: { host: `localhost:${port}` } });
      req.on('error', fail).on('response', async (res) => {
        let text = '';
        for await (const chunk of res) text += chunk;
        done({ status: res.statusCode!, body: JSON.parse(text) });
      });
      req.end(JSON.stringify(sent));
    });
  const read = (rel: string) => readFileSync(join(src, rel), 'utf8');
  const edits = [
    [
      'cartridge.json',
      CARTRIDGE,
      { id: 'c', title: 't', world: { theft: { attribute: 'nerve' } } },
    ],
    [
      'resources.json',
      RESOURCES,
      {
        resources: {
          coin: { minimum: 0, maximum: 9, start: 1, gain: 0 },
          wood: { minimum: 0, maximum: 0, start: 0, gain: 0 },
        },
      },
    ],
  ] as const;
  for (const [file, bytes, draft] of edits) {
    const ops = diff(JSON.parse(bytes), draft);
    const done = await ask('/change', { file, was: sha256(bytes), ops });
    assert.equal(done.status, 200, file);
    assert.deepEqual(JSON.parse(read(file)), draft, file);
    assert.equal((await ask('/undo', { id: done.body.id })).status, 200, file);
    assert.equal(read(file), bytes, file);
  }
});

// Break: a picker offers a def from another area, by its file or its `areas/<a>.json` bundle, which
// area_rules.ex:27 refuses in an area file; or hides a root def, an own-area def or a room (each allowed: areas.ex:70-73, area_rules.ex:27).
test('the pickers offer an area file its own area, the root and every room', () => {
  const nodes = ['hob', 'own', 'top', 'yard', 'elder'].map((ref, i) => ({
    ref,
    kind: i === 3 ? 'room' : 'npc',
  }));
  const files = {
    hob: 'areas/hub/npcs/hob.json',
    own: 'areas/law/npcs/own.json',
    top: 'npcs/top.json',
    yard: 'areas/hub/rooms/yard.json',
  };
  const bundled = { elder: 'areas/village.json' };
  const offered = (rel?: string) => reachable(nodes, { files, bundled }, rel).map((n) => n.ref);
  assert.deepEqual(offered('areas/law/barriers/door.json'), ['own', 'top', 'yard']);
  assert.deepEqual(offered('areas/law.json'), ['own', 'top', 'yard']);
  assert.deepEqual(offered('areas/village/npcs/x.json'), ['top', 'yard', 'elder']);
  assert.deepEqual(offered('barriers/door.json'), ['hob', 'own', 'top', 'yard', 'elder']);
  assert.deepEqual(offered(), ['hob', 'own', 'top', 'yard', 'elder']);
});
