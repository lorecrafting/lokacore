// Toolbox row W25 through the real elapsed driver and SQLite: the calendar job never bounds an
// elapsed step (elapsed.ts boundary), so a long absence commits one clock_hour, not one per hour.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';

function exposureBundle() {
  const dir = mkdtempSync(join(tmpdir(), 'loka-exposure-host-'));
  try {
    const file = join(dir, 'artifact.json');
    execFileSync('mix', ['loka.compile', 'cartridges/exposure_sampler', file], {
      cwd: fileURLToPath(new URL('../../../', import.meta.url)),
      stdio: 'pipe',
    });
    const { cartridge, content_hash } = JSON.parse(readFileSync(file, 'utf8'));
    return { canonical: encode(cartridge), sha256: content_hash as string };
  } finally {
    rmSync(dir, { recursive: true });
  }
}

// Breaks: the host stops each elapsed step at the calendar job's due time, so ten game hours
// away (720 s at 50 units a second, 3600 units an hour) commit ten clock_hour events.
test('ten game hours away commit one clock_hour through the elapsed driver', () => {
  const a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, exposureBundle());
  assert.equal(a.game.pulse().kind, 'ready');
  a.clock.wall += 720_000;
  a.clock.mono += 720_000;
  assert.equal(a.game.pulse().kind, 'ready');
  assert.equal(a.game.view().view.time, 36000);
  const fired = (a.sql.prepare('SELECT response FROM receipt').all() as { response: string }[])
    .flatMap((r) => JSON.parse(r.response).events ?? [])
    .filter((e: { payload: { type: string } }) => e.payload.type === 'clock_hour')
    .map((e: { logical_time: number }) => e.logical_time);
  assert.deepEqual(fired, [36000]);
  a.sql.close();
});
