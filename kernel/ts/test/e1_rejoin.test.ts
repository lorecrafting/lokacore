import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { hash } from '../src/foundation/canonical.ts';
import { read } from './read.ts';
import { admitCandidate } from './e1_policy.ts';
import { caseHost, type CaseHost } from './e1_case_host.ts';
import { replayCase } from './e1_cases.ts';
import { elspethStays, rejoin } from './e1_rejoin.ts';

const pin = read('protocol/fixtures/missing_child_v042_hash.json');
const bytes = new TextEncoder().encode(
  `{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`,
);
const source = {
  source_sha: '1'.repeat(40),
  check_hash: '2'.repeat(64),
  policy_hash: '3'.repeat(64),
};
const base = '/dialogues/ashmere_missing_child@0.0.42:dialogue';
const elspeth = (child: string) =>
  [
    '',
    '/choices/acknowledge',
    '/choices/directions',
    '/choices/inn',
    '/policy/root',
    '/policy/root/items/0',
  ].map((p) => `${base}/b_elspeth_${child}${p}`);
const variant =
  '/quests/ashmere_missing_child@0.0.42:quest/missing_child/journal/active_variants/0/when/root';

function replayed(case_id: string, recipe: (a: CaseHost) => void) {
  const dir = mkdtempSync(join(tmpdir(), 'loka-e1-rejoin-'));
  const a = caseHost(
    admitCandidate(bytes),
    join(dir, 'save.db'),
    join(dir, 'case.jsonl'),
    undefined,
    {
      case_id,
      source,
      fault_schedule: [],
    },
  );
  try {
    recipe(a);
    a.record({
      kind: 'finish',
      steps: a.commands.length,
      digest: a.digest(),
      state_hash: hash(a.story.world().state as never),
    });
    return replayCase(bytes, readFileSync(join(dir, 'case.jsonl'), 'utf8'), source).obligations;
  } finally {
    a.close();
    rmSync(dir, { recursive: true });
  }
}

// Breaks: the route skips the death or the rejoin, or an Elspeth choice talk is omitted.
test('E1 escort death, rejoin and pre-bell Elspeth talks witness their exact paths', () => {
  const rescued = replayed('rejoin', rejoin);
  for (const path of [
    `${base}/b_wren_rejoin`,
    `${base}/b_wren_rejoin/choices/rejoin`,
    `${base}/b_wren_rejoin/policy/root`,
    ...[0, 1, 2, 3, 4].map((i) => `${base}/b_wren_rejoin/policy/root/items/${i}`),
    variant,
    `${variant}/items/0`,
    `${variant}/items/1`,
    ...elspeth('rescued'),
  ])
    assert.equal(rescued.includes(path), true, path);
  const stays = replayed('elspeth-stays', elspethStays);
  for (const path of elspeth('stays')) assert.equal(stays.includes(path), true, path);
});
