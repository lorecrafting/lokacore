// Homestead row hs-5 through real SQLite: the stew's Eat (meal line, then `fed`'s applied line)
// across reopen, a failed COMMIT, a lost acknowledgement and replay (docs/system/save.md).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
import { value } from '../../../kernel/ts/src/mechanics/attributes/shared.ts';
import type { World } from '../../../kernel/ts/src/runtime/decision.ts';
import { openStory } from './authority.ts';
import { coldReopen, elapsedHost, receipts } from './__tests__/elapsed-host.test.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-kitchen-save-'));
const saves = mkdtempSync(join(tmpdir(), 'loka-kitchen-saves-'));
const file = join(scratch, 'artifact.json');
let artifact;
try {
  execFileSync('mix', ['loka.compile', 'cartridges/kitchen_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = JSON.parse(readFileSync(file, 'utf8'));
} finally {
  rmSync(scratch, { recursive: true });
}
// Second-opinion probe C: a lawful reaction on the first `fed` adds spoiling's line to the Eat.
const status = (key: string) => ({
  cartridge_id: 'kitchen_sampler',
  cartridge_version: '0.0.1',
  kind: 'status',
  key,
});
artifact.cartridge.reactions['kitchen_sampler@0.0.1:reaction/fed_seen'] = {
  key: 'fed_seen',
  on: { event: 'status_applied', status: status('fed') },
  steps: [{ op: 'status.apply', status: status('spoiling') }],
};
const canonical = encode(artifact.cartridge);
const bundle = { canonical, sha256: createHash('sha256').update(canonical).digest('hex') };
const loaded = loadCartridge(
  new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${bundle.sha256}"}`),
  INSTALLED,
);
if (!loaded.ok) throw new Error(JSON.stringify(loaded));
const initial = newWorld(
  loaded.cartridge as Cartridge,
  '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
  [1, 2, 3, 4],
);
const releases = [{ fresh: initial, content_hash: bundle.sha256 }] as const;
const S = 'kitchen_sampler@0.0.1';
const id = (k: string) => initial.entityIds[`${S}:${k}`]!;
const ref = (kind: string, key: string) => ({
  cartridge_id: 'kitchen_sampler',
  cartridge_version: '0.0.1',
  kind,
  key,
});
const str = (w: World) => value(w, w.character, ref('attribute', 'str') as never);
const lines = [
  { key: 'narration.eat_stew_plain' },
  { key: 'narration.fed.applied' },
  { key: 'narration.spoiling.applied' },
];

// Breaks: the Eat receipt's status line refused on replay or reopen (the receipt allowed one line
// only, or only the meal's own statuses' lines, so a reaction's line opened as save_corrupt); a
// failed or uncertain COMMIT adopting half of the stew's custody or the fed status; a lost
// acknowledgement applying fed twice; a forged line 0 accepted as the meal's narration.
test('the stew Eat survives reopen, failed and lost COMMIT and replay; a forged line 0 is refused', (t) => {
  t.after(() => rmSync(saves, { recursive: true, force: true }));
  for (const kind of ['failed', 'lost'] as const) {
    const path = join(saves, `${kind}.db`);
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
      invocation_id: `eeeeeeee-5555-4555-8555-${String(++n).padStart(12, '0')}`,
      actor_id: initial.character,
      action_key,
      target_ids,
      input,
    });
    const saved = (i: ReturnType<typeof invoke>) => {
      const r = story.invoke(i);
      assert.equal(r.kind, 'saved', JSON.stringify(r));
      if (r.kind === 'saved') assert.equal((r.decision as any).kind, 'accepted', JSON.stringify(r));
    };
    const service = (action: string, key: string) =>
      invoke(action, [id('npc/cook')], { service: ref('service', key), quoted_price: 1 });
    saved(invoke('move', [], { direction: 'north' }));
    saved(invoke('take', [id('item/fish_01')]));
    saved(invoke('take', [id('item/fish_02')]));
    saved(invoke('move', [], { direction: 'south' }));
    saved(service('commission', 'stew'));
    const from = story.world().state.clock;
    assert.equal(
      story.elapsed({ expected_run_id: story.runId(), from, until: from + 300 }).kind,
      'saved',
    );
    saved(service('claim', 'claim'));
    const stew = id('item/stew_plain_01');
    story = reopen();
    assert.equal(story.world().state.containers[stew], initial.body);
    const before = Number(receipts(p.sql));
    if (kind === 'failed')
      p.sql.exec(
        'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent DEFERRABLE INITIALLY DEFERRED)',
      );
    const eat = invoke('eat', [stew]);
    p.fault.kind = kind;
    p.fault.armed = true;
    assert.equal(story.invoke(eat).kind, 'pending', kind);
    p.fault.reads = false;
    if (p.sql.isTransaction) p.sql.exec('ROLLBACK');
    story = reopen();
    const committed = kind === 'lost';
    assert.equal(story.world().state.containers[stew], committed ? initial.consumed : initial.body);
    assert.equal(str(story.world()), committed ? 11 : 10, kind);
    assert.equal(receipts(p.sql), before + (committed ? 1 : 0), kind);
    const replay = story.invoke(eat);
    assert.deepEqual(
      replay.kind === 'saved' && [replay.replay, (replay.decision as any).narration],
      [committed, lines],
      kind,
    );
    assert.equal(receipts(p.sql), before + 1, kind);
    story = reopen();
    assert.equal(str(story.world()), 11, kind);
    const row = p.sql
      .prepare('SELECT command_id, response FROM receipt WHERE invocation_id=?')
      .get(eat.invocation_id) as { command_id: string; response: string };
    assert.deepEqual(story.narration(row.command_id)?.lines, lines, kind);
    const forge = (forged: unknown[]) => {
      const d = { ...JSON.parse(row.response), narration: forged };
      p.sql
        .prepare('UPDATE receipt SET response=? WHERE invocation_id=?')
        .run(JSON.stringify(d), eat.invocation_id);
      return () => story.narration(row.command_id);
    };
    // save.md binds only line 0: later lines are free (known limit: a forged bare [meal] passes).
    for (const free of [[lines[0]], [lines[0], lines[2], lines[1], lines[1]]])
      assert.deepEqual(forge(free)()?.lines, free, kind);
    // Red controls: line 0 replaced, missing (a status line first) or null.
    for (const forged of [
      [{ key: 'narration.fish_seen' }, ...lines.slice(1)],
      lines.slice(1),
      [null, ...lines.slice(1)],
    ])
      assert.throws(forge(forged), /invalid committed Eat/, JSON.stringify(forged));
    p.sql
      .prepare('UPDATE receipt SET response=? WHERE invocation_id=?')
      .run(row.response, eat.invocation_id);
    p.sql.close();
    coldReopen(path, bundle);
  }
});
