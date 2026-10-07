import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { read } from './read.ts';
import { admitCandidate } from './e1_policy.ts';
import { caseHost } from './e1_case_host.ts';
import { replayCase } from './e1_cases.ts';
import { hash } from '../src/foundation/canonical.ts';
import { chandlersDebt, lanternDream } from './e1_optional_quests.ts';

const pin = read('protocol/fixtures/missing_child_v042_hash.json');
const bytes = new TextEncoder().encode(
  `{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`,
);
// Breaks: an optional quest commits an unreopenable intermediate state, resolves early,
// loses its final consequence, applies it twice, or is missing from exact case replay.
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
    const source = {
      source_sha: '1'.repeat(40),
      check_hash: '2'.repeat(64),
      policy_hash: '3'.repeat(64),
    };
    let prior: string | undefined;
    for (const run of [1, 2]) {
      const a = caseHost(
        admitCandidate(bytes),
        join(dir, `save-${run}.db`),
        `${log}-${run}`,
        undefined,
        { case_id: id, source, fault_schedule: [], certification: false },
      );
      try {
        route(a);
        a.record({
          kind: 'finish',
          steps: a.commands.length,
          digest: a.digest(),
          state_hash: hash(a.story.world().state as never),
        });
        const replay = replayCase(bytes, readFileSync(`${log}-${run}`, 'utf8'), source);
        assert.equal(replay.case_id, id);
        assert.deepEqual(replay.obligations, []);
        if (prior) assert.equal(a.digest(), prior);
        prior = a.digest();
      } finally {
        a.close();
      }
    }
    rmSync(dir, { recursive: true });
  });
