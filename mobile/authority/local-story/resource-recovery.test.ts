// M2 opted rows through the real elapsed authority and rollback-journal SQLite.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import {
  INSTALLED,
  loadCartridge,
  newWorld,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { openGame } from './session.ts';
import { openStory } from './authority.ts';

const recoveryBundle = () => {
  const c = structuredClone(read('protocol/fixtures/cartridge_rest_hash.json').value);
  c.manifest.time_policy = { profile: 'real_elapsed', rate: 50 };
  c.manifest.requires.kernel_api.at_least = '1.2';
  c.calendar = { start: 64800 };
  for (const caps of [c.manifest.requires.capabilities, c.lock.capabilities]) caps.calendar = 1;
  Object.assign(c.resources['ashmere_rest@0.0.1:resource/mv'], {
    maximum: 10,
    start: 0,
    regen: { every: 10, by_position: { standing: 2, sitting: 2, resting: 4, sleeping: 4 } },
  });
  const canonical = encode(c);
  return { canonical, sha256: createHash('sha256').update(canonical).digest('hex') };
};
const intent = (action_key: string) => ({
  action_key: action_key as never,
  target_ids: [],
  input: {},
});
const resource = (p: ReturnType<typeof elapsedHost>) =>
  p.sql
    .prepare(
      'SELECT key, value FROM state_row WHERE section = \'resources\' AND key LIKE \'%"key":"mv"%\'',
    )
    .get() as { key: string; value: string };
const disk = (p: ReturnType<typeof elapsedHost>) =>
  p.sql.prepare('SELECT section,key,value FROM state_row ORDER BY section,key').all();
const at = (p: ReturnType<typeof elapsedHost>, milliseconds: number) => {
  p.clock.wall = 10000 + milliseconds;
  p.clock.mono = milliseconds;
  assert.equal(p.game.pulse().kind, 'ready');
};

// Breaks: saved rate/fraction or position disappears on reopen, and receipt replay settles again.
test('Rest/reopen/Stand keeps literal fractions and replays the Rest receipt without writes', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-recovery-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'save.db'),
    bundle = recoveryBundle();
  let p = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  at(p, 60);
  assert.equal(p.game.invoke(intent('rest')).kind, 'saved');
  assert.deepEqual(JSON.parse(resource(p).value), { value: 0, at: 64803, rate: 4, remainder: 6 });
  const receipt = p.sql
    .prepare('SELECT invocation_id FROM receipt WHERE command LIKE \'%"type":"rest"%\'')
    .get()!;
  p.sql.close();
  p = elapsedHost(path, { wall: 10060, mono: 60 }, bundle);
  try {
    assert.equal(p.game.view().view.position, 'resting');
    const loaded = loadCartridge(
      new TextEncoder().encode(
        `{"cartridge":${bundle.canonical},"content_hash":"${bundle.sha256}"}`,
      ),
      INSTALLED,
    );
    assert.ok(loaded.ok);
    const fresh = newWorld(
      loaded.cartridge as Cartridge,
      '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
      [1, 2, 3, 4],
    );
    const story = openStory(p.db, [{ fresh, content_hash: bundle.sha256 }], p.host);
    assert.equal(story.kind, 'open');
    if (story.kind !== 'open') return;
    const before = disk(p);
    const reply = story.invoke({
      invocation_id: receipt.invocation_id,
      actor_id: fresh.character,
      action_key: 'rest',
      target_ids: [],
      input: {},
    });
    assert.equal(reply.kind, 'saved');
    assert.equal(reply.kind === 'saved' && reply.replay, true);
    assert.deepEqual(disk(p), before);
    at(p, 100);
    assert.equal(p.game.invoke(intent('stand')).kind, 'saved');
    assert.deepEqual(JSON.parse(resource(p).value), { value: 1, at: 64805, rate: 2, remainder: 4 });
    at(p, 160);
    assert.equal(p.game.view().view.resources!.find((r) => r.resource.key === 'mv')!.current, 2);
    assert.deepEqual(JSON.parse(resource(p).value), { value: 1, at: 64805, rate: 2, remainder: 4 });
  } finally {
    p.sql.close();
  }
});

// Breaks: load treats a missing opted row as free recovery or accepts malformed/wrong-but-authored metadata.
test('load refuses corrupt opted rows without rewriting stored progress', () => {
  const p = elapsedHost(':memory:', { wall: 10000, mono: 0 }, recoveryBundle());
  try {
    at(p, 60);
    assert.equal(p.game.invoke(intent('rest')).kind, 'saved');
    const valid = resource(p);
    const cases = [
      null,
      { value: 0, at: 64803, rate: 2, remainder: 6 },
      { value: 0, at: 64803, rate: 4, remainder: 10 },
      { value: 0, at: 64804, rate: 4, remainder: 6 },
      { value: 0, at: 64803, rate: true, remainder: 6 },
      { value: 0.5, at: 64803, rate: 4, remainder: 6 },
      { value: 10, at: 64803, rate: 4, remainder: 6 },
    ];
    for (const row of cases) {
      p.sql.prepare("DELETE FROM state_row WHERE section='resources' AND key=?").run(valid.key);
      if (row)
        p.sql
          .prepare('INSERT INTO state_row VALUES (?,?,?)')
          .run('resources', valid.key, JSON.stringify(row));
      const before = disk(p);
      assert.throws(
        () => openGame(p.db, p.bundle, p.host),
        (e: any) => e.cause?.kind === 'save_corrupt',
      );
      assert.deepEqual(disk(p), before);
    }
  } finally {
    p.sql.close();
  }
});

// Breaks: successful-but-unknown COMMIT reload adopts an authored rate inconsistent with the committed Rest fact.
test('reconciled adoption rejects wrong authored rate and keeps the prior confirmed view', () => {
  const p = elapsedHost(':memory:', { wall: 10000, mono: 0 }, recoveryBundle());
  try {
    at(p, 60);
    p.fault.kind = 'lost';
    p.fault.armed = true;
    assert.equal(p.game.invoke(intent('rest')).kind, 'pending');
    assert.equal(p.game.view().view.position, 'standing');
    const row = resource(p);
    p.sql
      .prepare("UPDATE state_row SET value=? WHERE section='resources' AND key=?")
      .run(JSON.stringify({ value: 0, at: 64803, rate: 2, remainder: 6 }), row.key);
    p.fault.reads = false;
    const status = p.game.pulse();
    assert.equal(status.kind, 'error');
    assert.equal(status.kind === 'error' && status.reason, 'save_corrupt');
    assert.equal(p.game.view().view.position, 'standing');
  } finally {
    p.sql.close();
  }
});

// Breaks: the actual sampler ignores MV fare/recovery bands, retroactively changes rates, or fails to cap the recovered pool.
test('bundled sampler pays MV1 and rests twice as fast before reaching its pool cap', () => {
  const p = elapsedHost(
    ':memory:',
    { wall: 10000, mono: 0 },
    read('protocol/fixtures/cartridge_sampler_hash.json'),
  );
  try {
    const mv = () => p.game.view().view.resources!.find((r) => r.resource.key === 'mv')!;
    const move = (direction: string) =>
      p.game.invoke({ ...intent('move'), input: { direction: direction as never } });
    assert.deepEqual([mv().current, mv().maximum, mv().band], [100, 100, 'mv_ready']);
    for (const direction of ['north', 'south', 'north', 'south'])
      assert.equal(move(direction).kind, 'saved');
    assert.equal(mv().current, 96);
    assert.equal(p.game.invoke(intent('rest')).kind, 'saved');
    at(p, 2000);
    assert.equal(mv().current, 97);
    assert.equal(p.game.invoke(intent('stand')).kind, 'saved');
    at(p, 4000);
    assert.equal(mv().current, 97);
    at(p, 6000);
    assert.equal(mv().current, 98);
    assert.equal(mv().band, 'steady');
    assert.equal(p.game.view().view.resources!.find((r) => r.resource.key === 'hp')!.band, 'ready');
    at(p, 72000);
    assert.equal(mv().current, 100);
  } finally {
    p.sql.close();
  }
});

// Breaks: a genuine failed COMMIT or SQLITE_FULL adopts only Rest's fact or only its resource metadata.
test('real SQLite write failures keep the pool and position together until the unchanged retry commits', () => {
  for (const kind of ['full', 'failed'] as const) {
    const p = elapsedHost(':memory:', { wall: 10000, mono: 0 }, recoveryBundle());
    try {
      at(p, 60);
      const before = disk(p);
      if (kind === 'full')
        p.sql.exec(`PRAGMA max_page_count=${p.sql.prepare('PRAGMA page_count').get()!.page_count}`);
      else {
        p.sql.exec(
          'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
        );
        p.fault.kind = 'failed';
        p.fault.armed = true;
      }
      if (kind === 'full') assert.throws(() => p.game.invoke(intent('rest')), { errcode: 13 });
      else assert.equal(p.game.invoke(intent('rest')).kind, 'pending');
      assert.equal(p.game.view().view.position, 'standing');
      p.fault.reads = false;
      assert.deepEqual(disk(p), before);
      if (kind === 'full') p.sql.exec('PRAGMA max_page_count=1073741823');
      assert.equal(p.game.invoke(intent('rest')).kind, 'saved');
      assert.equal(p.game.view().view.position, 'resting');
      assert.deepEqual(JSON.parse(resource(p).value), {
        value: 0,
        at: 64803,
        rate: 4,
        remainder: 6,
      });
    } finally {
      p.sql.close();
    }
  }
});
