// Built rooms S5 (mechanics.md Built rooms): a self-built room (craft_sampler's raise step, hs-12)
// razes as a commissioned one does. Its own file: craft.test.ts
// is at its size cap.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { pending } from '../src/mechanics/dialogue/shared.ts';
import { ctx } from './harness.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), 'loka-craft-raze-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/craft_sampler', file], {
    cwd: root,
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const loaded = loadCartridge(artifact, INSTALLED);
assert.ok(loaded.ok, JSON.stringify(loaded));
const content = loaded.cartridge as Cartridge;

const P = 'craft_sampler@0.0.1:';
const R = (kind: string, key: string) =>
  ({ cartridge_id: 'craft_sampler', cartridge_version: '0.0.1', kind, key }) as never;
let n = 0;
const ok = (w: World, payload: object) => {
  const i = ++n;
  const id = `eeeeeeee-5555-4444-8444-${String(i).padStart(12, '0')}`;
  const r = step(
    w,
    { id, world_context_id: w.context, payload: { actor_id: w.character, ...payload } } as never,
    i,
  );
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
};
const move = (w: World, ...dirs: string[]) =>
  dirs.reduce((x, direction) => ok(x, { type: 'move', direction }), w);
const done = (w: World, ...actions: string[]) =>
  actions.reduce((x, action) => ok(x, { type: 'perform', action }), w);
const chopped = (w: World) => move(done(move(w, 'west'), 'chop', 'chop'), 'east');
const carpentry = (w0: World) => {
  const w = ok(w0, { type: 'talk', target_id: w0.entityIds[`${P}npc/old_carver`] });
  const [continuation_id] = pending(w, w.character)!;
  return ok(w, { type: 'choose', choice_id: 'learn_carpentry', continuation_id });
};

// Breaks: the raze finder keyed on something only the build service writes (the carpenter's raze
// is injected: craft_sampler sells none).
test('the self-built hut razes like a commissioned one', () => {
  const c = structuredClone(content) as any;
  const plain = c.services[`${P}service/raise_hut_plain`];
  const benefit = { kind: 'raze', site: R('room', 'lane'), direction: 'north' };
  c.services[`${P}service/raze_hut`] = { ...plain, benefit };
  c.npcs[`${P}npc/carpenter`].services.push(R('service', 'raze_hut'));
  let w = ok(newWorld(c, ctx('6a1f3c2e-9b4d-4e7a-8c5f-2d0b1e3a4c6f'), [1, 2, 3, 4]), {
    type: 'choose_ancestry',
    ancestry: 'woodfolk',
  });
  w = ok(w, { type: 'take', item_id: w.entityIds[`${P}item/axe`] });
  w = move(done(chopped(done(carpentry(chopped(w)), 'saw')), 'saw'), 'east');
  w = done(w, 'raise_timbered_hut');
  const lane = w.state.containers[w.body];
  const [hut] = Object.keys(w.state.created ?? {});
  assert.ok(w.rooms[lane].exits.north);
  const provider_id = w.entityIds[`${P}npc/carpenter`];
  w = ok(w, {
    type: 'use_service',
    provider_id,
    service: R('service', 'raze_hut'),
    quoted_price: plain.price,
  });
  assert.deepEqual(Object.keys(w.state.built ?? {}), [hut]);
  assert.equal(w.rooms[lane].exits.north, undefined);
});
