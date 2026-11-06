// The escort, patrol and water samplers (loka-vduxr.60), compiled as a builder compiles them
// (placeholder text), each driven until its mechanic fires. Expected states come from
// docs/system/mechanics.md (escort@1, S3 patrol, D6 water), not from the implementation.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import { gameView, INSTALLED, loadCartridge, newWorld, type World } from '../src/index.ts';
import type { Cartridge } from '../src/runtime/decision.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { commands, ctx } from './harness.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-samplers-'));
function sampler(name: string): { w: World; ref: (kind: string, key: string) => object } {
  const file = join(scratch, `${name}.json`);
  execFileSync('mix', ['loka.compile', `cartridges/${name}`, file, '--allow-placeholders'], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  const loaded = loadCartridge(readFileSync(file), INSTALLED);
  assert.ok(loaded.ok, JSON.stringify(loaded));
  const w = newWorld(
    loaded.cartridge as Cartridge,
    ctx('7e1f0c2a-5d3b-4c8e-9a6f-000000000060'),
    [1, 2, 3, 4],
  );
  const ref = (kind: string, key: string) => ({
    cartridge_id: name,
    cartridge_version: '0.0.1',
    kind,
    key,
  });
  return { w, ref };
}
after(() => rmSync(scratch, { recursive: true }));
const { play, send } = commands('dddddddd-6060-4333-8444');
const id = (w: World, kind: string, key: string) =>
  w.entityIds[Object.keys(w.entityIds).find((k) => k.endsWith(`:${kind}/${key}`))!]!;
const room = (w: World, key: string) =>
  w.roomIds[Object.keys(w.roomIds).find((k) => k.endsWith(`:room/${key}`))!]!;
const where = (w: World, e: string) => w.state.containers[e];
const choose = (w: World, choice_id: string, extra: object = {}) =>
  play(w, {
    type: 'choose',
    choice_id,
    continuation_id: gameView(w).choice!.continuation_id,
    ...extra,
  });
const talk = (w: World, npc: string) => play(w, { type: 'talk', target_id: id(w, 'npc', npc) });

// Breaks: the escort start, the follow on Move or the complete choice stops working in a
// cartridge a builder copies (the child stays behind, or the quest never resolves).
test('escort_sampler: the child follows a Move and Complete hands it over', () => {
  const { w: fresh, ref } = sampler('escort_sampler');
  let w = play(fresh, { type: 'accept_quest', quest: ref('quest', 'homeward') });
  w = choose(talk(w, 'child'), 'rescue');
  const child = id(w, 'npc', 'child');
  assert.equal(w.state.escorts![w.character]!.status, 'following');
  assert.equal(where(w, child), room(w, 'green'));
  w = play(w, { type: 'move', direction: 'south' });
  assert.deepEqual([where(w, w.body), where(w, child)], [room(w, 'quay'), room(w, 'quay')]);
  w = choose(talk(w, 'keeper'), 'home');
  assert.equal(w.state.escorts![w.character]!.status, 'completed');
});

// Breaks: Tobin does not walk on Continue, or the player's arrival at the checkpoint earns no
// credit, so the one-checkpoint round never completes and never writes the trust fact.
test('patrol_sampler: Tobin walks to the gate, the player joins him and the round completes', () => {
  const { w: fresh } = sampler('patrol_sampler');
  const tobin = id(fresh, 'npc', 'tobin');
  const patrol = (w: World) => Object.values(w.state.patrols ?? {})[0];
  const pick = (w: World, choice_id: string) => {
    const talked = talk(w, 'tobin');
    const p = patrol(talked);
    return choose(talked, choice_id, {
      ...(p && {
        patrol: {
          quest_instance_id: p.quest_instance_id,
          attempt_id: p.attempt_id,
          cursor: p.cursor,
          status: p.status,
        },
      }),
    });
  };
  let w = pick(fresh, 'start');
  assert.equal(patrol(w)!.status, 'together');
  w = pick(w, 'continue');
  assert.deepEqual([patrol(w)!.status, where(w, tobin)], ['awaiting', room(w, 'gate')]);
  w = play(w, { type: 'move', direction: 'east' });
  assert.equal(patrol(w)!.status, 'completed');
});

// Breaks: the water route is not a working descent: the skill gate or entry cost is dropped, or
// the sampler's route no longer reaches its bottom room.
test('water_sampler: down is refused until Sedge teaches swim, then costs the entry fare', () => {
  const { w: fresh } = sampler('water_sampler');
  const mv = (w: World) => level(w, w.body, resourceRef(w, 'mv'));
  const refused = send(fresh, { type: 'move', direction: 'down' });
  assert.equal(refused.decision.kind, 'rejected');
  let w = choose(talk(fresh, 'sedge'), 'learn');
  w = play(w, { type: 'move', direction: 'down' });
  assert.deepEqual([where(w, w.body), mv(w)], [room(w, 'pool_bottom'), 40]);
});
