// Toolbox rows 37a and 37b through the real elapsed driver and SQLite: a save closed mid-raid
// cold-reopens, and the new moon then counts the raid's aftermath once.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import type { DatabaseSync } from 'node:sqlite';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';

function raidBundle() {
  const dir = mkdtempSync(join(tmpdir(), 'loka-raid-host-'));
  try {
    const file = join(dir, 'artifact.json');
    execFileSync('mix', ['loka.compile', 'cartridges/raid_sampler', file], {
      cwd: fileURLToPath(new URL('../../../', import.meta.url)),
      stdio: 'pipe',
    });
    const canonical = encode(JSON.parse(readFileSync(file, 'utf8')).cartridge);
    return { canonical, sha256: createHash('sha256').update(canonical).digest('hex') };
  } finally {
    rmSync(dir, { recursive: true });
  }
}
// The committed fact_changed events of `fact`, as [logical_time, new].
const changes = (sql: DatabaseSync, fact: string) =>
  (sql.prepare('SELECT response FROM receipt').all() as { response: string }[])
    .flatMap((r) => JSON.parse(r.response).events ?? [])
    .filter((e: any) => e.payload.type === 'fact_changed' && e.payload.fact.key === fact)
    .map((e: any) => [e.logical_time, e.payload.new]);

// Breaks: cold reopen of a save holding a spawned raider and `raided` true is refused, or the
// reopened world counts the aftermath twice (or never) over two new-moon hours.
test('a save closed mid-raid cold-reopens; the new moon counts the aftermath once', (t) => {
  const bundle = raidBundle();
  const dir = mkdtempSync(join(tmpdir(), 'loka-raid-reopen-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'save.db');
  const a = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  assert.equal(a.game.pulse().kind, 'ready');
  a.clock.wall += 20_000; // 1000 units at 50 a second: the full moon
  a.clock.mono += 20_000;
  assert.equal(a.game.pulse().kind, 'ready');
  assert.deepEqual(changes(a.sql, 'raided'), [[1000, true]]);
  a.sql.close();
  const b = elapsedHost(path, { wall: a.clock.wall, mono: a.clock.mono }, bundle);
  t.after(() => b.sql.close());
  for (const ms of [20_000, 2_000]) {
    b.clock.wall += ms; // to 2000 (the new moon), then a second new-moon hour at 2100
    b.clock.mono += ms;
    assert.equal(b.game.pulse().kind, 'ready');
  }
  assert.equal(b.game.view().view.time, 2100);
  assert.deepEqual(changes(b.sql, 'aftermaths'), [[2000, 1]]);
});
