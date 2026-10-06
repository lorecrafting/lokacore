import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import { key } from '../../../kernel/ts/src/foundation/compose.ts';
import {
  gameView,
  loadCartridge,
  INSTALLED,
  newWorld,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';
import { resourceRef } from '../../../kernel/ts/src/mechanics/resource.ts';
import type { World } from '../../../kernel/ts/src/runtime/decision.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { openStory } from './authority.ts';
import type { Db } from './store.ts';
import { bleedingLine, buttonsOf, group } from '../../app/book/model.ts';

// Breaks: the managed elapsed driver skips the newly scheduled second tick or expiry in one
// offline catch-up, or cold reopen loses the resulting HP and inactive condition.
test('managed offline catch-up commits each bleed tick and expiry through real SQLite', (t) => {
  const content = structuredClone(
    read('kernel/ts/test/fixtures/c5-provisional-artifact.json').cartridge,
  );
  content.entry.key = 'hound_run';
  content.manifest.time_policy = { profile: 'real_elapsed', rate: 50 };
  for (const npc of Object.values(content.npcs) as any[])
    if (npc.key === 'fen_hound') npc.attack.chance = 100;
  content.world.combat.player_attack.chance = 0;
  delete content.world.combat.dodge;
  const canonical = encode(content),
    sha256 = createHash('sha256').update(canonical).digest('hex');
  const bundle = { canonical, sha256 };
  const loaded = loadCartridge(
    new TextEncoder().encode(JSON.stringify({ cartridge: content, content_hash: sha256 })),
    INSTALLED,
  );
  if (!loaded.ok) throw new Error(JSON.stringify(loaded));
  const initial = newWorld(
    loaded.cartridge as Cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
  const target = Object.entries(initial.state.created ?? {}).find(
    ([id, e]) =>
      e.origin.kind === 'spawned' &&
      e.origin.role === 'hound' &&
      initial.state.containers[id] === initial.state.containers[initial.body],
  )?.[0];
  assert.ok(target);
  const dir = mkdtempSync(join(tmpdir(), 'loka-c5-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'save.db');
  const a = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  const invoke = (action_key: string, target_ids: string[] = []) =>
    a.game.invoke({ action_key: action_key as never, target_ids: target_ids as never, input: {} });
  assert.equal(invoke('attack', [target]).kind, 'saved');
  a.clock.wall += 3000;
  a.clock.mono += 3000;
  assert.equal(a.game.pulse().kind, 'ready');
  assert.equal(a.game.view().view.time, 64950);
  assert.equal(invoke('flee').kind, 'saved');
  const before = a.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n as number;
  a.clock.wall += 6000;
  a.clock.mono += 6000;
  assert.equal(a.game.pulse().kind, 'ready');
  assert.equal(a.game.view().view.time, 65250);
  assert.equal(a.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n, before + 3);
  a.sql.close();
  const b = elapsedHost(path, { wall: a.clock.wall, mono: a.clock.mono }, bundle);
  t.after(() => b.sql.close());
  assert.equal(b.game.view().view.time, 65250);
  // The initial hound loss, two periodic losses, and exclusive-end expiry have literal answers.
  const after = b.game.view().view;
  assert.equal(after.bleeding, undefined);
  assert.equal(after.resources?.find((r) => r.resource.key === 'hp')?.current, 7);
});

// Breaks: failed or uncertain tick/cure COMMIT leaks half of HP, wound, job or item custody;
// an idempotent retry spends the bandage twice.
test('active tick and exact cure reconcile real SQLite COMMIT faults and replay once', (t) => {
  const artifact = read('kernel/ts/test/fixtures/c5-provisional-artifact.json');
  const loaded = loadCartridge(new TextEncoder().encode(JSON.stringify(artifact)), INSTALLED);
  if (!loaded.ok) throw new Error(JSON.stringify(loaded));
  const base = newWorld(
    loaded.cartridge as Cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
  const target = Object.entries(base.state.created ?? {}).find(
    ([, e]) => e.origin.kind === 'spawned' && e.origin.role === 'hound',
  )![0];
  const item = base.entityIds['ashmere_missing_child@0.0.35:item/bandage_01'];
  const wick = base.entityIds['ashmere_missing_child@0.0.35:npc/wick'];
  const entities = { ...base.entities } as Record<string, any>;
  for (const [id, e] of Object.entries(base.state.created ?? {}))
    if (e.origin.kind === 'spawned' && e.origin.role === 'hound')
      entities[id] = { ...entities[id], attack: { ...entities[id].attack, chance: 100 } };
  const combat = base.cartridge.world!.combat!;
  const fresh: World = {
    ...base,
    entities,
    cartridge: {
      ...base.cartridge,
      world: {
        ...base.cartridge.world!,
        combat: {
          ...combat,
          player_attack: { chance: 0, damage_min: 1, damage_max: 1 },
          dodge: undefined,
        },
      },
    },
    state: {
      ...base.state,
      containers: {
        ...base.state.containers,
        [base.body]: base.state.containers[target],
        [item]: base.body,
        [wick]: base.state.containers[target],
      },
      resources: {
        ...base.state.resources,
        [key({ kind: 'resource', entity_id: base.body, resource: resourceRef(base, 'hp') })]: {
          value: 10,
          at: 64800,
        },
      },
    },
  };
  const dir = mkdtempSync(join(tmpdir(), 'loka-c5-cure-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'save.db');
  const releases = [{ fresh, content_hash: artifact.content_hash }] as const;
  const host = {
    kernel_version: `loka-kernel@${'0'.repeat(40)}`,
    newId: (() => {
      let n = 0;
      return () => `bbbbbbbb-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    })(),
  };
  type Fault = {
    kind: 'failed' | 'absent' | 'lost';
    armed: boolean;
    reads: boolean;
    inserted: boolean;
  };
  const open = (sql: DatabaseSync, fault?: Fault) => {
    const db: Db = {
      execSync: (q) => {
        const before = sql.isTransaction;
        if (fault?.armed && fault.kind === 'absent' && q === 'COMMIT') {
          fault.armed = false;
          fault.reads = true;
          throw new Error('COMMIT outcome unknown before execution');
        }
        try {
          sql.exec(q);
        } catch (e) {
          if (fault?.armed && before) {
            fault.armed = false;
            fault.reads = true;
          }
          throw e;
        }
        if (fault?.armed && fault.kind === 'lost' && before && !sql.isTransaction) {
          fault.armed = false;
          fault.reads = true;
          throw new Error('COMMIT acknowledgement lost');
        }
      },
      runSync: (q, ...p) => {
        if (fault?.armed && fault.kind === 'failed' && !fault.inserted) {
          fault.inserted = true;
          sql.exec('INSERT INTO child VALUES (1)');
        }
        return sql.prepare(q).run(...p);
      },
      getFirstSync: <T>(q: string, ...p: (string | number | null)[]) => {
        if (fault?.reads) sql.prepare('SELECT * FROM unavailable_c5_read').get();
        return (sql.prepare(q).get(...p) ?? null) as T | null;
      },
      getAllSync: <T>(q: string, ...p: (string | number | null)[]) => {
        if (fault?.reads) sql.prepare('SELECT * FROM unavailable_c5_read').get();
        return sql.prepare(q).all(...p) as T[];
      },
      isInTransactionSync: () => sql.isTransaction,
    };
    const story = openStory(db, releases, host);
    if (story.kind !== 'open') throw new Error(story.kind);
    return { story, sql };
  };
  let a = open(new DatabaseSync(path));
  const invoke = (n: number, action_key: string, target_ids: string[] = [], input = {}) => ({
    invocation_id: `dddddddd-0000-4000-8000-${String(n).padStart(12, '0')}`,
    actor_id: fresh.character,
    action_key,
    target_ids,
    input,
  });
  assert.equal(a.story.invoke(invoke(1, 'wick_bandage', [wick])).kind, 'saved');
  const choice = gameView(a.story.world()).choice!;
  assert.equal(
    a.story.invoke(
      invoke(2, 'choose', [], { continuation_id: choice.continuation_id, choice_id: 'learn' }),
    ).kind,
    'saved',
  );
  assert.equal(a.story.invoke(invoke(3, 'attack', [target])).kind, 'saved');
  assert.equal(
    a.story.elapsed({ expected_run_id: a.story.runId(), from: 64800, until: 64950 }).kind,
    'saved',
  );
  const row = a.story.world().state.bleeds![fresh.body]!;
  assert.ok(row.active);
  assert.equal(
    bleedingLine(
      gameView(a.story.world()).bleeding!,
      64950,
      (k) => a.story.world().cartridge.text[k],
    ),
    'Bleeding · 300s remaining · 1 HP each 100s',
  );
  assert.deepEqual(
    group(
      buttonsOf(
        gameView(a.story.world()),
        (x) => x,
        (x) => x,
      ) as never,
    ).bandage.map((b) => ({ target_ids: b.target_ids, input: b.input })),
    [{ target_ids: [item], input: { effect_generation: 1 } }],
  );
  const cure = invoke(4, 'bandage', [item], { effect_generation: row.generation });
  a.sql.close();
  const snapshot = (sql: DatabaseSync) => ({
    head: sql.prepare('SELECT * FROM head').all(),
    rows: sql.prepare('SELECT * FROM state_row ORDER BY section,key').all(),
    receipts: sql.prepare('SELECT * FROM receipt ORDER BY revision').all(),
  });
  for (const action of ['tick', 'cure'] as const)
    for (const kind of ['failed', 'absent', 'lost'] as const) {
      const clone = join(dir, action + '-' + kind + '.db');
      copyFileSync(path, clone);
      const sql = new DatabaseSync(clone);
      if (kind === 'failed')
        sql.exec(
          'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
        );
      const fault: Fault = { kind, armed: false, reads: false, inserted: false };
      const attempt = open(sql, fault);
      const prior = snapshot(sql);
      const old = attempt.story.world();
      const due = { expected_run_id: attempt.story.runId(), from: 64950, until: 65050 };
      fault.armed = true;
      const result = action === 'tick' ? attempt.story.elapsed(due) : attempt.story.invoke(cure);
      assert.equal(result.kind, 'pending', action + kind);
      assert.equal(attempt.story.world(), old);
      assert.equal(attempt.story.invoke(invoke(50, 'look')).kind, 'pending');
      assert.equal(attempt.story.elapsed(due).kind, 'pending');
      fault.reads = false;
      if (sql.isTransaction) sql.exec('ROLLBACK');
      sql.close();
      const settled = open(new DatabaseSync(clone));
      const next = kind === 'lost';
      if (!next) assert.deepEqual(snapshot(settled.sql), prior, action + kind);
      assert.equal(
        settled.story.world().state.bleeds![fresh.body]!.active,
        action === 'cure' && next ? false : true,
      );
      assert.equal(
        settled.story.world().state.containers[item],
        action === 'cure' && next ? fresh.consumed : fresh.body,
      );
      assert.equal(
        settled.story.world().state.jobs![row.job_id].status,
        next ? (action === 'tick' ? 'completed' : 'cancelled') : 'pending',
      );
      if (next && action === 'tick') {
        const continued = settled.story.world().state.bleeds![fresh.body]!;
        assert.ok(continued.active);
        assert.equal(settled.story.world().state.jobs![continued.job_id].due_time, 65150);
      }
      assert.equal(
        settled.story.world().state.resources?.[
          key({ kind: 'resource', entity_id: fresh.body, resource: resourceRef(fresh, 'hp') })
        ]?.value,
        action === 'tick' && next ? 8 : 9,
      );
      assert.equal(settled.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n, next ? 5 : 4);
      if (next && action === 'tick')
        assert.deepEqual(
          settled.story.narration()?.lines.map((line) => line.key),
          ['narration.bleed.tick'],
        );
      const replay = action === 'tick' ? settled.story.elapsed(due) : settled.story.invoke(cure);
      assert.equal(replay.kind, 'saved');
      if (replay.kind === 'saved') assert.equal(replay.replay, next);
      settled.sql.close();
    }
  a = open(new DatabaseSync(path));
  const saved = a.story.invoke(cure);
  assert.equal(saved.kind, 'saved', JSON.stringify(saved));
  assert.equal(a.story.world().state.containers[item], fresh.consumed);
  assert.equal(a.story.world().state.bleeds![fresh.body]!.active, false);
  a.sql.close();
  a = open(new DatabaseSync(path));
  t.after(() => a.sql.close());
  assert.equal(a.story.world().state.containers[item], fresh.consumed);
  assert.equal(a.story.world().state.bleeds![fresh.body]!.active, false);
  const replay = a.story.invoke(cure);
  assert.equal(replay.kind, 'saved');
  if (replay.kind === 'saved') assert.equal(replay.replay, true);
  assert.equal(a.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n, 5);
});
