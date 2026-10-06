import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle, entity, fresh, ref, room } from '../../../kernel/ts/test/transport_fixture.ts';
import { activation } from '../../../kernel/ts/src/mechanics/quest/lifecycle.ts';
import { accepted, allocator } from '../../../kernel/ts/src/runtime/decision.ts';
import { apply } from '../../../kernel/ts/src/runtime/apply.ts';
import { admit, adopt } from '../../../kernel/ts/src/runtime/proposal.ts';
import { adjust, level, resourceRef } from '../../../kernel/ts/src/mechanics/resource.ts';
import { deathSequence } from '../../../kernel/ts/src/mechanics/death/sequence.ts';
import { key } from '../../../kernel/ts/src/foundation/compose.ts';
import type { Command, FactValue } from '../../../kernel/ts/src/contracts.gen.ts';
import type { World } from '../../../kernel/ts/src/index.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { openStory } from './authority.ts';
import { replace, type Meta } from './store.ts';
import { writeElapsed } from './elapsed-store.ts';

function source() {
  const change = (c: any) => {
    c.entry = ref('room', 'belfry');
    c.calendar.start = 64800;
  };
  const initial = fresh(change);
  const command = {
    id: '00000000-0000-4000-8000-000000000090' as Command['id'],
    world_context_id: initial.context,
    payload: { type: 'look', actor_id: initial.character },
  } as const satisfies Command;
  const mint = allocator(initial, command);
  const started = apply(initial, [
    ...activation(mint, initial.character, ref('quest', 'missing_child')).ops,
    ...activation(mint, initial.character, ref('quest', 'bell_of_ashmere')).ops,
  ]);
  assert.ok('world' in started);
  return {
    bundle: bundle(change),
    fresh: {
      ...started.world,
      state: {
        ...started.world.state,
        facts: {
          ...started.world.state.facts,
          [key({
            kind: 'fact',
            fact: ref('fact', 'fen_tracks_found'),
            scope: { kind: 'player', character_id: initial.character },
          })]: true as FactValue,
        },
      },
    },
  };
}

function studySource() {
  const change = (c: any) => {
    c.entry = ref('room', 'prior_study');
    c.calendar.start = 64800;
  };
  const base = fresh(change);
  const item = entity(base, 'item', 'brass_key');
  const held: World = {
    ...base,
    state: { ...base.state, containers: { ...base.state.containers, [item]: base.body } },
  };
  const command = {
    id: '00000000-0000-4000-8000-000000000091' as Command['id'],
    world_context_id: held.context,
    payload: { type: 'look', actor_id: held.character },
  } as const satisfies Command;
  const mint = allocator(held, command);
  const hp = resourceRef(held, 'hp');
  const loss = adjust(held, held.body, hp, -level(held, held.body, hp)!, {}).op;
  const lost = apply(held, [loss]);
  assert.ok('world' in lost);
  const death = deathSequence(
    lost.world,
    command,
    { loss, owner_id: held.character, killer_id: null, credited_character_id: null },
    mint,
  );
  const died = adopt(
    held,
    admit('death', accepted(held, 'died', [loss, ...death.ops], death.events)),
    command,
    mint,
    1,
  );
  assert.equal(died.decision.kind, 'accepted');
  return { bundle: bundle(change), fresh: died.world };
}

function setup(
  path: string,
  release: { bundle: ReturnType<typeof source>['bundle']; fresh: World } = source(),
) {
  const p = elapsedHost(path, { wall: 10000, mono: 0 }, release.bundle);
  const m = p.sql.prepare('SELECT * FROM save').get() as Record<string, string | null>;
  const meta = {
    ...m,
    parent: JSON.parse(m.parent!),
    seed: JSON.parse(m.seed!),
    pin: JSON.parse(m.pin!),
  } as Meta;
  assert.ok(replace(p.db, release.fresh, meta));
  writeElapsed(p.db, {
    run_id: meta.run_id,
    wall_ms: 10000,
    remainder: 0,
    target: release.fresh.state.clock,
  });
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
  const bell = Object.entries(p.story.world().details).find(([, d]) => d.key === 'bell')![0];
  const invocation = {
    invocation_id: 'aaaaaaaa-0000-4000-8000-000000000101',
    actor_id: p.story.world().character,
    action_key: 'ring_bell',
    target_ids: [bell],
    input: {},
  };
  const reply = p.story.invoke(invocation);
  assert.equal(reply.kind, 'saved');
  if (reply.kind !== 'saved') return;
  assert.equal((reply.decision as { kind: string }).kind, 'accepted');
  const first = p.story.narration(reply.command_id);
  assert.equal(first?.cue?.key, 'narration.bell_cue');
  assert.equal(first?.cue?.room_id, room(p.story.world(), 'belfry'));
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
  for (const kind of ['failed', 'lost'] as const) {
    const p = setup(join(dir, `${kind}.db`));
    const bell = Object.entries(p.story.world().details).find(([, d]) => d.key === 'bell')![0];
    const invocation = {
      invocation_id: 'aaaaaaaa-0000-4000-8000-000000000201',
      actor_id: p.story.world().character,
      action_key: 'ring_bell',
      target_ids: [bell],
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
      Object.values(p.story.world().state.population_plans ?? {})[0].suppression,
      undefined,
      kind,
    );
    p.fault.reads = false;
    const settled = p.story.invoke(invocation);
    assert.equal(settled.kind, 'saved', kind);
    if (settled.kind !== 'saved') continue;
    assert.equal(settled.replay, kind === 'lost', kind);
    assert.equal((settled.decision as { kind: string }).kind, 'accepted', kind);
    const control = Object.values(p.story.world().state.population_plans ?? {})[0];
    assert.deepEqual(
      [control.suppression?.generation, control.suppression?.ends_at],
      [1, 237600],
      kind,
    );
    assert.equal(
      Object.values(p.story.world().state.jobs ?? {}).filter(
        (j) => j.status === 'pending' && j.due_time === 237600,
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
  }
});

// Breaks: a saved Study death loses the corpse on reopen or grants its item without physical Take.
test('real SQLite Study corpse retains physical west pickup across cold reopen', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-d9-study-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const p = setup(join(dir, 'save.db'), studySource());
  assert.equal(
    p.story.world().state.containers[p.story.world().body],
    room(p.story.world(), 'chapel_nave'),
  );
  const item = entity(p.story.world(), 'item', 'brass_key');
  const invoke = (n: number, action_key: string, target_ids: string[], input: object) => {
    const result = p.story.invoke({
      invocation_id: `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`,
      actor_id: p.story.world().character,
      action_key,
      target_ids,
      input,
    });
    assert.equal(result.kind, 'saved');
    if (result.kind === 'saved')
      assert.equal((result.decision as { kind: string }).kind, 'accepted');
  };
  invoke(301, 'move', [], { direction: 'west' });
  assert.equal(
    p.story.world().state.containers[p.story.world().body],
    room(p.story.world(), 'prior_study'),
  );
  invoke(302, 'take', [item], {});
  assert.equal(p.story.world().state.containers[item], p.story.world().body);
  invoke(303, 'move', [], { direction: 'east' });
  const reopened = openStory(
    p.db,
    [{ fresh: p.release.fresh, content_hash: p.release.bundle.sha256 }],
    p.host,
  );
  assert.equal(reopened.kind, 'open');
  if (reopened.kind !== 'open') return;
  assert.equal(reopened.world().state.containers[item], reopened.world().body);
  const west = reopened.invoke({
    invocation_id: 'aaaaaaaa-0000-4000-8000-000000000304',
    actor_id: reopened.world().character,
    action_key: 'move',
    target_ids: [],
    input: { direction: 'west' },
  });
  assert.equal(west.kind, 'saved');
  if (west.kind === 'saved') assert.equal((west.decision as { kind: string }).kind, 'accepted');
});
