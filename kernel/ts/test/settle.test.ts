// Settle S3-1 (N1) on the compiled settle sampler (mechanics.md "Settle S3-1: narrate"): the
// `arrival_line` rule says `settle.arrival_line` when the character enters `road` (west of the
// entry `square`). The calendar starts at 600. The 1.103 floor is loader_floors.json's
// "a narrate step" case. Twin of test/loka/content_settle_test.exs.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { encode } from '../src/foundation/canonical.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-settle-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/settle_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const RULE = 'settle_sampler@0.0.1:reaction/arrival_line';
const LINE = 'settle.arrival_line';

function load(edit: (c: any) => void = () => {}) {
  const c = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  edit(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
}
function world(edit?: (c: any) => void): World {
  const r = load(edit);
  assert.ok(r.ok, JSON.stringify(r));
  return newWorld(
    r.cartridge as Cartridge,
    '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2],
  );
}
const lines = (d: { narration?: { key: string }[] }) => (d.narration ?? []).map((l) => l.key);
function west(w: World) {
  const id = 'bbbbbbbb-0000-4000-8000-000000000001' as never;
  const payload = { actor_id: w.character, type: 'move', direction: 'west' };
  const r = step(w, { id, world_context_id: w.context, payload } as never, 1);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r;
}
function wait(w: World, until: number) {
  const [run_id, from] = ['cccccccc-0000-4000-8000-000000000001' as never, w.state.clock];
  const payload = { type: 'elapsed', actor_id: w.character, run_id, from, until };
  const id = elapsedCommandId(run_id, w.context, from, until) as never;
  const r = stepElapsed(w, { id, world_context_id: w.context, payload } as never, 2);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return lines(r.decision as never);
}

// Breaks: the narrate branch dropped (or lowered to an op), so the move's receipt says nothing, or
// says the line twice. A move's own text is view-side; its receipt carries only this line.
test('S3-1: entering the road says the authored line once in the move receipt', () => {
  assert.deepEqual(lines(west(world()).decision as never), [LINE]);
});

// Breaks: a line goes before the lines of the steps before it (unshift, not push).
test('S3-1: a rule says its lines in step order', () => {
  const first = { op: 'narrate', text: 'room.road.title' };
  const w = world((c) => c.reactions[RULE].apply.unshift(first));
  assert.deepEqual(lines(west(w).decision as never), ['room.road.title', LINE]);
});

// Breaks: a fired (after) rule skips the step, or says it when scheduled instead of when due.
test('S3-1: a delayed line is said by the advance that reaches its due time, not before', () => {
  const w = world((c) => (c.reactions[RULE].after = 300));
  assert.equal(w.state.clock, 600);
  const moved = west(w);
  assert.ok(!lines(moved.decision as never).includes(LINE));
  assert.deepEqual(wait(moved.world, 899), []);
  assert.deepEqual(wait(moved.world, 900), [LINE]);
});

// Breaks: the loader admits a line whose text key is not in the catalog.
test('loader: a narrate text key resolves in the text catalog', () => {
  const r = load((c) => (c.reactions[RULE].apply[0].text = 'settle.missing'));
  assert.deepEqual(r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path], [
    'UNRESOLVED_REFERENCE',
    `.cartridge.reactions["${RULE}"].apply[0].text`,
  ]);
});
