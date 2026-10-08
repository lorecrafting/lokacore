import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { read } from './read.ts';
import { admitCandidate } from './e1_policy.ts';
import { caseHost, AUTHORITY_KERNEL } from './e1_case_host.ts';
import { replay } from './sim.ts';
import { hash } from '../src/foundation/canonical.ts';
import { nightMarsh } from './e1_night_marsh.ts';

// Breaks: a route claims survival without the fifth ordered entry or claims shelter without invoking it.
test('E1 legal Night in the Marsh route cold reopens and replays completion once', () => {
  const pin = read('protocol/fixtures/missing_child_v042_hash.json');
  const loaded = admitCandidate(
    new TextEncoder().encode(`{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`),
  );
  const dir = mkdtempSync(join(tmpdir(), 'loka-e1-night-'));
  let prior: string | undefined;
  try {
    for (const run of [1, 2]) {
      const a = caseHost(
        loaded,
        join(dir, `save-${run}.db`),
        join(dir, `case-${run}.jsonl`),
        undefined,
        { case_id: 'night-marsh', fault_schedule: [], certification: false },
      );
      try {
        const summary = nightMarsh(a);
        assert.equal(replay(a.initial, a.commands, AUTHORITY_KERNEL), undefined);
        a.record({
          kind: 'finish',
          steps: a.commands.length,
          digest: a.digest(),
          state_hash: hash(a.story.world().state as never),
          summary,
        });
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
