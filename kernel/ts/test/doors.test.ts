// Toolbox row W26 on the compiled doors sampler (docs/system/mechanics.md, NPCs use doors). The
// literals: the calendar starts at 07:00 in the lane; the thief walks to the hut (north, behind
// hut_door, open, key hut_key lying in the lane) at 08:00 and jumps to the yard at 10:00; the
// guard holds gate_key and walks at 09:00 to the keep (lane east through the locked gate to the
// yard, then east). One wait call is one decision; its events are collected below.
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
import { barrierState } from '../src/mechanics/lookups.ts';
import { read } from './read.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-doors-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/doors_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const source = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
const C = 'doors_sampler@0.0.1';
const ref = (kind: string, key: string) => ({
  cartridge_id: 'doors_sampler',
  cartridge_version: '0.0.1',
  kind,
  key,
});
function load(change: (c: any) => void = () => {}, from: any = source) {
  const c = structuredClone(from);
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
let changes: [string, string, string][] = [];
const code = (w: World, p: object) => {
  n += 1;
  const r = step(
    w,
    {
      id: `eeeeeeee-2626-4026-8026-${String(n).padStart(12, '0')}` as never,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...p } as never,
    },
    n,
  );
  for (const e of r.decision.kind === 'accepted' ? r.decision.events : [])
    if (e.payload.type === 'barrier_changed')
      changes.push([e.payload.barrier.key, e.payload.from, e.payload.to]);
  return { r, code: r.decision.kind === 'accepted' ? 'accepted' : (r.decision as any).error?.code };
};
function play(w: World, p: object): World {
  const { r, code: c } = code(w, p);
  assert.equal(c, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
const at = (hour: number) => ({ type: 'wait', until: hour * 3600 });
const where = (w: World, npc: string) =>
  Object.entries(w.roomIds).find(
    ([, id]) => id === w.state.containers[w.entityIds[`${C}:npc/${npc}`]],
  )![0];
const room = (k: string) => `${C}:room/${k}`;
const key = (w: World, item: string) => w.entityIds[`${C}:item/${item}`];
// The player takes hut_key, closes and locks the hut door, at 07:00.
const lockHut = (w: World) =>
  [
    { type: 'take', item_id: key(w, 'hut_key') },
    { type: 'close', direction: 'north' },
    { type: 'lock', direction: 'north' },
  ].reduce(play, w);

// Breaks: walkPath refuses an open door (no path to the hut).
test('a. the door open, the thief walks into the hut at 08:00', () => {
  assert.equal(where(play(fresh(), at(8.5)), 'thief'), room('hut'));
});

// Breaks: npcPassage lets a walker through a locked barrier without its key, or the path search
// ignores barriers; the refused step makes a new job (10:00 then not run as written).
test('b. the hut locked, the thief stays in the lane at 08:00 and jumps to the yard at 10:00', () => {
  changes = [];
  let w = lockHut(fresh());
  assert.equal(barrierState(w, ref('barrier', 'hut_door') as never), 'locked');
  w = play(w, at(8.5));
  assert.equal(where(w, 'thief'), room('lane'));
  assert.equal(where(play(w, at(10.5)), 'thief'), room('yard'));
  assert.deepEqual(
    changes.filter(([b]) => b === 'hut_door'),
    [
      ['hut_door', 'open', 'closed'],
      ['hut_door', 'closed', 'locked'],
    ],
  ); // the player's two verbs; the thief's refusal emits none
});

// Breaks: the key passage does not re-lock (the gate reads open), emits the transitions in
// another order, or the NPC holding the key is not read (the guard stays).
test('c. the guard with gate_key walks to the keep at 09:00; the gate reads locked after', () => {
  changes = [];
  const w = play(fresh(), at(9.5));
  assert.equal(where(w, 'guard'), room('keep'));
  assert.equal(barrierState(w, ref('barrier', 'gate') as never), 'locked');
  assert.deepEqual(changes, [
    ['gate', 'locked', 'closed'],
    ['gate', 'closed', 'open'],
    ['gate', 'open', 'closed'],
    ['gate', 'closed', 'locked'],
  ]);
});

// Breaks: a key anywhere (here in the hut, not in the guard's body custody) opens the gate.
test('d. the guard without the key stays in the lane; the gate stays locked, no event', () => {
  changes = [];
  const w = play(
    fresh(
      (c) => (c.items[`${C}:item/gate_key`].location = { in: 'room', room: ref('room', 'hut') }),
    ),
    at(9.5),
  );
  assert.equal(where(w, 'guard'), room('lane'));
  assert.equal(barrierState(w, ref('barrier', 'gate') as never), 'locked');
  assert.deepEqual(changes, []);
});

// The hut's enter lock: the player holds hut_key, or the target (a walking NPC) is a resident.
const resident = (value: boolean) => (c: any) => {
  c.facts[`${C}:fact/resident`] = {
    key: 'resident',
    meaning: 'Whether the NPC lives in the hut.',
    per_subject: true,
    scopes: ['player'],
    value_type: { type: 'bool', default: value },
    version: 1,
  };
  c.rooms[room('hut')].locks = {
    enter: {
      policy_version: 1,
      root: {
        op: 'any',
        items: [
          { op: 'has_item', item: ref('item', 'hut_key') },
          { op: 'fact_compare', fact: ref('fact', 'resident'), subject: 'target', equals: true },
        ],
      },
    },
  };
};

// Breaks: the lock read with the NPC as actor (the player's hut_key admits nobody else, so the
// third case stays in the lane), or not read for a walker at all (the first enters).
test("e. the hut's enter lock reads the player as actor and the thief as target", () => {
  assert.equal(where(play(fresh(resident(false)), at(8.5)), 'thief'), room('lane'));
  assert.equal(where(play(fresh(resident(true)), at(8.5)), 'thief'), room('hut'));
  const w = fresh(resident(false));
  const taken = play(w, { type: 'take', item_id: key(w, 'hut_key') });
  assert.equal(where(play(taken, at(8.5)), 'thief'), room('hut'));
  assert.equal(code(w, { type: 'move', direction: 'north' }).code, 'permission_denied');
});

// Breaks: walks read on a step that does not declare it (the locked hut stops the thief).
test('f. without walks the thief jumps into the locked hut', () => {
  const w = play(
    lockHut(fresh((c) => delete c.npcs[`${C}:npc/thief`].schedule_cases['8'][0].walks)),
    at(8.5),
  );
  assert.equal(where(w, 'thief'), room('hut'));
});

// Breaks: the loader's 1.81 floor for walks is missing or 1.80 (twin of content_doors_test.exs):
// walks on a schedule case here, and on a population plan of the pinned Chapter 1 artifact (1.25).
test('g. walks on a case or a plan below kernel_api 1.81 does not load', () => {
  const chapter = read('protocol/fixtures/missing_child_v029_hash.json').value;
  const [plan] = Object.keys(chapter.populations);
  const walking = structuredClone(chapter);
  walking.populations[plan!].walks = true;
  for (const r of [
    load((c) => (c.manifest.requires.kernel_api.at_least = '1.80')),
    load(() => {}, walking),
  ])
    assert.deepEqual(r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path], [
      'KERNEL_API_RANGE_INVALID',
      '.cartridge.manifest.requires.kernel_api.at_least',
    ]);
  assert.ok(load(() => {}, chapter).ok);
});
