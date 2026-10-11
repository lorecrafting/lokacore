// Toolbox row W21 on the compiled fear sampler: two goblins of one pack plan (6 HP, a sure hit for
// 1, flight below 25%) in the den, a burrow east inside their area; the player (10 HP) always hits
// for 2. A shout of "begone" applies `afraid` (a fear status) to each goblin that hears it.
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
import { level, resourceRef } from '../src/mechanics/resource.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-fear-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/fear_sampler', file], {
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
const id = () => `eeeeeeee-2121-4121-8121-${String(++n).padStart(12, '0')}` as never;
function ok(r: ReturnType<typeof step>) {
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
const play = (w: World, payload: object) =>
  ok(
    step(
      w,
      {
        id: id(),
        world_context_id: w.context,
        payload: { actor_id: w.character, ...payload },
      } as never,
      n,
    ),
  );
function round(w: World) {
  const run_id = `aaaaaaaa-2121-4121-8121-${String(++n).padStart(12, '0')}`;
  const [from, until] = [w.state.clock, w.state.clock + 150];
  const payload = { type: 'elapsed', actor_id: w.character, run_id, from, until };
  const command = { id: elapsedCommandId(run_id, w.context, from, until), payload };
  return ok(stepElapsed(w, { ...command, world_context_id: w.context } as never, n));
}
const hp = (w: World, e: string) => level(w, e as never, resourceRef(w, 'hp'));
const room = (w: World, e: string) => w.rooms[w.state.containers[e]!]?.title;

/** Two rounds of a fight on the lower-id goblin, after `before` in the den. */
function fight(before: (w: World) => World) {
  n = 0;
  let w = play(newWorld(content, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]), {
    type: 'move',
    direction: 'east',
  });
  const den = w.state.containers[w.body];
  const [a, b] = Object.keys(w.state.created ?? {})
    .filter((e) => w.state.created![e].origin.kind === 'spawned' && w.state.containers[e] === den)
    .sort();
  assert.ok(a && b, 'two goblins in the den');
  w = round(round(play(before(w), { type: 'attack', target_id: a })));
  return { w, a: a!, b: b! };
}

// Breaks: combat behaviour ignores the fear status (the goblins fight on), reads it only below the
// hp threshold, or a feared goblin skips its turn instead of fleeing.
test('afraid goblins flee on their next turns; without fear they fight', () => {
  const calm = fight((w) => w);
  assert.deepEqual(
    [hp(calm.w, calm.w.body), hp(calm.w, calm.a), room(calm.w, calm.a), room(calm.w, calm.b)],
    [8, 2, 'room.den.title', 'room.den.title'],
    'each goblin strikes once; the player hits the first twice',
  );
  const { w, a, b } = fight((v) => play(v, { type: 'shout', word: 'begone' }));
  assert.deepEqual(
    [hp(w, w.body), hp(w, a), hp(w, b), room(w, a), room(w, b)],
    [10, 4, 6, 'room.burrow.title', 'room.burrow.title'],
    'round 1: hit, the first goblin flees; round 2: the second flees before the player strikes',
  );
  assert.deepEqual(
    Object.values(w.state.encounters ?? {}).map((e) => e.status),
    ['closed'],
  );
});

// Breaks: the loader admits a fear status under API 1.48, or refuses one without per_tick (twin of
// test/loka/content_fear_test.exs).
test('a fear status needs API 1.49 and may omit per_tick', () => {
  const c = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  c.manifest.requires.kernel_api.at_least = '1.48';
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  const r = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
  assert.deepEqual(r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path], [
    'KERNEL_API_RANGE_INVALID',
    '.cartridge.manifest.requires.kernel_api.at_least',
  ]);
});
