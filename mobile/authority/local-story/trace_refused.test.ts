import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';

const tool = (name: string) => new URL(`../../../kernel/ts/play/${name}`, import.meta.url).pathname;

/** A real host save: an elapsed tick, then `moves` invoked, its stored rows written where the tools read them. */
type Host = ReturnType<typeof elapsedHost>;
function played(t: TestContext, moves: (a: Host) => object[]) {
  const a = elapsedHost(),
    folder = mkdtempSync(join(tmpdir(), 'loka-refused-'));
  t.after(() => (a.sql.close(), rmSync(folder, { recursive: true })));
  a.clock.wall += 20;
  a.clock.mono += 20;
  assert.equal(a.game.pulse().kind, 'ready');
  const replies = moves(a).map((m) => a.game.invoke(m as never));
  const artifact = join(folder, 'cartridge.json'),
    path = join(folder, 'trace.jsonl');
  writeFileSync(
    artifact,
    `{"cartridge":${a.bundle.canonical},"content_hash":"${a.bundle.sha256}"}`,
  );
  const rows = a.sql
    .prepare('SELECT record FROM trace ORDER BY rowid')
    .all()
    .map((r) => r.record as string);
  const write = (lines: string[]) => writeFileSync(path, lines.join('\n') + '\n');
  write(rows);
  const run = (name: string, ...args: string[]) =>
    spawnSync(process.execPath, [tool(name), artifact, ...args], {
      encoding: 'utf8',
      maxBuffer: 1e9,
    });
  return { replies, rows, write, run, path };
}

const barred = () => [{ action_key: 'move', target_ids: [], input: { direction: 'south' } }];
const look = { action_key: 'look', target_ids: [], input: {} };
const decision = (reply: unknown) => (reply as { decision: { kind: string } }).decision.kind;
// Bram's talk is grey until his quest is active; the kernel refuses it and the host stores a receipt.
const greyTalk = (a: Host) => {
  const bram = a.game
    .view()
    .view.entities.find((e) => e.actions.some((x) => x.action_key === 'bram'));
  return [{ action_key: 'bram', target_ids: [bram!.id], input: {} }];
};

// Breaks: replay rebuilds a stored rejection as commit unavailable, so a host's refused move differs.
test('a refused move replays identically, and a forged revision on it still differs', (t) => {
  const p = played(t, () => [...barred(), look]);
  assert.equal(decision(p.replies[0]), 'rejected');
  const replay = () => p.run('main.ts', '--replay', p.path);
  const same = replay();
  assert.equal(same.status, 0, same.stderr);
  assert.match(same.stdout, /replay: 3 commands identical/);

  const forged = JSON.parse(p.rows[2]);
  assert.equal(forged.data.commit.state, 'committed');
  forged.data.commit.revision += 1;
  p.write([p.rows[0], p.rows[1], encode(forged), p.rows[3]]);
  const differs = replay();
  assert.equal(differs.status, 1);
  assert.match(differs.stderr, /replay differs/);
});

// Breaks: coverage or Why throws on a host trace, a refusal counts as exercise, or Why calls it done.
test('coverage credits a refused talk nothing, and Why says rejected and answers past it', (t) => {
  const p = played(t, (a) => [...greyTalk(a), look]);
  assert.equal(decision(p.replies[0]), 'rejected');
  const covered = p.run('coverage.ts', p.path);
  assert.equal(covered.status, 0, covered.stderr);
  const plain = played(t, () => [look]);
  assert.equal(covered.stdout, plain.run('coverage.ts', plain.path).stdout);
  const why = (ordinal: number) => {
    const r = p.run('why.ts', p.path, String(ordinal));
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout);
  };
  assert.equal(why(2).outcome, 'rejected');
  assert.equal(why(3).outcome, 'looked');
});
