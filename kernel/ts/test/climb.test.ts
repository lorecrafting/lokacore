// Toolbox row 30 on the compiled climb sampler: the clifftop's down face to the ledge is a climb
// needing the rope (damage 4, HP 10); the ledge's up face is plain (mechanics.md rope and climb).
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
import { level, resourceRef } from '../src/mechanics/resource.ts';
import * as patrol from './patrol_fixture.ts';
import { ctx } from './harness.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-climb-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/climb_sampler', file], {
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
const P = 'climb_sampler@0.0.1';

// The player's session over `cartridge`: send a command, read the narration keys, room and HP.
function session(cartridge: Cartridge) {
  let n = 0;
  let w: World = newWorld(cartridge, ctx('3c5e7a9b-1d2f-4a6b-8c0d-2e4f6a8b0c1f'), [1, 2, 3, 4]);
  const send = (payload: object) => {
    const r = step(
      w,
      {
        id: `eeeeeeee-9999-4999-8999-${String(++n).padStart(12, '0')}`,
        world_context_id: w.context,
        payload: { actor_id: w.character, ...payload },
      } as never,
      n,
    );
    assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
    w = r.world;
    return (r.decision as { narration?: { key: string }[] }).narration?.map((t) => t.key);
  };
  return {
    send,
    world: () => w,
    edit: (change: (x: World) => World) => void (w = change(w)),
    at: () => w.rooms[w.state.containers[w.body]].title,
    hp: () => level(w, w.body, resourceRef(w, 'hp')),
  };
}

// Breaks: the fall ignores the rope (a roped climb still hurts), skips the move or the damage,
// kills or takes HP below 1, or a plain face (the ledge's up) also falls.
test('without the rope the climber falls to the ledge for 4 HP, never below 1; with it, unhurt', () => {
  const { send, world, at, hp } = session(content);

  for (const after of [6, 2, 1, 1]) {
    assert.deepEqual(send({ type: 'move', direction: 'down' }), [
      'movement.moved',
      'narration.fell',
    ]);
    assert.deepEqual([at(), hp()], ['room.ledge.title', after]);
    assert.deepEqual(send({ type: 'move', direction: 'up' }), ['movement.moved']);
    assert.deepEqual([at(), hp()], ['room.clifftop.title', after]);
  }
  send({ type: 'take', item_id: world().entityIds[`${P}:item/rope`] });
  assert.deepEqual(send({ type: 'move', direction: 'down' }), ['movement.moved']);
  assert.deepEqual([at(), hp()], ['room.ledge.title', 1]);
});

// Breaks: only a rope in the hand counts, so a rope carried inside a held pack still drops the climber.
test('a rope inside a carried pack counts as held', () => {
  const { send, world, edit, at, hp } = session(content);
  const rope = world().entityIds[`${P}:item/rope`];
  const pack = 'pack-under-test' as never; // held() only walks state.containers
  edit((w) => ({
    ...w,
    state: { ...w.state, containers: { ...w.state.containers, [pack]: w.body, [rope]: pack } },
  }));
  assert.deepEqual(send({ type: 'move', direction: 'down' }), ['movement.moved']);
  assert.deepEqual([at(), hp()], ['room.ledge.title', 10]);
});

// Breaks: the fall reads HP before the move's fare (a stale `from`, or the fall applied first):
// 10 - 1 (fare) - 4 (fall) = 5, and the fall's op starts from the post-fare 9.
test('the fall lands after the move cost', () => {
  const costly = {
    ...content,
    world: {
      movement: {
        cost: {
          resource: resourceRef(newWorld(content, 'x' as never, [1, 2, 3, 4]), 'hp'),
          amount: 1,
        },
      },
    },
  } as Cartridge;
  const { send, at, hp } = session(costly);
  assert.deepEqual(send({ type: 'move', direction: 'down' }), ['movement.moved', 'narration.fell']);
  assert.deepEqual([at(), hp()], ['room.ledge.title', 5]);
});

// Breaks: the loader admits a patrol leg over a climb face, so the leader walks it (twin of
// content_climb_test.exs).
test('the loader refuses a patrol route over a climb face', () => {
  const P = patrol.prefix;
  const r = patrol.load((c: any) => {
    c.manifest.requires.kernel_api.at_least = '1.45';
    c.rooms[`${P}:room/watch_post`].exits.west.climb = {
      item: patrol.ref(patrol.fresh, 'item', 'brass_key'),
      damage: 1,
      fell: 'watch.prompt',
    };
  });
  assert.deepEqual(r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path], [
    'OUTCOME_MISMATCH',
    `.cartridge.quests["${P}:quest/watch_rounds"].patrol.route[0]`,
  ]);
});
