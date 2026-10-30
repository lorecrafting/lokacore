import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import { gameView } from '../../../kernel/ts/src/index.ts';
import { bundle, genesis, prefix, unpacked } from '../../../kernel/ts/test/c4_pack_fixture.ts';
import { openStory } from './authority.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';

// The kernel's controlled goblins, unpacked; the body starts at the inn, two moves (west, south)
// from the pit.
const artifact = bundle(unpacked);
const releases = [{ fresh: genesis(unpacked), content_hash: artifact.sha256 }] as const;

// The same goblins with every other job source and room removed: the pit and the yard south of it.
function populationOnly() {
  const only = (c: any) => {
    unpacked(c);
    const keep = (rows: Record<string, unknown>, names: string[]) =>
      Object.fromEntries(
        Object.entries(rows).filter(([id]) => names.some((name) => id.endsWith(`/${name}`))),
      );
    const rooms = ['goblin_pit', 'drill_yard'];
    c.rooms = keep(c.rooms, rooms);
    const yard = c.rooms[`${prefix}:room/drill_yard`];
    yard.exits = { south: yard.exits.south };
    c.map_positions = c.map_positions.filter((p: any) => rooms.includes(p.room.key));
    c.items = keep(c.items, ['ear', 'npc_corpse', 'player_corpse']);
    for (const item of Object.values(c.items) as any[]) delete item.immune;
    c.npcs = keep(c.npcs, ['goblin']);
    c.resources = keep(c.resources, ['hp', 'mv']);
    for (const section of [
      'actions',
      'attributes',
      'barriers',
      'structures',
      'dialogues',
      'liquids',
      'quests',
      'reactions',
      'scripted_actions',
      'replenish',
      'scenes',
      'services',
      'skills',
      'statuses',
      'story_points',
      'topics',
    ])
      c[section] = {};
    c.entry = { ...c.entry, key: 'goblin_pit' };
    c.world.death.shrine = { ...c.world.death.shrine, key: 'goblin_pit' };
    for (const rule of ['construction', 'death_credit', 'derived', 'levelling', 'theft'])
      delete c.world[rule];
  };
  const artifact = bundle(only);
  return {
    artifact,
    releases: [{ fresh: genesis(only), content_hash: artifact.sha256 }] as const,
  };
}

// Breaks: a population-only cartridge skips receipt replay and opens after its accepted wander
// receipt's actor is forged, even though the persisted world rows still look complete.
test('population alone activates byte-preserving accepted-history refusal', (t) => {
  const only = populationOnly();
  const dir = mkdtempSync(join(tmpdir(), 'loka-population-only-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'save.db');
  const p = elapsedHost(path, { wall: 10000, mono: 0 }, only.artifact);
  const story = openStory(p.db, only.releases, p.host);
  assert.equal(story.kind, 'open');
  if (story.kind !== 'open') return;
  const advanced = story.elapsed({ expected_run_id: story.runId(), from: 64800, until: 68400 });
  assert.equal(advanced.kind, 'saved');
  p.sql
    .prepare("UPDATE receipt SET actor_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' WHERE revision=1")
    .run();
  p.sql.close();
  const altered = readFileSync(path);
  const sql = new DatabaseSync(path);
  t.after(() => sql.close());
  const db = {
    execSync: (query: string) => sql.exec(query),
    runSync: (query: string, ...args: any[]) => sql.prepare(query).run(...args),
    getFirstSync: (query: string, ...args: any[]) => sql.prepare(query).get(...args) ?? null,
    getAllSync: (query: string, ...args: any[]) => sql.prepare(query).all(...args),
    isInTransactionSync: () => sql.isTransaction,
  };
  assert.equal(openStory(db as never, only.releases, p.host).kind, 'save_corrupt');
  assert.deepEqual(readFileSync(path), altered);
});

// Breaks: a population job writes rows the phone cannot cold-load, or lost COMMIT acknowledgement duplicates its births.
test('one goblin wander persists across real SQLite unknown-COMMIT recovery and cold reopen', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-goblins-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'save.db');
  const p = elapsedHost(path, { wall: 10000, mono: 0 }, artifact);
  const story = openStory(p.db, releases, p.host);
  assert.equal(story.kind, 'open');
  if (story.kind !== 'open') return;
  const initial = story.world();
  assert.equal(Object.keys(initial.state.created ?? {}).length, 8);
  p.fault.kind = 'lost';
  p.fault.armed = true;
  const evidence = { expected_run_id: story.runId(), from: 64800, until: 68400 };
  assert.equal(story.elapsed(evidence).kind, 'pending');
  p.fault.reads = false;
  const settled = story.elapsed(evidence);
  assert.equal(settled.kind, 'saved');
  if (settled.kind === 'saved') assert.equal(settled.replay, true);
  assert.equal(Object.keys(story.world().state.created ?? {}).length, 8);
  assert.equal(
    Object.values(story.world().state.jobs ?? {}).filter(
      (j) => j.status === 'pending' && j.job.kind === 'population',
    ).length,
    1,
  );
  p.sql.close();
  const q = elapsedHost(path, { wall: 10000, mono: 0 }, artifact);
  t.after(() => q.sql.close());
  const reopened = openStory(q.db, releases, q.host);
  assert.equal(reopened.kind, 'open');
  if (reopened.kind !== 'open') return;
  assert.deepEqual(reopened.world().state, story.world().state);
});

// Breaks: cold reopen loses corpse/pelt custody or treats a Take receipt without acquired evidence as pickup.
test('a real goblin kill and pelt Take cold-reopen with conserved custody and evidence', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-goblin-loot-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'save.db');
  const p = elapsedHost(path, { wall: 10000, mono: 0 }, artifact);
  const story = openStory(p.db, releases, p.host);
  assert.equal(story.kind, 'open');
  if (story.kind !== 'open') return;
  let n = 0;
  const invoke = (action_key: string, target_ids: string[] = [], input = {}) => {
    const result = story.invoke({
      invocation_id: `cccccccc-0000-4000-8000-${String(++n).padStart(12, '0')}`,
      actor_id: story.world().character,
      action_key,
      target_ids,
      input,
    });
    assert.equal(result.kind, 'saved');
    if (result.kind === 'saved')
      assert.equal((result.decision as { kind: string }).kind, 'accepted');
  };
  for (const direction of ['west', 'south']) invoke('move', [], { direction });
  const member = gameView(story.world()).entities.find(
    (e) => e.kind === 'npc' && e.name === 'npc.goblin.short',
  )!.id;
  const pelt = Object.entries(story.world().state.created ?? {}).find(
    ([, identity]) =>
      identity.origin.kind === 'spawned' &&
      identity.origin.role === 'loot' &&
      identity.origin.member_id === member,
  )![0];
  invoke('attack', [member]);
  for (let i = 0; i < 20 && story.world().state.containers[pelt] === member; i++) {
    const from = story.world().state.clock;
    const result = story.elapsed({ expected_run_id: story.runId(), from, until: from + 150 });
    assert.equal(result.kind, 'saved');
  }
  const corpse = story.world().state.containers[pelt];
  assert.equal(story.world().state.created?.[corpse]?.definition.key, 'npc_corpse');
  invoke('take', [pelt]);
  assert.equal(story.world().state.containers[pelt], story.world().body);
  const before = story.world().state;
  p.sql.close();
  const q = elapsedHost(path, { wall: 10000, mono: 0 }, artifact);
  t.after(() => q.sql.close());
  const reopened = openStory(q.db, releases, q.host);
  assert.equal(reopened.kind, 'open');
  if (reopened.kind !== 'open') return;
  assert.equal(encode(reopened.world().state as never), encode(before as never));
  assert.equal(reopened.world().state.containers[pelt], reopened.world().body);
  assert.equal(
    Object.values(reopened.world().state.created ?? {}).filter((i) => i.origin.kind === 'death')
      .length,
    1,
  );
  const receipt = q.sql
    .prepare('SELECT revision, response FROM receipt ORDER BY revision DESC LIMIT 1')
    .get()!;
  q.sql
    .prepare('UPDATE receipt SET response=? WHERE revision=?')
    .run(
      JSON.stringify({ ...JSON.parse(receipt.response as string), events: [] }),
      receipt.revision as number,
    );
  assert.throws(() => reopened.narration(), /invalid corpse pickup evidence/);
  q.sql
    .prepare('UPDATE receipt SET response=? WHERE revision=?')
    .run(receipt.response as string, receipt.revision as number);
});
