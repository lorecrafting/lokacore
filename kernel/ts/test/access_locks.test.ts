// Toolbox row G7 on the compiled access sampler: an exit's traverse, a room's enter and an item's
// get and put locks, granted by Ada's role pair fact; and the loader's floor and lock-root checks.
// Expected values are hand-counted.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, gameView, loadCartridge, newWorld, step } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { LIMITS, type DefinitionRef, type EntityId } from '../src/contracts.gen.ts';
import { decode, encode } from '../src/foundation/canonical.ts';
import { key } from '../src/foundation/compose.ts';
import { targetOf } from '../src/mechanics/fact.ts';
import { chainRefused } from '../src/mechanics/locks.ts';
import { pending, talking } from '../src/mechanics/dialogue/shared.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-access-locks-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/access_sampler', file], {
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
const S = 'access_sampler@0.0.1';
const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const ref = (kind: string, k: string) => ({
  cartridge_id: 'access_sampler',
  cartridge_version: '0.0.1',
  kind,
  key: k,
});
const id = (w: World, kind: string, k: string) => w.entityIds[`${S}:${kind}/${k}`] as EntityId;
const resident = source.items[`${S}:item/chest`].locks.get;
const fresh = () => newWorld(content, CONTEXT as never, [1, 2, 3, 4]);
let n = 0;
const run = (w: World, p: object) => {
  n += 1;
  const cid = `cccccccc-4444-4333-8444-${String(n).padStart(12, '0')}`;
  return step(
    w,
    { id: cid, world_context_id: w.context, payload: { actor_id: w.character, ...p } } as never,
    n,
  );
};
const code = (w: World, p: object) => {
  const d = run(w, p).decision;
  return d.kind === 'accepted' ? 'accepted' : d.kind === 'rejected' ? d.error.code : d;
};
const play = (w: World, ...ps: object[]) =>
  ps.reduce((x: World, p) => {
    const s = run(x, p);
    assert.equal(s.decision.kind, 'accepted', JSON.stringify([p, s.decision]));
    return s.world;
  }, w);
const go = (direction: string) => ({ type: 'move', direction });
const take = (w: World, k: string) => ({ type: 'take', item_id: id(w, 'item', k) });
const put = (w: World, into: string) => ({
  type: 'put',
  item_id: id(w, 'item', 'pebble'),
  container_id: id(w, 'item', into),
});
// Pick `choice` in Ada's conversation, talking first unless already in it.
const chat = (w: World, choice: string) => {
  const ada = id(w, 'npc', 'ada');
  const talked = talking(w, w.character, ada) ? w : play(w, { type: 'talk', target_id: ada });
  const [continuation_id] = pending(talked, talked.character)!;
  return play(talked, { type: 'choose', choice_id: choice, continuation_id });
};
const exits = (w: World) =>
  gameView(w).exits.map((e) => [e.direction, e.available, 'reason' in e && e.reason?.code]);
// The GameView's take on the ring in the chest: [available, reason code].
const ringTake = (w: World) => {
  const chest = gameView(w).entities.find((e) => e.id === id(w, 'item', 'chest'))!;
  const ring = chest.contents!.find((e) => e.id === id(w, 'item', 'ring'))!;
  const offer = ring.actions.find((a) => a.action_key === 'take')!;
  return [offer.available, 'reason' in offer && offer.reason?.code];
};
// The GameView's put pairs for the pebble (a refused pair is not offered).
const putPairs = (w: World) =>
  gameView(w)
    .inventory.find((i) => i.id === id(w, 'item', 'pebble'))!
    .actions.filter((a) => a.action_key === 'put')
    .map((a) => a.target_ids);

// Breaks: movementPlan reads no traverse or no enter lock (north or east accepted), the GameView's
// exits do not share it, or a lock answers before the exit lookup (west not not_found).
test('a stranger is refused north and east; a missing exit stays not_found', () => {
  const w = fresh();
  assert.equal(code(w, go('north')), 'permission_denied');
  assert.equal(code(w, go('east')), 'permission_denied');
  assert.equal(code(w, go('west')), 'not_found');
  assert.deepEqual(exits(w), [
    ['east', false, 'permission_denied'],
    ['north', false, 'permission_denied'],
  ]);
});

// Breaks: the get walk reads only the item's own lock (the chest's is skipped), the GameView's take
// admission skips the get walk, putRefused (rule or GameView pairs) reads no put lock or only the
// destination's own (the unlocked bag in the chest), or the enter lock ignores `any`.
test('a guest enters the hut but may not take from or put in the chest; revoked, north refuses', () => {
  let w = chat(fresh(), 'invite');
  w = play(w, take(w, 'pebble'), go('north'));
  assert.equal(code(w, take(w, 'ring')), 'permission_denied');
  assert.deepEqual(ringTake(w), [false, 'permission_denied']);
  assert.equal(code(w, put(w, 'chest')), 'permission_denied');
  assert.equal(code(w, put(w, 'bag')), 'permission_denied');
  assert.deepEqual(putPairs(w), []);
  w = play(w, go('south'));
  assert.equal(code(w, go('east')), 'permission_denied');
  w = chat(w, 'revoke');
  assert.equal(code(w, go('north')), 'permission_denied');
});

// Breaks: a lock that holds still refuses (a grant is not read at Ada).
test('a resident takes the ring, puts the pebble in the bag and walks east', () => {
  let w = chat(fresh(), 'settle');
  w = play(w, take(w, 'pebble'), go('north'));
  assert.deepEqual(ringTake(w), [true, false]);
  const pebble = id(w, 'item', 'pebble');
  assert.deepEqual(
    putPairs(w).sort(),
    [
      [pebble, id(w, 'item', 'bag')],
      [pebble, id(w, 'item', 'chest')],
    ].sort(),
  );
  w = play(w, take(w, 'ring'), put(w, 'bag'), go('south'), go('east'));
  assert.equal(w.state.containers[pebble], id(w, 'item', 'bag'));
});

// Breaks: the get walk skips the item's own lock and reads only its containers, or charges no
// query step before it reads a lock.
test('a lock on the ring itself refuses a guest; the walk charges the step budget', () => {
  let w = play(chat(fresh(), 'invite'), go('north'));
  const [ring, chest] = [id(w, 'item', 'ring'), id(w, 'item', 'chest')];
  const { locks: _, ...unlocked } = w.entities[chest] as { locks?: object };
  const locked = { ...w.entities[ring], locks: { get: resident } };
  w = { ...w, entities: { ...w.entities, [chest]: unlocked, [ring]: locked } as never };
  assert.equal(code(w, take(w, 'ring')), 'permission_denied');
  assert.equal(
    chainRefused(w, w.character, ring, 'get', { n: LIMITS.query_steps }),
    'budget_exceeded',
  );
});

// Breaks: a container's lock reads the taken item, not the container, as its `subject: "target"`.
test("the chest's lock reads the chest as its target", () => {
  let w = play(chat(fresh(), 'invite'), go('north'));
  const chest = id(w, 'item', 'chest');
  const role = ref('fact', 'role') as DefinitionRef;
  const root = { op: 'fact_compare', fact: role, subject: 'target', equals: 'resident' };
  const locks = { get: { policy_version: 1, root } };
  const facts = { ...w.state.facts, [key(targetOf(w, w.character, role, chest))]: 'resident' };
  w = {
    ...w,
    entities: { ...w.entities, [chest]: { ...w.entities[chest], locks } },
    state: { ...w.state, facts },
  } as World;
  assert.equal(code(w, take(w, 'ring')), 'accepted');
});

// Breaks: the traverse or enter lock is read before the exit's passage (permission_denied first).
test('a closed door before the hut answers exit_closed first', () => {
  const w = fresh();
  const lane = w.roomIds[`${S}:room/lane`];
  const room = w.rooms[lane];
  const door = ref('barrier', 'door');
  const north = { ...room.exits.north, barrier: door };
  const shut = {
    ...w,
    rooms: { ...w.rooms, [lane]: { ...room, exits: { ...room.exits, north } } },
    barrierInitial: { ...w.barrierInitial, [key(door)]: 'closed' },
  } as World;
  assert.equal(code(shut, go('north')), 'exit_closed');
});

// Breaks: the loader's 1.78 floor is missing or 1.77, a put lock on a non-container loads, a lock
// root is not walked for references, subject "target" loads in a room or exit lock (no target) or
// is refused in an item's lock (the item is its target).
test('the loader checks the floor, put on a container and every lock root', () => {
  const at = (kind: string, k: string) => `.cartridge.${kind}[${JSON.stringify(`${S}:${k}`)}]`;
  const hut = `${at('rooms', 'room/hut')}.locks.enter.root`;
  const east = `${at('rooms', 'room/lane')}.exits.east.locks.traverse.root`;
  const targeted = (r: any) => {
    delete r.npc;
    r.subject = 'target';
  };
  const rows: [(c: any) => void, string, string][] = [
    [
      (c) => (c.manifest.requires.kernel_api.at_least = '1.77'),
      'KERNEL_API_RANGE_INVALID',
      '.cartridge.manifest.requires.kernel_api.at_least',
    ],
    [
      (c) => (c.items[`${S}:item/ring`].locks = { put: resident }),
      'SCHEMA_VIOLATION',
      `${at('items', 'item/ring')}.locks.put`,
    ],
    [
      (c) => (c.rooms[`${S}:room/hut`].locks.enter.root.items[0].fact = ref('fact', 'nope')),
      'UNRESOLVED_REFERENCE',
      `${hut}.items[0].fact`,
    ],
    [
      (c) => (c.items[`${S}:item/chest`].locks.put.root.fact = ref('fact', 'nope')),
      'UNRESOLVED_REFERENCE',
      `${at('items', 'item/chest')}.locks.put.root.fact`,
    ],
    [
      (c) => targeted(c.rooms[`${S}:room/lane`].exits.east.locks.traverse.root),
      'FACT_SCOPE_UNSUPPORTED',
      `${east}.subject`,
    ],
    [
      (c) => targeted(c.rooms[`${S}:room/hut`].locks.enter.root.items[0]),
      'FACT_SCOPE_UNSUPPORTED',
      `${hut}.items[0].subject`,
    ],
  ];
  const load = (change: (c: any) => void) => {
    const c = structuredClone(source);
    change(c);
    const canonical = encode(c);
    const sha256 = createHash('sha256').update(canonical).digest('hex');
    const r = loadCartridge(
      new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
      INSTALLED,
    );
    return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path];
  };
  for (const [change, want, path] of rows) assert.deepEqual(load(change), [want, path]);
  assert.equal(
    load((c) => targeted(c.items[`${S}:item/chest`].locks.get.root)),
    'loaded',
  );
});
