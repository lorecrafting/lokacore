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
  let w: World = newWorld(cartridge, '5b7d9f1a-3c5e-4a7b-9d1f-4a6c8e0b2d4f' as never, [1, 2, 3, 4]);
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

// Breaks: the loader does not walk a barrier's opens_when (so a window past the day loads), accepts
// a sky phase the lunar cuts do not name, or accepts the new fields below kernel_api 1.45: a sky
// leaf alone (the hall's variant, no opens_when) or a barrier's opens_when alone (no sky leaf).
test('the loader refuses a bad window or phase in opens_when and an API below 1.45', () => {
  const at = (key: string) => `.cartridge.barriers["time_sampler@0.0.1:barrier/${key}"]`;
  const root = (c: Obj, key: string) =>
    c.barriers[`time_sampler@0.0.1:barrier/${key}`].opens_when.root;
  const ungate = (c: Obj, key: string) =>
    delete c.barriers[`time_sampler@0.0.1:barrier/${key}`].opens_when;
  const api = (c: Obj) => (c.manifest.requires.kernel_api.at_least = '1.44');
  const floor = '.cartridge.manifest.requires.kernel_api.at_least';
  const hall = 'time_sampler@0.0.1:room/hall';
  const rows: [(c: Obj) => void, string, string][] = [
    [
      (c) => (root(c, 'hour_door').to = 10),
      'SCHEMA_VIOLATION',
      `${at('hour_door')}.opens_when.root`,
    ],
    [
      (c) => (root(c, 'moon_door').lunar = 'half'),
      'SCHEMA_VIOLATION',
      `${at('moon_door')}.opens_when.root.lunar`,
    ],
    [api, 'KERNEL_API_RANGE_INVALID', floor],
    [
      (c) => (api(c), ungate(c, 'moon_door'), ungate(c, 'hour_door')),
      'KERNEL_API_RANGE_INVALID',
      floor,
    ],
    [
      (c) => (api(c), ungate(c, 'moon_door'), delete c.rooms[hall].variants),
      'KERNEL_API_RANGE_INVALID',
      floor,
    ],
  ];
  for (const [change, code, path] of rows) {
    const c = structuredClone(content) as unknown as Obj;
    change(c);
    const canonical = encode(c);
    const sha256 = createHash('sha256').update(canonical).digest('hex');
    const r = loadCartridge(
      new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
      INSTALLED,
    );
    assert.deepEqual(r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path], [code, path]);
  }
});
