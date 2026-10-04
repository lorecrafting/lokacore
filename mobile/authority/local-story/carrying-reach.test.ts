// Real SQLite-loaded custody must terminate before carrying admission, in both consumers.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import type {
  Command,
  DefinitionRef,
  WorldContextId,
} from '../../../kernel/ts/src/contracts.gen.ts';
import { key } from '../../../kernel/ts/src/foundation/compose.ts';
import {
  loadCartridge,
  newWorld,
  type Cartridge,
  type World,
} from '../../../kernel/ts/src/index.ts';
import { INSTALLED, step } from '../../../kernel/ts/src/runtime/world.ts';
import { decide as containment } from '../../../kernel/ts/src/mechanics/containment/rule.ts';
import { decide as barrier } from '../../../kernel/ts/src/mechanics/barrier/rule.ts';
import { lists } from '../../../kernel/ts/src/view/action_lists.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { load } from './store.ts';

const SATCHEL = 'd530207e-b845-8be5-9d53-b44b2cf5d8a1';
const OIL = '6a70d262-b6ea-8b64-9809-ec7f79d1521e';
const kat = read('protocol/fixtures/cartridge_items_hash.json');
const loaded = loadCartridge(
  new TextEncoder().encode(`{"cartridge":${kat.canonical},"content_hash":"${kat.sha256}"}`),
  INSTALLED,
);
assert.ok(loaded.ok);
const base = newWorld(
  loaded.cartridge as Cartridge,
  '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as WorldContextId,
  [1, 2, 3, 4],
);
const fresh: World = {
  ...base,
  cartridge: { ...base.cartridge, world: { ...base.cartridge.world, carry: { max_grams: 10 } } },
  entities: Object.fromEntries(
    Object.entries(base.entities).map(([id, e]) => [
      id,
      e.kind === 'item' ? { ...e, mass_grams: 1 } : e,
    ]),
  ),
};
const command = (w: World, type = 'take'): Command =>
  ({
    id: 'e5f6a7b8-c9d0-8e1f-8a2b-4c5d6e7f8a9b',
    world_context_id: w.context,
    payload: {
      type,
      actor_id: w.character,
      ...(type === 'take' ? { item_id: SATCHEL } : { target_id: SATCHEL }),
    },
  }) as Command;
const noEvent = () => {
  throw new Error('a reach fault allocated an event');
};

function savedCycle() {
  const sql = new DatabaseSync(':memory:');
  const db = {
    execSync: (q: string) => void sql.exec(q),
    runSync: (q: string, ...p: (string | number | null)[]) => sql.prepare(q).run(...p),
    getFirstSync: <T>(q: string, ...p: (string | number | null)[]) =>
      (sql.prepare(q).get(...p) ?? null) as T | null,
    getAllSync: <T>(q: string, ...p: (string | number | null)[]) => sql.prepare(q).all(...p) as T[],
    isInTransactionSync: () => sql.isTransaction,
  };
  const first = () => ({
    format: 'loka-save-v1',
    lineage_id: '00000000-0000-4000-8000-000000000001',
    run_id: '00000000-0000-4000-8000-000000000002',
    parent: null,
    seed: [1, 2, 3, 4],
    pin: { content_hash: kat.sha256 },
    binding: null,
  });
  assert.ok(load(db, fresh, first));
  sql
    .prepare("UPDATE state_row SET value = ? WHERE section = 'containers' AND key = ?")
    .run(JSON.stringify(OIL), SATCHEL);
  const reopened = load(db, fresh, first);
  assert.ok(reopened);
  assert.equal(reopened.world.state.containers[OIL], SATCHEL);
  assert.equal(reopened.world.state.containers[SATCHEL], OIL);
  sql.close();
  return reopened.world;
}

function probe(mode: string) {
  const w = savedCycle();
  if (mode === 'step') {
    const result = step(w, command(w), 0);
    assert.deepEqual(result.decision, { kind: 'fault', code: 'containment_cycle' });
    assert.equal(result.world, w);
  } else if (mode === 'list') {
    const offer = lists(w, w.character)
      .of('room_contents', SATCHEL)
      .find((a) => a.action_key === 'take');
    assert.ok(offer && !offer.available);
    assert.deepEqual(offer.reason, { code: 'containment_cycle' });
  } else {
    assert.deepEqual(barrier(w, command(w, 'open') as never, noEvent, { n: 0 }), {
      kind: 'fault',
      code: 'containment_cycle',
    });
  }
}

if (process.env.LOKA_CARRY_REACH_PROBE) {
  probe(process.env.LOKA_CARRY_REACH_PROBE);
} else {
  // Breaks: either real admission or projection hangs on an open cycle restored from SQLite;
  // a truthy reach error also must not make item-barrier admission succeed or mask its fault.
  for (const mode of ['step', 'list', 'barrier'])
    test(`saved custody cycle faults in ${mode}`, () => {
      const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
        env: { ...process.env, LOKA_CARRY_REACH_PROBE: mode },
        encoding: 'utf8',
        timeout: 5000,
      });
      assert.equal(child.error, undefined, 'custody traversal must terminate');
      assert.equal(child.status, 0, child.stderr);
    });

  // Breaks: reach resets the prior query budget or lets a fault allocate an event.
  test('Take and item-barrier reach preserve the spent decision budget', () => {
    for (const [rule, type] of [
      [containment, 'take'],
      [barrier, 'open'],
    ] as const) {
      assert.deepEqual(rule(fresh, command(fresh, type) as never, noEvent, { n: 32768 }), {
        kind: 'fault',
        code: 'budget_exceeded',
      });
    }
    const ids = Array.from(
      { length: 32769 },
      (_, n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    );
    const many: World = {
      ...base,
      entities: {
        ...base.entities,
        ...Object.fromEntries(ids.map((id) => [id, base.entities[SATCHEL]])),
      },
      state: {
        ...base.state,
        containers: {
          ...base.state.containers,
          ...Object.fromEntries(ids.map((id) => [id, base.state.containers[base.body]])),
        },
      },
    };
    const projected = lists(many, many.character);
    for (const id of ids.slice(0, 32768)) projected.of('room_contents', id);
    const offer = projected.of('room_contents', ids[32768]).find((a) => a.action_key === 'take');
    assert.ok(offer && !offer.available);
    assert.deepEqual(offer.reason, { code: 'budget_exceeded' });
    assert.ok(
      projected.of('room_contents', ids[0]).find((a) => a.action_key === 'take')?.available,
    );
  });

  // Breaks: inspecting a cycle beyond a closed lid replaces the existing not_present refusal.
  test('a closed ancestor refuses reach before the hidden cycle', () => {
    const w = savedCycle();
    const lid = {
      cartridge_id: 'ashmere_items',
      cartridge_version: '0.0.1',
      kind: 'barrier',
      key: 'lid',
    } as DefinitionRef;
    const closed: World = {
      ...w,
      barrierInitial: { ...w.barrierInitial, [key(lid)]: 'closed' },
      entities: { ...w.entities, [OIL]: { ...w.entities[OIL], barrier: lid } as never },
    };
    assert.deepEqual(step(closed, command(closed), 0).decision, {
      kind: 'rejected',
      error: { code: 'not_present' },
    });
    const offer = lists(closed, closed.character)
      .of('room_contents', SATCHEL)
      .find((a) => a.action_key === 'take');
    assert.ok(offer && !offer.available);
    assert.deepEqual(offer.reason, { code: 'not_present' });
  });
}
