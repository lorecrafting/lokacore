// Toolbox row W27 on the compiled recap sampler: GameView carries the authored away recap threshold
// in logical seconds; the loader's twin of the Elixir API floor (1.47).
import { awayCap } from '../src/mechanics/calendar.ts';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { gameView, newWorld } from '../src/index.ts';
import type { Cartridge } from '../src/runtime/decision.ts';
import { ctx, reload } from './harness.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-recap-after-'));
let source: any;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/recap_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  source = JSON.parse(readFileSync(file, 'utf8')).cartridge;
} finally {
  rmSync(scratch, { recursive: true });
}
const view = (change?: (c: any) => void) => {
  const r = reload(source, change);
  if (!r.ok) throw new Error(JSON.stringify(r.diagnostic));
  return gameView(
    newWorld(r.cartridge as Cartridge, ctx('0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f'), [1, 2, 3, 4]),
  );
};

// Breaks: the threshold is projected in real minutes or seconds, not logical seconds (30 minutes
// at rate 50 is 90000); it shows without the field.
test('recap_after is the authored minutes in logical seconds, absent unless authored', () => {
  assert.equal(view((c) => (c.manifest.time_policy.away_cap_hours = 25)).recap_after, 90000);
  assert.equal(
    view((c) => delete c.manifest.time_policy.recap_after_minutes).recap_after,
    undefined,
  );
});

// Breaks: a threshold above the away cap stays as authored, so no settlement can reach it and the
// recap never shows (30 minutes at rate 50 is 90000; one 24-hour day is 86400).
test('recap_after never exceeds the away cap', () => {
  assert.equal(view().recap_after, 86400);
});

// Breaks: the default assumes a 24-hour day of 3600-second hours, not the cartridge's calendar.
test('the away cap defaults to one calendar day, in hours when authored', () => {
  const calendar = { units_per_hour: 60, hours_per_day: 10 };
  const cap = (time_policy: object) => awayCap({ calendar, manifest: { time_policy } } as never);
  assert.equal(cap({}), 600);
  assert.equal(cap({ away_cap_hours: 3 }), 180);
});
