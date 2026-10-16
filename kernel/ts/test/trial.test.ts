// Toolbox row 35 (the arrest engine) on the compiled trial sampler: a guard hostile to a wanted
// character arrests a walk-in to the cell, saying its line, instead of opening an encounter. The
// crier sets `wanted` by dialogue; Ada, a group member, stays where the move took her. Expected
// values are hand-counted.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, gameView, loadCartridge, newWorld, step } from '../src/index.ts';
import { bodyOf, type Cartridge, type World } from '../src/runtime/decision.ts';
import type { EntityId } from '../src/contracts.gen.ts';
import { decode, encode } from '../src/foundation/canonical.ts';
import { validate } from '../src/foundation/validate.ts';
import { pending, talking } from '../src/mechanics/dialogue/shared.ts';
import { engaged } from '../src/mechanics/combat/shared.ts';
import { visits } from '../src/mechanics/knowledge/shared.ts';
import { positionOf } from '../src/mechanics/position/shared.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-trial-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/trial_sampler', file], {
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
const source = (decode(new TextDecoder().decode(artifact)) as { cartridge: any }).cartridge;
const S = 'trial_sampler@0.0.1:';
const ref = (kind: string, key: string) => ({
  cartridge_id: 'trial_sampler',
  cartridge_version: '0.0.1',
  kind,
  key,
});
// The sampler loaded with a test-local change to its compiled cartridge.
const reload = (change: (c: any) => void) => {
  const c = structuredClone(source);
  change(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
};
const guardOf = (c: any) => c.npcs[`${S}npc/guard`];

let n = 0;
const play = (w: World, p: object) =>
  step(
    w,
    {
      id: `cccccccc-4444-4333-8444-${String(++n).padStart(12, '0')}`,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...p },
    } as never,
    n,
  );
const ok = (r: ReturnType<typeof step>) => {
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r;
};
const act = (w: World, p: object) => ok(play(w, p)).world;
const npc = (w: World, k: string) => w.entityIds[`${S}npc/${k}`] as EntityId;
const room = (w: World, k: string) => w.roomIds[`${S}room/${k}`]!;
const chat = (w: World, who: string, choice: string) => {
  const open = talking(w, w.character, npc(w, who));
  const talked = open ? w : act(w, { type: 'talk', target_id: npc(w, who) });
  const [continuation_id] = pending(talked, talked.character)!;
  const chosen = act(talked, { type: 'choose', choice_id: choice, continuation_id });
  const left = pending(chosen, chosen.character);
  return left ? act(chosen, { type: 'close_choice', continuation_id: left[0] }) : chosen;
};
const fresh = (c = content) => {
  n = 0;
  return newWorld(c, '5d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]);
};
const north = (w: World) => {
  const r = ok(play(w, { type: 'move', direction: 'north' }));
  if (r.decision.kind !== 'accepted') throw new Error('unreachable');
  return { w: r.world, d: r.decision };
};
const entered = (d: { events: readonly { payload: object; position: number }[] }) =>
  d.events.map((e) => [e.payload, e.position]);
const body = (w: World) => bodyOf(w, w.character)!;
const at = (w: World) => w.state.containers[body(w)];

// Break: hostileAt drops the arrest candidate (or keeps its no-combat bar), so nobody is arrested.
test('a wanted walk-in is arrested to the cell', () => {
  const { w, d } = north(chat(fresh(), 'crier', 'confess'));
  assert.equal(at(w), room(w, 'cell'));
  assert.equal(w.state.containers[npc(w, 'guard')], room(w, 'market'));
  assert.equal(engaged(w, body(w)), undefined);
  assert.deepEqual(d.narration, [{ key: 'npc.guard.arrest' }]);
  assert.deepEqual(entered(d), [
    [{ type: 'entity_entered_room', entity_id: body(w), room_id: room(w, 'market') }, 1],
    [{ type: 'entity_entered_room', entity_id: body(w), room_id: room(w, 'cell') }, 2],
  ]);
  assert.equal(positionOf(w, w.character) ?? 'standing', 'standing');
  assert.equal(gameView(w).place.id, room(w, 'cell'));
  assert.deepEqual(validate('GameView', gameView(w)), []);
  assert.equal(visits(w, w.character, room(w, 'cell')), 1);
  // Observed: knowledge records the body's room once, after the arrest; the market is not visited.
  assert.equal(visits(w, w.character, room(w, 'market')), 0);
});

// Break: the guard arrests a character who is not wanted.
test('an innocent walk-in is not arrested', () => {
  const { w, d } = north(fresh());
  assert.equal(at(w), room(w, 'market'));
  assert.equal(d.narration, undefined);
  assert.deepEqual(entered(d), [
    [{ type: 'entity_entered_room', entity_id: body(w), room_id: room(w, 'market') }, 1],
  ]);
});

// Break: the arrest also carries group members (or an escort) to the cell.
test('a group member stays where the move took her', () => {
  const { w } = north(chat(chat(fresh(), 'ada', 'join'), 'crier', 'confess'));
  assert.equal(at(w), room(w, 'cell'));
  assert.equal(w.state.containers[npc(w, 'ada')], room(w, 'market'));
});

// Break: an arrest to the room the move entered transfers the body onto itself (a fault) or
// says the line anyway.
test('an arrest to the room just entered is an ordinary move', () => {
  const r = reload((c) => (guardOf(c).disposition.arrest.to = ref('room', 'market')));
  assert.ok(r.ok, JSON.stringify(r));
  const { w, d } = north(chat(fresh(r.cartridge as Cartridge), 'crier', 'confess'));
  assert.equal(at(w), room(w, 'market'));
  assert.equal(d.narration, undefined);
  assert.equal(d.events.length, 1);
});

// Break: Sleep in the guard's room reads no arrest (position/rule.ts drops engage's events).
test('a wanted sleeper is arrested where it sleeps', () => {
  const w0 = chat(fresh(), 'crier', 'confess');
  const w1 = {
    ...w0,
    state: { ...w0.state, containers: { ...w0.state.containers, [body(w0)]: room(w0, 'market') } },
  };
  const r = ok(play(w1, { type: 'sleep' }));
  if (r.decision.kind !== 'accepted') throw new Error('unreachable');
  assert.equal(at(r.world), room(w0, 'cell'));
  assert.deepEqual(r.decision.narration?.at(-1), { key: 'npc.guard.arrest' });
  assert.deepEqual(r.decision.events.at(-1)?.payload, {
    type: 'entity_entered_room',
    entity_id: body(w0),
    room_id: room(w0, 'cell'),
  });
});

// Break: the loader admits an arrest without hostile or beside engage, a dangling destination or
// line, or an arrest under a floor below 1.105.
test('the loader refuses a malformed arrest', () => {
  const npcAt = `.cartridge.npcs[${JSON.stringify(`${S}npc/guard`)}].disposition`;
  const rows: [(c: any) => void, string | string[]][] = [
    [() => {}, 'loaded'],
    [(c) => delete guardOf(c).disposition.hostile, ['SCHEMA_VIOLATION', npcAt]],
    [(c) => (guardOf(c).disposition.engage = 'npc.guard.arrest'), ['SCHEMA_VIOLATION', npcAt]],
    [
      (c) => (guardOf(c).disposition.arrest.to = ref('npc', 'crier')),
      ['UNRESOLVED_REFERENCE', `${npcAt}.arrest.to`],
    ],
    [
      (c) => (guardOf(c).disposition.arrest.narration = 'nope'),
      ['UNRESOLVED_REFERENCE', `${npcAt}.arrest.narration`],
    ],
    [
      (c) => (c.manifest.requires.kernel_api.at_least = '1.104'),
      ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'],
    ],
  ];
  for (const [change, want] of rows) {
    const r = reload(change);
    assert.deepEqual(r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path], want);
  }
});
