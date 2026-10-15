// Built rooms S2 through real SQLite (save.md, Built rooms): the raised hut's identity row is the
// only saved trace of the room; reopen derives the room again and a forged row is save_corrupt.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  gameView,
  INSTALLED,
  loadCartridge,
  newWorld,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { openStory } from './authority.ts';
import { coldReopen, elapsedHost } from './__tests__/elapsed-host.test.ts';

const kat = read('protocol/fixtures/build_sampler_hash.json');
const bundle = { canonical: kat.canonical as string, sha256: kat.sha256 as string };
const loaded = loadCartridge(
  new TextEncoder().encode(`{"cartridge":${bundle.canonical},"content_hash":"${bundle.sha256}"}`),
  INSTALLED,
);
if (!loaded.ok) throw new Error(JSON.stringify(loaded));
const initial = newWorld(
  loaded.cartridge as Cartridge,
  '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
  [1, 2, 3, 4],
);
const releases = [{ fresh: initial, content_hash: bundle.sha256 }] as const;
const npc = (k: string) => initial.entityIds[`build_sampler@0.0.1:npc/${k}`]!;
const service = (key: string) => ({
  cartridge_id: 'build_sampler',
  cartridge_version: '0.0.1',
  kind: 'service',
  key,
});

const timber = (k: string) => initial.entityIds[`build_sampler@0.0.1:item/timber_${k}`]!;

// Built rooms S3: buy the plot, take two timber, order the hut; with `reopen`, close and reopen
// the save between order and completion; then elapse to the order's due time.
function build(path: string, reopen: boolean) {
  let p = elapsedHost(path, undefined, bundle);
  const open = () => {
    const s = openStory(p.db, releases, p.host);
    if (s.kind !== 'open') throw new Error(JSON.stringify(s));
    return s;
  };
  let story = open();
  let n = 0;
  const invocation = (action_key: string, target_ids: string[], input = {}) => ({
    invocation_id: `aaaaaaaa-1091-4091-8091-${String(++n).padStart(12, '0')}`,
    actor_id: initial.character,
    action_key,
    target_ids,
    input,
  });
  const run = (i: ReturnType<typeof invocation>) => {
    const r = story.invoke(i);
    assert.equal(r.kind, 'saved', JSON.stringify(r));
    if (r.kind === 'saved') assert.equal((r.decision as any).kind, 'accepted', JSON.stringify(r));
    return r;
  };
  run(invocation('buy_plot', [npc('seller')], { service: service('buy_plot'), quoted_price: 10 }));
  run(invocation('take', [timber('a')]));
  run(invocation('take', [timber('b')]));
  const raise = invocation('raise_hut', [npc('carpenter')], {
    service: service('raise_hut'),
    quoted_price: 5,
  });
  run(raise);
  const created = () => Object.keys(story.world().state.created ?? {});
  assert.deepEqual(created(), []);
  const from = story.world().state.clock;
  if (reopen) {
    p.sql.close();
    p = elapsedHost(path, undefined, bundle);
    story = open();
  }
  const r = story.elapsed({ expected_run_id: story.runId(), from, until: from + 7200 });
  assert.equal(r.kind, 'saved', JSON.stringify(r));
  return { p, raise, invocation, created };
}

// Breaks: the order job's owner (actor_id) or the built identity row not saved or not hydrated
// (no hut, or north not offered after reopen), a reopen between order and completion minting
// a different room id, the receipt replay minting a second room, or load admitting a forged
// built row (refused as save_corrupt by a load check, not specifically by the direction check).
test('the hut survives cold reopen, its receipt replays, and a forged east row is save_corrupt', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-built-saves-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'hut.db');
  const straight = build(join(dir, 'straight.db'), false).created();
  straight.length || assert.fail('the uninterrupted run raised no hut');
  const built = build(path, true);
  const [hut] = built.created();
  assert.deepEqual(built.created(), straight);
  built.p.sql.close();

  const p = elapsedHost(path, undefined, bundle);
  const story = openStory(p.db, releases, p.host);
  if (story.kind !== 'open') throw new Error(JSON.stringify(story));
  const { raise, invocation } = built;
  assert.ok(gameView(story.world()).exits.some((e) => e.direction === 'north'));
  const again = story.invoke(raise);
  assert.equal(again.kind === 'saved' && again.replay, true, JSON.stringify(again));
  assert.deepEqual(Object.keys(story.world().state.created ?? {}), [hut]);
  const moved = story.invoke(invocation('move', [], { direction: 'north' }));
  assert.equal(moved.kind, 'saved');
  assert.equal(story.world().state.containers[story.world().body], hut);
  coldReopen(path, bundle);

  const row = p.sql
    .prepare("SELECT value FROM state_row WHERE section = 'created' AND key = ?")
    .get(hut) as { value: string };
  const forged = JSON.parse(row.value);
  forged.origin.direction = 'east';
  p.sql
    .prepare("UPDATE state_row SET value = ? WHERE section = 'created' AND key = ?")
    .run(JSON.stringify(forged), hut);
  p.sql.close();
  assert.throws(() => coldReopen(path, bundle), /save_corrupt/);
});
