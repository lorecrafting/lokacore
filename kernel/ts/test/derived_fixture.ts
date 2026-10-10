// The compiled derived sampler (toolbox row 2) and the helpers its tests share.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INSTALLED, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { gameView } from '../src/view/view.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-derived-sampler-'));
export let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/derived_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const loaded = loadCartridge(artifact, INSTALLED);
assert.ok(loaded.ok, JSON.stringify(loaded));
export const content = loaded.cartridge as Cartridge;
export const anvil = (w: World) => w.entityIds['derived_sampler@0.0.1:item/anvil'];
export const MIGHT = 'derived_sampler@0.0.1:status/might';
export const dummy = (w: World) => w.entityIds['derived_sampler@0.0.1:npc/dummy'];
let n = 0;
export function act(w: World, p: object) {
  n += 1;
  return step(
    w,
    {
      id: `dddddddd-5555-4333-8444-${String(n).padStart(12, '0')}` as never,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...p } as never,
    },
    n,
  );
}
export function play(w: World, p: object): World {
  const r = act(w, p);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
export const chosen = (ancestry: string, c: Cartridge = content) =>
  play(newWorld(c, '1d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]), {
    type: 'choose_ancestry',
    ancestry,
  });
export function wait(w: World, seconds: number): World {
  n += 1;
  const run_id = 'aaaaaaaa-0000-4000-8000-000000000020';
  const until = w.state.clock + seconds;
  const r = stepElapsed(
    w,
    {
      id: elapsedCommandId(run_id, w.context, w.state.clock, until) as never,
      world_context_id: w.context,
      payload: { type: 'elapsed', actor_id: w.character, run_id, from: w.state.clock, until },
    } as never,
    n,
  );
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  if (r.decision.kind === 'accepted')
    seen.push(
      ...r.decision.events.map((e) => e.payload.type as string),
      ...(r.decision.narration ?? []).map((t) => t.key as string),
    );
  return r.world;
}
export const seen: string[] = []; // every elapsed run's event types, then its narration keys

export const hpView = (w: World) => {
  const { current, maximum } = gameView(w).resources!.find((r) => r.resource.key === 'hp')!;
  return [current, maximum];
};
