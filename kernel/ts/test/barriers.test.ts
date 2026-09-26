// Barriers (R5 S7; 21 §5 Barrier; 04 §5.3 Lifecycle transition, §7, §19): open, close, lock and
// unlock, moves through closed and locked exits, the GameView's exits, barrier_state, and the
// loader's barrier references. Worlds are the gate known answer
// (protocol/fixtures/cartridge_gate_hash.json: the gatehouse's north exit through the oak door,
// closed, to the courtyard, where the iron key lies; its east exit through the cell door, locked,
// key_item the iron key, to the cell), variants re-hashed with node:crypto over sorted-key
// JSON.stringify; expected codes and states are hand-derived from those files.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import type { Command } from '../src/contracts.gen.ts';
import { loadCartridge, type Cartridge, type World } from '../src/index.ts';
import { describe } from '../src/rules/description_variant.ts';
import { doors } from '../src/target.ts';
import { gameView, INSTALLED, newWorld, step } from '../src/world.ts';
import { read } from './read.ts';

const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const CMD = 'e5f6a7b8-c9d0-8e1f-8a2b-4c5d6e7f8a9b';
const G = 'ashmere_gate@0.0.1';
const OAK = {
  cartridge_id: 'ashmere_gate',
  cartridge_version: '0.0.1',
  kind: 'barrier',
  key: 'oak_door',
};

const sorted = (v: any): any =>
  Array.isArray(v)
    ? v.map(sorted)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, sorted(v[k])]),
        )
      : v;
const load = (f: (c: any) => void) => {
  const c = structuredClone(read('protocol/fixtures/cartridge_gate_hash.json').value);
  f(c);
  const text = JSON.stringify(sorted(c));
  const h = createHash('sha256').update(text).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${text},"content_hash":"${h}"}`),
    INSTALLED,
  );
};
const world = (f: (c: any) => void = () => {}): World => {
  const loaded = load(f);
  assert.ok(loaded.ok, JSON.stringify(loaded));
  return newWorld(loaded.cartridge as Cartridge, CONTEXT as World['context'], [1, 2, 3, 4]);
};
const cmd = (w: World, payload: object): Command =>
  ({
    id: CMD,
    world_context_id: CONTEXT,
    payload: { actor_id: w.character, ...payload },
  }) as Command;
const door = (type: string, direction: string) => ({ type, direction });
const move = (direction: string) => ({ type: 'move', direction });
const take = (w: World, key: string) => ({
  type: 'take',
  item_id: w.entityIds[`${G}:item/${key}`],
});
// Runs payloads in order, each accepted; returns the last world.
const run = (w: World, ...ps: object[]) =>
  ps.reduce((at: World, p) => {
    const s = step(at, cmd(at, p));
    assert.equal(
      s.decision.kind,
      'accepted',
      `${JSON.stringify(p)}: ${JSON.stringify(s.decision)}`,
    );
    return s.world;
  }, w);
// A rejection with `code` that leaves the world as it was (04 §5.0).
const refused = (w: World, p: object, code: string) => {
  const s = step(w, cmd(w, p));
  assert.deepEqual(s.decision, { kind: 'rejected', error: { code } }, JSON.stringify(p));
  assert.equal(s.world, w, JSON.stringify(p));
};
const exits = (w: World) => gameView(w).exits;
const KEY = (w: World) => take(w, 'iron_key');
const withKey = () =>
  run(world(), door('open', 'north'), move('north'), KEY(world()), move('south'));

// Breaks: a transition from the wrong state admitted (open while locked, close while closed,
// lock while open, unlock while closed), the wrong code, or a rejection that writes anything.
test('only legal transitions are admitted; an illegal one changes nothing', () => {
  const w = world();
  refused(w, door('close', 'north'), 'invalid_state'); // closed
  refused(w, door('unlock', 'north'), 'invalid_state'); // closed, not locked
  refused(w, door('open', 'east'), 'exit_locked');
  refused(w, door('close', 'east'), 'invalid_state'); // locked
  refused(w, door('lock', 'east'), 'invalid_state'); // already locked
  refused(w, door('open', 'west'), 'not_found');
  refused(w, door('open', 'sideways'), 'invalid_target');
  const doorless = world((c) => {
    delete c.rooms[`${G}:room/gatehouse`].exits.north.barrier;
    delete c.rooms[`${G}:room/courtyard`].exits.south.barrier;
  });
  refused(doorless, door('close', 'north'), 'invalid_target'); // an exit without a barrier
  const opened = run(w, door('open', 'north'));
  refused(opened, door('open', 'north'), 'invalid_state');
  refused(opened, door('lock', 'north'), 'invalid_state'); // open: close it first
  const inCourtyard = run(opened, move('north'));
  refused(inCourtyard, door('open', 'south'), 'invalid_state'); // the same door, open
  refused(run(inCourtyard, move('south')), door('lock', 'north'), 'invalid_state');
});

// Breaks: an accepted transition without its op, event or outcome, or one that reads a stale
// state.
test('open proposes one barrier.transition and barrier_changed', () => {
  const w = world();
  const d = step(w, cmd(w, door('open', 'north'))).decision;
  assert.equal(d.kind, 'accepted');
  if (d.kind !== 'accepted') return;
  assert.equal(d.outcome, 'opened');
  assert.deepEqual(JSON.parse(JSON.stringify(d.delta.ops)), [
    { op: 'barrier.transition', writer_group: 0, barrier: OAK, from: 'closed', to: 'open' },
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(d.events.map((e) => [e.position, e.payload]))), [
    [1, { type: 'barrier_changed', barrier: OAK, from: 'closed', to: 'open' }],
  ]);
});

// Breaks: lock or unlock without the key, the key not found inside a carried bag (has_item is
// transitive), or found while it lies in the room.
test('lock and unlock need the key, held directly or in a carried bag', () => {
  const w = world();
  refused(w, door('unlock', 'east'), 'not_owned');
  const holding = withKey();
  const through = run(holding, door('unlock', 'east'), door('open', 'east'), move('east'));
  assert.equal(through.state.containers[through.body], through.roomIds[`${G}:room/cell`]);
  const relocked = run(through, move('west'), door('close', 'east'), door('lock', 'east'));
  refused(relocked, door('open', 'east'), 'exit_locked');
  refused(
    run(relocked, { type: 'drop', item_id: relocked.entityIds[`${G}:item/iron_key`] }),
    door('unlock', 'east'),
    'not_owned',
  );
  refused(world(), door('lock', 'north'), 'not_owned'); // closed, but no key
  // A satchel in the courtyard holding the key: carrying the satchel carries the key.
  const bag = world((c) => {
    c.items[`${G}:item/satchel`] = {
      key: 'satchel',
      keywords: ['satchel'],
      short: 'item.iron_key.short',
      room_line: 'item.iron_key.room',
      description: 'item.iron_key.description',
      location: { in: 'room', room: { ...OAK, kind: 'room', key: 'courtyard' } },
    };
    c.items[`${G}:item/iron_key`].location = {
      in: 'item',
      item: { ...OAK, kind: 'item', key: 'satchel' },
    };
  });
  const carrying = run(
    bag,
    door('open', 'north'),
    move('north'),
    take(bag, 'satchel'),
    move('south'),
  );
  run(carrying, door('unlock', 'east'));
  const left = run(bag, door('open', 'north'), move('north'), take(bag, 'satchel'));
  const inRoom = run(
    left,
    { type: 'drop', item_id: bag.entityIds[`${G}:item/satchel`] },
    move('south'),
  );
  refused(inRoom, door('unlock', 'east'), 'not_owned');
});

// Breaks: each face with its own state, so a door opened from one side stays closed from the
// other, or closing it from the far side leaves the near side open.
test('both faces of a door are one barrier', () => {
  const inCourtyard = run(world(), door('open', 'north'), move('north'));
  assert.deepEqual(exits(inCourtyard), [{ available: true, direction: 'south' }]);
  const closed = run(inCourtyard, door('close', 'south'));
  refused(closed, move('south'), 'exit_closed');
  const back = run(closed, door('open', 'south'), move('south'), door('close', 'north'));
  assert.deepEqual(exits(back)[1], {
    available: false,
    direction: 'north',
    reason: { code: 'exit_closed' },
  });
});

// Breaks: a move through a closed or locked exit admitted, the GameView advertising it as
// available, or the two disagreeing (the S6b lesson: one eligibility function).
test('moves through closed and locked exits are refused, and the GameView says why', () => {
  const w = world();
  refused(w, move('north'), 'exit_closed');
  refused(w, move('east'), 'exit_locked');
  // Exits list in the RoomDefinition exits order (view.ts): east before north.
  assert.deepEqual(exits(w), [
    { available: false, direction: 'east', reason: { code: 'exit_locked' } },
    { available: false, direction: 'north', reason: { code: 'exit_closed' } },
  ]);
  const opened = run(w, door('open', 'north'));
  assert.deepEqual(exits(opened)[1], { available: true, direction: 'north' });
  run(opened, move('north'));
  const verbs = gameView(w).actions.map((a) => [a.action_key, a.input]);
  for (const v of ['open', 'close', 'lock', 'unlock'])
    assert.deepEqual(
      verbs.find(([k]) => k === v),
      [v, ['direction']],
    );
});

// Breaks: barrier_state reading the initial state after a change, or the wrong barrier.
test("barrier_state reads the door's current state", () => {
  const w = world();
  const detail = Object.values(w.details).find((d) => d.key === 'oak_door')!;
  assert.equal(describe(w, w.character, detail), 'detail.oak_door');
  const opened = run(w, door('open', 'north'));
  assert.equal(describe(opened, opened.character, detail), 'detail.oak_door.open');
  const shut = run(opened, door('close', 'north'));
  assert.equal(describe(shut, shut.character, detail), 'detail.oak_door');
});

// Breaks: a door's keywords not naming it, a door in another room named, or an ambiguous name
// resolved to one.
test("a door's keywords name the exits it is on", () => {
  const w = world();
  assert.deepEqual(doors(w, w.character, 'the door'), ['east', 'north']);
  assert.deepEqual(doors(w, w.character, 'oak door'), ['north']);
  assert.deepEqual(doors(w, w.character, 'cell door'), ['east']);
  assert.deepEqual(doors(w, w.character, 'gate'), []);
  const yard = run(w, door('open', 'north'), move('north'));
  assert.deepEqual(doors(yard, yard.character, 'cell door'), []);
});

const fails = (
  f: (c: any) => void,
  code: string,
  path: string,
  data = {},
  suggested: string[] = [],
) =>
  assert.deepEqual(load(f), {
    ok: false,
    diagnostic: {
      severity: 'error',
      code,
      path,
      message_key: `diagnostics.${code.toLowerCase()}`,
      data,
      suggested_capabilities: suggested,
    },
  });
const ROOM = (k: string) => `.cartridge.rooms["${G}:room/${k}"]`;
const room = (c: any, k: string) => c.rooms[`${G}:room/${k}`];
const trapdoor = { ...OAK, key: 'trapdoor' };

// Breaks: the loader admitting what the compiler rejects (test/loka/content_gate_test.exs):
// the kernel would read a barrier or key that does not exist, or two faces with two states.
test('the loader checks barrier references, texts, faces and the lock', () => {
  const target = { target: `${G}:barrier/trapdoor` };
  fails(
    (c) =>
      (room(c, 'courtyard').exits.south.barrier = room(c, 'gatehouse').exits.north.barrier =
        trapdoor),
    'UNRESOLVED_REFERENCE',
    `${ROOM('courtyard')}.exits.south.barrier`,
    target,
  );
  fails(
    (c) => (c.barriers[`${G}:barrier/cell_door`].key_item = { ...OAK, kind: 'room', key: 'cell' }),
    'UNRESOLVED_REFERENCE',
    `.cartridge.barriers["${G}:barrier/cell_door"].key_item`,
    { target: `${G}:room/cell` },
  );
  fails(
    (c) => (room(c, 'gatehouse').details.oak_door.variants[0].when.root.barrier = trapdoor),
    'UNRESOLVED_REFERENCE',
    `${ROOM('gatehouse')}.details.oak_door.variants[0].when.root.barrier`,
    target,
  );
  fails(
    (c) => delete c.text['barrier.oak_door.short'],
    'UNRESOLVED_REFERENCE',
    `.cartridge.barriers["${G}:barrier/oak_door"].short`,
    { target: 'barrier.oak_door.short' },
  );
  fails(
    (c) => (room(c, 'cell').exits.west.barrier = OAK),
    'BARRIER_MISMATCH',
    `${ROOM('cell')}.exits.west`,
  );
  fails(
    (c) => delete room(c, 'gatehouse').exits.north.barrier,
    'BARRIER_MISMATCH',
    `${ROOM('courtyard')}.exits.south`,
  );
  fails(
    (c) => {
      delete c.manifest.requires.capabilities.barrier;
      delete c.lock.capabilities.barrier;
    },
    'UNDECLARED_CAPABILITY',
    `.cartridge.barriers["${G}:barrier/cell_door"]`,
    { capability: 'barrier' },
    ['barrier@1'],
  );
  fails(
    (c) => (c.barriers[`${G}:barrier/oak_door`].key = 'gate'),
    'ARTIFACT_DEFINITION_KEY_MISMATCH',
    `.cartridge.barriers["${G}:barrier/oak_door"]`,
    { field: 'key', declared: 'oak_door', expected: 'gate' },
  );
});

// Review #50 A2/N2. Breaks: faces paired by destination room rather than by connection, so two
// passages between the same rooms cannot carry two doors (twin: test/loka/content_gate_test.exs).
test('two passages between the same rooms may carry different barriers', () => {
  const blue = { ...OAK, key: 'blue' };
  const passages = (c: any, back: object) => {
    c.barriers[`${G}:barrier/blue`] = {
      key: 'blue',
      keywords: ['hatch'],
      short: 'barrier.oak_door.short',
      initial: 'open',
    };
    room(c, 'gatehouse').exits.west = {
      to: { ...OAK, kind: 'room', key: 'courtyard' },
      barrier: blue,
    };
    room(c, 'courtyard').exits.east = {
      to: { ...OAK, kind: 'room', key: 'gatehouse' },
      barrier: back,
    };
    room(c, 'courtyard').exits.down = { to: { ...OAK, kind: 'room', key: 'gatehouse' } }; // a chute: no face
  };
  assert.ok(load((c) => passages(c, blue)).ok);
  fails((c) => passages(c, OAK), 'BARRIER_MISMATCH', `${ROOM('courtyard')}.exits.east`);
});

// Review #50 A1. Breaks: a locked door whose key lies only behind it (or that has no key) loading
// into a cartridge no one can finish. The gate known answer itself is the passing case (the key
// lies past the oak door, closed, not locked); the carried-bag test above passes a key in a bag.
test('a locked barrier whose key is out of reach is BARRIER_UNREACHABLE_KEY', () => {
  const CELL = `.cartridge.barriers["${G}:barrier/cell_door"]`;
  const key = (c: any) => c.items[`${G}:item/iron_key`];
  fails((c) => (key(c).location.room.key = 'cell'), 'BARRIER_UNREACHABLE_KEY', CELL);
  fails(
    (c) => delete c.barriers[`${G}:barrier/cell_door`].key_item,
    'BARRIER_UNREACHABLE_KEY',
    CELL,
  );
  fails(
    (c) => (c.barriers[`${G}:barrier/oak_door`].initial = 'locked'),
    'BARRIER_UNREACHABLE_KEY',
    CELL,
  );
});

// Review #50 re-review S2 (twin: test/loka/content_gate_test.exs). Breaks: a face paired without
// the "leads back" condition, so a door on A.north to B and B.south to C is taken for one door.
test('a door on a bent passage is BARRIER_MISMATCH', () => {
  const bent = (c: any) =>
    (room(c, 'courtyard').exits.south = {
      to: { ...OAK, kind: 'room', key: 'cell' },
      barrier: OAK,
    });
  fails(bent, 'BARRIER_MISMATCH', `${ROOM('courtyard')}.exits.south`);
  // With cell.north back to the courtyard, only the gatehouse's face is bent.
  fails(
    (c) => {
      bent(c);
      room(c, 'cell').exits.north = {
        to: { ...OAK, kind: 'room', key: 'courtyard' },
        barrier: OAK,
      };
    },
    'BARRIER_MISMATCH',
    `${ROOM('gatehouse')}.exits.north`,
  );
});
