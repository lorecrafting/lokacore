import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle, fresh, ref, rat } from '../../../kernel/ts/test/combat_fixture.ts';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import {
  loadCartridge,
  INSTALLED,
  newWorld,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';
import { level, resourceRef } from '../../../kernel/ts/src/mechanics/resource.ts';
import { openStory } from './authority.ts';
import { coldReopen, elapsedHost } from './__tests__/elapsed-host.test.ts';
import { load } from './store.ts';

// Breaks: a Diku round-1 Attack (loka-kgd.197) that a failed COMMIT, a lost acknowledgement,
// a reopen or a receipt replay draws again, applies twice or refuses (a fatal round 1 leaves no job).
test('a round-1 initiative Attack, fatal or not, survives failed COMMIT, lost ack, reopen and replay', (t) => {
  // Every strike that may land lands for a fixed 1 (fatal: 10), so the outcome holds whoever
  // the initiative draw puts first; only the fatal rat cannot hit back.
  for (const fatal of [true, false]) {
    const outcomes: Record<string, string> = {};
    for (const kind of ['failed', 'lost'] as const) {
      const content = structuredClone(bundle.value);
      const combat = content.world.combat;
      combat.initiative = true;
      combat.player_attack = {
        chance: 100,
        damage_min: fatal ? 10 : 1,
        damage_max: fatal ? 10 : 1,
      };
      content.npcs[ref(fresh, 'npc', 'cellar_rat_1')].attack = {
        chance: fatal ? 0 : 100,
        damage_min: 1,
        damage_max: 1,
      };
      const canonical = encode(content);
      const sha256 = createHash('sha256').update(canonical).digest('hex');
      const artifact = { canonical, sha256 };
      const loaded = loadCartridge(
        new TextEncoder().encode(JSON.stringify({ cartridge: content, content_hash: sha256 })),
        INSTALLED,
      );
      assert.ok(loaded.ok);
      if (!loaded.ok) return;
      const initial = newWorld(loaded.cartridge as Cartridge, fresh.context, [1, 2, 3, 4]);
      const releases = [{ fresh: initial, content_hash: sha256 }] as const;
      const dir = mkdtempSync(join(tmpdir(), 'loka-initiative-'));
      t.after(() => rmSync(dir, { recursive: true }));
      const path = join(dir, 'save.db');
      const p = elapsedHost(path, { wall: 10000, mono: 0 }, artifact);
      const story = openStory(p.db, releases, p.host);
      assert.equal(story.kind, 'open');
      if (story.kind !== 'open') return;
      let n = 0;
      const invocation = (action_key: string, target_ids: string[] = [], input = {}) => ({
        invocation_id: `bbbbbbbb-0000-4000-8000-${String(++n).padStart(12, '0')}`,
        actor_id: initial.character,
        action_key,
        target_ids,
        input,
      });
      for (const direction of ['north', 'east', 'down'])
        assert.equal(story.invoke(invocation('move', [], { direction })).kind, 'saved');
      const attack = invocation('attack', [rat(initial)]);
      const old = story.world();

      // A genuinely failed COMMIT (deferred FK) leaves nothing durable and its retry decides afresh;
      // a lost acknowledgement leaves the commit durable and its retry replays that one receipt.
      if (kind === 'failed')
        p.sql.exec(
          'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
        );
      p.fault.kind = kind;
      p.fault.armed = true;
      assert.equal(story.invoke(attack).kind, 'pending');
      assert.equal(story.world(), old);
      p.fault.reads = false;
      const durable = load(p.db, initial, () => assert.fail('the save exists'))!.world.state;
      if (kind === 'failed') assert.equal(encode(durable as never), encode(old.state as never));
      const retried = story.invoke(attack);
      assert.equal(retried.kind, 'saved');
      if (retried.kind === 'saved') assert.equal(retried.replay, kind === 'lost');
      const committed = encode(story.world().state as never);
      if (kind === 'lost') assert.equal(encode(durable as never), committed);
      outcomes[kind] = committed;
      const w = story.world();
      // From [1, 2, 3, 4] the initiative draw puts the player first; fixed damage draws none, so
      // round 1 is initiative + player roll (+ the living rat's roll): numeric-vectors.json
      // rng_steps[1] (fatal) or rng_steps[2], drawn once at Attack whatever the fault.
      assert.deepEqual(old.state.rng, [1, 2, 3, 4]);
      assert.deepEqual(
        w.state.rng,
        fatal ? [12295, 1029, 1029, 25165824] : [25179138, 12295, 540162, 2107404],
      );
      assert.equal(level(w, rat(w), resourceRef(w, 'hp')), fatal ? 0 : 5);
      assert.equal(level(w, w.body, resourceRef(w, 'hp')), fatal ? 10 : 9);
      const [row] = Object.values(w.state.encounters!);
      // A closed row keeps the round that ended it; an open one names the round still to come.
      assert.deepEqual([row.status, row.round], fatal ? ['closed', 1] : ['open', 2]);
      const job = w.state.jobs?.[row.job_id];
      if (fatal) assert.equal(job, undefined);
      else assert.equal(job!.due_time, old.state.clock + 150);
      p.sql.close();

      // Reopen on a fresh connection, then replay the original Attack: one outcome, no new draw.
      const q = elapsedHost(path, { wall: 10000, mono: 0 }, artifact);
      const reopened = openStory(q.db, releases, q.host);
      assert.equal(reopened.kind, 'open');
      if (reopened.kind !== 'open') return;
      assert.equal(encode(reopened.world().state as never), committed);
      const replay = reopened.invoke(attack);
      assert.equal(replay.kind, 'saved');
      if (replay.kind === 'saved') assert.equal(replay.replay, true);
      assert.equal(encode(reopened.world().state as never), committed);
      q.sql.close();
      coldReopen(path, artifact);
    }
    assert.equal(outcomes.failed, outcomes.lost); // one outcome, one RNG draw, whichever fault
  }
});
