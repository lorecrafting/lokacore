// Toolbox row 4 on the compiled levelling sampler: rats grant 10 experience each, level 2 at 30
// grants one point, Raise spends it, and the quest reward grants 20 (mechanics.md row 4).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import { bodyOf, type Cartridge, type World } from '../src/runtime/decision.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { encode } from '../src/foundation/canonical.ts';
import { resolve } from '../src/commands/invocation.ts';
import { derived } from '../src/mechanics/attribute/shared.ts';
import { levelsReached, levelUp, oneWrite } from '../src/mechanics/levelling/shared.ts';
import { decide } from '../src/mechanics/attribute/rule.ts';
import { gameView } from '../src/view/view.ts';
import { validate } from '../src/foundation/validate.ts';
import { ctx } from './harness.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-levelling-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/levelling_sampler', file], {
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
const LEVEL_UP = 'levelling.level_up';
const attr = (key: string) => ({
  cartridge_id: 'levelling_sampler',
  cartridge_version: '0.0.1',
  kind: 'attribute',
  key,
});
let n = 0;
const id = () => `dddddddd-6666-4666-8666-${String(++n).padStart(12, '0')}` as never;
function play(w: World, p: object, action?: string) {
  const command = {
    id: id(),
    world_context_id: w.context,
    payload: { actor_id: w.character, ...p },
  };
  const r = step(w, command as never, n, action as never);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r;
}
function wait(w: World, seconds: number) {
  const run_id = `aaaaaaaa-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const until = w.state.clock + seconds;
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
  return r;
}
const narration = (r: { decision: object }) =>
  ((r.decision as { narration?: { key: string }[] }).narration ?? []).map((t) => t.key);
const fresh = (c: Cartridge = content) =>
  newWorld(c, ctx('2d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f'), [1, 2, 3, 4]);
/** One rat in the pit killed in one round; the step and the world after it. */
function kill(w: World, rat: string) {
  const target_id = w.entityIds[`levelling_sampler@0.0.1:npc/${rat}`];
  return wait(play(w, { type: 'attack', target_id }).world, 150);
}
/** Three rats killed from the pit, and the step of the third kill. */
function cull(c: Cartridge = content) {
  let w = play(fresh(c), { type: 'move', direction: 'east' }).world;
  w = kill(kill(w, 'rat_a').world, 'rat_b').world;
  const two = gameView(w);
  const third = kill(w, 'rat_c');
  return { two, third, w: third.world };
}
/** The raise_attribute invocation taken from the GameView, resolved and stepped with its key. */
function raise(w: World, key: string) {
  const offered = gameView(w).actions.find((a) => a.action_key === 'raise_attribute');
  assert.ok(offered, 'raise_attribute offered');
  const invocation = {
    invocation_id: id(),
    actor_id: w.character,
    action_key: offered.action_key,
    target_ids: [],
    input: { attribute: attr(key) },
  };
  const command = resolve(w, { invocation, command_id: id() } as never);
  assert.ok(!('kind' in command), JSON.stringify(command));
  return play(w, command.payload, offered.action_key);
}
const hp = (w: World) => {
  const { current, maximum } = gameView(w).resources!.find((r) => r.resource.key === 'hp')!;
  return [current, maximum];
};

// Breaks: kill credit grants nothing or the wrong amount, the level counts a threshold above the
// experience (or misses the one at it), the level grants no point, Raise is offered without a
// point, or the level-up line is dropped from the killing step (or emitted by an earlier kill).
test('three rat kills reach level 2 with one point and narrate the level-up once', () => {
  const { two, third, w } = cull();
  assert.deepEqual(two.levelling, { level: 1, experience: 20, from: 0, next: 30, unspent: 0 });
  assert.ok(!two.actions.some((a) => a.action_key === 'raise_attribute'));
  assert.deepEqual(gameView(w).levelling, {
    level: 2,
    experience: 30,
    from: 30,
    next: 100,
    unspent: 1,
  });
  assert.equal(narration(third).filter((k) => k === LEVEL_UP).length, 1);
});

// Breaks: value() ignores allocated points (damage stays +0), Raise keeps the point, a spent point
// is still offered, a forged Raise without points is accepted, or Raise narrates a level-up.
test('Raise STR spends the point, raises the derived damage by 1 and is then refused', () => {
  const { w } = cull();
  const damage = (x: World) => derived(x, x.character, x.cartridge.world!.derived!.damage!);
  assert.equal(damage(w), 0);
  const raised = raise(w, 'str');
  assert.equal(narration(raised).includes(LEVEL_UP), false);
  assert.equal(damage(raised.world), 1);
  const view = gameView(raised.world);
  assert.deepEqual(view.levelling, { level: 2, experience: 30, from: 30, next: 100, unspent: 0 });
  assert.equal(view.attributes!.find((a) => a.attribute.key === 'str')!.value, 11);
  assert.ok(!view.actions.some((a) => a.action_key === 'raise_attribute'));
  const command = {
    id: id(),
    world_context_id: raised.world.context,
    payload: { type: 'raise_attribute', actor_id: raised.world.character, attribute: attr('str') },
  };
  const forged = step(raised.world, command as never, n, 'raise_attribute' as never);
  assert.notEqual(forged.decision.kind, 'accepted');
  // The rule itself keeps the points within the grant: composition does not (mechanics.md row 4).
  const ruled = decide(raised.world, command as never, undefined as never);
  assert.deepEqual(ruled.kind === 'rejected' && ruled.error.code, 'invalid_state');
});

// Breaks (PM ruling, loka-kgd.11): Raise CON writes no zero-amount hp settle first, so the 4 hours
// banked at full hp 10/10 are granted by the raised maximum at once (11/11 instead of 10/11).
test('Raise CON after 4 h idle at full hp keeps hp 10 of 11, then regenerates from there', () => {
  let w = wait(cull().w, 4 * 3600).world;
  assert.deepEqual(hp(w), [10, 10]);
  w = raise(w, 'con').world;
  assert.deepEqual(hp(w), [10, 11]);
  assert.deepEqual(hp(wait(w, 3600).world), [11, 11]);
});

// Breaks: the experience.grant step on the quest's quest_resolved reaction writes nothing, or a
// level reached by a reaction write is not narrated on the step that caused it.
test('resolving the den quest grants 20 experience; after two kills it narrates level 2', () => {
  const accept = (w: World) =>
    play(w, { type: 'accept_quest', quest: { ...attr('cull'), kind: 'quest' } }, 'cull');
  const den = (w: World) => play(accept(w).world, { type: 'move', direction: 'west' });
  const quest = den(fresh());
  assert.deepEqual(gameView(quest.world).levelling, {
    level: 1,
    experience: 20,
    from: 0,
    next: 30,
    unspent: 0,
  });
  assert.equal(narration(quest).includes(LEVEL_UP), false);
  let w = play(fresh(), { type: 'move', direction: 'east' }).world;
  w = kill(kill(w, 'rat_a').world, 'rat_b').world;
  w = play(w, { type: 'move', direction: 'west' }).world;
  const up = den(w);
  assert.deepEqual(gameView(up.world).levelling, {
    level: 2,
    experience: 40,
    from: 30,
    next: 100,
    unspent: 1,
  });
  assert.ok(narration(up).includes(LEVEL_UP));
});

const events = (r: { decision: object }) =>
  (r.decision as { events: { id: string; causation_id: string; position: number; payload: any }[] })
    .events;
const levels = (r: { decision: object }) =>
  events(r).flatMap((e) => (e.payload.type === 'level_reached' ? [e.payload.level] : []));
const lines = (r: { decision: object }) => (r.decision as { narration: object[] }).narration;
const GAINED = 'levelling.gained';
/** A fresh world whose stored row already holds `experience`. */
function holding(experience: number, c: Cartridge = content) {
  const w = fresh(c);
  const row = { experience, allocated: {} };
  return { ...w, state: { ...w.state, levelling: { [w.character]: row } } };
}
/** One kill of a rat worth `worth` from a stored row of `experience`. */
function strike(experience: number, worth: number) {
  const c = variant((l) => l.kills.forEach((k: any) => (k.experience = worth)));
  return kill(play(holding(experience, c), { type: 'move', direction: 'east' }).world, 'rat_a');
}

// Breaks: no level_reached from a credited kill, it lands before the round's own events, its
// rule runs in a later proposal or not at all, or the gained line follows the level-up line.
test('the third kill places level_reached after the death and its rule fires in the proposal', () => {
  const { third } = cull();
  assert.deepEqual(lines(third).slice(-2), [
    { key: GAINED, bindings: { amount: 10 } },
    { key: LEVEL_UP },
  ]);
  assert.ok(narration(third).includes('levelling.level_two'));
  const all = events(third);
  const reached = all.filter((e) => e.payload.type === 'level_reached');
  const [character_id] = [third.world.character];
  assert.deepEqual(
    reached.map((e) => e.payload),
    [{ type: 'level_reached', character_id, level: 2 }],
  );
  const died = all.find((e) => e.payload.type === 'entity_died')!;
  assert.ok(reached[0]!.position > died.position);
  const fact = all.find(
    (e) => e.payload.type === 'fact_changed' && e.payload.fact.key === 'second_wind',
  )!;
  assert.equal(fact.causation_id, reached[0]!.id);
  assert.equal(fact.payload.new, true);
  assert.deepEqual(validate('DecisionResult', third.decision), []);
});

// Breaks: a gain within one level emits an event, the gained line needs a level, or its amount
// reads the row after the write.
test('a quest reward within a level tells the gain and emits no event', () => {
  const accept = play(
    holding(30),
    { type: 'accept_quest', quest: { ...attr('cull'), kind: 'quest' } },
    'cull',
  );
  const r = play(accept.world, { type: 'move', direction: 'west' });
  assert.deepEqual(lines(r).slice(-1), [{ key: GAINED, bindings: { amount: 20 } }]);
  assert.deepEqual(levels(r), []);
});

// Breaks: spending a point, a levelling write that adds nothing, tells a gain of 0.
test('raising an attribute tells no gain', () => {
  assert.ok(!narration(raise(cull().w, 'str')).includes(GAINED));
});

// Breaks: a character with no row yet counts from anything but 0, so a first threshold at 1 is missed.
test('a first grant from no row crosses a threshold at 1', () => {
  const c = variant((l) => (l.thresholds = [1, 30, 100]));
  const r = kill(play(fresh(c), { type: 'move', direction: 'east' }).world, 'rat_a');
  assert.deepEqual(levels(r), [2]);
});

// Breaks: the threshold compare is < instead of <=, or one below it counts.
test('a grant landing exactly on 100 reaches level 3; landing on 99 does not', () => {
  assert.deepEqual([levels(strike(30, 70)), levels(strike(30, 69))], [[3], []]);
});

// Breaks: one event per write instead of per threshold, descending levels, a second level-up
// line, or a filter that ignores the level so a rule fires for each event.
test('one grant crossing two thresholds gives two events in order and one line', () => {
  const r = strike(29, 71);
  assert.deepEqual(levels(r), [2, 3]);
  const keys = narration(r);
  assert.equal(keys.filter((k) => k === LEVEL_UP).length, 1);
  assert.deepEqual(
    keys.filter((k) => k.startsWith('levelling.level_t')),
    ['levelling.level_two', 'levelling.level_three'],
  );
  assert.deepEqual(lines(r).slice(-2), [
    { key: GAINED, bindings: { amount: 71 } },
    { key: LEVEL_UP },
  ]);
});

// Breaks: from is the next threshold (thresholds[r]) or goes missing at level 1 or the top.
test('the view carries the threshold of the current level, validated, at every level', () => {
  const view = (w: World) => gameView(w);
  assert.deepEqual(view(fresh()).levelling, {
    level: 1,
    experience: 0,
    from: 0,
    next: 30,
    unspent: 0,
  });
  const after = view(cull().w);
  assert.deepEqual(after.levelling, { level: 2, experience: 30, from: 30, next: 100, unspent: 1 });
  assert.deepEqual(validate('GameView', after), []);
  assert.deepEqual(view(holding(120)).levelling, {
    level: 3,
    experience: 120,
    from: 100,
    unspent: 2,
  });
});

/** The sampler with its loaded levelling declaration changed by `change`. */
function variant(change: (l: any) => void) {
  const c = structuredClone(content);
  change(c.world!.levelling!);
  return c;
}

// Breaks (#344 review, finding 1): credit matches any kills entry, so a kill of an NPC the
// cartridge does not list still grants experience.
test('killing an NPC that kills does not list leaves experience unchanged', () => {
  const { w } = cull(variant((l) => (l.kills = l.kills.filter((k: any) => k.npc.key !== 'rat_c'))));
  assert.deepEqual(gameView(w).levelling, {
    level: 1,
    experience: 20,
    from: 0,
    next: 30,
    unspent: 0,
  });
});

// Breaks (#344 review, finding 2): unspent ignores points_per_level (one point per level).
test('a level with points_per_level 2 grants two unspent points', () => {
  const { w } = cull(variant((l) => (l.points_per_level = 2)));
  assert.equal(gameView(w).levelling!.unspent, 2);
});

// Breaks (#344 review, finding 3): Raise accepts an attribute the cartridge does not declare and
// spends the point on it.
test('a forged Raise of an unknown attribute is refused not_found and keeps the point', () => {
  const { w } = cull();
  const command = {
    id: id(),
    world_context_id: w.context,
    payload: { type: 'raise_attribute', actor_id: w.character, attribute: attr('luck') },
  };
  const r = step(w, command as never, n, 'raise_attribute' as never);
  assert.equal(r.decision.kind === 'rejected' && r.decision.error.code, 'not_found');
  assert.equal(gameView(r.world).levelling!.unspent, 1);
});

// Breaks (#344 review, finding 4): a kill grant past the ResourceInt maximum does not saturate.
test('experience saturates at the ResourceInt maximum', () => {
  const max = 2147483647;
  const c = variant((l) => (l.kills[0].experience = max));
  const w = kill(play(fresh(c), { type: 'move', direction: 'east' }).world, 'rat_a').world;
  assert.equal(gameView(kill(w, 'rat_b').world).levelling!.experience, max);
});

// Breaks (#344 batch review, finding 1): the kill grant (fatal group) and the quest reward
// (reaction group) each write the levelling row, so the killing step faults conflicting_write.
test('a kill that also resolves a rewarding quest writes experience once and levels up once', () => {
  const c: any = structuredClone(content);
  const ref = (kind: string, key: string) => ({ ...attr(key), kind });
  c.world.death_credit = [
    { npc: ref('npc', 'rat_a'), room: ref('room', 'pit'), fact: ref('fact', 'den_found') },
  ];
  let w = play(fresh(c), { type: 'accept_quest', quest: ref('quest', 'cull') }, 'cull').world;
  w = play(w, { type: 'move', direction: 'east' }).world;
  const r = kill(w, 'rat_a');
  assert.ok(r.decision.kind === 'accepted');
  assert.deepEqual(
    r.decision.delta.ops.flatMap((o) => (o.op === 'levelling.set' ? [[o.expected, o.value]] : [])),
    [[null, { experience: 30, allocated: {} }]],
  );
  assert.deepEqual(gameView(r.world).levelling, {
    level: 2,
    experience: 30,
    from: 30,
    next: 100,
    unspent: 1,
  });
  assert.equal(narration(r).filter((k) => k === LEVEL_UP).length, 1);
});

// Breaks: the gained line and level_reached read each write instead of the proposal's fold, so a
// grant on top of a loss tells only its last step or re-crosses a threshold already held.
test('folded writes: gained sums the proposal, a loss and regrant or no levelling reaches no level', () => {
  const w = holding(35);
  const write = (from: number, to: number) => ({
    op: 'levelling.set' as const,
    writer_group: 1,
    character_id: w.character,
    expected: { experience: from, allocated: {} },
    value: { experience: to, allocated: {} },
  });
  assert.deepEqual(levelUp(w, w.character, [write(35, 45), write(45, 55)]), [
    { key: GAINED, bindings: { amount: 20 } },
  ]);
  const none = () => assert.fail('no event, no id');
  assert.deepEqual(levelsReached(w, [write(35, 25), write(25, 35)], {} as never, none), []);
  const off = { ...w, cartridge: { ...content, world: {} } };
  assert.deepEqual(levelsReached(off, [write(0, 200)], {} as never, none), []);
});

// Breaks: level_reached's subject is its character_id, not the body, so an event.emit in a level
// rule (or a status) is about a character id instead of the levelled body.
test('a level rule is about the levelled character body', () => {
  const c = structuredClone(content) as any;
  const rule = Object.values<any>(c.reactions).find((r) => r.on.level === 2);
  rule.steps = [{ op: 'event.emit', event: 'anything' }];
  const { third, w } = cull(c);
  const emitted = events(third).find((e) => e.payload.type === 'custom_event')!;
  assert.equal(emitted.payload.subject_id, bodyOf(w, w.character));
});

// Breaks: several credited kills in one decision (fatal groups 1 and 2, not reachable in play
// while Attack is single-opponent) keep one write each, or the collapse merges across characters
// or keeps the last write's own expected instead of the row before the first write.
test('one levelling write per character keeps the last value and the first expected', () => {
  const [a, b] = ['a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002'];
  const row = (experience: number) => ({ experience, allocated: {} });
  const set = (g: number, c: string, from: number | null, to: number) => ({
    op: 'levelling.set' as const,
    writer_group: g,
    character_id: c as never,
    expected: from === null ? null : row(from),
    value: row(to),
  });
  const other = { op: 'time.advance', writer_group: 0, from: 0, to: 1 } as never;
  assert.deepEqual(
    oneWrite([set(1, a, null, 10), other, set(1, b, 5, 15), set(2, a, 10, 20), set(3, a, 20, 40)]),
    [other, set(1, b, 5, 15), set(3, a, null, 40)],
  );
});
