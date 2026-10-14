// Toolbox row FD8 on the compiled ambient sampler: the yard's description varies by sky and hour,
// derived on read. Rain from 21 to 5 shows `rain_night`; clear from 5 to 8 shows `clear_dawn`.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { gameView, INSTALLED, loadCartridge, newWorld } from '../src/index.ts';
import type { Cartridge } from '../src/runtime/decision.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-ambient-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/ambient_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const loaded = loadCartridge(artifact, INSTALLED);
assert.ok(loaded.ok, JSON.stringify(loaded));
const content = loaded.cartridge as Cartridge;

// Oracle, independent of the kernel: with this world id days 1 to 5 are frost, clear, gale, heat
// and rain (first 4 bytes of SHA-256 of `weather:<id>:<d>` mod 5; see exposure.test.ts).
const CONTEXT = '7e1f0c2a-5d3b-4c8e-9a6f-000000000003';
const at = (day: number, hour: number) => {
  const w = newWorld(content, CONTEXT as never, [1, 2, 3, 4]);
  w.state.clock = ((day - 1) * 24 + hour) * 3600;
  return gameView(w).place.description.key;
};

// Breaks: a variant drops the sky leaf (clear night shows rain), drops the hour (rain by day
// shows rain), or the window stops wrapping past midnight (rain at 23 or 2 shows the default).
test('the yard description follows sky and hour together', () => {
  const rows: [number, number, string][] = [
    [5, 23, 'room.yard.rain_night'],
    [5, 2, 'room.yard.rain_night'],
    [2, 23, 'room.yard.description'],
    [5, 12, 'room.yard.description'],
    [2, 6, 'room.yard.clear_dawn'],
    [5, 6, 'room.yard.description'],
  ];
  for (const [day, hour, key] of rows) assert.equal(at(day, hour), key, `day ${day} hour ${hour}`);
});
