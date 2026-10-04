// M1-A real SQLite: trusted receipts/replay/run fencing and modal time admission.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import type { Command, WorldContextId } from '../../../kernel/ts/src/contracts.gen.ts';
import {
  loadCartridge,
  newWorld,
  INSTALLED,
  gameView,
  stepElapsed,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { openStory, type Saved } from './authority.ts';
const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as WorldContextId;
function setup(scene = false) {
  const c = structuredClone(
    read(`protocol/fixtures/cartridge_${scene ? 'scene' : 'ferry'}_hash.json`).value,
  );
  c.manifest.time_policy = { profile: 'real_elapsed', rate: 50 };
  c.manifest.requires.kernel_api.at_least = '1.1';
  for (const recipe of Object.values(c.recipes) as any[]) delete recipe.duration;
  const canonical = encode(c);
  const hash = createHash('sha256').update(canonical).digest('hex');
  const loaded = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${hash}"}`),
    INSTALLED,
  );
  assert.ok(loaded.ok);
  const fresh = newWorld(loaded.cartridge as Cartridge, CONTEXT, [1, 2, 3, 4]);
  const sql = new DatabaseSync(':memory:');
  const fault = { armed: false, reads: 0 };
  const db = {
    execSync(q: string) {
      const before = sql.isTransaction;
      sql.exec(q);
      // Lose a successful COMMIT acknowledgement after making receipt reads fail in real SQLite.
      // This is an operation fault; no SQL text or statement spelling selects it.
      if (fault.armed && before && !sql.isTransaction) {
        fault.armed = false;
        sql.exec('ALTER TABLE receipt RENAME TO unavailable_receipt');
        throw new Error('lost transaction acknowledgement');
      }
    },
    runSync: (q: string, ...p: (string | number | null)[]) => sql.prepare(q).run(...p),
    getFirstSync<T>(q: string, ...p: (string | number | null)[]) {
      fault.reads++;
      return (sql.prepare(q).get(...p) ?? null) as T | null;
    },
    getAllSync: <T>(q: string, ...p: (string | number | null)[]) => sql.prepare(q).all(...p) as T[],
    isInTransactionSync: () => sql.isTransaction,
  };
  let n = 0;
  const host = {
    kernel_version: `loka-kernel@${'0123456789'.repeat(4)}`,
    newId: () => `aaaaaaaa-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  };
  const open = () => {
    const o = openStory(db, [{ content_hash: hash, fresh }], host);
    assert.equal(o.kind, 'open');
    if (o.kind !== 'open') throw new Error('unreachable');
    return o;
  };
  const o = open();
  const invoke = (action_key: string, target_ids: string[] = [], input: object = {}) =>
    o.invoke({
      invocation_id: host.newId(),
      actor_id: fresh.character,
      action_key,
      target_ids,
      input,
    }) as Saved;
  return { sql, fresh, fault, o, open, invoke };
}
const count = (sql: DatabaseSync) => sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n;

// Breaks: deciding a duplicate interval against the new clock or saving memory without its receipt.
test('elapsed receipt survives reopen and replays its first result after later clock commits', () => {
  const { o, sql, open, fresh } = setup();
  try {
    const first = { expected_run_id: o.runId(), from: 21600, until: 21601 };
    const a = o.elapsed(first) as Saved;
    assert.equal(a.kind, 'saved');
    assert.equal(a.replay, false);
    assert.equal(a.revision, 1);
    assert.equal(o.world().state.clock, 21601);
    assert.equal(sql.prepare('SELECT clock FROM head').get()!.clock, 21601);
    const command = JSON.parse(
      sql.prepare('SELECT command FROM receipt WHERE revision=1').get()!.command as string,
    ) as Command;
    const replayed = stepElapsed(fresh, command, 1);
    assert.deepEqual(replayed.decision, a.decision);
    assert.equal(replayed.world.state.clock, 21601);
    const reopened = open();
    assert.equal(reopened.world().state.clock, 21601);
    assert.equal(
      (reopened.elapsed({ expected_run_id: reopened.runId(), from: 21601, until: 21602 }) as Saved)
        .revision,
      2,
    );
    assert.deepEqual(reopened.elapsed(first), { ...a, replay: true });
    assert.equal(reopened.world().state.clock, 21602);
    assert.equal(count(sql), 2);
  } finally {
    sql.close();
  }
});

// Breaks: old-run callbacks being retargeted to a replacement with the same template world context.
test('old run elapsed refuses before receipt lookup after replacement without Host.random', () => {
  const { o, sql, fault } = setup();
  try {
    const old = { expected_run_id: o.runId(), from: 21600, until: 21601 };
    assert.equal((o.elapsed(old) as Saved).kind, 'saved');
    assert.equal(o.newGame().kind, 'replaced');
    assert.notEqual(o.runId(), old.expected_run_id);
    assert.equal(o.world().context, CONTEXT);
    fault.reads = 0;
    assert.deepEqual(o.elapsed(old), { kind: 'stale_view' });
    assert.equal(fault.reads, 0);
    assert.equal(o.world().state.clock, 21600);
    assert.equal(count(sql), 0);
  } finally {
    sql.close();
  }
});

// Breaks: new elapsed delivery entering while its previous COMMIT is unknown or advancing on retry.
test('unknown elapsed COMMIT fences trusted and player delivery until the real receipt reconciles', () => {
  const { o, sql, fault, invoke } = setup();
  try {
    const first = { expected_run_id: o.runId(), from: 21600, until: 21601 };
    fault.armed = true;
    assert.deepEqual(o.elapsed(first), { kind: 'pending' });
    assert.equal(sql.isTransaction, false);
    assert.equal(sql.prepare('SELECT count(*) AS n FROM unavailable_receipt').get()!.n, 1);
    assert.equal(o.world().state.clock, 21600);
    assert.deepEqual(o.elapsed({ ...first, until: 21602 }), { kind: 'pending' });
    assert.deepEqual(invoke('look'), { kind: 'pending' });
    sql.exec('ALTER TABLE unavailable_receipt RENAME TO receipt');
    const got = o.elapsed(first) as Saved;
    assert.equal(got.kind, 'saved');
    assert.equal(got.replay, true);
    assert.equal(got.revision, 1);
    assert.equal(o.world().state.clock, 21601);
    assert.equal(count(sql), 1);
  } finally {
    sql.close();
  }
});

// Breaks: trusted time sharing scene's player admission or implicitly advancing/ending its line.
test('modal scene keeps Continue-only player controls while elapsed time commits', () => {
  const { o, sql, fresh, invoke } = setup(true);
  try {
    const F = 'ashmere_scene@0.0.1';
    for (const [action, targets, input] of [
      ['lantern', [], {}],
      ['take', [fresh.entityIds[`${F}:item/lantern`]], {}],
      ['bram', [fresh.entityIds[`${F}:npc/bram`]], {}],
      [
        'choose',
        [],
        { choice_id: 'carry', continuation_id: () => gameView(o.world()).choice!.continuation_id },
      ],
    ] as [string, string[], any][]) {
      const value =
        typeof input.continuation_id === 'function'
          ? { ...input, continuation_id: input.continuation_id() }
          : input;
      const r = invoke(action, targets, value);
      assert.equal(r.kind, 'saved');
      assert.equal((r.decision as { kind: string }).kind, 'accepted');
    }
    assert.equal(o.world().state.clock, 21600);
    assert.equal(gameView(o.world()).scene!.index, 1);
    assert.deepEqual(
      gameView(o.world()).actions.map((a) => a.action_key),
      ['continue'],
    );
    const tick = o.elapsed({ expected_run_id: o.runId(), from: 21600, until: 21601 }) as Saved;
    assert.equal(tick.kind, 'saved');
    assert.equal((tick.decision as { kind: string }).kind, 'accepted');
    assert.equal(o.world().state.clock, 21601);
    assert.equal(gameView(o.world()).scene!.index, 1);
    const player = invoke('elapsed', [], { until: 21602 });
    assert.deepEqual(player.decision, {
      kind: 'rejected',
      error: { code: 'unsupported_capability' },
    });
    assert.equal(o.world().state.clock, 21601);
  } finally {
    sql.close();
  }
});

// Breaks: either stored JSON column escaping as a parse exception on elapsed replay.
for (const field of ['command', 'response'] as const)
  test(`malformed stored ${field} JSON conflicts without state or receipt changes`, () => {
    const { o, sql } = setup();
    try {
      const first = { expected_run_id: o.runId(), from: 21600, until: 21601 };
      assert.equal((o.elapsed(first) as Saved).revision, 1);
      const before = o.world();
      sql.prepare(`UPDATE receipt SET ${field} = ?`).run('{');
      assert.deepEqual(o.elapsed(first), { kind: 'conflict' });
      assert.equal(o.world(), before);
      assert.equal(o.world().state.clock, 21601);
      assert.equal(sql.prepare('SELECT revision, clock FROM head').get()!.revision, 1);
      assert.equal(count(sql), 1);
    } finally {
      sql.close();
    }
  });

// Breaks: an overly broad parse guard swallowing a real SQLite receipt-read error as conflict.
test('healthy elapsed delivery preserves actual SQLite receipt-read failures', () => {
  const { o, sql } = setup();
  try {
    const first = { expected_run_id: o.runId(), from: 21600, until: 21601 };
    assert.equal((o.elapsed(first) as Saved).revision, 1);
    const before = o.world();
    sql.exec('ALTER TABLE receipt RENAME TO unavailable_receipt');
    assert.throws(() => o.elapsed(first), { code: 'ERR_SQLITE_ERROR' });
    assert.equal(o.world(), before);
    assert.equal(o.world().state.clock, 21601);
    assert.equal(sql.prepare('SELECT count(*) AS n FROM unavailable_receipt').get()!.n, 1);
    sql.exec('ALTER TABLE unavailable_receipt RENAME TO receipt');
    assert.equal((o.elapsed(first) as Saved).replay, true);
  } finally {
    sql.close();
  }
});
