import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { hash } from '../src/foundation/canonical.ts';
import { read } from './read.ts';
import { admitCandidate } from './e1_policy.ts';
import { caseHost } from './e1_case_host.ts';
import { replayCase } from './e1_cases.ts';
import { ENDINGS } from './e1_paths.ts';
import { epilogueTalks } from './e1_epilogue_talks.ts';

const pin = read('protocol/fixtures/missing_child_v042_hash.json');
const bytes = new TextEncoder().encode(
  `{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`,
);
const source = {
  source_sha: '1'.repeat(40),
  check_hash: '2'.repeat(64),
  policy_hash: '3'.repeat(64),
};

// Breaks: an ending-specific conversation is omitted or credited from another ending.
test('E1 reaches and resolves five post-epilogue conversations in each ending', () => {
  for (const [child, allegiance, fox] of ENDINGS) {
    const dir = mkdtempSync(join(tmpdir(), 'loka-e1-epilogue-'));
    const a = caseHost(
      admitCandidate(bytes),
      join(dir, 'save.db'),
      join(dir, 'case.jsonl'),
      undefined,
      {
        case_id: `${child}-${allegiance}`,
        source,
        fault_schedule: [],
      },
    );
    try {
      epilogueTalks(a, child, allegiance, fox);
      a.record({
        kind: 'finish',
        steps: a.commands.length,
        digest: a.digest(),
        state_hash: hash(a.story.world().state as never),
      });
      const replay = replayCase(bytes, readFileSync(join(dir, 'case.jsonl'), 'utf8'), source);
      for (const dialogue of [
        `a0_d9_elspeth_${child}_${allegiance}`,
        `a0_d9_maud_${child}_${allegiance}`,
        `a0_d9_aldric_${allegiance}`,
        `a0_d9_vesper_${allegiance}`,
        `a0_d9_sedge_${allegiance}`,
      ]) {
        const base = `/dialogues/ashmere_missing_child@0.0.42:dialogue/${dialogue}`;
        assert.equal(replay.obligations.includes(base), true);
        assert.equal(replay.obligations.includes(`${base}/choices/leave`), true);
      }
    } finally {
      a.close();
      rmSync(dir, { recursive: true });
    }
  }
});
