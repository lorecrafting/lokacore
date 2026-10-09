// Toolbox row 1 status rows through real SQLite: reopen, a failed COMMIT, a lost acknowledgement
// and receipt replay for a tick and a cure (docs/system/save.md, Status recovery).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import {
  gameView,
  INSTALLED,
  loadCartridge,
  newWorld,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';
import { level, resourceRef } from '../../../kernel/ts/src/mechanics/resource.ts';
import type { World } from '../../../kernel/ts/src/runtime/decision.ts';
import { openStory } from './authority.ts';
import { elapsedHost, receipts } from './__tests__/elapsed-host.test.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-status-save-'));
const saves = mkdtempSync(join(tmpdir(), 'loka-status-saves-'));
const file = join(scratch, 'artifact.json');
let artifact;
try {
  execFileSync('mix', ['loka.compile', 'cartridges/status_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = JSON.parse(readFileSync(file, 'utf8'));
} finally {
  rmSync(scratch, { recursive: true });
}
const loaded = loadCartridge(new TextEncoder().encode(JSON.stringify(artifact)), INSTALLED);
if (!loaded.ok) throw new Error(JSON.stringify(loaded));
const bundle = { canonical: encode(artifact.cartridge), sha256: artifact.content_hash as string };
const initial = newWorld(
  loaded.cartridge as Cartridge,
  '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
  [1, 2, 3, 4],
);
const releases = [{ fresh: initial, content_hash: bundle.sha256 }] as const;
const antidote = initial.entityIds['status_sampler@0.0.1:item/antidote']!;
const hp = (w: World) => level(w, w.body, resourceRef(w, 'hp'));

// Breaks: the statuses section is not persisted or rebuilt on reopen; a failed or uncertain tick or
// cure COMMIT adopts half of hp, status row, job or custody; a lost acknowledgement applies twice.
test('status tick and cure survive reopen, failed and lost COMMIT, and replay once', (t) => {
  t.after(() => rmSync(saves, { recursive: true, force: true }));
  for (const action of ['tick', 'cure'] as const)
    for (const kind of ['failed', 'lost'] as const) {
      const path = join(saves, `${action}-${kind}.db`);
      let p = elapsedHost(path, undefined, bundle);
      const open = () => {
        const s = openStory(p.db, releases, p.host);
        if (s.kind !== 'open') throw new Error(s.kind);
        return s;
      };
      const reopen = () => {
        p.sql.close();
        p = elapsedHost(path, undefined, bundle);
        return open();
      };
      let story = open();
      let n = 0;
      const invoke = (action_key: string, target_ids: string[] = [], input = {}) => ({
        invocation_id: `dddddddd-7777-4777-8777-${String(++n).padStart(12, '0')}`,
        actor_id: initial.character,
        action_key,
        target_ids,
        input,
      });
      const t0 = story.world().state.clock;
      assert.equal(story.invoke(invoke('take', [antidote])).kind, 'saved');
      assert.equal(story.invoke(invoke('move', [], { direction: 'east' })).kind, 'saved');
      story = reopen();
      const row = gameView(story.world()).conditions?.[0];
      assert.deepEqual([row?.ends_at, row?.next_tick_at], [t0 + 300, t0 + 60]);
      const before = Number(receipts(p.sql));
      if (kind === 'failed')
        p.sql.exec(
          'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent DEFERRABLE INITIALLY DEFERRED)',
        );
      const tick = { expected_run_id: story.runId(), from: t0, until: t0 + 60 };
      const cure = invoke('eat', [antidote]);
      const run = () => (action === 'tick' ? story.elapsed(tick) : story.invoke(cure));
      p.fault.kind = kind;
      p.fault.armed = true;
      assert.equal(run().kind, 'pending', action + kind);
      p.fault.reads = false;
      if (p.sql.isTransaction) p.sql.exec('ROLLBACK');
      story = reopen();
      const committed = kind === 'lost';
      const w = story.world();
      assert.equal(hp(w), action === 'tick' && committed ? 9 : 10, action + kind);
      assert.deepEqual(
        gameView(w).conditions?.map((c) => c.next_tick_at),
        action === 'cure' && committed ? undefined : [committed ? t0 + 120 : t0 + 60],
        action + kind,
      );
      assert.equal(
        w.state.containers[antidote],
        action === 'cure' && committed ? initial.consumed : initial.body,
      );
      assert.equal(receipts(p.sql), before + (committed ? 1 : 0), action + kind);
      const replay = run();
      assert.equal(replay.kind, 'saved', action + kind);
      if (replay.kind === 'saved') assert.equal(replay.replay, committed, action + kind);
      assert.equal(receipts(p.sql), before + 1, action + kind);
      p.sql.close();
    }
});
