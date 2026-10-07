import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { admitCandidate } from './e1_policy.ts';
import { caseHost } from './e1_case_host.ts';
import { topology } from './e1_routes.ts';
import { replayCase, gaps } from './e1_cases.ts';
import { hash } from '../src/foundation/canonical.ts';
import { read } from './read.ts';

// Break: a legal route strands the player, cannot cold reopen, or is refused by case replay.
test('E1 fresh authority route visits 57 literal rooms and reopens before each joined consumer', () => {
  const pin = read('protocol/fixtures/missing_child_v042_hash.json');
  const bytes = new TextEncoder().encode(
    `{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`,
  );
  const loaded = admitCandidate(bytes);
  const dir = mkdtempSync(join(tmpdir(), 'loka-e1-routes-'));
  const source = {
    source_sha: '1'.repeat(40),
    check_hash: '2'.repeat(64),
    policy_hash: '3'.repeat(64),
  };
  const a = caseHost(loaded, join(dir, 'save.db'), join(dir, 'case.jsonl'), undefined, {
    case_id: 'topology',
    source,
    fault_schedule: [],
  });
  try {
    const summary = topology(a);
    assert.equal(summary.rooms.length, 57);
    assert.equal(summary.swim, true);
    assert.equal(summary.terminal_room, 'ferry_landing');
    a.record({
      kind: 'finish',
      steps: a.commands.length,
      digest: a.digest(),
      state_hash: hash(a.story.world().state as never),
      summary,
    });
    const replay = replayCase(bytes, readFileSync(join(dir, 'case.jsonl'), 'utf8'), source);
    assert.equal(replay.case_id, 'topology');
    assert.deepEqual(replay.obligations, []);
    const missing = gaps(loaded, a.seen, new Set(replay.obligations));
    assert.deepEqual(missing.rooms, []);
    assert.equal(missing.authored_obligations.includes('/world/carry'), true);
  } finally {
    a.close();
    rmSync(dir, { recursive: true });
  }
});
