import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { read } from './read.ts';
import { admitCandidate } from './e1_policy.ts';
import { caseHost, witnessedObligations } from './e1_case_host.ts';
import { replayCase } from './e1_cases.ts';
import { itemRound } from './e1_items.ts';
import { hash } from '../src/foundation/canonical.ts';

const pin = read('protocol/fixtures/missing_child_v042_hash.json');
const bytes = new TextEncoder().encode(
  `{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`,
);
const source = {
  source_sha: '1'.repeat(40),
  check_hash: '2'.repeat(64),
  policy_hash: '3'.repeat(64),
};
const path = (key: string) => `/items/ashmere_missing_child@0.0.42:item/${key}`;

// Breaks: a bought or taken static item stays pending, or a sale/move credits an item it did not transfer.
test('E1 witnesses each bought or taken static item by its own committed transfer', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-e1-items-'));
  const log = join(dir, 'case.jsonl');
  const a = caseHost(admitCandidate(bytes), join(dir, 'save.db'), log, undefined, {
    case_id: 'item-round',
    source,
    fault_schedule: [],
  });
  const keyOf = new Map(
    Object.entries(a.initial.entityIds).map(([ref, id]) => [id, ref.split('/').pop()!]),
  );
  const transfers: string[][] = [];
  try {
    a.watch((before, after, command, decision) => {
      const p = command.payload;
      if (p.type !== 'buy' && p.type !== 'take') return;
      const items = witnessedObligations(before, after, command, decision).filter((x) =>
        x.startsWith('/items/'),
      );
      transfers.push([`${p.type} ${keyOf.get(p.item_id)}`, ...items]);
    });
    assert.deepEqual(itemRound(a), {
      held: ['torch', 'lamp_oil', 'spare_waterskin', 'brass_key', 'tin_whistle', 'silver_ring'],
      sold: ['iron_sword', 'satchel', 'wooden_shield', 'waterskin'],
      pennies: 0,
    });
    assert.deepEqual(transfers, [
      ['buy torch', path('torch')],
      ['buy satchel', path('satchel')],
      ['buy iron_sword', path('iron_sword')],
      ['buy wooden_shield', path('wooden_shield')],
      ['buy lamp_oil', path('lamp_oil')],
      ['buy waterskin', path('waterskin')],
      ['buy spare_waterskin', path('spare_waterskin')],
      ['take brass_key', path('brass_key')],
      ['take tin_whistle', path('tin_whistle')],
      ['take silver_ring', path('silver_ring')],
    ]);
    a.record({
      kind: 'finish',
      steps: a.commands.length,
      digest: a.digest(),
      state_hash: hash(a.story.world().state as never),
    });
    const replayed = replayCase(bytes, readFileSync(log, 'utf8'), source).obligations;
    const items = transfers.map(([, item]) => item!);
    assert.deepEqual(
      items.filter((x) => !replayed.includes(x)),
      [],
    );
    // Maud keeps her cask; the drink service elsewhere never shows or transfers it.
    assert.equal(replayed.includes(path('lantern_ale_cask')), false);
  } finally {
    a.close();
    rmSync(dir, { recursive: true });
  }
});
