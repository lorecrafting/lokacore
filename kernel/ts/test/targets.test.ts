// Toolbox rows 6a, 6b and 6c on the compiled targets sampler: two goblins of one pack plan (6 HP, a
// sure hit for 1) and a player blow that always hits for 2; with world.combat.target_choice,
// Attack on the other roster member while engaged makes it the primary the player strikes. Row
// 6b: the yard's guard (world.combat.allies, a sure hit for 1) fights beside the player.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, gameView, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { adjust, level, resourceRef } from '../src/mechanics/resource.ts';
import { encode } from '../src/foundation/canonical.ts';
import { apply } from '../src/runtime/apply.ts';
import { value } from '../src/mechanics/fact.ts';
import { applyStatus } from '../src/mechanics/status/shared.ts';
import { positioned } from './combat_fixture.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-targets-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/targets_sampler', file], {
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
const C = { cartridge_id: 'targets_sampler', cartridge_version: '0.0.1' };

let n = 0;
const id = () => `eeeeeeee-6666-4666-8666-${String(++n).padStart(12, '0')}` as never;
function play(w: World, payload: object) {
  return step(
    w,
    {
      id: id(),
      world_context_id: w.context,
      payload: { actor_id: w.character, ...payload },
    } as never,
    n,
  );
}
function ok(r: ReturnType<typeof step>) {
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
/** In the den, engaged with the lower-id goblin; returns [world, first, second]. */
function engaged(cartridge = content): [World, string, string] {
  n = 0;
  let w = newWorld(cartridge, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]);
  w = ok(play(w, { type: 'move', direction: 'east' }));
  const den = w.state.containers[w.body];
  const [a, b] = Object.keys(w.state.created ?? {})
    .filter((e) => w.state.created![e].origin.kind === 'spawned' && w.state.containers[e] === den)
    .sort();
  assert.ok(a && b, 'two goblins in the den');
  return [ok(play(w, { type: 'attack', target_id: a })), a, b];
}
function advance(w: World) {
  const run_id = `aaaaaaaa-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const [from, until] = [w.state.clock, w.state.clock + 150];
  const payload = { type: 'elapsed', actor_id: w.character, run_id, from, until };
  const command = { id: elapsedCommandId(run_id, w.context, from, until), payload };
  return stepElapsed(w, { ...command, world_context_id: w.context } as never, n);
}
const round = (w: World) => ok(advance(w));
const offered = (v: World) =>
  gameView(v).entities.flatMap((e) =>
    e.actions.filter((x) => x.action_key === 'attack').map((x) => [e.id, x.available]),
  );
const hp = (w: World, e: string) => level(w, e as never, resourceRef(w, 'hp'));

// Breaks: the switch is refused, writes nothing, or the round still strikes the first primary.
test('the player picks the second goblin; the round blow lands on it, the first is untouched', () => {
  const [start, a, b] = engaged();
  assert.deepEqual([hp(round(start), a), hp(round(start), b)], [4, 6], 'default: first goblin');
  const switched = play(start, { type: 'attack', target_id: b });
  const w = ok(switched);
  assert.deepEqual(switched.decision.kind === 'accepted' && switched.decision.narration, [
    { key: 'combat.goblin_targeted', participants: { enemy: b } },
  ]);
  assert.equal(w.state.rng, start.state.rng, 'no draw');
  const after = round(w);
  assert.deepEqual([hp(after, a), hp(after, b)], [6, 4]);
});

// Breaks: the current primary or a goblin without the opt-in can be "switched" to, or the
// GameView offers Attack on a target the rule refuses.
test('only another roster member is a choice, and only when the cartridge opts in', () => {
  const [w, a, b] = engaged();
  assert.deepEqual(offered(w), [
    [a, false],
    [b, true],
  ]);
  assert.equal(play(w, { type: 'attack', target_id: a }).decision.kind, 'rejected');
  const single = structuredClone(w);
  for (const row of Object.values(single.state.encounters ?? {}))
    (row as { active_ids: unknown }).active_ids = [a];
  assert.deepEqual(offered(single), [], 'a roster of one keeps the single-foe ActionSet');
  const plain = structuredClone(content) as { world: { combat: Record<string, unknown> } };
  delete plain.world.combat.target_choice;
  const [off, , other] = engaged(plain as unknown as Cartridge);
  assert.deepEqual(offered(off), []);
  assert.equal(play(off, { type: 'attack', target_id: other }).decision.kind, 'rejected');
});

// Breaks: the loader admits target choice under API 1.47 (twin of content_targets_test.exs).
/** The first load diagnostic of the compiled sampler after `edit`, re-hashed. */
function reload(edit: (c: any) => void) {
  const c = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  edit(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  const r = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
  return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path];
}
const FLOOR = ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'];

test('the loader refuses target choice below API 1.48', () => {
  assert.deepEqual(
    reload((c) => {
      c.manifest.requires.kernel_api.at_least = '1.47';
      delete c.world.combat.allies;
    }),
    FLOOR,
  );
});

// Toolbox row 6b (twin of content_targets_test.exs). Breaks: the loader admits allies under API
// 1.47, a spawn template, an NPC without an attack or an unknown NPC as an ally, or allies
// without their narration.
test('the loader keeps allies to API 1.48, authored fighters and their narration', () => {
  const ally = '.cartridge.world.combat.allies[0]';
  const npc = (key: string) => ({ ...C, kind: 'npc', key });
  const cases: [(c: any) => void, unknown][] = [
    [
      (c) => {
        c.manifest.requires.kernel_api.at_least = '1.47';
        delete c.world.combat.target_choice;
      },
      FLOOR,
    ],
    [(c) => (c.world.combat.allies = [npc('goblin')]), ['SCHEMA_VIOLATION', ally]],
    [(c) => delete c.npcs['targets_sampler@0.0.1:npc/guard'].attack, ['SCHEMA_VIOLATION', ally]],
    [(c) => (c.world.combat.allies = [npc('nobody')]), ['UNRESOLVED_REFERENCE', ally]],
    [
      (c) => delete c.world.combat.narration.ally_miss,
      ['SCHEMA_VIOLATION', '.cartridge.world.combat.narration.ally_miss'],
    ],
  ];
  for (const [edit, expected] of cases) assert.deepEqual(reload(edit), expected);
});

// Toolbox row 6c (6a carry). Breaks: the ActionSet counts the roster row, not the members still
// here, so a member gone between rounds (a status death or departure) keeps the Attack rows.
test('a roster with one member left here offers no Attack', () => {
  const [w, a, b] = engaged();
  const gone = structuredClone(w);
  const hall = Object.entries(w.roomIds).find(([k]) => k.endsWith('room/hall'))![1];
  (gone.state.containers as Record<string, string>)[b] = hall;
  assert.deepEqual(gone.state.encounters![Object.keys(gone.state.encounters!)[0]].active_ids, [
    a,
    b,
  ]);
  assert.deepEqual(offered(gone), []);
});

const guardOf = (w: World) => w.entityIds['targets_sampler@0.0.1:npc/guard']!;

// Toolbox row 6b. Breaks: the guard never strikes, strikes the player, is offered or accepted as
// a target, strikes while fallen, or its kill is not credited to the player (combat/credit.ts
// party credit).
test('the guard fights beside the player; its blow kills the raider and credits the player', () => {
  n = 0;
  let w = newWorld(content, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]);
  w = ok(play(w, { type: 'move', direction: 'south' }));
  const [guard, raider] = [guardOf(w), w.entityIds['targets_sampler@0.0.1:npc/raider']!];
  assert.deepEqual(offered(w), [[raider, true]], 'no Attack on the guard');
  const refused = play(w, { type: 'attack', target_id: guard }).decision;
  assert.deepEqual(refused.kind === 'rejected' && refused.error.code, 'invalid_target');
  w = ok(play(w, { type: 'attack', target_id: raider }));
  // A fallen guard (0 HP, still in the yard: an NPC's body stays where it died) never strikes.
  const fallen = apply(w, [adjust(w, guard, resourceRef(w, 'hp'), -10, {}).op], false);
  assert.ok('world' in fallen);
  assert.equal(hp(round(fallen.world), raider), 1);
  const r = advance(w);
  const after = ok(r);
  // Raider 3 HP: the player's 2, then the guard's 1; the player takes the raider's 1 of 10.
  assert.deepEqual([hp(after, raider), hp(after, guard), hp(after, after.body)], [0, 10, 9]);
  const died = r.decision.kind === 'accepted' ? r.decision.events : [];
  const death = died.find((e) => e.payload.type === 'entity_died')?.payload as never as {
    killer_id: string;
    credited_character_id: string;
  };
  assert.deepEqual([death.killer_id, death.credited_character_id], [guard, after.character]);
  assert.ok(
    r.decision.kind === 'accepted' &&
      r.decision.narration?.some((x) => x.key === 'combat.ally_hit'),
  );
  const fact = { ...C, kind: 'fact', key: 'raider_slain' } as never;
  assert.equal(value(after, after.character, fact), true);
});

// Toolbox row 6b, loka-x2gv. Breaks: a round's blow on a roster member other than the job's
// primary (the first goblin gone, the player and the guard strike the second) takes its own
// writer group while that member's poison tick, due at the same time, holds another, so the
// wait faults conflicting_write (status/job.ts statusGroup).
test('a poisoned second goblin ticks and takes the player and guard blows in one wait', () => {
  const [w, a, b] = engaged();
  const den = w.state.containers[w.body];
  const hall = Object.entries(w.roomIds).find(([k]) => k.endsWith('room/hall'))![1];
  const poison = { ...C, kind: 'status', key: 'poison' } as never;
  const statuses = {
    'targets_sampler@0.0.1:status/poison': {
      duration: 300,
      tick_every: 150,
      resource: resourceRef(w, 'hp'),
      per_tick: -1,
      label: 'combat.goblin_targeted',
      narration: { applied: 'combat.npc_hit', tick: 'combat.npc_hit', expired: 'combat.npc_hit' },
    },
  };
  const containers = { ...w.state.containers, [a]: hall, [guardOf(w)]: den };
  const moved = {
    ...w,
    cartridge: { ...w.cartridge, statuses } as never,
    state: { ...w.state, containers },
  } as World;
  const job = 'cccccccc-6666-4666-8666-000000000001' as never;
  const poisoned = apply(
    moved,
    applyStatus(moved, b as never, poison, 0, () => job),
    false,
  );
  assert.ok('world' in poisoned, JSON.stringify(poisoned));
  const after = round(poisoned.world);
  // 6 HP: at +150 the tick takes 1 and the round the player's 2 and the guard's 1.
  assert.deepEqual([hp(after, a), hp(after, b)], [6, 2]);
});

// loka-x2gv (b). Breaks: the player's body and the goblin each tick poison in their own writer
// group before the round (their job ids sort first); the round, which writes both HP pools, keeps
// the first group (status/job.ts statusGroup), so the goblin's HP conflicts in the wait.
test('poison ticks on the body and on the goblin in two groups, then one round, commit', () => {
  const [w, a] = engaged();
  const poison = { ...C, kind: 'status', key: 'poison' } as never;
  const spec = {
    duration: 300,
    tick_every: 150,
    resource: resourceRef(w, 'hp'),
    per_tick: -1,
    label: 'combat.goblin_targeted',
    narration: { applied: 'combat.npc_hit', tick: 'combat.npc_hit', expired: 'combat.npc_hit' },
  };
  const statuses = { 'targets_sampler@0.0.1:status/poison': spec };
  const moved = { ...w, cartridge: { ...w.cartridge, statuses } as never } as World;
  const job = (n: number) => () => `00000000-6666-4666-8666-00000000000${n}` as never;
  const ops = [
    ...applyStatus(moved, moved.body, poison, 0, job(1)),
    ...applyStatus(moved, a as never, poison, 0, job(2)),
  ];
  const poisoned = apply(moved, ops, false);
  assert.ok('world' in poisoned, JSON.stringify(poisoned));
  const before = hp(poisoned.world, poisoned.world.body)!;
  const after = round(poisoned.world);
  // Each tick takes 1; the player's sure blow takes 2 and the opponent's turn (one a round) 1.
  assert.deepEqual([hp(after, a), hp(after, after.body)], [3, before - 2]);
});

// Toolbox row 6b. Breaks: the guard's turn is lost when the player's blow kills the opponent
// whose turn comes next (the pack loop stops instead of passing to the guard).
test('when the player kills the striking goblin, the guard still hits the other', () => {
  const [w, a, b] = engaged();
  const den = w.state.containers[w.body];
  const moved = {
    ...w,
    state: { ...w.state, containers: { ...w.state.containers, [guardOf(w)]: den } },
  };
  const weak = apply(moved, [adjust(moved, a as never, resourceRef(w, 'hp'), -4, {}).op], false);
  assert.ok('world' in weak);
  const after = round(weak.world);
  assert.deepEqual([hp(after, a), hp(after, b)], [0, 5]);
});

// Toolbox row 6b. Breaks: the guard's two draws (hit, damage 1-2) run past the round's eight,
// faulting the wait, or the guard is skipped while two remain. The player's hit (bound 100) loses
// its first four, three or two raw draws to rejection in these states; the player's and the
// raider's damage rolls (1-3, 1-2) and the raider's hit then leave the guard none, one or two.
test('a round with fewer than two of its eight draws left skips the guard; with two it strikes', () => {
  const c = structuredClone(content) as any;
  c.world.combat.player_attack.damage_max = 3;
  c.npcs['targets_sampler@0.0.1:npc/raider'].attack.damage_max = 2;
  c.npcs['targets_sampler@0.0.1:npc/guard'].attack.damage_max = 2;
  for (const [rng, strikes] of [
    [[2094537, 1697854259, 1831315020, 1130250676], false],
    [[0, 3291316952, 3775549605, 2703766232], false],
    [[0, 889565275, 2048508316, 0], true],
  ] as const) {
    n = 0;
    let w = newWorld(c, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]);
    const raider = w.entityIds['targets_sampler@0.0.1:npc/raider']!;
    w = ok(
      play(ok(play(w, { type: 'move', direction: 'south' })), {
        type: 'attack',
        target_id: raider,
      }),
    );
    const r = advance({ ...w, state: { ...w.state, rng } } as World);
    ok(r);
    const keys =
      r.decision.kind === 'accepted' ? r.decision.narration!.map((x) => x.key as string) : [];
    assert.equal(keys.includes('combat.ally_hit'), strikes, keys.join());
  }
});

// Toolbox row 6b. Breaks: the player's defences reach the guard's blow on the raider
// (round_attack.ts attack: only a foe's blow on the player is defended or sleep-multiplied).
test("the player's shield and sleep touch only the raider's blow, never the guard's", () => {
  const K = 'targets_sampler@0.0.1:';
  const same = (w: World) => w;
  const yard = (edit: (c: any) => void, fresh = same, fighting = same) => {
    const c = structuredClone(content) as any;
    edit(c);
    n = 0;
    let w = fresh(newWorld(c, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]));
    const raider = w.entityIds[`${K}npc/raider`]!;
    w = ok(play(w, { type: 'move', direction: 'south' }));
    w = ok(play(w, { type: 'attack', target_id: raider }));
    const r = advance(fighting(w));
    const keys = r.decision.kind === 'accepted' ? r.decision.narration!.map((x) => x.key) : [];
    return [hp(ok(r), raider), hp(ok(r), w.body), keys.includes('combat.ally_hit' as never)];
  };
  // A 100 block shield stops the raider's blow; the player's 2 and the guard's 1 kill it.
  const shielded = yard(
    (c) => {
      c.items[`${K}item/shield`] = {
        ...c.items[`${K}item/ear`],
        key: 'shield',
        location: { in: 'npc', npc: { ...C, kind: 'npc', key: 'guard' } },
        slot: 'off_hand',
        block_chance: 100,
      };
      c.world.combat.narration.block = 'combat.npc_miss';
    },
    (w) => {
      const shield = w.entityIds[`${K}item/shield`]!;
      const containers = { ...w.state.containers, [shield]: w.slots.off_hand! };
      return { ...w, state: { ...w.state, containers } };
    },
  );
  assert.deepEqual(shielded, [0, 10, true]);
  // The player sleeps through the raider's miss: the guard's 1 is not doubled (raider 3 HP).
  const asleep = yard(
    (c) => (c.npcs[`${K}npc/raider`].attack.chance = 0),
    same,
    (w) => positioned(w, 'sleeping'),
  );
  assert.deepEqual(asleep, [2, 10, true]);
});
