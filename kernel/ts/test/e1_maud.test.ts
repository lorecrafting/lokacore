import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { read } from './read.ts';
import { admitCandidate } from './e1_policy.ts';
import { caseHost, AUTHORITY_KERNEL } from './e1_case_host.ts';
import { replay } from './sim.ts';
import { maudsCellar } from './e1_maud.ts';

const pin = read('protocol/fixtures/missing_child_v042_hash.json');
const loaded = admitCandidate(
  new TextEncoder().encode(`{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`),
);

// Breaks: a fifth rat death is omitted after reopen, so Maud's exact turn-in cannot complete.
test('E1 Maud cellar earns all five separate deaths and the original reward durably', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-e1-maud-'));
  let prior: string | undefined;
  try {
    for (const run of [1, 2]) {
      const a = caseHost(loaded, join(dir, `save-${run}.db`));
      try {
        assert.deepEqual(maudsCellar(a), {
          killed: 5,
          outcome: 'done',
          trust: 5,
          original_key: true,
        });
        assert.equal(replay(a.initial, a.commands, AUTHORITY_KERNEL), undefined);
        if (prior) assert.equal(a.digest(), prior);
        prior = a.digest();
      } finally {
        a.close();
      }
    }
  } finally {
    rmSync(dir, { recursive: true });
  }
});
