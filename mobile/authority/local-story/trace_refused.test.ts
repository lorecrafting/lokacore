import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';

const tool = (name: string) => new URL(`../../../kernel/ts/play/${name}`, import.meta.url).pathname;

/** A real host save: an elapsed tick, then `moves` invoked, its trace written where the tools read it. */
function played(t: TestContext, moves: object[]) {
  const a = elapsedHost(),
    folder = mkdtempSync(join(tmpdir(), 'loka-refused-'));
  t.after(() => (a.sql.close(), rmSync(folder, { recursive: true })));
  a.clock.wall += 20;
  a.clock.mono += 20;
  assert.equal(a.game.pulse().kind, 'ready');
  const replies = moves.map((m) => a.game.invoke(m as never));
  const artifact = join(folder, 'cartridge.json'),
    path = join(folder, 'trace.jsonl');
  writeFileSync(
    artifact,
    `{"cartridge":${a.bundle.canonical},"content_hash":"${a.bundle.sha256}"}`,
  );
  const records = a.sql
    .prepare('SELECT record FROM trace ORDER BY rowid')
    .all()
    .map((r) => JSON.parse(r.record as string));
  const write = (rows: any[]) => writeFileSync(path, rows.map((r) => encode(r)).join('\n') + '\n');
  write(records);
  const run = (name: string, ...args: string[]) =>
    spawnSync(process.execPath, [tool(name), artifact, ...args], {
      encoding: 'utf8',
      maxBuffer: 1e9,
    });
  return { replies, records, write, run, path };
}

const barred = { action_key: 'move', target_ids: [], input: { direction: 'south' } };
const look = { action_key: 'look', target_ids: [], input: {} };
const decision = (reply: unknown) => (reply as { decision: { kind: string } }).decision.kind;

// Breaks: replay rebuilds a stored rejection as commit unavailable, so a host's refused move differs.
test('a refused move replays identically, and a forged commit on it still differs', (t) => {
  const p = played(t, [barred, look]);
  assert.equal(decision(p.replies[0]), 'rejected');
  assert.equal(p.records[2].data.commit.state, 'committed');
  const replay = () => p.run('main.ts', '--replay', p.path);
  const same = replay();
  assert.equal(same.status, 0, same.stderr);
  assert.match(same.stdout, /replay: 3 commands identical/);

  const forged = structuredClone(p.records);
  forged[2].data.commit.revision += 1;
  p.write(forged);
  const differs = replay();
  assert.equal(differs.status, 1);
  assert.match(differs.stderr, /replay differs/);
});

// Breaks: coverage replays through the receipt-blind form and throws, or a refusal counts as exercise.
test('coverage reads past a refused move and credits it nothing', (t) => {
  const p = played(t, [look, barred]);
  const covered = p.run('coverage.ts', p.path);
  assert.equal(covered.status, 0, covered.stderr);
  p.write(p.records.slice(0, -1));
  const without = p.run('coverage.ts', p.path);
  assert.equal(without.status, 0, without.stderr);
  assert.equal(covered.stdout, without.stdout);
});

// Breaks: Why throws on the trace, or reports the refused step as if it had taken effect.
test('Why at a refused move says rejected, and answers past it', (t) => {
  const p = played(t, [barred, look]);
  const why = (ordinal: number) => {
    const r = p.run('why.ts', p.path, String(ordinal));
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout);
  };
  const refused = why(2);
  assert.equal(refused.command, 'move');
  assert.equal(refused.outcome, 'rejected');
  assert.deepEqual(refused.reactions, []);
  assert.equal(why(3).outcome, 'looked');
});
