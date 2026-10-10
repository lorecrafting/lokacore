// Toolbox row W10 on the compiled schedule sampler: a conditional daily_schedule hour sends Maud
// to the Green while the child is lost (a fact), else to the garden; her goal shows only when the
// player sees her leave; the loader's twin checks of schedule_cases.
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

const scratch = mkdtempSync(join(tmpdir(), 'loka-schedule-cases-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/schedule_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const source = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
const C = 'schedule_sampler@0.0.1';
const MAUD = `${C}:npc/maud`;
// `change` applied to a copy of the compiled cartridge, then loaded: the cartridge or the diagnostic.
function load(change: (c: any) => void = () => {}) {
  const c = structuredClone(source);
  change(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
}
const fresh = (change?: (c: any) => void) => {
  const r = load(change);
  assert.ok(r.ok, JSON.stringify(r));
  return newWorld(r.cartridge as Cartridge, '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1]);
};
let n = 0;
const narration: string[] = [];
function play(w: World, p: object): World {
  n += 1;
  const r = step(
    w,
    {
      id: `eeeeeeee-1010-4010-8010-${String(n).padStart(12, '0')}` as never,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...p } as never,
    },
    n,
  );
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  narration.push(...(r.decision.narration ?? []).map((t) => t.key as string));
  return r.world;
}
const at = (hour: number) => ({ type: 'wait', until: hour * 3600 });
const room = (w: World) => w.state.containers[w.entityIds[MAUD]!];
const roomId = (w: World, k: string) => w.roomIds[`${C}:room/${k}`];

// Breaks: the cases ignored (always the fallback), the first case taken whatever its condition,
// or the goal never narrated.
test('Maud goes to the garden at 08:00, or hurries to the Green while the child is lost', () => {
  narration.length = 0;
  let w = play(fresh(), at(9)); // 07:00 in the cottage, nothing lost
  assert.equal(room(w), roomId(w, 'garden'));
  assert.deepEqual(narration, []);

  w = play(play(fresh(), { type: 'move', direction: 'north' }), {
    type: 'move',
    direction: 'south',
  });
  w = play(w, at(9)); // the child is lost in the woods; back in the cottage at 08:00
  assert.equal(room(w), roomId(w, 'green'));
  assert.deepEqual(narration, ['npc.maud.goal_green']);
});

// Breaks: the goal narrated whenever the case moves her, although the player is not in the room
// she leaves (status and sight narration show only what the player sees).
test('the goal is not narrated when the player is elsewhere', () => {
  narration.length = 0;
  const w = play(play(fresh(), { type: 'move', direction: 'north' }), at(9)); // still in the woods
  assert.equal(room(w), roomId(w, 'green'));
  assert.deepEqual(narration, []);
});

// Breaks: the condition read at the advance's end instead of the job's due time, so a single
// wait from 07:00 to 11:00 reads an 08:00-09:00 window as false and she goes to the garden.
test("a case's time window is read at the hour's due time, not the end of the wait", () => {
  const w = play(
    fresh((c) => {
      c.npcs[MAUD].schedule_cases['8'][0].when.root = { op: 'time_window', from: 8, to: 9 };
    }),
    at(11),
  );
  assert.equal(room(w), roomId(w, 'green'));
});

// Breaks: the loader skips schedule_cases (an unknown room, goal text or condition fact loads and
// fails in play), accepts a case hour the daily_schedule does not list (its job never runs it),
// or loads a case below kernel_api 1.47 (twin of content_schedules_test.exs).
test('the loader checks schedule_cases rooms, goal texts, conditions, hours and the 1.47 floor', () => {
  const at0 = `.cartridge.npcs[${JSON.stringify(MAUD)}].schedule_cases.8[0]`;
  const rows: [(c: any) => void, string, string, object][] = [
    [
      (c) => (c.npcs[MAUD].schedule_cases['8'][0].room.key = 'moor'),
      'UNRESOLVED_REFERENCE',
      `${at0}.room`,
      { target: `${C}:room/moor` },
    ],
    [
      (c) => (c.npcs[MAUD].schedule_cases['8'][0].goal = 'npc.maud.gone'),
      'UNRESOLVED_REFERENCE',
      `${at0}.goal`,
      { target: 'npc.maud.gone' },
    ],
    [
      (c) => (c.npcs[MAUD].schedule_cases['8'][0].when.root.fact.key = 'ghost'),
      'UNRESOLVED_REFERENCE',
      `${at0}.when.root.fact`,
      { target: `${C}:fact/ghost` },
    ],
    [
      (c) => (c.npcs[MAUD].schedule_cases['9'] = c.npcs[MAUD].schedule_cases['8']),
      'SCHEMA_VIOLATION',
      `.cartridge.npcs[${JSON.stringify(MAUD)}].schedule_cases.9`,
      { error: 'invalid_value' },
    ],
    [
      (c) => (c.manifest.requires.kernel_api.at_least = '1.46'),
      'KERNEL_API_RANGE_INVALID',
      '.cartridge.manifest.requires.kernel_api.at_least',
      {},
    ],
  ];
  for (const [change, code, path, data] of rows) {
    const r = load(change);
    assert.deepEqual(r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path, r.diagnostic.data], [
      code,
      path,
      data,
    ]);
  }
});
