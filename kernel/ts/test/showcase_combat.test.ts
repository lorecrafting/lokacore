// The showcase's combat district, the Drill Yard, walked step by step (docs/showcase/combat-district.md,
// "Guided loop and expected outcomes"). Steps 1 to 8 continue one world (step 3's inn shout is its
// own branch); step 10 starts fresh in the social district and combat 11 in the hub.
// Every attack is chance 100 or 0, so the numbers are the plan's; the purse roll alone is seeded.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView } from '../src/index.ts';
import type { World } from '../src/runtime/decision.ts';
import { decode } from '../src/foundation/canonical.ts';
import { pending } from '../src/mechanics/dialogue/shared.ts';
import { engaged } from '../src/mechanics/combat/shared.ts';
import { describeEntity } from '../src/mechanics/description_variant/rule.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { activeStatuses, statusKey } from '../src/mechanics/status/shared.ts';
import {
  attribute,
  detail,
  fresh,
  go,
  id,
  play,
  pool,
  ref,
  refused,
  reload,
  take,
  wait,
} from './showcase_fixture.ts';

const CTX = '5ca5e000-0000-4000-8000-0000000000c0';
const SOCIAL = '5ca5e000-0000-4000-8000-00000000032e';
const LEVEL_UP = 'levelling.level_up';
const C = { cartridge_id: 'toolbox_showcase', cartridge_version: '0.0.1' };
const fact = (w: World, key: string) =>
  Object.entries(w.state.facts ?? {}).find(
    ([k]) => (decode(k) as { fact: { key: string } }).fact.key === key,
  )?.[1];
const npc = (w: World, k: string) => id(w, 'npc', k);
const where = (w: World, k: string) => w.state.containers[k];
const room = (w: World, k: string) => w.roomIds[ref('room', k)];
const hp = (w: World, entity: string) => level(w, entity as never, resourceRef(w, 'hp'));
const cues = (w: World) => gameView(w).cues;
const conditions = (w: World) => gameView(w).conditions;
const levelling = (w: World) => gameView(w).levelling;
const inside = (w: World, holder: string) =>
  Object.keys(w.state.containers).filter((e) => w.state.containers[e] === holder);
/** The corpse a death made of `who` (the player's body or an NPC). */
function corpseOf(w: World, who: string) {
  const found = Object.keys(w.state.created ?? {}).find((e) => {
    const o = w.state.created![e].origin as { kind: string; victim_id?: string };
    return o.kind === 'death' && o.victim_id === who;
  });
  assert.ok(found, `no corpse of ${who}`);
  return found;
}
const bleedRow = (w: World) =>
  w.state.statuses?.[statusKey(w.body, { ...C, kind: 'status', key: 'bleeding' } as never)];
/** The dialogue whose choice is pending. */
const open = (w: World) =>
  Object.values(w.state.choices ?? {}).find((c) => c.status === 'pending')?.source.key;
function talk(w: World, who: string) {
  const r = play(w, { type: 'talk', target_id: npc(w, who) });
  return { world: r.world, opened: open(r.world) };
}
function choose(w: World, choice_id: string) {
  const [continuation_id] = pending(w, w.character)!;
  return play(w, { type: 'choose', choice_id, continuation_id });
}
const attack = (w: World, who: string) => play(w, { type: 'attack', target_id: npc(w, who) }).world;
const wield = (w: World) =>
  play(w, { type: 'wear', item_id: id(w, 'item', 'training_sword') }).world;

/** Bleeding applied at `at`: a tick of -1 every 900, ending 1800 later. */
const bleeding = (at: number) => ({
  label: 'condition.bleeding',
  ends_at: at + 1800,
  next_tick_at: at + 900,
  resource: 'hp',
  per_tick: -1,
  tick_every: 900,
});
// A permanent status shows no end and no tick (its tick_every is required by the schema; it never runs).
const GORED = { label: 'condition.gored', resource: 'hp', tick_every: 60 };

/** The pack members spawned in `roomKey`, lower id first. */
const goblinsIn = (w: World, roomKey: string) =>
  Object.keys(w.state.created ?? {})
    .filter(
      (e) => w.state.created![e].origin.kind === 'spawned' && where(w, e) === room(w, roomKey),
    )
    .sort();

// One world through steps 1 to 9.
let w = take(fresh(CTX), 'waterskin');

// Breaks: the boar's cue is missing, ignores its range (heard from the inn or the gate yard), or
// gives no direction from the next room.
test('combat 1: the Drill Yard sign reads; the boar is heard from the yard only', () => {
  assert.equal(cues(w), undefined);
  w = go(w, 'west').world;
  assert.deepEqual(play(w, { type: 'read', target_id: detail(w, 'sign_combat') }).lines, [
    'readable.sign_combat',
  ]);
  assert.deepEqual(cues(w), [{ sense: 'sound', text: 'cue.boar', direction: 'north' }]);
  assert.equal(cues(go(w, 'west').world), undefined);
});

// Breaks: the lesson grants no skill or sword, the lesson reopens after it is learned, Talk lists
// the keyword dialogue, a say opens it from another room, or the bounty is not accepted.
test('combat 2: the lesson gives the blade and the sword; say steel; the bounty', () => {
  const lesson = talk(w, 'aldous');
  assert.equal(lesson.opened, 'aldous_lesson');
  w = choose(lesson.world, 'learn').world;
  const sword = id(w, 'item', 'training_sword');
  assert.deepEqual([fact(w, 'skill_blade'), where(w, sword)], [true, w.body]);
  w = wield(w);
  assert.ok(Object.values(w.slots).includes(where(w, sword)), 'the sword is wielded');
  const said = play(w, { type: 'say', word: 'steel' });
  const steel = said.world;
  assert.equal(said.decision.kind === 'accepted' && said.decision.outcome, 'choice_opened');
  assert.equal(open(steel), 'aldous_steel');
  const elsewhere = play(go(w, 'west').world, { type: 'say', word: 'steel' });
  assert.equal(elsewhere.decision.kind === 'accepted' && elsewhere.decision.outcome, 'spoken');
  const plain = talk(choose(steel, 'leave').world, 'aldous');
  assert.equal(plain.opened, 'aldous_talk');
  w = choose(plain.world, 'bounty').world;
  assert.equal(gameView(w).journal[0]?.state, 'active');
  // A hub reopens after an answer; Leave the conversation closes it.
  const [continuation_id] = pending(w, w.character)!;
  w = play(w, { type: 'close_choice', continuation_id }).world;
});

// Breaks: a say reaches Gil through the wall, a shout does not, a shout carries two exits (from
// the inn), or Gil's description ignores the fact.
test('combat 3: a shout of "ware" in the yard warns Gil; a say or a shout from the inn does not', () => {
  const fromInn = play(go(w, 'east').world, { type: 'shout', word: 'ware' }).world;
  assert.notEqual(fact(fromInn, 'gil_warned'), true);
  w = play(w, { type: 'say', word: 'ware' }).world;
  assert.notEqual(fact(w, 'gil_warned'), true);
  w = play(w, { type: 'shout', word: 'ware' }).world;
  assert.equal(fact(w, 'gil_warned'), true);
  w = go(w, 'west').world;
  assert.equal(
    describeEntity(w, w.character, npc(w, 'gil'), 'description'),
    'npc.gil.description_warned',
  );
});

// Breaks: Gil does not strike or his kill is not credited to the player, the death credit fact,
// the bounty's resolve or its reward is missing from the elapsed round, or the level-up line is
// missing, doubled or not last, or Aldous still offers the bounty once the raider is dead.
test('combat 4: Gil kills the raider; the bounty resolves and the player reaches level 2', () => {
  const start = w.state.clock;
  w = attack(w, 'raider');
  const r = wait(w, start + 150);
  w = r.world;
  const raider = npc(w, 'raider');
  const died = r.events.find((e) => e.type === 'entity_died');
  assert.deepEqual([died?.killer_id, died?.credited_character_id], [npc(w, 'gil'), w.character]);
  assert.deepEqual([hp(w, raider), pool(w, 'hp'), fact(w, 'raider_slain')], [0, 9, true]);
  assert.equal(gameView(w).journal[0]?.state, 'resolved');
  assert.deepEqual(levelling(w), { level: 2, experience: 30, next: 100, unspent: 1 });
  assert.equal(r.lines.filter((k) => k === LEVEL_UP).length, 1);
  assert.equal(r.lines.at(-1), LEVEL_UP);
  assert.deepEqual(inside(w, corpseOf(w, raider)), []);
  const after = talk(go(w, 'east').world, 'aldous');
  assert.equal(after.opened, 'aldous_yard');
  const [continuation_id] = pending(after.world, after.world.character)!;
  assert.ok(refused(after.world, { type: 'choose', choice_id: 'bounty', continuation_id }));
});

// Breaks: Raise keeps the point or does not raise str (step 8's damage 3 holds the derived bonus).
test('combat 5: Raise str spends the point', () => {
  w = play(w, {
    type: 'raise_attribute',
    attribute: { ...C, kind: 'attribute', key: 'str' },
  }).world;
  assert.equal(attribute(w, 'str'), 11);
  assert.deepEqual(levelling(w), { level: 2, experience: 30, next: 100, unspent: 0 });
  assert.ok(!gameView(w).actions.some((a) => a.action_key === 'raise_attribute'));
});

// Breaks: the gore reaction or a status is missing, the boar's own statuses land on the player
// twice, the bleed ticks early, the death keeps the bleed or loses the scar, the level or str,
// or the held items do not move to the corpse.
test('combat 6: unarmed, the boar gores the player to death; the scar survives the return', () => {
  const sword = id(w, 'item', 'training_sword');
  w = play(w, { type: 'remove', item_id: sword }).world;
  w = go(go(w, 'east').world, 'north').world;
  assert.equal(where(w, w.body), room(w, 'boar_run'));
  assert.deepEqual(cues(w), [{ sense: 'sound', text: 'cue.boar' }]);
  const start = w.state.clock;
  const first = wait(attack(w, 'boar'), start + 150);
  w = first.world;
  for (const line of [
    'combat.player_miss',
    'narration.bleeding.applied',
    'narration.gored.applied',
  ])
    assert.ok(first.lines.includes(line), line);
  assert.equal(pool(w, 'hp'), 7);
  assert.deepEqual(conditions(w), [bleeding(start + 150), GORED]);
  assert.deepEqual(cues(w), [
    { sense: 'smell', text: 'cue.blood' },
    { sense: 'sound', text: 'cue.boar' },
  ]);
  const last = wait(w, start + 750);
  w = last.world;
  assert.ok(last.lines.includes('combat.player_died'));
  assert.ok(!last.lines.includes('narration.bleeding.tick'));
  assert.equal(engaged(w, w.body), undefined);
  assert.equal(where(w, w.body), room(w, 'crossroads_inn'));
  assert.deepEqual([pool(w, 'hp'), pool(w, 'mv')], [10, 100]);
  assert.deepEqual(conditions(w), [GORED]);
  assert.deepEqual(levelling(w), { level: 2, experience: 30, next: 100, unspent: 0 });
  assert.equal(attribute(w, 'str'), 11);
  const corpse = corpseOf(w, w.body);
  assert.equal(where(w, corpse), room(w, 'boar_run'));
  assert.deepEqual(inside(w, corpse).sort(), [sword, id(w, 'item', 'waterskin')].sort());
  assert.equal(hp(w, npc(w, 'boar')), 8);
});

// Breaks: the owner cannot take back from the corpse, or the boar engages on entry.
test('combat 7: back at the run, the corpse gives back the sword and the waterskin', () => {
  w = go(go(w, 'west').world, 'north').world;
  const corpse = corpseOf(w, w.body);
  w = take(take(w, 'training_sword'), 'waterskin');
  assert.deepEqual(inside(w, corpse), []);
  assert.equal(engaged(w, w.body), undefined);
  w = wield(w);
});

// Breaks: the derived damage is not added to the sword (four rounds), the boar's own statuses
// land on it, a permanent status is re-applied, the kill gives no experience or no tusk, a dead boar is still heard, the poultice
// does not cure the bleed or cures the scar, or the bleed's tick or expiry times are wrong.
test('combat 8: armed, the boar falls in three rounds; the poultice stops the bleeding', () => {
  const boar = npc(w, 'boar');
  const start = w.state.clock;
  const first = wait(attack(w, 'boar'), start + 150);
  assert.deepEqual([hp(first.world, boar), pool(first.world, 'hp')], [5, 8]);
  assert.ok(first.lines.includes('narration.bleeding.applied'));
  assert.ok(!first.lines.includes('narration.gored.applied'));
  assert.equal(bleedRow(first.world)?.generation, 2);
  assert.deepEqual(activeStatuses(first.world, boar), []);
  const second = wait(first.world, start + 300).world;
  assert.deepEqual([hp(second, boar), pool(second, 'hp')], [2, 6]);
  // The purse roll (chance 50): the round's rolls after the player's hit draw are the tusk's then
  // the purse's, as loot.test.ts's rat (hit, tail, coin), whose hand-computed rows give from
  // [1, 1, 1, 1] rolls 60, 20 (the purse drops) and from its last seed 50, 86 (the boar keeps it).
  const killed = (rng: number[]) =>
    wait({ ...second, state: { ...second.state, rng: rng as never } }, start + 450);
  const noPurse = killed([170029958, 3890805239, 3345768512, 779757290]).world;
  const withPurse = killed([1, 1, 1, 1]);
  w = withPurse.world;
  assert.ok(withPurse.lines.includes('combat.npc_died'));
  assert.equal(pool(w, 'hp'), 6);
  const corpse = corpseOf(w, boar);
  assert.deepEqual(
    inside(w, corpse).sort(),
    [id(w, 'item', 'tusk'), id(w, 'item', 'purse')].sort(),
  );
  assert.deepEqual(inside(noPurse, corpseOf(noPurse, boar)), [id(w, 'item', 'tusk')]);
  assert.deepEqual(levelling(w), { level: 2, experience: 60, next: 100, unspent: 0 });
  assert.deepEqual(cues(w), [{ sense: 'smell', text: 'cue.blood' }]);
  // Without the poultice: ticks at +1050 and +1950, expiry at +2100 (the round-1 refresh at +150).
  const tick1 = wait(w, start + 1050).world;
  const tick2 = wait(tick1, start + 1950).world;
  const over = wait(tick2, start + 2100);
  assert.deepEqual([pool(tick1, 'hp'), pool(tick2, 'hp')], [5, 4]);
  assert.ok(over.lines.includes('narration.bleeding.expired'));
  assert.deepEqual(conditions(over.world), [GORED]);
  // With it: no tick, mv + 1, the scar stays.
  w = take(go(w, 'south').world, 'poultice');
  const mv = pool(w, 'mv')!;
  w = play(w, { type: 'eat', item_id: id(w, 'item', 'poultice') }).world;
  assert.deepEqual([pool(w, 'hp'), pool(w, 'mv'), conditions(w)], [6, mv + 1, [GORED]]);
});

// Breaks: the pit's pack or target choice is missing (the second Attack is refused or plays a
// round), the switch does not move the player's blow off A, the goblin kill entry is lost (no 70),
// or a non-final pack kill pays (loka-lpq6: re-pin B's death to 70 and the end to 80 once fixed).
test('combat 9: in the pit the player turns on the second goblin; the last kill pays', () => {
  w = go(w, 'south').world;
  const [a, b] = goblinsIn(w, 'goblin_pit');
  assert.ok(a && b, 'two goblins in the pit');
  const joined = play(w, { type: 'attack', target_id: a });
  assert.ok(joined.lines.includes('combat.goblin_joined'));
  const start = joined.world.state.clock;
  const turned = play(joined.world, { type: 'attack', target_id: b });
  assert.deepEqual(turned.lines, ['combat.goblin_targeted']);
  assert.deepEqual(
    [turned.world.state.clock, turned.world.state.rng],
    [start, joined.world.state.rng],
  );
  const unswitched = wait(joined.world, start + 150).world;
  assert.deepEqual([hp(unswitched, a), hp(unswitched, b)], [3, 6]);
  const hps = (x: World) => [hp(x, a), hp(x, b), pool(x, 'hp')];
  const r1 = wait(turned.world, start + 150).world;
  assert.deepEqual(hps(r1), [6, 3, 5]);
  const r2 = wait(r1, start + 300).world;
  assert.deepEqual(hps(r2), [6, 0, 4]);
  assert.equal(levelling(r2)?.experience, 60);
  const r3 = wait(r2, start + 450).world;
  assert.deepEqual(hps(r3), [3, 0, 3]);
  w = wait(r3, start + 600).world;
  assert.deepEqual(hps(w), [0, 0, 2]);
  assert.equal(engaged(w, w.body), undefined);
  assert.deepEqual(levelling(w), { level: 2, experience: 70, next: 100, unspent: 0 });
});

// Breaks: the Warden's physical resistance is missing (the sword kills him in three rounds and
// the toll gate's talk path is lost), or the wielded sword's hit is not reported as a hit.
test('combat 10: with the sword, the Warden takes hits for no loss; Flee holds', () => {
  let s = go(fresh(SOCIAL), 'west').world;
  s = wield(choose(talk(s, 'aldous').world, 'learn').world);
  s = go(go(s, 'east').world, 'south').world;
  const reeve = (x: World, c: string) =>
    choose(pending(x, x.character) ? x : talk(x, 'reeve').world, c).world;
  s = choose(reeve(reeve(s, 'wrong'), 'wrong'), 'leave').world;
  assert.equal(fact(s, 'wardle_standing'), -2);
  s = go(s, 'east').world;
  const warden = npc(s, 'warden');
  assert.equal(engaged(s, s.body)?.row.npc_id, warden);
  const round = wait(s, s.state.clock + 150);
  const blow = round.events.find((e) => e.type === 'attack_result' && e.target_id === warden);
  assert.deepEqual([blow?.hit, blow?.loss], [true, 0]);
  assert.equal(hp(round.world, warden), 5);
  assert.equal(engaged(round.world, round.world.body)?.row.npc_id, warden);
  const fled = play(round.world, { type: 'flee' }).world;
  assert.equal(where(fled, fled.body), room(fled, 'village_green'));
});

// Breaks: the bounty's resolve fires with no bounty taken (the round faults and the fight never
// ends), or the kill credits experience it should not.
test('combat 11: the raider falls before the bounty is taken; the fight ends normally', () => {
  let s = play(go(fresh(CTX), 'west').world, { type: 'shout', word: 'ware' }).world;
  s = attack(go(s, 'west').world, 'raider');
  s = wait(s, s.state.clock + 450).world; // unarmed: Gil alone takes the raider's 3 hp
  assert.equal(fact(s, 'raider_slain'), true);
  assert.equal(engaged(s, s.body), undefined);
  assert.deepEqual(gameView(s).journal, []);
  assert.deepEqual(levelling(s), { level: 1, experience: 10, next: 30, unspent: 0 });
  assert.equal(talk(go(s, 'east').world, 'aldous').opened, 'aldous_lesson');
});

// Twin of the compiler rows in test/loka/content_showcase_test.exs (loka-kgd.79). Breaks: an
// attacker filter loads under API 1.57, names a spawn template (no instance ever attacks) or an
// NPC the cartridge lacks.
test('loader: the attacker filter needs API 1.58 and an authored NPC', () => {
  const gore = (api: string, key: string) => (c: any) => {
    c.manifest.requires.kernel_api.at_least = api;
    c.reactions[ref('reaction', 'boar_gore')].on.attacker = { ...C, kind: 'npc', key };
  };
  const at = `.cartridge.reactions["${ref('reaction', 'boar_gore')}"].on.attacker`;
  assert.equal(reload(gore('1.58', 'boar')), 'ok');
  assert.equal(
    reload(gore('1.57', 'boar')),
    'KERNEL_API_RANGE_INVALID .cartridge.manifest.requires.kernel_api.at_least',
  );
  assert.equal(reload(gore('1.58', 'goblin')), `SCHEMA_VIOLATION ${at}`);
  assert.equal(reload(gore('1.58', 'wolf')), `UNRESOLVED_REFERENCE ${at}`);
});
