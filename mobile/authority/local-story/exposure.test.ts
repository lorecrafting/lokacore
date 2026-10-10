// Toolbox row W25 through the real elapsed driver and SQLite: the calendar job never bounds an
// elapsed step (elapsed.ts boundary), so a long absence commits one clock_hour, not one per hour.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';

function exposureBundle(edit = (_: any) => {}) {
  const dir = mkdtempSync(join(tmpdir(), 'loka-exposure-host-'));
  try {
    const file = join(dir, 'artifact.json');
    execFileSync('mix', ['loka.compile', 'cartridges/exposure_sampler', file], {
      cwd: fileURLToPath(new URL('../../../', import.meta.url)),
      stdio: 'pipe',
    });
    const { cartridge } = JSON.parse(readFileSync(file, 'utf8'));
    edit(cartridge);
    const canonical = encode(cartridge);
    return { canonical, sha256: createHash('sha256').update(canonical).digest('hex') };
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

// Controlled input: swap frost into the slot of whatever weather the host's world draws on day 1
// (equal weights), so day 1 is frosty whatever world id the host mints.
const frostyDayOne = (drawn: string) => (c: any) => {
  const phases = c.calendar.weather.map((w: { phase: string }) => w.phase);
  const [a, b] = [phases.indexOf(drawn), phases.indexOf('frost')];
  [c.calendar.weather[a], c.calendar.weather[b]] = [c.calendar.weather[b], c.calendar.weather[a]];
};

// Breaks: cold reopen refuses the pending calendar job or a status row written by a tick and a
// clock_hour refresh in one settlement (two writes in the holder's group), or the next tick stalls.
test('a tick and refresh in one settlement and the calendar job survive SQLite reopen', (t) => {
  const probe = elapsedHost(':memory:', { wall: 10000, mono: 0 }, exposureBundle());
  const drawn = probe.game.view().view.calendar_status!.weather as string;
  probe.sql.close();
  const bundle = exposureBundle(frostyDayOne(drawn));
  const dir = mkdtempSync(join(tmpdir(), 'loka-exposure-reopen-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'save.db');
  const a = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  const hp = (g: typeof a.game) =>
    g.view().view.resources?.find((r: { resource: { key: string } }) => r.resource.key === 'hp')
      ?.current;
  assert.equal(a.game.pulse().kind, 'ready');
  const moved = a.game.invoke({
    action_key: 'move',
    target_ids: [],
    input: { direction: 'north' },
  } as never);
  assert.equal(moved.kind, 'saved');
  assert.deepEqual(
    a.game.view().view.conditions?.map((c: { label: string }) => c.label),
    ['condition.chilled'],
  );
  a.clock.wall += 144_000; // 7200 units: the 3600 refresh and the 7200 tick in one step
  a.clock.mono += 144_000;
  assert.equal(a.game.pulse().kind, 'ready');
  assert.equal(hp(a.game), 9);
  a.sql.close();
  const b = elapsedHost(path, { wall: a.clock.wall, mono: a.clock.mono }, bundle);
  t.after(() => b.sql.close());
  b.clock.wall += 144_000;
  b.clock.mono += 144_000;
  assert.equal(b.game.pulse().kind, 'ready');
  assert.equal(b.game.view().view.time, 14400);
  assert.equal(hp(b.game), 8);
  assert.deepEqual(
    b.game.view().view.conditions?.map((c: { label: string }) => c.label),
    ['condition.chilled'],
  );
});
