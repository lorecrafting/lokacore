import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle, genesis, ref, room } from '../../../kernel/ts/test/bell_fixture.ts';
import { key } from '../../../kernel/ts/src/foundation/compose.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { openStory } from './authority.ts';

// The bell fragment: entry at the Drill Yard bell, 18:00, goblins suppressed for two days on Ring.
function setup(path: string) {
  const release = { bundle: bundle(), fresh: genesis() };
  const p = elapsedHost(path, { wall: 10000, mono: 0 }, release.bundle);
  const host = { kernel_version: p.host.kernel_version, newId: p.host.newId };
  const story = openStory(
    p.db,
    [{ fresh: release.fresh, content_hash: release.bundle.sha256 }],
    host,
  );
  assert.equal(story.kind, 'open');
  if (story.kind !== 'open') throw new Error('save did not open');
  return { ...p, story, release, host };
}

// Breaks: a confirmed bell cue is lost on cold reopen or replay emits another cue.
test('real SQLite cold reopen retains one cause-bound bell cue', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-d9-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const p = setup(join(dir, 'save.db'));
  const invocation = {
    invocation_id: 'aaaaaaaa-0000-4000-8000-000000000101',
    actor_id: p.story.world().character,
    action_key: 'ring_bell',
    target_ids: [],
    input: {},
  };
  const reply = p.story.invoke(invocation);
  assert.equal(reply.kind, 'saved');
  if (reply.kind !== 'saved') return;
  assert.equal((reply.decision as { kind: string }).kind, 'accepted');
  const first = p.story.narration(reply.command_id);
  assert.equal(first?.cue?.key, 'narration.bell_cue');
  assert.equal(first?.cue?.room_id, room(p.story.world(), 'drill_yard'));
  const reopened = openStory(
    p.db,
    [{ fresh: p.release.fresh, content_hash: p.release.bundle.sha256 }],
    p.host,
  );
  assert.equal(reopened.kind, 'open');
  if (reopened.kind !== 'open') return;
  assert.deepEqual(reopened.narration(reply.command_id), first);
  const replay = reopened.invoke(invocation);
  assert.equal(replay.kind, 'saved');
  if (replay.kind === 'saved') assert.equal(replay.replay, true);
  assert.deepEqual(reopened.narration(reply.command_id), first);
});

// Breaks: a failed or acknowledged-lost bell COMMIT leaves a partial suppression or mints it twice.
test('real SQLite uncertain bell COMMIT reconciles one suppression and one resume job', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-d9-fault-'));
  t.after(() => rmSync(dir, { recursive: true }));
  for (const [kind, suffix] of [
    ['failed', '201'],
    ['lost', '201'],
    ['failed', '203'],
    ['lost', '203'],
  ] as const) {
    const p = setup(join(dir, `${kind}-${suffix}.db`));
    const invocation = {
      invocation_id: `aaaaaaaa-0000-4000-8000-000000000${suffix}`,
      actor_id: p.story.world().character,
      action_key: 'ring_bell',
      target_ids: [],
      input: {},
    };
    if (kind === 'failed')
      p.sql.exec(
        'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
      );
    p.fault.kind = kind;
    p.fault.armed = true;
    assert.equal(p.story.invoke(invocation).kind, 'pending', kind);
    assert.equal(
      p.story.world().state.population_plans![key(ref('population', 'goblins'))].suppression,
      undefined,
      kind,
    );
    p.fault.reads = false;
    const settled = p.story.invoke(invocation);
    assert.equal(settled.kind, 'saved', kind);
    if (settled.kind !== 'saved') continue;
    assert.equal(settled.replay, kind === 'lost', kind);
    assert.equal((settled.decision as { kind: string }).kind, 'accepted', kind);
    const control = p.story.world().state.population_plans![key(ref('population', 'goblins'))];
    assert.deepEqual(
      [control.suppression?.generation, control.suppression?.ends_at],
      [1, 237600],
      kind,
    );
    assert.equal(
      Object.values(p.story.world().state.jobs ?? {}).filter(
        (j) => j.status === 'pending' && j.due_time === 237600 && j.job.key === 'goblins',
      ).length,
      1,
      kind,
    );
    assert.equal(
      p.sql
        .prepare(
          "SELECT count(*) AS n FROM receipt WHERE json_extract(command,'$.payload.action')='ring_bell'",
        )
        .get()!.n,
      1,
      kind,
    );
    assert.equal(
      openStory(p.db, [{ fresh: p.release.fresh, content_hash: p.release.bundle.sha256 }], p.host)
        .kind,
      'open',
      kind,
    );
    while (p.story.world().state.clock < 237599) {
      const from = p.story.world().state.clock;
      const until = Math.min(
        237599,
        ...Object.values(p.story.world().state.jobs ?? {})
          .filter((j) => j.status === 'pending')
          .map((j) => j.due_time),
      );
      const tick = p.story.elapsed({ expected_run_id: p.story.runId(), from, until });
      assert.equal(tick.kind, 'saved');
      if (tick.kind === 'saved') assert.equal((tick.decision as { kind: string }).kind, 'accepted');
    }
    assert.equal(
      openStory(p.db, [{ fresh: p.release.fresh, content_hash: p.release.bundle.sha256 }], p.host)
        .kind,
      'open',
    );
    p.fault.inserted = false;
    p.fault.kind = kind;
    p.fault.armed = true;
    const resume = { expected_run_id: p.story.runId(), from: 237599, until: 237600 };
    assert.equal(p.story.elapsed(resume).kind, 'pending');
    assert.equal(p.story.world().state.clock, 237599);
    p.fault.reads = false;
    const settledResume = p.story.elapsed(resume);
    assert.equal(settledResume.kind, 'saved');
    if (settledResume.kind === 'saved') assert.equal(settledResume.replay, kind === 'lost');
    const replayedResume = p.story.elapsed(resume);
    assert.equal(replayedResume.kind, 'saved');
    if (replayedResume.kind === 'saved') assert.equal(replayedResume.replay, true);
    assert.equal(
      p.story.world().state.population_plans![key(ref('population', 'goblins'))].suppression
        ?.ends_at,
      null,
    );
    assert.equal(
      openStory(p.db, [{ fresh: p.release.fresh, content_hash: p.release.bundle.sha256 }], p.host)
        .kind,
      'open',
    );
  }
});
