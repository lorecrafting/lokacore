import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { read } from './read.ts';
import { admitCandidate } from './e1_policy.ts';
import { caseHost } from './e1_case_host.ts';
import { storageFault, faultSchedule } from './e1_faults.ts';
import { replayCase } from './e1_cases.ts';
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

// Breaks: a case replay says green after the SQLite fault or an intermediate commit is omitted.
test('E1 SQLite case requires complete fault schedule and committed commands', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-e1-case-')),
    path = join(dir, 'save.db'),
    log = join(dir, 'case.jsonl');
  const a = caseHost(admitCandidate(bytes), path, log, undefined, {
    case_id: 'sqlite-lost',
    source,
    fault_schedule: faultSchedule('lost'),
  });
  try {
    const summary = storageFault(a, path, 'lost');
    a.record({
      kind: 'finish',
      steps: a.commands.length,
      digest: a.digest(),
      state_hash: hash(a.story.world().state as never),
      summary,
    });
    const text = readFileSync(log, 'utf8');
    assert.equal(replayCase(bytes, text, source).steps, 2);
    const rows = text
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    rows[0].fault_schedule = [];
    assert.throws(
      () => replayCase(bytes, rows.map((r) => JSON.stringify(r)).join('\n'), source),
      /incomplete fault schedule/,
    );
    assert.throws(() =>
      replayCase(
        bytes,
        text
          .trim()
          .split('\n')
          .filter((line) => JSON.parse(line).kind !== 'step')
          .join('\n'),
        source,
      ),
    );
    assert.throws(
      () => replayCase(bytes, text.trim().split('\n').slice(0, -1).join('\n'), source),
      /incomplete case finish/,
    );
  } finally {
    a.close();
    rmSync(dir, { recursive: true });
  }
});
