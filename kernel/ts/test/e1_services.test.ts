import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { read } from './read.ts';
import { admitCandidate } from './e1_policy.ts';
import { caseHost, witnessedObligations } from './e1_case_host.ts';
import { replayCase } from './e1_cases.ts';
import { lanternServices } from './e1_services.ts';
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

// Breaks: a paid service is credited after its authored benefit or recovery is omitted from the receipt.
test('E1 witnesses each Maud service only with its own payment and committed benefit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-e1-services-'));
  const a = caseHost(
    admitCandidate(bytes),
    join(dir, 'save.db'),
    join(dir, 'case.jsonl'),
    undefined,
    {
      case_id: 'lantern-services',
      source,
      fault_schedule: [],
    },
  );
  const base = '/services/ashmere_missing_child@0.0.42:service/';
  const expected = ['lantern_room', 'lantern_meal', 'lantern_ale'].map((key) => `${base}${key}`);
  try {
    const witnessed: string[] = [];
    a.watch((before, after, command, decision) => {
      if (command.payload.type !== 'use_service' || decision.kind !== 'accepted') return;
      const key = command.payload.service.key;
      const selected = `${base}${key}`;
      assert.deepEqual(witnessedObligations(before, after, command, decision), [selected]);
      witnessed.push(selected);
      const omitted = decision.delta.ops.filter((op) =>
        key === 'lantern_room'
          ? op.op !== 'fact.assign'
          : key === 'lantern_meal'
            ? !(op.op === 'resource.adjust' && op.resource.key === 'lantern_meals')
            : op.op !== 'liquid.set',
      );
      assert.equal(omitted.length, decision.delta.ops.length - 1, 'remove only the benefit op');
      const paymentOnly = { ...decision, delta: { ops: omitted } };
      assert.equal(
        witnessedObligations(before, after, command, paymentOnly).includes(selected),
        false,
      );
      if (key !== 'lantern_room') {
        const ops = decision.delta.ops.filter(
          (op) => !(op.op === 'resource.adjust' && op.resource.key === 'mv'),
        );
        assert.equal(ops.length, decision.delta.ops.length - 1, 'remove only the recovery op');
        const unrecovered = { ...decision, delta: { ops } };
        assert.equal(
          witnessedObligations(before, after, command, unrecovered).includes(selected),
          false,
        );
      }
      const wrongProvider = {
        ...command,
        payload: { ...command.payload, provider_id: before.body },
      } as typeof command;
      assert.equal(
        witnessedObligations(before, after, wrongProvider, decision).includes(selected),
        false,
      );
    });
    assert.deepEqual(lanternServices(a), {
      services: ['lantern_room', 'lantern_meal', 'lantern_ale'],
      pennies: 14,
      ale: 3,
    });
    assert.deepEqual(witnessed, expected);
    a.record({
      kind: 'finish',
      steps: a.commands.length,
      digest: a.digest(),
      state_hash: hash(a.story.world().state as never),
    });
    const replay = replayCase(bytes, readFileSync(join(dir, 'case.jsonl'), 'utf8'), source);
    assert.deepEqual(
      expected.filter((path) => !replay.obligations.includes(path)),
      [],
    );
  } finally {
    a.close();
    rmSync(dir, { recursive: true });
  }
});
