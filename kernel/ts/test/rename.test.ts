// POST /restructure's rename op (docs/design/story-tooling.md §W2): a renamed key takes every
// `checkpoints/*.json` step that names `<cartridge>@<version>:<kind>/<from>` with it, in one write,
// so one /undo puts the source and the checkpoints back. A checkpoint that names nothing under that
// kind is never written: its bytes stay exactly as the author wrote them.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { sha256 } from '../play/guard.ts';
import { serve } from '../play/live.ts';

const ROOM = 'rooms/well_lane.json';
const SRC =
  '{\n  "name": "room.well_lane.title",\n  "description": "room.well_lane.description"\n}\n';

// Compact, unformatted on purpose: a JSON round-trip would reflow it, so any rewrite shows up as a
// byte difference the byte-identical assertions catch.
const NAMES_WELL = `{"steps":[{"intent":{"action_key":"read","target_ids":["rooms_sampler@0.0.1:room/well_lane"],"input":{}}},{"advance":60000}]}`;
const NAMES_OTHER_ROOM = `{"steps":[{"intent":{"action_key":"look","target_ids":["rooms_sampler@0.0.1:room/boathouse"],"input":{}}}]}`;
const NAMES_ITEM_WELL = `{"steps":[{"intent":{"action_key":"take","target_ids":["rooms_sampler@0.0.1:item/well_lane"],"input":{}}}]}`;
const WALKED = `{"steps":[{"intent":{"action_key":"move","target_ids":[],"input":{"direction":"north"}}}]}`;

async function served(t: TestContext) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loka-rename-')));
  const src = join(dir, 'src');
  mkdirSync(join(src, 'rooms'), { recursive: true });
  mkdirSync(join(src, 'checkpoints'), { recursive: true });
  const live = serve(0, src, join(dir, 'none.json'));
  const port = await live.port;
  t.after(() => {
    live.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const ask = async (path: string, sent: unknown) => {
    const res = await fetch(`http://localhost:${port}${path}`, {
      method: 'POST',
      body: JSON.stringify(sent),
    });
    return { status: res.status, body: await res.json() };
  };
  const read = (rel: string) => readFileSync(join(src, rel), 'utf8');
  const plant = (bytes: string, rel: string) => writeFileSync(join(src, rel), bytes);
  const rename = (to: string) =>
    ask('/restructure', {
      file: ROOM,
      was: sha256(SRC),
      op: { rename: { kind: 'room', from: 'well_lane', to } },
      carry: [],
    });
  plant(SRC, ROOM);
  return { ask, read, plant, rename };
}

// Break: the route rewrites a checkpoint that names the key but not under the renamed kind — an entry
// like `rooms_sampler@0.0.1:room/well_lane` must follow the room, an item of the same key must not.
test('a rename follows only the refs of its own kind and counts them', async (t) => {
  const { read, plant, rename } = await served(t);
  plant(NAMES_WELL, 'checkpoints/named.json');
  plant(NAMES_ITEM_WELL, 'checkpoints/other_kind.json');
  plant(NAMES_OTHER_ROOM, 'checkpoints/elsewhere.json');
  plant(WALKED, 'checkpoints/walked.json');
  const done = await rename('the_well');
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.equal((done.body as { checkpoints: number }).checkpoints, 1);
  assert.equal(
    read('checkpoints/named.json'),
    NAMES_WELL.replace(':room/well_lane', ':room/the_well'),
  );
  // a step that only carries a direction names no room, so nothing in a moved checkpoint changes
  assert.equal(read('checkpoints/walked.json'), WALKED);
  assert.equal(read('rooms/the_well.json'), SRC); // the source took its new key
});

// Break: the route parses and re-serialises every checkpoint it walks past, so a file that names
// nothing it owns is reflowed although no key moved. Byte comparison, not parsed equality.
test('a checkpoint that names nothing keeps its bytes', async (t) => {
  const { read, plant, rename } = await served(t);
  plant(NAMES_OTHER_ROOM, 'checkpoints/elsewhere.json');
  plant(WALKED, 'checkpoints/walked.json');
  const done = await rename('the_well');
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.equal((done.body as { checkpoints: number }).checkpoints, 0);
  assert.equal(read('checkpoints/elsewhere.json'), NAMES_OTHER_ROOM);
  assert.equal(read('checkpoints/walked.json'), WALKED);
});

// Break: the route keys the ref on its key alone, ignoring the kind it carries, so renaming the room
// `well_lane` rewrites the `item/well_lane` a checkpoint takes. Same key, another kind: untouched.
test('a ref of the same key under another kind keeps its bytes', async (t) => {
  const { read, plant, rename } = await served(t);
  plant(NAMES_ITEM_WELL, 'checkpoints/other_kind.json');
  const done = await rename('the_well');
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.equal((done.body as { checkpoints: number }).checkpoints, 0);
  assert.equal(read('checkpoints/other_kind.json'), NAMES_ITEM_WELL);
});

// Break: the rename writes the new file but never journals the checkpoint change, so /undo restores
// the source and leaves the checkpoint naming a room that no longer exists.
test('one /undo puts the source and every rewritten checkpoint back', async (t) => {
  const { ask, read, plant, rename } = await served(t);
  plant(NAMES_WELL, 'checkpoints/named.json');
  const done = await rename('the_well');
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.equal(read('checkpoints/named.json').includes(':room/the_well'), true);
  const back = await ask('/undo', { id: (done.body as { id: number }).id });
  assert.equal(back.status, 200, JSON.stringify(back.body));
  assert.equal(read('checkpoints/named.json'), NAMES_WELL);
  assert.equal(read(ROOM), SRC);
});
