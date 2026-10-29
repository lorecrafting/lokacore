// Toolbox row 10 on the compiled time sampler: 100 units an hour, 10 hours a day, a lunar period of
// 2000 (new from 0, full from 1000); the silver door north opens only at full moon (sky leaf), the
// brass door east only in hours 2 to 4 (time_window), both by barrier opens_when.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { encode } from '../src/foundation/canonical.ts';
import type { Obj } from '../src/content/cartridge_refs.ts';
import { ctx } from './harness.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-time-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/time_sampler', file], {
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

let n = 0;
const id = () => `aaaaaaaa-1010-4010-8010-${String(++n).padStart(12, '0')}` as never;
// Runs the commands in order from a fresh world; returns each decision's outcome or refusal code.
const play = (...payloads: object[]) => playIn(content, ...payloads);
function playIn(cartridge: Cartridge, ...payloads: object[]) {
  let w: World = newWorld(cartridge, ctx('5b7d9f1a-3c5e-4a7b-9d1f-4a6c8e0b2d4f'), [1, 2, 3, 4]);
  return payloads.map((p) => {
    const r = step(
      w,
      { id: id(), world_context_id: w.context, payload: { actor_id: w.character, ...p } } as never,
      n,
    );
    w = r.world;
    const d = r.decision as { kind: string; outcome?: string; error?: { code: string } };
    return d.kind === 'accepted' ? d.outcome : (d.error?.code ?? d.kind);
  });
}
const wait = (until: number) => ({ type: 'wait', until });
const door = (type: string, direction: string) => ({ type, direction });

// Breaks: opens_when ignored (the door opens at new moon), the sky leaf reading the wrong phase or
// the time without the lunar period (still full at 2000), or the gate also refusing a close
// outside the window (the door opened at full moon closes at 2000).
test('the silver door opens only at full moon', () => {
  const north = (t: string) => door(t, 'north');
  assert.deepEqual(
    play(
      north('open'),
      wait(999),
      north('open'),
      wait(1000),
      north('open'),
      wait(2000),
      north('close'),
      north('open'),
      wait(3000),
      north('open'),
    ),
    [
      'invalid_state',
      'waited',
      'invalid_state',
      'waited',
      'opened',
      'waited',
      'closed',
      'invalid_state',
      'waited',
      'opened',
    ],
  );
});

// Breaks: the gate checked before the state, so a locked door outside its window answers
// invalid_state instead of exit_locked.
test('a locked gated door outside its window is exit_locked', () => {
  const locked = structuredClone(content);
  (locked.barriers!['time_sampler@0.0.1:barrier/moon_door'] as Obj).initial = 'locked';
  assert.deepEqual(playIn(locked, door('open', 'north')), ['exit_locked']);
});

// Breaks: the hour door reads the moon or ignores its window's ends (hour 2 is 200 to 299, hour 4
// starts at 400), or the window not repeating on day 2 (1200).
test('the brass door opens only in hours 2 to 4', () => {
  const east = (t: string) => door(t, 'east');
  assert.deepEqual(
    play(
      wait(199),
      east('open'),
      wait(200),
      east('open'),
      east('close'),
      wait(400),
      east('open'),
      wait(1399),
      east('open'),
    ),
    [
      'waited',
      'invalid_state',
      'waited',
      'opened',
      'closed',
      'waited',
      'invalid_state',
      'waited',
      'opened',
    ],
  );
});
