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
import { wispWard, infirmaryHerbs } from './e1_wisp_herbs.ts';

const pin = read('protocol/fixtures/missing_child_v042_hash.json');
const loaded = admitCandidate(
  new TextEncoder().encode(`{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`),
);
// Breaks: a route claims ward without the correct answer, or claims twelve bandages after only three exchanges.
for (const [name, route] of [
  ['wisp-ward', wispWard],
  ['infirmary-herbs', infirmaryHerbs],
] as const)
  test(`E1 ${name} cold reopens and replays its literal consequences`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'loka-e1-wisp-herbs-'));
    let prior: string | undefined;
    try {
      for (const run of [1, 2]) {
        const a = caseHost(
          loaded,
          join(dir, `save-${run}.db`),
          join(dir, `case-${run}.jsonl`),
          undefined,
          { case_id: name, fault_schedule: [], certification: false },
        );
        try {
          const summary = route(a);
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
