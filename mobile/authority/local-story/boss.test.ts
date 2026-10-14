// Toolbox row 39 through real SQLite: a mid-fight save of cartridges/boss_sampler (a spawned guard,
// the instance facts `summoned` and `withdrawn`, the warlord withdrawn to his lair) reopens cold
// and keeps through later rounds (docs/system/mechanics.md, Boss phases).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import {
  INSTALLED,
  loadCartridge,
  newWorld,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';
import { openStory } from './authority.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-boss-save-'));
const saves = mkdtempSync(join(tmpdir(), 'loka-boss-saves-'));
const file = join(scratch, 'artifact.json');
let artifact;
try {
  execFileSync('mix', ['loka.compile', 'cartridges/boss_sampler', file], {
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
const warlord = initial.entityIds['boss_sampler@0.0.1:npc/warlord']!;

// Breaks: load or recovery refuses or rewrites a spawned member's slot or birth, a reaction's
// instance fact rows, or the scheduled move, so the reopened world differs from the saved one or
// the next round faults.
test('a mid-fight save after the summon and the withdraw reopens cold and fights on', (t) => {
  const path = join(saves, 'boss.db');
  let p = elapsedHost(path, undefined, bundle);
  t.after(() => {
    p.sql.close();
    rmSync(saves, { recursive: true, force: true });
  });
  const opened = () => {
    const s = openStory(p.db, releases, p.host);
    if (s.kind !== 'open') throw new Error(s.kind);
    return s;
  };
  const reopen = () => {
    p.sql.close();
    p = elapsedHost(path, undefined, bundle);
    return opened();
  };
  let story = opened();
  const attack = story.invoke({
    invocation_id: 'dddddddd-9999-4999-8999-000000000001',
    actor_id: initial.character,
    action_key: 'attack',
    target_ids: [warlord],
    input: {},
  });
  assert.equal(attack.kind, 'saved', JSON.stringify(attack));
  const until = (to: number) => {
    const from = story.world().state.clock;
    const r = story.elapsed({ expected_run_id: story.runId(), from, until: to });
    return r.kind;
  };
  for (const to of [1350, 2300]) {
    for (let at = story.world().state.clock + 150; at < to; at += 150)
      assert.equal(until(at), 'saved', `at ${at}`);
    assert.equal(until(to), 'saved');
    const saved = encode(story.world().state as never);
    story = reopen();
    assert.equal(encode(story.world().state as never), saved, `reopened at ${to}`);
  }
  assert.equal(until(2450), 'saved');
});
