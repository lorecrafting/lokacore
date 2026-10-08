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
import { watchRounds } from './e1_watch_rounds.ts';

// Breaks: the route claims completion without its final player join, or pause/rejoin grants fake credit.
test('E1 watch rounds cold reopen and replay the four literal post-start checkpoints', () => {
  const pin = read('protocol/fixtures/missing_child_v042_hash.json');
  const loaded = admitCandidate(
    new TextEncoder().encode(`{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`),
  );
  const dir = mkdtempSync(join(tmpdir(), 'loka-e1-watch-'));
  let prior: string | undefined;
  try {
    for (const run of [1, 2]) {
      const a = caseHost(
        loaded,
        join(dir, `save-${run}.db`),
        join(dir, `case-${run}.jsonl`),
        undefined,
        { case_id: 'watch-rounds', fault_schedule: [], certification: false },
      );
      try {
        const summary = watchRounds(a);
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
