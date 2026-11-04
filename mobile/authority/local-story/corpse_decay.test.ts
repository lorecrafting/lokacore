import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fragment } from '../../../kernel/ts/test/fragment.ts';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import {
  INSTALLED,
  loadCartridge,
  newWorld,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';
import { openStory } from './authority.ts';
import { coldReopen, elapsedHost } from './__tests__/elapsed-host.test.ts';
import { load } from './store.ts';

const showcase = fragment('protocol/fixtures/toolbox_showcase_hash.json');

// The player starts in the sapper cellar with a killing blow; the goblins never land one.
const artifact = showcase.bundle((c) => {
  c.entry.key = 'sapper_cellar';
  c.world.combat.player_attack = { chance: 100, damage_min: 100, damage_max: 100 };
  for (const [k, npc] of Object.entries(c.npcs) as [string, any][])
    if (k.endsWith('goblin')) npc.attack = { ...npc.attack, chance: 0 };
});

// Breaks: a decay job (corpse_id) a save cannot reopen, or a decay a failed COMMIT, a lost
// acknowledgement, a reopen or a receipt replay spills twice, loses or refuses (owner decision 2026-11-02).
test('corpse decay survives failed COMMIT, lost ack, reopen and replay', (t) => {
  const outcomes: Record<string, string> = {};
  for (const kind of ['failed', 'lost'] as const) {
    const loaded = loadCartridge(
      new TextEncoder().encode(
        `{"cartridge":${artifact.canonical},"content_hash":"${artifact.sha256}"}`,
      ),
      INSTALLED,
    );
    assert.ok(loaded.ok, JSON.stringify(loaded));
    if (!loaded.ok) return;
    const initial = newWorld(
      loaded.cartridge as Cartridge,
      '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
      [1, 2, 3, 4],
    );
    const releases = [{ fresh: initial, content_hash: artifact.sha256 }] as const;
    const dir = mkdtempSync(join(tmpdir(), 'loka-decay-'));
    t.after(() => rmSync(dir, { recursive: true }));
    const path = join(dir, 'save.db');
    const p = elapsedHost(path, { wall: 10000, mono: 0 }, artifact);
    const story = openStory(p.db, releases, p.host);
    assert.equal(story.kind, 'open');
    if (story.kind !== 'open') return;

    const [ear] = Object.entries(initial.state.created!).find(
      ([, e]) => e.origin.kind === 'spawned' && e.origin.role === 'loot',
    )!;
    const goblin = initial.state.containers[ear]!;
    const room = initial.state.containers[goblin]!;
    assert.equal(initial.state.containers[initial.body], room);
    const attack = story.invoke({
      invocation_id: 'dddddddd-0000-4000-8000-000000000001',
      actor_id: initial.character,
      action_key: 'attack',
      target_ids: [goblin],
      input: {},
    });
    assert.equal(attack.kind, 'saved', JSON.stringify(attack));
    const dead = story.world();
    const [corpse] = Object.entries(dead.state.created!).find(
      ([, e]) => e.origin.kind === 'death' && e.origin.victim_id === goblin,
    )!;
    const [job_id, job] = Object.entries(dead.state.jobs!).find(([, j]) => j.corpse_id === corpse)!;
    assert.equal(job.status, 'pending');
    assert.equal(dead.state.containers[ear], corpse);

    // Breaks (store.ts restorable): a decay row bound to a corpse no death created, a decay with
    // no corpse, or another kind bound to a corpse (jobRoute runs it as a decay), loads and faults
    // the later elapsed run instead of giving save_corrupt.
    if (kind === 'failed') {
      const forge = (change: object) =>
        p.sql
          .prepare("UPDATE state_row SET value=? WHERE section='jobs' AND key=?")
          .run(JSON.stringify({ ...job, ...change }), job_id);
      for (const change of [
        { corpse_id: ear },
        { corpse_id: undefined },
        { job: { ...job.job, kind: 'status' } },
      ]) {
        forge(change);
        assert.equal(
          openStory(p.db, releases, p.host).kind,
          'save_corrupt',
          JSON.stringify(change),
        );
      }
      forge({});
      assert.equal(openStory(p.db, releases, p.host).kind, 'open');
    }

    // The scheduled job reopens on a fresh connection before it fires.
    p.sql.close();
    const q = elapsedHost(path, { wall: 10000, mono: 0 }, artifact);
    const reopened = openStory(q.db, releases, q.host);
    assert.equal(reopened.kind, 'open');
    if (reopened.kind !== 'open') return;
    assert.equal(encode(reopened.world().state as never), encode(dead.state as never));

    const decay = {
      expected_run_id: reopened.runId(),
      from: dead.state.clock,
      until: job.due_time,
    };
    const old = reopened.world();
    if (kind === 'failed')
      q.sql.exec(
        'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
      );
    q.fault.kind = kind;
    q.fault.armed = true;
    assert.equal(reopened.elapsed(decay).kind, 'pending');
    assert.equal(reopened.world(), old);
    q.fault.reads = false;
    const durable = load(q.db, initial, () => assert.fail('the save exists'))!.world.state;
    if (kind === 'failed') assert.equal(encode(durable as never), encode(old.state as never));
    const retried = reopened.elapsed(decay);
    assert.equal(retried.kind, 'saved', JSON.stringify(retried));
    const w = reopened.world();
    assert.equal(w.state.containers[ear], room);
    assert.equal(w.state.containers[corpse], w.consumed);
    assert.equal(w.state.jobs![job_id]!.status, 'completed');
    const committed = encode(w.state as never);
    if (kind === 'lost') assert.equal(encode(durable as never), committed);
    outcomes[kind] = committed;
    q.sql.close();

    // Reopen after the decay and replay the elapsed: one outcome, nothing spills twice.
    const r = elapsedHost(path, { wall: 10000, mono: 0 }, artifact);
    const last = openStory(r.db, releases, r.host);
    assert.equal(last.kind, 'open');
    if (last.kind !== 'open') return;
    assert.equal(encode(last.world().state as never), committed);
    const replay = last.elapsed(decay);
    assert.equal(replay.kind, 'saved');
    if (replay.kind === 'saved') assert.equal(replay.replay, true);
    assert.equal(encode(last.world().state as never), committed);
    r.sql.close();
    coldReopen(path, artifact);
  }
  assert.equal(outcomes.failed, outcomes.lost);
});
