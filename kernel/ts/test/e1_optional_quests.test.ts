import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { read } from './read.ts';
import { admitCandidate } from './e1_policy.ts';
import { caseHost } from './e1_case_host.ts';
import { hash } from '../src/foundation/canonical.ts';
import { chandlersDebt, lanternDream } from './e1_optional_quests.ts';

const pin = read('protocol/fixtures/missing_child_v042_hash.json');
const bytes = new TextEncoder().encode(
  `{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`,
);
// Breaks: an optional quest commits an unreopenable intermediate state, resolves early,
// loses its final consequence, or applies the consequence twice after resolution.
for (const [id, route] of [
  ['debt-on_time', chandlersDebt] as const,
  ...(['follow_fox', 'wake'] as const).map(
    (branch) =>
      [`dream-${branch}`, (a: ReturnType<typeof caseHost>) => lanternDream(a, branch)] as const,
  ),
])
  test(`E1 optional quest ${id} survives SQLite reopen and deterministic repetition`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'loka-e1-optional-'));
    const log = join(dir, 'case.jsonl');
    let prior: string | undefined;
    for (const run of [1, 2]) {
      const a = caseHost(
        admitCandidate(bytes),
        join(dir, `save-${run}.db`),
        `${log}-${run}`,
        undefined,
        { case_id: id, fault_schedule: [], certification: false },
      );
      try {
        route(a);
        a.record({
          kind: 'finish',
          steps: a.commands.length,
          digest: a.digest(),
          state_hash: hash(a.story.world().state as never),
        });
        if (prior) assert.equal(a.digest(), prior);
        prior = a.digest();
      } finally {
        a.close();
      }
    }
    rmSync(dir, { recursive: true });
  });
