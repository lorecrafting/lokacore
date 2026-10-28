// Mounts (toolbox row 43b; docs/system/mechanics.md, Mounts) on mount_sampler's pinned artifact:
// yard [road] north to road [road], east to fen [marsh]; yard south to ford [road, marsh]. A move
// costs 2 mv, road 50%, marsh 300%; mv starts at 10. The horse (yard) rides road at 0%.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { gameView, newWorld, step } from '../src/index.ts';
import { type Cartridge, type World } from '../src/runtime/decision.ts';
import { validate } from '../src/foundation/validate.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { pending } from '../src/mechanics/dialogue/shared.ts';
import { commands, reload } from './harness.ts';

const kat = JSON.parse(
  readFileSync(
    new URL('../../../protocol/fixtures/mount_sampler_hash.json', import.meta.url),
    'utf8',
  ),
);
const P = 'mount_sampler@0.0.1';
const HORSE = `${P}:npc/horse`;

const refused = (edit: (c: any) => void) => {
  const r = reload(kat.value, edit);
  return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path];
};

const stream = commands('eeeeeeee-4343-4b4b-8b4b');
const { send, play } = stream;
/** A new game in the yard on the artifact edited by `edit`. */
function yard(edit?: (c: any) => void) {
  const r = reload(kat.value, edit);
  assert.ok(r.ok, JSON.stringify(r));
  stream.n = 0;
  return newWorld(
    r.cartridge as Cartridge,
    '4b3a2c1d-5e6f-4a1b-8c2d-3e4f5a6b7c43' as never,
    [1, 2, 3, 4],
  );
}
const code = (r: ReturnType<typeof step>) =>
  r.decision.kind === 'rejected' ? r.decision.error.code : r.decision.kind;
const act = (w: World, p: object) => {
  const r = send(w, p);
  assert.equal(code(r), 'accepted', JSON.stringify(r.decision));
  return r;
};
const mv = (w: World) => level(w, w.body, resourceRef(w, 'mv'))!;
const horse = (w: World) => w.entityIds[HORSE]!;
/** Where the body and the horse stand, by room key, and the mv left. */
const where = (w: World) => [
  w.rooms[w.state.containers[w.body]!]!.key,
  w.rooms[w.state.containers[horse(w)]!]!.key,
  mv(w),
];
const go = (w: World, ...dirs: string[]) =>
  dirs.reduce((x, direction) => act(x, { type: 'move', direction }).world, w);
/** Talk to the horse and pick mount or dismount, then leave the conversation. */
function ride(w: World, choice: 'mount' | 'dismount') {
  const talked = act(w, { type: 'talk', target_id: horse(w) }).world;
  const [continuation_id] = pending(talked, talked.character)!;
  const chosen = act(talked, { type: 'choose', choice_id: choice, continuation_id }).world;
  const left = pending(chosen, chosen.character);
  return left ? act(chosen, { type: 'close_choice', continuation_id: left[0] }).world : chosen;
}

// Breaks: an unridden mount moves with the body, or riding is read without the fact.
test('case 1: on foot the horse stays and the road costs 1', () => {
  assert.deepEqual(where(go(yard(), 'north')), ['road', 'yard', 9]);
});

// Breaks: the ridden horse is left behind, moved twice, or the percent is not applied.
test('case 2: mounted, the horse comes along and the road costs nothing', () => {
  const r = act(ride(yard(), 'mount'), { type: 'move', direction: 'north' });
  assert.deepEqual(where(r.world), ['road', 'road', 10]);
  const ops = (r.decision as any).delta.ops;
  assert.equal(ops.filter((o: any) => o.op === 'resource.adjust').length, 0);
  const moved = (id: string) =>
    ops.filter((o: any) => o.op === 'entity.transfer' && o.entity_id === id).length;
  assert.deepEqual([moved(r.world.body), moved(horse(r.world))], [1, 1]);
});

// Breaks: a horse that is also a group member (G8) moves twice, or the mover order (escort, horse,
// members; mechanics.md Group primitive, Co-move) changes.
test('case 2b: a ridden horse in the group moves once, before the other members', () => {
  const w = yard((c) => {
    c.world.group = { member: c.world.mount.riding };
    c.facts[`${P}:fact/riding`].value_type.default = true;
    // An unsaddled member whose EntityId sorts before the horse's, so EntityId order alone fails.
    const { mount: _, ...cob } = c.npcs[HORSE];
    c.npcs[`${P}:npc/cob`] = { ...cob, key: 'cob' };
  });
  const ops = (send(w, { type: 'move', direction: 'north' }).decision as any).delta.ops;
  const moved = ops.filter((o: any) => o.op === 'entity.transfer').map((o: any) => o.entity_id);
  assert.deepEqual(moved, [w.body, horse(w), w.entityIds[`${P}:npc/cob`]]);
});

// Breaks: the mount's terrain is not checked, or the exits list disagrees with the move.
test('case 3: mounted, the fen is refused and shown unavailable', () => {
  const w = go(ride(yard(), 'mount'), 'north');
  const view = gameView(w);
  assert.deepEqual(validate('GameView', view), []);
  const east = view.exits.find((e) => e.direction === 'east')!;
  assert.deepEqual(
    [east.available, 'reason' in east && east.reason?.code],
    [false, 'invalid_state'],
  );
  const r = send(w, { type: 'move', direction: 'east' });
  assert.equal(code(r), 'invalid_state');
  assert.deepEqual(where(r.world), ['road', 'road', 10]);
});

// Breaks: dismounting leaves the horse following, or remounting elsewhere fails.
test('case 4: dismount, walk the fen and back, remount and ride home', () => {
  let w = go(ride(go(ride(yard(), 'mount'), 'north'), 'dismount'), 'east');
  assert.deepEqual(where(w), ['fen', 'road', 4]);
  w = go(w, 'west');
  assert.deepEqual(where(w), ['road', 'road', 3]);
  assert.deepEqual(where(go(ride(w, 'mount'), 'south')), ['yard', 'yard', 3]);
});

// Breaks: admission needs every destination tag on the list, not one.
test('case 5: mounted, the ford (road and marsh) is admitted', () => {
  assert.deepEqual(where(go(ride(yard(), 'mount'), 'south')), ['ford', 'ford', 10]);
});

// Breaks: mounted() reads the fact without checking the horse shares the body's room or has a mount.
test('case 6: riding true but the horse elsewhere or unsaddled: on foot', () => {
  const w = yard((c) => {
    c.npcs[HORSE].room.key = 'fen';
    c.facts[`${P}:fact/riding`].value_type.default = true;
  });
  assert.deepEqual(where(go(w, 'north')), ['road', 'fen', 9]);
  const unsaddled = yard((c) => {
    delete c.npcs[HORSE].mount;
    c.facts[`${P}:fact/riding`].value_type.default = true;
  });
  assert.deepEqual(where(go(unsaddled, 'north')), ['road', 'yard', 9]);
});

// Breaks: cost_percent ignored, or a mount without it not charged the full fare (default 100).
test('case 7: cost_percent 50 applies last and floors', () => {
  const half = (c: any) => (c.npcs[HORSE].mount.cost_percent = 50);
  assert.equal(mv(go(ride(yard(half), 'mount'), 'north')), 10);
  const plain = (c: any) => {
    half(c);
    delete c.world.movement.terrain;
  };
  assert.equal(mv(go(ride(yard(plain), 'mount'), 'north')), 9);
  const unset = (c: any) => delete c.npcs[HORSE].mount.cost_percent;
  assert.equal(mv(go(ride(yard(unset), 'mount'), 'north')), 9);
});

// Breaks: a loader check is missing, misplaced, or refuses the boundary values.
test('case 8: loader refusals and the accepted edges', () => {
  const npc = (f: (m: any) => void) => (c: any) => f(c.npcs[HORSE].mount);
  const riding = `${P}:fact/riding`;
  const cases: [(c: any) => void, unknown][] = [
    [(c) => delete c.world.mount, ['SCHEMA_VIOLATION', `.cartridge.npcs["${HORSE}"].mount`]],
    [
      (c) => delete c.facts[riding].per_subject,
      ['SCHEMA_VIOLATION', '.cartridge.world.mount.riding'],
    ],
    [
      (c) => (c.world.mount.riding.key = 'nope'),
      ['UNRESOLVED_REFERENCE', '.cartridge.world.mount.riding'],
    ],
    [
      npc((m) => (m.terrain = [])),
      ['SCHEMA_VIOLATION', `.cartridge.npcs["${HORSE}"].mount.terrain`],
    ],
    [
      npc((m) => (m.cost_percent = 1001)),
      ['SCHEMA_VIOLATION', `.cartridge.npcs["${HORSE}"].mount.cost_percent`],
    ],
    [
      (c) => (c.manifest.requires.kernel_api.at_least = '1.107'),
      ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'],
    ],
    [
      (c) => (c.npcs[HORSE].spawn_template = true),
      ['SCHEMA_VIOLATION', `.cartridge.npcs["${HORSE}"].mount`],
    ],
    [
      (c) => (c.facts[riding].scopes = ['instance']),
      ['SCHEMA_VIOLATION', '.cartridge.world.mount.riding'],
    ],
    [
      (c) => {
        c.facts[riding].value_type = { type: 'int', default: 0 };
        for (const [k, v] of [
          ['mount', 0],
          ['dismount', 1],
        ] as const) {
          const d = c.dialogues[`${P}:dialogue/horse_${k}`];
          d.choices[k].sequence[0].value = 1;
          d.policy.root.equals = v;
        }
        c.npcs[HORSE].description_variants[0].when.root.equals = 1;
      },
      ['SCHEMA_VIOLATION', '.cartridge.world.mount.riding'],
    ],
    [() => {}, 'loaded'],
    [npc((m) => (m.cost_percent = 1000)), 'loaded'],
    [
      npc((m) => (m.terrain = ['road', 'marsh', 'air', 'bed', 'cool', 'warm', 'water', 'rug'])),
      'loaded',
    ],
  ];
  for (const [edit, expected] of cases) assert.deepEqual(refused(edit), expected);
});

// Breaks: the saddled description reads the viewer, not the horse, as the pair fact's subject, or
// shows on foot; or Mount and Dismount are both offered (Dismount on foot, Mount while riding).
test('case 9: the horse page reads saddled while ridden, and offers only the choice that applies', () => {
  const seen = (w: World) => {
    const talked = gameView(act(w, { type: 'talk', target_id: horse(w) }).world);
    assert.deepEqual(validate('GameView', talked), []);
    const e = talked.entities.find((x) => x.id === horse(w))!;
    const offered = talked.choice!.choices.filter((o) => o.available).map((o) => o.choice_id);
    return [e.name, e.description, offered];
  };
  const w = yard();
  assert.deepEqual(seen(w), ['npc.horse.short', 'npc.horse.description', ['mount']]);
  const mounted = ride(w, 'mount');
  assert.deepEqual(seen(mounted), ['npc.horse.short', 'npc.horse.saddled', ['dismount']]);
  assert.deepEqual(seen(ride(mounted, 'dismount'))[1], 'npc.horse.description');
});
