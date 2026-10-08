import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { read } from './read.ts';
import { admitCandidate } from './e1_policy.ts';
import { caseHost, witnessedObligations } from './e1_case_host.ts';
import { itemRound } from './e1_items.ts';

const pin = read('protocol/fixtures/missing_child_v042_hash.json');
const loaded = admitCandidate(
  new TextEncoder().encode(`{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`),
);
const path = (key: string) => `/items/ashmere_missing_child@0.0.42:item/${key}`;

// Breaks: a bought, sold or taken static item stays pending, that command credits another
// item, or credit survives a missing event, transfer op, state change or static identity.
test('E1 item round witnesses each static item only by its own committed transfer', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-e1-items-'));
  const a = caseHost(loaded, join(dir, 'save.db'));
  const keyOf = new Map(
    Object.entries(a.initial.entityIds).map(([ref, id]) => [id, ref.split('/').pop()!]),
  );
  const transfers: string[][] = [];
  try {
    a.watch((before, after, command, decision) => {
      const p = command.payload;
      if (p.type !== 'buy' && p.type !== 'sell' && p.type !== 'take') return;
      const items = (b = before, x = after, d = decision) =>
        witnessedObligations(b, x, command, d).filter((y) => y.startsWith('/items/'));
      transfers.push([`${p.type} ${keyOf.get(p.item_id)}`, ...items()]);
      if (decision.kind !== 'accepted') return;
      const ops = decision.delta.ops.filter((op) => op.op !== 'entity.transfer');
      assert.deepEqual(items({ ...before, entityIds: {} }), []);
      assert.deepEqual(items(before, after, { ...decision, events: [] }), []);
      assert.deepEqual(items(before, after, { ...decision, delta: { ops } }), []);
      assert.deepEqual(items(after), []);
      assert.deepEqual(items(before, before), []);
    });
    assert.equal(itemRound(a).pennies, 0);
    const own = (verb: string, key: string) => [`${verb} ${key}`, path(key)];
    assert.deepEqual(transfers, [
      own('buy', 'torch'),
      own('buy', 'satchel'),
      own('buy', 'iron_sword'),
      own('buy', 'wooden_shield'),
      own('sell', 'iron_sword'),
      own('sell', 'satchel'),
      own('sell', 'wooden_shield'),
      own('buy', 'lamp_oil'),
      own('buy', 'waterskin'),
      own('sell', 'waterskin'),
      own('buy', 'spare_waterskin'),
      own('take', 'brass_key'),
      own('take', 'tin_whistle'),
      own('take', 'silver_ring'),
    ]);
  } finally {
    a.close();
    rmSync(dir, { recursive: true });
  }
});
