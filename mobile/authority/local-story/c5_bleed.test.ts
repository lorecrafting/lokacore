import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
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
import { buttonsOf, group } from '../../app/book/model.ts';

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

// Breaks: a saved exact cure loses terminal custody or resurrects the tick on cold replay;
// an idempotent retry spends that item twice.
test('saved exact bandage cure reopens and replays once on real SQLite', (t) => {
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
  const open = (sql: DatabaseSync) => {
    const db: Db = {
      execSync: (q) => sql.exec(q),
      runSync: (q, ...p) => sql.prepare(q).run(...p),
      getFirstSync: <T>(q: string, ...p: (string | number | null)[]) =>
        (sql.prepare(q).get(...p) ?? null) as T | null,
      getAllSync: <T>(q: string, ...p: (string | number | null)[]) =>
        sql.prepare(q).all(...p) as T[],
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
  assert.equal(row.active, true);
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
