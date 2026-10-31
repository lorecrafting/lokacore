// Toolbox row W21 on the compiled fear sampler: two goblins of one pack plan (6 HP, a sure hit for
// 1, flight below 25%) in the den, a burrow east inside their area; the player (10 HP) always hits
// for 2. A shout of "begone" applies `afraid` (a fear status) to each goblin that hears it.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { gameView, INSTALLED, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import { validate } from '../src/foundation/validate.ts';
import { key } from '../src/foundation/compose.ts';
import { refString, type Cartridge, type World } from '../src/runtime/decision.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { activeStatuses } from '../src/mechanics/status/shared.ts';
import { sequence } from '../src/mechanics/reaction.ts';
import { ctx } from './harness.ts';
import type { Command } from '../src/contracts.gen.ts';
import { resolved } from '../src/commands/actions.ts';
import { identify, resolve } from '../src/commands/invocation.ts';
import { check } from '../src/runtime/invariants.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-fear-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/fear_sampler', file], {
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

let n = 0;
const id = () => `eeeeeeee-2121-4121-8121-${String(++n).padStart(12, '0')}` as never;
const said: string[] = []; // every accepted decision's narration keys, in order
function ok(r: ReturnType<typeof step>) {
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  if (r.decision.kind === 'accepted') said.push(...(r.decision.narration ?? []).map((l) => l.key));
  return r.world;
}
const play = (w: World, payload: object) =>
  ok(
    step(
      w,
      {
        id: id(),
        world_context_id: w.context,
        payload: { actor_id: w.character, ...payload },
      } as never,
      n,
    ),
  );
function round(w: World, by = 150) {
  const run_id = `aaaaaaaa-2121-4121-8121-${String(++n).padStart(12, '0')}`;
  const [from, until] = [w.state.clock, w.state.clock + by];
  const payload = { type: 'elapsed', actor_id: w.character, run_id, from, until };
  const command = { id: elapsedCommandId(run_id, w.context, from, until), payload };
  return ok(stepElapsed(w, { ...command, world_context_id: w.context } as never, n));
}
const hp = (w: World, e: string) => level(w, e as never, resourceRef(w, 'hp'));
const room = (w: World, e: string) => w.rooms[w.state.containers[e]!]?.name;
const npc = (w: World, key: string) => {
  const { id: cartridge_id, version: cartridge_version } = w.cartridge.manifest;
  return w.entityIds[refString({ cartridge_id, cartridge_version, kind: 'npc', key } as never)]!;
};
const fearful = (w: World, e: string) => activeStatuses(w, e as never).length > 0;
const slay = (w: World) => round(play(w, { type: 'attack', target_id: npc(w, 'chief') }));

/** A new game, moved into the den, and its two goblins in EntityId order. */
function den(c: Cartridge) {
  n = 0;
  const w = play(newWorld(c, ctx('3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f'), [1, 2, 3, 4]), {
    type: 'move',
    direction: 'east',
  });
  const here = w.state.containers[w.body];
  const [a, b] = Object.keys(w.state.created ?? {})
    .filter((e) => w.state.created![e].origin.kind === 'spawned' && w.state.containers[e] === here)
    .sort();
  assert.ok(a && b, 'two goblins in the den');
  return { w, a, b };
}

/** Two rounds of a fight on the lower-id goblin, after `before` in the den. */
function fight(before: (w: World) => World, c = content) {
  const { w, a, b } = den(c);
  return { w: round(round(play(before(w), { type: 'attack', target_id: a }))), a, b };
}

// Breaks: combat behaviour ignores the fear status (the goblins fight on), reads it only below the
// hp threshold, or a feared goblin skips its turn instead of fleeing.
test('afraid goblins flee on their next turns; without fear they fight', () => {
  const calm = fight((w) => w);
  assert.deepEqual(
    [hp(calm.w, calm.w.body), hp(calm.w, calm.a), room(calm.w, calm.a), room(calm.w, calm.b)],
    [8, 2, 'room.den.title', 'room.den.title'],
    'each goblin strikes once; the player hits the first twice',
  );
  const { w, a, b } = fight((v) => play(v, { type: 'shout', word: 'begone' }));
  assert.deepEqual(
    [hp(w, w.body), hp(w, a), hp(w, b), room(w, a), room(w, b)],
    [10, 4, 6, 'room.burrow.title', 'room.burrow.title'],
    'round 1: hit, the first goblin flees; round 2: the second flees before the player strikes',
  );
  assert.deepEqual(
    Object.values(w.state.encounters ?? {}).map((e) => e.status),
    ['closed'],
  );
});

// Breaks (status reader 4, loka-kgd.98): pack flight ignores a `flee` block (entangled goblins still
// run), a pack turn ignores an `attack` bar (stunned goblins still strike), or the `attack` gate runs
// before flight (an afraid goblin barred from attacking skips its turn instead of fleeing). Breaks
// (loka-x6t.30): a stunned goblin tells no skipped line, or a fleeing one tells it.
test('pack turns read blocks and allows: rooted goblins fight, stunned ones idle, cowed ones flee', () => {
  const barred = (fields: object) => {
    said.length = 0;
    const c = structuredClone(content) as any;
    Object.assign(c.statuses['fear_sampler@0.0.1:status/afraid'], fields);
    return fight((v) => play(v, { type: 'shout', word: 'begone' }), c);
  };
  const rooted = barred({ blocks: ['flee'] });
  assert.deepEqual(
    [hp(rooted.w, rooted.w.body), hp(rooted.w, rooted.a), room(rooted.w, rooted.a)],
    [8, 2, 'room.den.title'],
    'as without fear: each goblin strikes once',
  );
  const stunned = barred({ allows: ['look'] });
  assert.deepEqual(
    [hp(stunned.w, stunned.w.body), hp(stunned.w, stunned.a), room(stunned.w, stunned.b)],
    [10, 2, 'room.den.title'],
    'neither flees nor strikes; the player hits the first twice',
  );
  assert.ok(said.includes('combat.skipped'), 'a stunned goblin tells its skipped turn');
  const { w, a, b } = barred({ blocks: ['attack'] });
  assert.deepEqual(
    [hp(w, w.body), hp(w, a), hp(w, b), room(w, a), room(w, b)],
    [10, 4, 6, 'room.burrow.title', 'room.burrow.title'],
  );
  assert.ok(!said.includes('combat.skipped'), 'a fleeing goblin tells no skipped turn');
});

// Breaks: the leader's entity_died reaction lands on the dead victim (co_present ignored), on no
// one, or only on the goblin the player attacks next.
test('the chief falls: both goblins flee on their next turns; without the reaction they fight', () => {
  const reactions = Object.entries(content.reactions!).filter(([, r]) => r.key !== 'leader_fell');
  assert.equal(reactions.length, 1);
  const calm = fight(slay, { ...content, reactions: Object.fromEntries(reactions) });
  assert.deepEqual(
    [hp(calm.w, calm.w.body), hp(calm.w, calm.a), room(calm.w, calm.a), room(calm.w, calm.b)],
    [8, 2, 'room.den.title', 'room.den.title'],
  );
  const { w, a, b } = fight(slay);
  assert.equal(hp(w, npc(w, 'chief')), 0, 'one blow fells the chief before it strikes');
  assert.deepEqual(
    [hp(w, w.body), hp(w, a), hp(w, b), room(w, a), room(w, b)],
    [10, 4, 6, 'room.burrow.title', 'room.burrow.title'],
  );
});

// Breaks: co_present reaches the player's body (any holder kind, not NPCs only) or an NPC that
// declares the status immune (the guard: how an ally opts out).
test('the chief falls: the player and the immune guard are not afraid', () => {
  const { w, a, b } = fight(slay);
  assert.deepEqual(
    [w.body, npc(w, 'guard'), a, b].map((e) => fearful(w, e)),
    [false, false, true, true],
  );
});

// The writer-group edge (docs/system/mechanics.md, writer groups; writer_groups.test.ts): a shout
// frightens the goblins at T; the chief falls in a round at T+650 in the same wait as their afraid
// expiry at T+600, so the reaction rewrites rows that expiry wrote. Breaks: a co_present holder
// does not join the group its status rows already hold in the advance (the wait faults
// conflicting_write), or the one wait differs from the same play split at T+600.
test("the chief falls in the wait that ends the goblins' fear: one wait equals two", () => {
  const after = (split: boolean) => {
    const { w: shouted, a, b } = den(content);
    const T = shouted.state.clock;
    let w = play(round(play(shouted, { type: 'shout', word: 'begone' }), 500), {
      type: 'attack',
      target_id: npc(shouted, 'chief'),
    });
    w = split ? round(round(w, 100), 50) : round(w, 150);
    return [w.state.clock - T, ...[npc(w, 'chief'), a, b].map((e) => [hp(w, e), fearful(w, e)])];
  };
  assert.deepEqual(after(false), [650, [0, false], [6, true], [6, true]]);
  assert.deepEqual(after(true), after(false));
});

// Breaks: with no room (a status_expired on an unplaced holder) co_present matches every NPC that
// has no container (here the chief, unplaced) instead of none, so the delivery writes its row.
test('co_present with no room frightens no one', () => {
  const placed = den(content).w;
  const { [npc(placed, 'chief')]: _, ...containers } = placed.state.containers;
  const w = { ...placed, state: { ...placed.state, containers } } as World;
  const rule = { ...Object.values(content.reactions!).find((r) => r.key === 'leader_fell')! };
  const status = (rule.steps[0] as unknown as { status: never }).status;
  const on = { event: 'status_expired' } as const;
  const payload = {
    type: 'status_expired',
    body_id: 'ffffffff-0000-4000-8000-000000000000',
    status,
  };
  const cause = { id: 'c', logical_time: w.state.clock, payload } as never;
  const r = sequence(
    w,
    w.character,
    { ...rule, on } as never,
    cause,
    1,
    { n: 0 },
    () => 'j' as never,
  );
  assert.deepEqual(r && r.kind === 'accepted' ? r.delta.ops : r, []);
});

// loka-xyyd (was zvwh's band test). Breaks: Attack admits an NPC with no hp of its own (the round's
// hp level is NaN), the view offers that Attack as available or drops the cause, execution refuses
// it with a different reason, or the hp check also refuses a goblin that has hp.
test('an hp-less NPC is offered Attack unavailable, cannot_be_hurt, and refused with it; a goblin is attackable', () => {
  const c = structuredClone(content) as any;
  c.npcs['fear_sampler@0.0.1:npc/guard'].attack = { chance: 100, damage_min: 1, damage_max: 1 };
  const { w, a } = den(c);
  const view = gameView(w);
  assert.deepEqual(validate('GameView', view), []);
  const offer = (target: string) =>
    view.entities.find((e) => e.id === target)!.actions.find((x) => x.action_key === 'attack')!;
  const guard = offer(npc(w, 'guard'));
  const reason = { code: 'invalid_target', cause: 'cannot_be_hurt' };
  assert.deepEqual([guard.available, 'reason' in guard && guard.reason], [false, reason]);
  assert.equal(offer(a).available, true);
  // The view's own offer, invoked as the Book does: identify, resolve, step (PM.md step 2).
  const found = identify('scope', w.character, {
    invocation_id: id(),
    actor_id: w.character,
    action_key: guard.action_key,
    target_ids: [npc(w, 'guard')], // an entity's own action targets that entity
    input: {},
  });
  assert.equal(found.kind, 'identified', JSON.stringify(found));
  const command = resolve(w, found as never) as Command;
  assert.equal(command.payload.type, 'attack');
  const refused = step(w, command, n, guard.action_key as never);
  assert.deepEqual(refused.decision, { kind: 'rejected', error: reason });
  assert.equal(refused.world, w);
  const resolves = Object.fromEntries(
    Object.values(resolved(w, w.character)).map((x) => [x.key, x.command]),
  );
  const observation = { view, command, decision: refused.decision, resolves };
  assert.ok(check('gameview_agrees_with_admission', observation));
  // The control: a view that offered this Attack as available disagrees with the refusal.
  const lied = structuredClone(view);
  lied.entities
    .find((e) => e.id === npc(w, 'guard'))!
    .actions.find((x) => x.action_key === 'attack')!.available = true;
  assert.equal(check('gameview_agrees_with_admission', { ...observation, view: lied }), false);
  assert.equal(gameView(play(w, { type: 'attack', target_id: a })).combat!.band, 'ready');
});

// loka-xyyd. Breaks: a hostile NPC with no hp of its own engages on entry, opening a fight whose
// rounds target a body with no hp.
test('a hostile hp-less NPC never engages; the goblins are calm', () => {
  const c = structuredClone(content) as any;
  Object.assign(c.npcs['fear_sampler@0.0.1:npc/guard'], {
    attack: { chance: 100, damage_min: 1, damage_max: 1 },
    disposition: { hostile: { op: 'all', items: [] }, engage: 'npc.guard.short' },
  });
  assert.deepEqual(den(c).w.state.encounters ?? {}, {});
  c.npcs['fear_sampler@0.0.1:npc/guard'].hp = c.npcs['fear_sampler@0.0.1:npc/goblin'].hp;
  const fought = den(c).w;
  assert.equal(Object.keys(fought.state.encounters ?? {}).length, 1); // the control: with hp it does
  // loka-zvwh: a save from before 1.126 holds that fight against a foe with no hp; it shows no band.
  const guard = npc(fought, 'guard');
  const { hp: _, ...bare } = fought.entities[guard] as any;
  const old = { ...fought, entities: { ...fought.entities, [guard]: bare } };
  assert.equal(gameView(fought).combat!.band, 'ready');
  assert.equal('band' in gameView(old).combat!, false);
});

// loka-zvwh. Breaks: the body's own hp entry, unreadable without its row under the regen pool,
// ships as a schema-invalid ResourceView (no current or band) instead of failing as living() does.
test('a missing body hp row fails the view with precondition_failed', () => {
  const { w } = den(content);
  const resources = { ...w.state.resources };
  delete resources[key({ kind: 'resource', resource: resourceRef(w, 'hp'), entity_id: w.body })];
  assert.throws(() => gameView({ ...w, state: { ...w.state, resources } }), {
    code: 'precondition_failed',
  });
});
