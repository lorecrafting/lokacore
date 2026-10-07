import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { admitCandidate } from './e1_policy.ts';
import { caseHost } from './e1_case_host.ts';
import { topology } from './e1_routes.ts';
import { read } from './read.ts';

// Break: a legal room route strands the player, or a committed water/ferry join cannot cold reopen.
test('E1 fresh authority route visits 57 literal rooms and reopens before each joined consumer', () => {
  const pin = read('protocol/fixtures/missing_child_v042_hash.json');
  const loaded = admitCandidate(
    new TextEncoder().encode(`{"cartridge":${pin.canonical},"content_hash":"${pin.sha256}"}`),
  );
  const dir = mkdtempSync(join(tmpdir(), 'loka-e1-routes-'));
  const a = caseHost(loaded, join(dir, 'save.db'), join(dir, 'case.jsonl'));
  try {
    const summary = topology(a);
    assert.equal(summary.rooms.length, 57);
    assert.equal(summary.swim, true);
    assert.equal(summary.terminal_room, 'ferry_landing');
  } finally {
    a.close();
    rmSync(dir, { recursive: true });
  }
});
