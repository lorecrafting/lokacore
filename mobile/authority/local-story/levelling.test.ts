// Toolbox row 4 levelling rows through real SQLite: reopen, a failed COMMIT, a lost acknowledgement
// and receipt replay for the killing round (experience and the level-up line) and Raise CON (the
// allocated point and the hp settle) (docs/system/mechanics.md, Experience and levelling).
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
import type { World } from '../../../kernel/ts/src/runtime/decision.ts';
import { openStory } from './authority.ts';
import { elapsedHost, receipts } from './__tests__/elapsed-host.test.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-levelling-save-'));
const saves = mkdtempSync(join(tmpdir(), 'loka-levelling-saves-'));
const file = join(scratch, 'artifact.json');
let artifact;
try {
  execFileSync('mix', ['loka.compile', 'cartridges/levelling_sampler', file], {
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
const rat = (x: string) => initial.entityIds[`levelling_sampler@0.0.1:npc/rat_${x}`]!;
const con = {
  cartridge_id: 'levelling_sampler',
  cartridge_version: '0.0.1',
  kind: 'attribute',
  key: 'con',
};
const LEVEL_UP = 'levelling.level_up';
const hpMax = (w: World) => gameView(w).resources!.find((r) => r.resource.key === 'hp')!.maximum;
const lines = (r: { kind: string; decision?: unknown }) =>
  ((r.decision as { narration?: { key: string }[] } | undefined)?.narration ?? []).map(
    (t) => t.key,
  );

// Breaks: the levelling section is not persisted or rebuilt on reopen; a failed or uncertain COMMIT
// of the killing round or of Raise is adopted; a lost acknowledgement applies twice; or the
// replayed receipt loses the level-up line.
test('levelling rows survive reopen, failed and lost COMMIT, and replay once', (t) => {
  t.after(() => rmSync(saves, { recursive: true, force: true }));
  for (const action of ['kill', 'raise'] as const)
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
        invocation_id: `dddddddd-8888-4888-8888-${String(++n).padStart(12, '0')}`,
        actor_id: initial.character,
        action_key,
        target_ids,
        input,
      });
      const round = () => {
        const from = story.world().state.clock;
        return { expected_run_id: story.runId(), from, until: from + 150 };
      };
      const saved = (r: { kind: string }) => assert.equal(r.kind, 'saved', JSON.stringify(r));
      saved(story.invoke(invoke('move', [], { direction: 'east' })));
      for (const x of ['a', 'b']) {
        saved(story.invoke(invoke('attack', [rat(x)])));
        saved(story.elapsed(round()));
      }
      saved(story.invoke(invoke('attack', [rat('c')])));
      const third = round();
      if (action === 'raise') saved(story.elapsed(third));
      story = reopen();
      const before = gameView(story.world()).levelling;
      assert.deepEqual(before, {
        level: action === 'kill' ? 1 : 2,
        experience: action === 'kill' ? 20 : 30,
        next: action === 'kill' ? 30 : 100,
        unspent: action === 'kill' ? 0 : 1,
      });
      const count = Number(receipts(p.sql));
      if (kind === 'failed')
        p.sql.exec(
          'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent DEFERRABLE INITIALLY DEFERRED)',
        );
      const raise = invoke('raise_attribute', [], { attribute: con });
      const run = () => (action === 'kill' ? story.elapsed(third) : story.invoke(raise));
      p.fault.kind = kind;
      p.fault.armed = true;
      assert.equal(run().kind, 'pending', action + kind);
      p.fault.reads = false;
      if (p.sql.isTransaction) p.sql.exec('ROLLBACK');
      story = reopen();
      const committed = kind === 'lost';
      const w = story.world();
      const after =
        action === 'kill'
          ? { level: 2, experience: 30, next: 100, unspent: 1 }
          : { ...before, unspent: 0 };
      assert.deepEqual(gameView(w).levelling, committed ? after : before, action + kind);
      if (action === 'raise') assert.equal(hpMax(w), committed ? 11 : 10, action + kind);
      assert.equal(receipts(p.sql), count + (committed ? 1 : 0), action + kind);
      const replay = run();
      saved(replay);
      if (replay.kind === 'saved') assert.equal(replay.replay, committed, action + kind);
      assert.equal(lines(replay).includes(LEVEL_UP), action === 'kill', action + kind);
      assert.equal(receipts(p.sql), count + 1, action + kind);
      p.sql.close();
    }
});
