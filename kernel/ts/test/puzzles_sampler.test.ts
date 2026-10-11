// Toolbox row 26 on the compiled puzzles sampler, content only (mechanics.md puzzles): levers
// pulled A, B, C unlock the north door (lever_stage 3); a lever out of order resets the stage.
// Three dial wheels count 0..9 by fact.adjust, a later-keyed rule wrapping 10 to 0; the east
// door opens on 3, 1, 2.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { value } from '../src/mechanics/fact.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-puzzles-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/puzzles_sampler', file], {
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
const fresh = () =>
  newWorld(content, '5d1b7e2a-3c4f-4a6b-9d8e-1f2a3b4c5d6e' as never, [1, 2, 3, 4]);
const fact = (w: World, k: string) =>
  value(w, w.character, {
    cartridge_id: 'puzzles_sampler',
    cartridge_version: '0.0.1',
    kind: 'fact',
    key: k,
  } as never);

let n = 0;
function run(w: World, payload: object) {
  n += 1;
  const r = step(
    w,
    {
      id: `eeeeeeee-2626-4226-8226-${String(n).padStart(12, '0')}`,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...payload },
    } as never,
    n,
  );
  const d = r.decision as { kind: string; outcome?: string; error?: { code: string } };
  return { w: r.world, out: d.kind === 'accepted' ? d.outcome : d.error?.code };
}
function perform(w: World, ...actions: string[]) {
  for (const action of actions) {
    const r = run(w, { type: 'perform', action });
    assert.equal(r.out, 'performed', action);
    w = r.w;
  }
  return w;
}
const open = (w: World, direction: string) => run(w, { type: 'open', direction }).out;

// Breaks: a reset rule keyed after its step rule (A, B, C ends at 0), a missing reset (A, C leaves
// stage 1; A, B, B leaves 2), or a step rule on the wrong stage.
test('levers A, B, C unlock the door; A, C, B resets, and the puzzle restarts', () => {
  let w = perform(fresh(), 'pull_a', 'pull_c');
  assert.equal(fact(w, 'lever_stage'), 0, 'C out of order resets');
  w = perform(w, 'pull_b');
  assert.equal(fact(w, 'lever_stage'), 0);
  assert.equal(open(w, 'north'), 'invalid_state');
  w = perform(w, 'pull_a', 'pull_b', 'pull_b');
  assert.equal(fact(w, 'lever_stage'), 0, 'B twice resets');
  w = perform(w, 'pull_a', 'pull_b', 'pull_c');
  assert.equal(fact(w, 'lever_stage'), 3);
  assert.equal(open(w, 'north'), 'opened');
});

// Breaks: any wheel's wrap rule missing or keyed before the turn (the tenth turn reads 10), the door reading the wrong wheel, or a wheel's turn adjusting another.
test('the dial opens on 3, 1, 2 only, and a wheel wraps 9 to 0', () => {
  const turn = (w: World, wheel: number, times: number) =>
    perform(w, ...Array<string>(times).fill(`turn_wheel_${wheel}`));
  let w = turn(turn(turn(fresh(), 1, 3), 2, 1), 3, 1);
  assert.equal(open(w, 'east'), 'invalid_state', '3, 1, 1');
  w = turn(w, 3, 1);
  assert.deepEqual(
    [1, 2, 3].map((i) => fact(w, `wheel_${i}`)),
    [3, 1, 2],
  );
  assert.equal(open(w, 'east'), 'opened');
  w = turn(turn(turn(fresh(), 1, 9), 2, 9), 3, 9);
  assert.deepEqual(
    [1, 2, 3].map((i) => fact(w, `wheel_${i}`)),
    [9, 9, 9],
  );
  w = turn(turn(turn(w, 1, 1), 2, 1), 3, 1);
  assert.deepEqual(
    [1, 2, 3].map((i) => fact(w, `wheel_${i}`)),
    [0, 0, 0],
    '9 wraps to 0',
  );
});
