import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle, fresh, ref, rat, room } from '../../../kernel/ts/test/combat_fixture.ts';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import { loadCartridge, INSTALLED, newWorld } from '../../../kernel/ts/src/index.ts';
import { level, resourceRef } from '../../../kernel/ts/src/mechanics/resource.ts';
import { openStory } from './authority.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';

// Breaks: a lawful scheduled departure commits a save that cold reopen or COMMIT recovery rejects.
test('scheduled opponent departure reopens and reconciles before a harmless due combat round', (t) => {
  const content = structuredClone(bundle.value);
  content.calendar.start = 3550;
  content.npcs[ref(fresh, 'npc', 'cellar_rat_1')].daily_schedule = {
    '1': {
      cartridge_id: 'ashmere_sampler',
      cartridge_version: '0.0.9',
      kind: 'room',
      key: 'drowned_lantern',
    },
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
  const initial = newWorld(loaded.cartridge, fresh.context, [1, 2, 3, 4]);
  const releases = [{ fresh: initial, content_hash: sha256 }];
  const dir = mkdtempSync(join(tmpdir(), 'loka-departure-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'save.db');
  const p = elapsedHost(path, { wall: 10000, mono: 0 }, artifact);
  const story = openStory(p.db, releases, p.host);
  assert.equal(story.kind, 'open');
  if (story.kind !== 'open') return;
  let n = 0;
  const invoke = (action_key: string, target_ids: string[] = [], input = {}) =>
    story.invoke({
      invocation_id: `bbbbbbbb-0000-4000-8000-${String(++n).padStart(12, '0')}`,
      actor_id: initial.character,
      action_key,
      target_ids,
      input,
    });
  for (const direction of ['north', 'east', 'down'])
    assert.equal(invoke('move', [], { direction }).kind, 'saved');
  assert.equal(invoke('attack', [rat(initial)]).kind, 'saved');
  const before = story.world();
  const departure = { expected_run_id: story.runId(), from: 3550, until: 3600 };
  p.fault.kind = 'lost';
  p.fault.armed = true;
  assert.equal(story.elapsed(departure).kind, 'pending');
  assert.equal(story.world(), before);
  p.fault.reads = false;
  const recovered = story.elapsed(departure);
  assert.equal(recovered.kind, 'saved');
  if (recovered.kind === 'saved') assert.equal(recovered.replay, true);
  assert.equal(story.world().state.containers[rat(initial)], room(initial, 'drowned_lantern'));
  const pending = Object.values(story.world().state.encounters!)[0];
  assert.equal(pending.status, 'open');
  assert.equal(story.world().state.jobs![pending.job_id].due_time, 3700);
  const saved = encode(story.world().state as never);
  p.sql.close();
  const q = elapsedHost(path, { wall: 10000, mono: 0 }, artifact);
  t.after(() => q.sql.close());
  const reopened = openStory(q.db, releases, q.host);
  assert.equal(reopened.kind, 'open');
  if (reopened.kind !== 'open') return;
  assert.equal(encode(reopened.world().state as never), saved);
  const round = reopened.elapsed({ ...departure, from: 3600, until: 3700 });
  assert.equal(round.kind, 'saved');
  if (round.kind !== 'saved') return;
  assert.equal(round.decision.kind, 'accepted');
  if (round.decision.kind !== 'accepted') return;
  assert.deepEqual(round.decision.events, []);
  assert.ok(!round.decision.delta.ops.some((op) => op.op === 'resource.adjust'));
  const after = reopened.world();
  assert.deepEqual(after.state.rng, [1, 2, 3, 4]);
  assert.equal(level(after, after.body, resourceRef(after, 'hp')), 10);
  assert.equal(level(after, rat(after), resourceRef(after, 'hp')), 6);
  assert.equal(Object.values(after.state.encounters!)[0].status, 'closed');
  assert.equal(after.state.jobs![pending.job_id].status, 'completed');
});
