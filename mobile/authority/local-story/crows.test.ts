import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle, ref, entity, prefix } from '../../../kernel/ts/test/transport_fixture.ts';
import {
  INSTALLED,
  loadCartridge,
  newWorld,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import { openStory } from './authority.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';

function setup(path = ':memory:') {
  const change = (c: any) => {
    c.entry = ref('room', 'village_green');
    c.calendar.start = 43200;
    c.items[`${prefix}:item/old_coin`].location = {
      in: 'room',
      room: ref('room', 'village_green'),
    };
  };
  const b = bundle(change);
  const loaded = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${b.canonical},"content_hash":"${b.sha256}"}`),
    INSTALLED,
  );
  assert.ok(loaded.ok);
  const initial = newWorld(
    loaded.cartridge as Cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
  const releases = [{ fresh: initial, content_hash: b.sha256 }] as const;
  const p = elapsedHost(path, { wall: 10000, mono: 0 }, b);
  const s = openStory(p.db, releases, p.host);
  assert.equal(s.kind, 'open');
  if (s.kind !== 'open') throw new Error('crow save');
  let n = 0;
  const invoke = (action_key: string, target_ids: string[] = [], options: object = {}) => {
    const input = {
      invocation_id: `cccccccc-0000-4000-8000-${String(++n).padStart(12, '0')}`,
      actor_id: initial.character,
      action_key,
      target_ids,
      input: options,
    };
    const result = s.invoke(input);
    assert.equal(result.kind, 'saved', JSON.stringify(result));
    if (result.kind === 'saved')
      assert.equal((result.decision as any).kind, 'accepted', JSON.stringify(result.decision));
    return input;
  };
  invoke('choose_ancestry', [], { ancestry: 'fey_touched' });
  const elapsed = (until: number) => {
    while (s.world().state.clock < until) {
      const from = s.world().state.clock;
      const due = Object.values(s.world().state.jobs ?? {})
        .filter((j) => j.status === 'pending' && j.due_time > from)
        .map((j) => j.due_time);
      const result = s.elapsed({
        expected_run_id: s.runId(),
        from,
        until: Math.min(until, ...due),
      });
      assert.equal(result.kind, 'saved', JSON.stringify(result));
    }
  };
  return { p, s, b, releases, invoke, elapsed, coin: entity(initial, 'item', 'old_coin') };
}

// Breaks: a cold save loses exact crow custody/job or a replay transfers the coin twice.
test('crow acquisition survives real SQLite cold reopen and invocation replay', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-crows-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'save.db');
  const a = setup(path);
  a.invoke('take', [a.coin]);
  const drop = a.invoke('drop', [a.coin]);
  a.elapsed(43350);
  const before = a.s.world().state;
  const carrier = Object.values(before.crows ?? {}).find((r) => r.phase === 'leg')!;
  assert.equal(before.containers[a.coin], carrier.member_id);
  a.p.sql.close();
  const q = elapsedHost(path, { wall: 10000, mono: 0 }, a.b);
  t.after(() => q.sql.close());
  const opened = openStory(q.db, a.releases, q.host);
  assert.equal(opened.kind, 'open');
  if (opened.kind !== 'open') return;
  assert.equal(encode(opened.world().state as never), encode(before as never));
  const rows = q.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all();
  const replay = opened.invoke(drop);
  assert.equal(replay.kind, 'saved');
  if (replay.kind === 'saved') assert.equal(replay.replay, true);
  assert.deepEqual(q.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all(), rows);
});

// Breaks: a living crow outside its two-room wander pair makes a lawful outbound or return save unreopenable.
test('crow intention, corridor flight and delivered return cold-reopen at their exact custody', (t) => {
  for (const [until, phase, room, holder] of [
    [43200, 'acquire', 'village_green', 'village_green'],
    [43500, 'leg', 'well_lane', 'crow'],
    [44550, 'return', 'oak_branches', 'nest'],
    [44700, 'return', 'drowned_oak', 'nest'],
  ] as const) {
    const dir = mkdtempSync(join(tmpdir(), 'loka-crow-flight-'));
    t.after(() => rmSync(dir, { recursive: true }));
    const path = join(dir, 'save.db');
    const a = setup(path);
    a.invoke('take', [a.coin]);
    a.invoke('drop', [a.coin]);
    a.elapsed(until);
    const before = a.s.world().state;
    const crow = Object.values(before.crows ?? {}).find((r) => r.phase === phase)!;
    assert.ok(crow, `${until}: ${phase}`);
    assert.equal(
      before.containers[crow.member_id],
      a.s.world().roomIds[`${prefix}:room/${room}`],
      `${until}: ${phase}`,
    );
    assert.equal(
      before.containers[a.coin],
      holder === 'crow'
        ? crow.member_id
        : holder === 'nest'
          ? entity(a.s.world(), 'item', 'crow_nest')
          : a.s.world().roomIds[`${prefix}:room/${holder}`],
    );
    a.p.sql.close();
    const q = elapsedHost(path, { wall: 10000, mono: 0 }, a.b);
    t.after(() => q.sql.close());
    const opened = openStory(q.db, a.releases, q.host);
    assert.equal(opened.kind, 'open', `${until}: ${phase}`);
    if (opened.kind === 'open')
      assert.equal(encode(opened.world().state as never), encode(before as never));
  }
});

// Breaks: a dead crow at a lawful corridor room becomes an unreopenable owner save.
test('a crow killed beyond its wander pair cold-reopens at its actual corridor room', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-crow-death-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'save.db');
  const a = setup(path);
  a.invoke('take', [a.coin]);
  a.invoke('drop', [a.coin]);
  a.elapsed(43650);
  const carrier = Object.values(a.s.world().state.crows ?? {}).find((r) => r.phase === 'leg')!;
  assert.equal(
    a.s.world().state.containers[carrier.member_id],
    a.s.world().roomIds[`${prefix}:room/ferry_landing`],
  );
  a.invoke('move', [], { direction: 'south' });
  a.invoke('move', [], { direction: 'south' });
  a.invoke('attack', [carrier.member_id]);
  for (let i = 0; i < 20; i++) {
    const slot = Object.values(a.s.world().state.population_slots ?? {}).find(
      (r) => r.member_id === carrier.member_id,
    )!;
    if (slot.replacement_due !== null) break;
    a.elapsed(a.s.world().state.clock + 150);
  }
  const slot = Object.values(a.s.world().state.population_slots ?? {}).find(
    (r) => r.member_id === carrier.member_id,
  )!;
  assert.notEqual(slot.replacement_due, null);
  const before = a.s.world().state;
  a.p.sql.close();
  const q = elapsedHost(path, { wall: 10000, mono: 0 }, a.b);
  t.after(() => q.sql.close());
  const opened = openStory(q.db, a.releases, q.host);
  assert.equal(opened.kind, 'open');
  if (opened.kind === 'open')
    assert.equal(encode(opened.world().state as never), encode(before as never));
});

// Breaks: an uncertain acquisition COMMIT adopts half a transfer or retries the same job twice.
test('real failed COMMIT and lost acknowledgement settle one crow acquisition', () => {
  for (const kind of ['failed', 'lost'] as const) {
    const a = setup();
    try {
      a.invoke('take', [a.coin]);
      a.invoke('drop', [a.coin]);
      const before = a.p.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all();
      if (kind === 'failed')
        a.p.sql.exec(
          'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
        );
      const evidence = { expected_run_id: a.s.runId(), from: 43200, until: 43350 };
      a.p.fault.kind = kind;
      a.p.fault.armed = true;
      assert.equal(a.s.elapsed(evidence).kind, 'pending');
      assert.equal(
        a.s.world().state.containers[a.coin],
        a.s.world().roomIds[`${prefix}:room/village_green`],
      );
      a.p.fault.reads = false;
      if (kind === 'failed')
        assert.deepEqual(
          a.p.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all(),
          before,
        );
      const settled = a.s.elapsed(evidence);
      assert.equal(settled.kind, 'saved');
      if (settled.kind === 'saved') assert.equal(settled.replay, kind === 'lost');
      const carrier = Object.values(a.s.world().state.crows ?? {}).find((r) => r.phase === 'leg')!;
      assert.equal(a.s.world().state.containers[a.coin], carrier.member_id);
      const rows = a.p.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all();
      const replay = a.s.elapsed(evidence);
      assert.equal(replay.kind, 'saved');
      if (replay.kind === 'saved') assert.equal(replay.replay, true);
      assert.deepEqual(a.p.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all(), rows);
    } finally {
      a.p.sql.close();
    }
  }
});

// Breaks: a forged persisted crow phase is accepted as lawful coin custody on reopen.
test('cold reopen refuses a forged crow occurrence without rewriting owner progress', () => {
  const a = setup();
  try {
    a.invoke('take', [a.coin]);
    a.invoke('drop', [a.coin]);
    a.elapsed(43350);
    const row = a.p.sql.prepare("SELECT key,value FROM state_row WHERE section='crows'").get()!;
    a.p.sql
      .prepare("UPDATE state_row SET value=? WHERE section='crows' AND key=?")
      .run(JSON.stringify({ ...JSON.parse(row.value as string), phase: 'idle' }), row.key);
    const before = a.p.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all();
    assert.equal(openStory(a.p.db, a.releases, a.p.host).kind, 'save_corrupt');
    assert.deepEqual(a.p.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all(), before);
  } finally {
    a.p.sql.close();
  }
});

// Breaks: cold reopen rejects a lawful combat-paused carrier or loses its Flee-resumed binding.
test('paused and Flee-resumed crow saves cold-reopen with exact released custody', (t) => {
  for (const resume of [false, true]) {
    const dir = mkdtempSync(join(tmpdir(), 'loka-crow-flee-'));
    t.after(() => rmSync(dir, { recursive: true }));
    const path = join(dir, 'save.db');
    const a = setup(path);
    a.invoke('take', [a.coin]);
    a.invoke('drop', [a.coin]);
    a.elapsed(43500);
    const carrier = Object.values(a.s.world().state.crows ?? {}).find((r) => r.phase === 'leg')!;
    a.invoke('move', [], { direction: 'south' });
    a.invoke('attack', [carrier.member_id]);
    const last = resume ? a.invoke('flee') : undefined;
    const before = a.s.world().state;
    const row = Object.values(before.crows ?? {}).find((r) => r.member_id === carrier.member_id)!;
    assert.equal(row.phase, resume ? 'return' : 'paused_return');
    assert.equal(before.containers[a.coin], a.s.world().roomIds[`${prefix}:room/well_lane`]);
    assert.equal(row.generation, carrier.generation);
    a.p.sql.close();
    const q = elapsedHost(path, { wall: 10000, mono: 0 }, a.b);
    t.after(() => q.sql.close());
    const opened = openStory(q.db, a.releases, q.host);
    assert.equal(opened.kind, 'open');
    if (opened.kind !== 'open') continue;
    assert.equal(encode(opened.world().state as never), encode(before as never));
    if (last) {
      const rows = q.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all();
      const replay = opened.invoke(last);
      assert.equal(replay.kind, 'saved');
      if (replay.kind === 'saved') assert.equal(replay.replay, true);
      assert.deepEqual(q.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all(), rows);
    }
  }
});
