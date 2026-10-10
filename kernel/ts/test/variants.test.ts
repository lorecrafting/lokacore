// Toolbox row W6 on the compiled variants sampler: entity text variants (status_active on the
// thing described, an hour window) and the npc_present leaf gating an opposed check on its NPC.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { gameView, INSTALLED, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import type { EntityId } from '../src/contracts.gen.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { key } from '../src/foundation/compose.ts';
import { encode } from '../src/foundation/canonical.ts';
import { detail, room } from '../play/text.ts';
import { resourceRef } from '../src/mechanics/resource.ts';
import { variants } from '../src/content/cartridge_variants.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-variants-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/variants_sampler', file], {
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
const C = 'variants_sampler@0.0.1';
const id = (w: World, kind: string, k: string) => w.entityIds[`${C}:${kind}/${k}`]!;
// The name and description the GameView shows for an entity in the player's room.
const shown = (w: World, kind: string, k: string) => {
  const e = gameView(w).entities.find((x) => x.id === id(w, kind, k));
  return e && [e.name, e.description];
};
let n = 0;
// A chain of bounded elapsed commands, each to the earliest pending job (status.test.ts wait).
function wait(w: World, seconds: number): World {
  const target = w.state.clock + seconds;
  while (w.state.clock < target) {
    n += 1;
    const until = Object.values(w.state.jobs ?? {})
      .filter((j) => j.status === 'pending')
      .reduce((t, j) => Math.min(t, j.due_time), target);
    const run_id = 'aaaaaaaa-0000-4000-8000-000000000016';
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
    w = r.world;
  }
  return w;
}
const shove = (w: World) => {
  n += 1;
  return step(
    w,
    {
      id: `dddddddd-6666-4666-8666-${String(n).padStart(12, '0')}` as never,
      world_context_id: w.context,
      payload: { actor_id: w.character, type: 'perform', action: 'shove' },
    } as never,
    n,
  ).decision;
};
const offered = (w: World) =>
  gameView(w).actions.find((a) => a.action_key === 'shove')?.available === true;
const fresh = () =>
  newWorld(content, '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]);

// Breaks: describe() not applied to an entity's name or description in the GameView, the
// described entity not passed as the target (status_active then never holds), status_active
// reading another holder or ignoring the status, or an item's variants not read.
test('Maud is bruised and the sword notched after the 07:00 raid; the guard sleeps before 06:00', () => {
  let w = fresh(); // 05:00
  assert.deepEqual(shown(w, 'npc', 'guard'), ['npc.guard.short_asleep', 'npc.guard.description']);
  assert.deepEqual(shown(w, 'npc', 'maud'), ['npc.maud.short', 'npc.maud.description']);
  assert.deepEqual(shown(w, 'item', 'sword'), ['item.sword.short', 'item.sword.description']);
  w = wait(w, 3600); // 06:00: awake
  assert.deepEqual(shown(w, 'npc', 'guard'), ['npc.guard.short', 'npc.guard.description']);
  w = wait(w, 7200); // 07:00 Maud walks into the raided yard, 08:00 back at the counter
  assert.deepEqual(shown(w, 'npc', 'maud'), ['npc.maud.short', 'npc.maud.description_bruised']);
  assert.match(room(content, w), /\nMaud, bruised, wipes the counter\.\n/);
  assert.equal(
    detail(content, w, id(w, 'npc', 'maud') as EntityId),
    'Maud, bruised, wipes the counter.\n',
  );
  assert.deepEqual(shown(w, 'item', 'sword'), [
    'item.sword.short_notched',
    'item.sword.description',
  ]);
});

// Breaks: npc_present ignoring the NPC's room (absent guard), its life (dead guard) or the actor's
// room, or the leaf reading the target detail instead of the named NPC.
test('the shove at the guard is offered only while the guard is in the taproom and alive', () => {
  let w = fresh(); // 05:00: the guard keeps the cellar door
  assert.equal(offered(w), true);
  assert.equal(shove(w).kind, 'accepted');
  w = wait(w, 7200); // 07:00: the guard sleeps in the bunkroom
  assert.equal(offered(w), false);
  assert.equal(shove(w).kind, 'rejected');
  w = wait(w, 3600); // 08:00: back at his post
  assert.equal(offered(w), true);
  const hp = key({
    kind: 'resource',
    resource: resourceRef(w, 'hp'),
    entity_id: id(w, 'npc', 'guard'),
  });
  const dead = {
    ...w,
    state: {
      ...w.state,
      resources: { ...w.state.resources, [hp]: { value: 0, at: w.state.clock } },
    },
  } as World;
  assert.equal(offered(dead), false);
  assert.equal(shove(dead).kind, 'rejected');
});

// Breaks: the loader's kernel_api floor misses a new variant list or leaf, or wrongly refuses an
// item's room_line_variants, which predate row W6 (ashmere_items declares one at 1.0).
test('row W6 fields and leaves need kernel_api 1.46; an item room-line variant does not', () => {
  const v = [{ when: { policy_version: 1, root: { op: 'target_present' } }, description: 't' }];
  const leaf = (op: object) => ({ policies: { p: { root: op } } });
  const rows: [object, boolean][] = [
    [{ npcs: { a: { short_variants: v } } }, true],
    [{ npcs: { a: { room_line_variants: v } } }, true],
    [{ npcs: { a: { description_variants: v } } }, true],
    [{ items: { a: { short_variants: v } } }, true],
    [{ items: { a: { description_variants: v } } }, true],
    [{ items: { a: { room_line_variants: v } } }, false],
    [leaf({ op: 'not', item: { op: 'status_active', subject: 'target', status: {} } }), true],
    [leaf({ op: 'npc_present', npc: {} }), true],
  ];
  for (const [part, refused] of rows) {
    const c = (api: string) => ({
      manifest: { requires: { kernel_api: { at_least: api } } },
      actions: {},
      policies: {},
      ...part,
    });
    assert.equal(variants(c('1.45')).length, refused ? 1 : 0, JSON.stringify(part));
    assert.deepEqual(variants(c('1.46')), []);
  }
});

// Breaks: the loader stops walking an NPC's or item's new variant lists, so a variant naming an
// undeclared status or text key loads and fails in play (twin of content_variants_test.exs).
test("the loader checks a new variant list's references and text keys", () => {
  const source = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  const maud = `${C}:npc/maud`;
  const sword = `${C}:item/sword`;
  const rows: [(c: any) => void, string, string][] = [
    [
      (c) => (c.npcs[maud].description_variants[0].when.root.status.key = 'ghost'),
      `.cartridge.npcs[${JSON.stringify(maud)}].description_variants[0].when.root.status`,
      `${C}:status/ghost`,
    ],
    [
      (c) => (c.items[sword].short_variants[0].description = 'item.sword.gone'),
      `.cartridge.items[${JSON.stringify(sword)}].short_variants[0].description`,
      'item.sword.gone',
    ],
  ];
  for (const [change, path, target] of rows) {
    const c = structuredClone(source);
    change(c);
    const canonical = encode(c);
    const sha256 = createHash('sha256').update(canonical).digest('hex');
    const r = loadCartridge(
      new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
      INSTALLED,
    );
    assert.deepEqual(r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path, r.diagnostic.data], [
      'UNRESOLVED_REFERENCE',
      path,
      { target },
    ]);
  }
});
