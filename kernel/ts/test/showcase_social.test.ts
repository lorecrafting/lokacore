// size: allow 650, Low Wardle social 1 to 21 share one district's helpers and module-level worlds
// The showcase's social district, Low Wardle, walked step by step (docs/showcase/hub-and-first-districts.md,
// "Guided loop and expected outcomes" of Low Wardle). Steps 5 to 9 continue one world; the others
// start fresh. Weather oracle, independent of the kernel: for d in 1..2 the first 4 bytes of
// `printf 'weather:<ctx>:<d>' | shasum -a 256`, big-endian, mod 7 (clear 2, frost, rain, gale,
// heat, drought): SOCIAL 2, 3 (day 1 frost, day 2 rain); WET 3 (day 1 rain); for d in 1..3,
// ECHO 2, 0, 1 (frost, clear, clear).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView } from '../src/index.ts';
import type { World } from '../src/runtime/decision.ts';
import { decode } from '../src/foundation/canonical.ts';
import { pending, spokenBy } from '../src/mechanics/dialogue/shared.ts';
import { shelf } from '../src/mechanics/commerce/shared.ts';
import { engaged } from '../src/mechanics/combat/shared.ts';
import { disposition } from '../src/mechanics/disposition.ts';
import { describeEntity } from '../src/mechanics/description_variant/rule.ts';
import { level } from '../src/mechanics/skills.ts';
import {
  detail,
  fresh,
  go,
  HOUR,
  id,
  labels,
  perform,
  play,
  pool,
  refused,
  take,
  wait,
} from './showcase_fixture.ts';

const SOCIAL = '5ca5e000-0000-4000-8000-00000000032e';
const WET = '5ca5e000-0000-4000-8000-000000000306';
const AT_SEVEN = 7 * HOUR;
const green = (ctx = SOCIAL) => go(fresh(ctx), 'south').world;
/** A fact's value for `key` (and, for a pair or entity fact, `subject`'s row); undefined if unset. */
const fact = (w: World, key: string, subject?: string) =>
  Object.entries(w.state.facts ?? {}).find(([k]) => {
    const t = decode(k) as { fact: { key: string }; subject_id?: string };
    return t.fact.key === key && (subject === undefined || t.subject_id === subject);
  })?.[1];
const npc = (w: World, k: string) => id(w, 'npc', k);
const where = (w: World, k: string) => w.state.containers[k];
const room = (w: World, k: string) => w.roomIds[`toolbox_showcase@0.0.1:room/${k}`];
/** Talk to `who`; the dialogue that opened and the world with the choice pending. */
function talk(w: World, who: string) {
  const r = play(w, { type: 'talk', target_id: npc(w, who) });
  return { world: r.world, opened: spokenBy(w, w.character, npc(w, who))?.key };
}
function choose(w: World, choice_id: string) {
  const [continuation_id] = pending(w, w.character)!;
  return play(w, { type: 'choose', choice_id, continuation_id });
}
// An accepted decision's outcome.
const outcome = (r: ReturnType<typeof play>) =>
  r.decision.kind === 'accepted' ? r.decision.outcome : undefined;
// Pick `choice` from `who`'s dialogue, talking first unless its hub is still open.
const say = (w: World, who: string, choice: string) =>
  choose(pending(w, w.character) ? w : talk(w, who).world, choice);
const leave = (w: World) => choose(w, 'leave').world;
const bread = (w: World, who = 'nell') => shelf(w, npc(w, who))![0];
const mood = (w: World, who: string) => disposition(w, w.character, npc(w, who));
const topics = (w: World) => (gameView(w).topics ?? []).map((t) => t.label as string);
const quest = (w: World) => gameView(w).journal[0]!;
// Intimidate's use count and level.
function intimidate(w: World) {
  const skill = gameView(w).skills!.find((s) => s.skill.key === 'intimidate')!.skill;
  return [fact(w, 'uses_intimidate'), level(w, w.character, skill)];
}

// Breaks: the sign is missing, the shop's price or currency is wrong, or Nell starts friendly.
test('social 1: the Low Wardle sign reads; bread from a wary Nell costs 4', () => {
  let w = green();
  assert.deepEqual(play(w, { type: 'read', target_id: detail(w, 'sign_social') }).lines, [
    'readable.sign_social',
  ]);
  assert.equal(mood(w, 'nell'), 'wary');
  assert.equal(bread(w).buy.price, 4);
  const loaf = id(w, 'item', 'bread');
  w = play(w, { type: 'buy', provider_id: npc(w, 'nell'), item_id: loaf, quoted_price: 4 }).world;
  assert.deepEqual([where(w, loaf), pool(w, 'pennies')], [w.body, 6]);
});

// Breaks: help or wrong adjusts the wrong fact or amount, the standing does not clamp at -2, the
// discount or the hostile refusal ignores the village standing, or the Warden never engages,
// or the player's waited-out hits kill him and lose the toll gate.
test('social 2-3: help makes Nell friendly (bread 2); wrong twice makes her hostile and the Warden engage', () => {
  let w = green();
  w = play(w, {
    type: 'buy',
    provider_id: npc(w, 'nell'),
    item_id: id(w, 'item', 'bread'),
    quoted_price: 4,
  }).world;
  w = say(w, 'reeve', 'help').world;
  assert.deepEqual(
    [fact(w, 'wardle_standing'), mood(w, 'nell'), bread(w).buy.price],
    [1, 'friendly', 2],
  );
  w = say(w, 'reeve', 'wrong').world;
  assert.equal(fact(w, 'wardle_standing'), -1);
  w = leave(say(w, 'reeve', 'wrong').world);
  assert.deepEqual([fact(w, 'wardle_standing'), mood(w, 'nell')], [-2, 'hostile']);
  // The sell leg is offered on the held bread, so hostility is its only refusal.
  assert.deepEqual([bread(w).sell.available, bread(w).sell.reason], [false, 'invalid_state']);
  assert.equal(refused(w, { type: 'talk', target_id: npc(w, 'nell') }), 'invalid_state');
  const east = go(w, 'east');
  assert.equal(engaged(east.world, east.world.body)?.row.npc_id, npc(w, 'warden'));
  assert.ok(east.lines.includes('npc.warden.engage'), JSON.stringify(east.lines));
  // Ten rounds of waiting: the Warden lives, so after a flee and a mended standing the talk path
  // to the toll gate stays open.
  const held = wait(east.world, east.world.state.clock + 1500).world;
  assert.equal(engaged(held, held.body)?.row.npc_id, npc(w, 'warden'));
  const fled = play(held, { type: 'flee' }).world;
  assert.equal(where(fled, fled.body), room(fled, 'village_green'));
  const passed = say(go(say(fled, 'reeve', 'help').world, 'east').world, 'warden', 'reason');
  assert.equal(outcome(passed), 'reason');
  const through = go(play(passed.world, { type: 'open', direction: 'east' }).world, 'east').world;
  assert.equal(where(through, through.body), room(through, 'tollhouse'));
});

// Breaks: the gift reaction writes the giver's row or a shared one, or the Warden's hostility
// ignores his own trust.
test('social 4: an apple for the Warden keeps him calm at -2; an apple for Nell is her trust', () => {
  let w = take(green(), 'apple');
  w = go(w, 'east').world;
  w = play(w, {
    type: 'give',
    item_id: id(w, 'item', 'apple'),
    recipient_id: npc(w, 'warden'),
  }).world;
  assert.equal(fact(w, 'trust', npc(w, 'warden')), 1);
  w = leave(say(say(go(w, 'west').world, 'reeve', 'wrong').world, 'reeve', 'wrong').world);
  const calm = go(w, 'east').world;
  assert.equal(engaged(calm, calm.body), undefined);
  assert.equal(mood(w, 'nell'), 'hostile');
  const nell = take(green(), 'apple');
  const fed = play(nell, {
    type: 'give',
    item_id: id(nell, 'item', 'apple'),
    recipient_id: npc(nell, 'nell'),
  }).world;
  assert.deepEqual(
    [fact(fed, 'trust', npc(fed, 'nell')), fact(fed, 'trust', npc(fed, 'warden'))],
    [1, undefined],
  );
});

let w: World;

// Breaks: the lean check ignores the skill's uses or rating, a failure does not close the talk,
// the pass does not assign warden_lets_pass, or the toll gate ignores it; reason does not read cha.
test('social 5: lean fails once, then passes with practice; the toll gate opens', () => {
  w = go(green(), 'east').world;
  const failed = say(w, 'warden', 'lean');
  assert.equal(outcome(failed), 'check_failed');
  w = failed.world;
  assert.equal(pending(w, w.character), undefined);
  assert.deepEqual(intimidate(w), [1, 1]);
  assert.equal(refused(w, { type: 'open', direction: 'east' }), 'invalid_state');
  w = say(w, 'warden', 'lean').world;
  assert.deepEqual([...intimidate(w), fact(w, 'warden_lets_pass')], [2, 2, true]);
  w = play(w, { type: 'open', direction: 'east' }).world;
  const reason = say(go(green(), 'east').world, 'warden', 'reason');
  assert.equal(outcome(reason), 'reason');
});

// Breaks: the pick check ignores the lock's rating or the use count, the lid ignores the picked
// fact, or the ledger grants no topic.
test('social 6: the strongbox pick fails, then passes; the ledger reads "The mill"', () => {
  w = go(w, 'east').world;
  const missed = perform(w, 'pick_strongbox');
  const picked = perform(missed.world, 'pick_strongbox');
  assert.deepEqual([outcome(missed), outcome(picked)], ['failure', 'success']);
  w = play(picked.world, { type: 'open', target_id: id(w, 'item', 'strongbox') }).world;
  w = take(w, 'mill_ledger');
  w = play(w, { type: 'read', target_id: id(w, 'item', 'mill_ledger') }).world;
  assert.deepEqual(topics(w), ['topic.mill']);
});

// Breaks: has_tag ignores the barrier's tags (the iron door is forced), or the force check does not
// read str, or the wooden door ignores the forced fact.
test('social 7: the iron door is unavailable and refused; the wooden door gives to str', () => {
  const iron = gameView(w).actions.find((a) => a.action_key === 'force_iron_door');
  assert.equal(iron?.available, false);
  assert.equal(refused(w, { type: 'perform', action: 'force_iron_door' }), 'invalid_state');
  const forced = perform(w, 'force_tollhouse_door');
  assert.equal(outcome(forced), 'success');
  w = go(play(forced.world, { type: 'open', direction: 'north' }).world, 'north').world;
  assert.equal(where(w, w.body), room(w, 'mill'));
});

// Breaks: Tam's schedule hours are wrong, the rumour writes the wrong subject, Nell's rumour
// dialogue opens before she knows, or the press check (level 2 >= 2) or its topic is wrong.
test('social 8: Tam sees the fire at 10:00 and tells Nell at 11:00; press grants "The fire"', () => {
  w = wait(w, AT_SEVEN + 3 * HOUR).world;
  assert.equal(where(w, npc(w, 'tam')), room(w, 'mill'));
  assert.deepEqual(
    [fact(w, 'knows_fire', npc(w, 'tam')), fact(w, 'knows_fire', npc(w, 'nell'))],
    [true, undefined],
  );
  w = go(w, 'down').world;
  assert.equal(talk(w, 'nell').opened, 'nell_talk');
  w = wait(w, AT_SEVEN + 4 * HOUR).world;
  assert.equal(where(w, npc(w, 'tam')), room(w, 'village_green'));
  assert.equal(fact(w, 'knows_fire', npc(w, 'nell')), true);
  const t = talk(w, 'nell');
  assert.equal(t.opened, 'nell_rumour');
  const pressed = choose(t.world, 'press');
  assert.equal(outcome(pressed), 'press');
  w = pressed.world;
  assert.deepEqual(topics(w), ['topic.fire', 'topic.mill']);
  assert.equal(talk(w, 'nell').opened, 'nell_talk');
});

// Breaks: the schedule case ignores the sky (Tam reaches the green in rain), its goal is not
// narrated in the room he leaves, or the rumour reaches Nell without Tam on the green.
test('social 8, rain: at 11:00 Tam makes for the church; Nell learns nothing', () => {
  let x = go(green(WET), 'up').world;
  x = wait(x, AT_SEVEN + 3 * HOUR).world;
  const r = wait(x, AT_SEVEN + 4 * HOUR);
  assert.ok(r.lines.includes('npc.tam.goal_church'), JSON.stringify(r.lines));
  x = r.world;
  assert.deepEqual(
    [
      where(x, npc(x, 'tam')),
      fact(x, 'knows_fire', npc(x, 'tam')),
      fact(x, 'knows_fire', npc(x, 'nell')),
    ],
    [room(x, 'church'), true, undefined],
  );
  assert.equal(talk(go(x, 'down').world, 'nell').opened, 'nell_talk');
});

// Breaks: the badge needs fewer than the five rooms or is granted again by Tam's later entries,
// the roll grants no topic, the deduction is offered before both topics or after its own.
test('social 9: the church makes five rooms (Wardle walker); the roll and the lectern give "The heir"', () => {
  w = go(w, 'west').world;
  assert.ok(topics(w).includes('topic.walker'), JSON.stringify(topics(w)));
  w = take(w, 'parish_roll');
  w = play(w, { type: 'read', target_id: id(w, 'item', 'parish_roll') }).world;
  assert.deepEqual(
    gameView(w).deductions?.map((d) => [d.action, d.from]),
    [
      ['think_hall_lectern', ['topic.parish', 'topic.fire']],
      ['think_lectern', ['topic.parish', 'topic.fire']],
    ],
  );
  // The hall twin's card shows here too, but its lectern is in the moot hall (toolbox row 46 view;
  // Beads loka-kgd.64).
  assert.equal(refused(w, { type: 'perform', action: 'think_hall_lectern' }), 'not_present');
  w = perform(w, 'think_lectern').world;
  assert.deepEqual(topics(w), [
    'topic.fire',
    'topic.heir',
    'topic.mill',
    'topic.parish',
    'topic.walker',
  ]);
  assert.equal(gameView(w).deductions, undefined);
  // Tam's next entries into the five rooms leave one badge row.
  const later = wait(w, 24 * HOUR + AT_SEVEN + 5 * HOUR).world;
  const rows = Object.keys(later.state.facts ?? {}).filter((k) =>
    k.includes('"topic_walker_known"'),
  );
  assert.equal(rows.length, 1);
});

let letter: World;
let atWat: World;

// Breaks: the deadline counts from the take not the accept, a hint fires early or for the wrong
// stage, or the take does not complete the post-activation objective. The accept is pinned at
// 07:00 on day 1 (frost) so the run north at 19:30 is still day 1 (day 2 is rain: soaked, not chilled).
test('social 10: accept at 07:00, the stone hint at +5 min, the take, then two road hints', () => {
  letter = say(green(), 'reeve', 'accept').world;
  assert.equal(letter.state.clock, AT_SEVEN);
  assert.deepEqual(
    [quest(letter).state, quest(letter).remaining, quest(letter).hint],
    ['active', 60000, undefined],
  );
  letter = wait(letter, AT_SEVEN + 15000).world;
  assert.equal(quest(letter).hint, 'quest.carry_letter.hint_stone');
  letter = take(letter, 'letter');
  assert.deepEqual(
    [quest(letter).state, quest(letter).journal, quest(letter).remaining, quest(letter).hint],
    ['objectives_complete', 'quest.carry_letter.objectives_met', 45000, undefined],
  );
  letter = wait(letter, AT_SEVEN + 30000).world;
  assert.equal(quest(letter).hint, 'quest.carry_letter.hint_road');
  letter = wait(letter, AT_SEVEN + 45000).world;
  assert.equal(quest(letter).hint, 'quest.carry_letter.hint_hut');
});

// Breaks: the deadline stops or resets while a status ticks, or the frost exposure misses the
// letter run.
test('social 11: on the frost fell at 19:30 the chill ticks at 21:30 while 7800 remain', () => {
  let x = go(go(go(letter, 'north').world, 'north').world, 'north').world;
  assert.ok(labels(x).includes('condition.chilled'));
  assert.equal(quest(x).remaining, 15000);
  x = wait(x, 21 * HOUR + 1800).world;
  assert.deepEqual([pool(x, 'hp'), quest(x).remaining], [9, 7800]);
  assert.ok(labels(x).includes('condition.chilled'));
  atWat = go(x, 'east').world;
});

// Breaks: the choice does not resolve the quest with its id, the story point or its scene is not
// reached, the scene-end reaction misses or adjusts the wrong amount, or burn hands the letter over.
test('social 12: deliver resolves the quest, plays letter_read and raises standing; burn the reverse', () => {
  const t = talk(atWat, 'wat');
  assert.equal(t.opened, 'wat_letter');
  for (const [choice, scene, standing, held] of [
    ['deliver', 'letter_read', 1, true],
    ['burn', 'letter_ash', -2, false],
  ] as const) {
    let x = choose(t.world, choice).world;
    assert.deepEqual(
      [quest(x).state, quest(x).journal, where(x, id(x, 'item', 'letter')) === npc(x, 'wat')],
      ['resolved', `quest.carry_letter.${choice}`, held],
    );
    assert.equal(gameView(x).scene?.scene.key, scene);
    while (gameView(x).scene) {
      const s = gameView(x).scene!;
      x = play(x, { type: 'continue', scene: s.scene, line: s.index }).world;
    }
    assert.equal(fact(x, 'wardle_standing'), standing);
  }
});

// Breaks: the deadline never fires or names another outcome, or its reaction misses a write.
test('social 13: unfinished at +60000 the letter is late: the Reeve turns cold, standing -1', () => {
  const r = wait(say(green(), 'reeve', 'accept').world, AT_SEVEN + 60000);
  const x = r.world;
  assert.deepEqual(
    [
      quest(x).state,
      quest(x).journal,
      quest(x).remaining,
      fact(x, 'letter_late'),
      fact(x, 'wardle_standing'),
    ],
    ['failed', 'quest.carry_letter.late', undefined, true, -1],
  );
  assert.equal(
    describeEntity(x, x.character, npc(x, 'reeve'), 'description'),
    'npc.reeve.description_cold',
  );
});

// Breaks: the recap threshold is not authored (no recap_after), or a long absence loses the
// deadline's writes. The recap block itself is Book-side: mobile/app/book/showcase_recap.test.ts.
test('social 14: the manifest sets a 30 real minute recap; 150 game hours away the letter is late', () => {
  const x = wait(say(green(), 'reeve', 'accept').world, AT_SEVEN + 150 * HOUR).world;
  assert.equal(gameView(x).recap_after, 90000);
  assert.deepEqual([fact(x, 'letter_late'), fact(x, 'wardle_standing')], [true, -1]);
});

// Breaks: the sandbox twins lose their wiring: Bess ignores the standing, boast fails, lean
// passes once practice tops out (level 2 < 3), the hall box or cupboard ignores its fact, or the hall roll grants no topic.
test('moot hall: the sandbox has every Low Wardle mechanic behind one door', () => {
  let x = go(green(), 'south').world;
  assert.equal(bread(x, 'bess').buy.price, 4);
  x = say(x, 'bess', 'praise').world;
  assert.equal(bread(x, 'bess').buy.price, 2);
  const boast = say(x, 'bess', 'boast');
  assert.equal(outcome(boast), 'boast');
  x = boast.world;
  for (let i = 0; i < 3; i++) {
    const lean = say(x, 'bess', 'lean');
    assert.equal(outcome(lean), 'check_failed');
    x = lean.world;
  }
  x = leave(say(x, 'bess', 'insult').world);
  assert.deepEqual([fact(x, 'wardle_standing'), mood(x, 'bess')], [-1, 'wary']);
  const box = { type: 'open', target_id: id(x, 'item', 'hall_strongbox') };
  assert.equal(refused(x, box), 'invalid_state');
  x = perform(perform(x, 'pick_hall_strongbox').world, 'pick_hall_strongbox').world;
  assert.equal(outcome(play(x, box)), 'opened');
  x = perform(x, 'force_hall_cupboard').world;
  x = go(play(x, { type: 'open', direction: 'east' }).world, 'east').world;
  assert.equal(where(x, x.body), room(x, 'hall_closet'));
  x = go(x, 'west').world;
  x = play(take(x, 'hall_roll'), { type: 'read', target_id: id(x, 'item', 'hall_roll') }).world;
  assert.deepEqual(topics(x), ['topic.parish']);
});

// Cause and effect (docs/showcase/cause-and-effect.md, steps 15 to 21): ECHO's days 2 and 3 are
// clear, so Tam reaches the green at 11:00.
const ECHO = '5ca5e000-0000-4000-8000-000000000330';
const DAY = 24 * HOUR;
/** Active word_travels rows as [holder, ends_at]. */
const statuses = (w: World) =>
  Object.entries(w.state.statuses ?? {})
    .map(([k, r]) => [decode(k) as { body_id: string; status: { key: string } }, r] as const)
    .filter(([k, r]) => r.active && k.status.key === 'word_travels')
    .map(([k, r]) => [k.body_id, r.active && r.ends_at]);
const offered = (w: World, action: string) =>
  gameView(w).actions.find((a) => a.action_key === action)?.available;
const looks = (w: World, who: string) =>
  (['room_line', 'description'] as const).map((f) =>
    describeEntity(w, w.character, npc(w, who), f),
  );
const entered = (r: ReturnType<typeof wait>, who: string) =>
  r.events.some((e) => e.type === 'entity_entered_room' && e.entity_id === npc(r.world, who));
/** 08:00 day 1 in the tollhouse: standing 1 after help, the toll gate leaned open. */
function tollhouse() {
  let x = leave(say(green(ECHO), 'reeve', 'help').world);
  x = say(say(go(x, 'east').world, 'warden', 'lean').world, 'warden', 'lean').world;
  return wait(go(play(x, { type: 'open', direction: 'east' }).world, 'east').world, 8 * HOUR).world;
}
let box: World;

// Breaks: the force check or its policy is wrong, the lid ignores the forced fact, the pick stays
// offered, the fuse lands on the wrong holder or with the wrong end, or the fuse says something.
test('social 15: forced at 08:00 the box opens and carries word_travels to 08:00 day 2, silently', () => {
  const forced = perform(tollhouse(), 'force_strongbox');
  assert.deepEqual(
    [outcome(forced), forced.lines],
    ['success', ['narration.force_strongbox.success']],
  );
  let x = forced.world;
  assert.deepEqual(statuses(x), [[id(x, 'item', 'strongbox'), 8 * HOUR + DAY]]);
  assert.deepEqual(
    [fact(x, 'strongbox_forced'), offered(x, 'pick_strongbox'), labels(x), fact(x, 'warden_knows')],
    [true, false, [], undefined],
  );
  assert.deepEqual(looks(x, 'warden'), ['npc.warden.room', 'npc.warden.description']);
  x = take(play(x, { type: 'open', target_id: id(x, 'item', 'strongbox') }).world, 'mill_ledger');
  x = play(perform(x, 'force_tollhouse_door').world, { type: 'open', direction: 'north' }).world;
  box = go(go(x, 'north').world, 'down').world;
  assert.equal(where(box, box.body), room(box, 'village_green'));
});

// Breaks: the pick lights the fuse too, the force stays offered after a pick, or the Warden learns
// or walks without the fuse.
test('social 16: picked, the box carries nothing; at 14:30 day 2 the Warden is at his gate, unknowing', () => {
  let x = perform(perform(tollhouse(), 'pick_strongbox').world, 'pick_strongbox').world;
  assert.deepEqual([statuses(x), offered(x, 'force_strongbox')], [[], false]);
  x = wait(go(go(x, 'west').world, 'west').world, DAY + 14 * HOUR + 1800).world;
  assert.deepEqual(
    [fact(x, 'warden_knows'), where(x, npc(x, 'warden')), looks(x, 'warden')[0]],
    [undefined, room(x, 'warden_gate'), 'npc.warden.room'],
  );
});

let dawn: World;
let noon: World;

// Breaks: the expiry reaction misses or speaks, the 13:00 case ignores warden_knows or engages on
// his own entry, he does not go back at 14:00, or his hostility ignores warden_knows.
test('social 17: at 08:00 day 2 the Warden knows; 13:00 he walks the green; 14:30 he engages at the gate', () => {
  const night = wait(box, DAY + 8 * HOUR - 1);
  let x = night.world;
  // The fuse's tick (one unit before its end) speaks no more than its expiry.
  assert.deepEqual(
    [fact(x, 'warden_knows'), night.lines.filter((l) => l.includes('word_travels'))],
    [undefined, []],
  );
  const out = wait(x, DAY + 8 * HOUR);
  assert.deepEqual(
    [fact(out.world, 'warden_knows'), out.lines, statuses(out.world)],
    [true, [], []],
  );
  dawn = out.world;
  const walk = wait(wait(dawn, DAY + 13 * HOUR - 1).world, DAY + 13 * HOUR);
  noon = walk.world;
  assert.ok(entered(walk, 'warden'), JSON.stringify(walk.events));
  assert.deepEqual(
    [where(noon, npc(noon, 'warden')), engaged(noon, noon.body), looks(noon, 'warden')],
    [
      room(noon, 'village_green'),
      undefined,
      ['npc.warden.room_watchful', 'npc.warden.description_watchful'],
    ],
  );
  x = wait(noon, DAY + 14 * HOUR).world;
  assert.equal(where(x, npc(x, 'warden')), room(x, 'warden_gate'));
  const east = go(wait(x, DAY + 14 * HOUR + 1800).world, 'east');
  assert.equal(engaged(east.world, east.world.body)?.row.npc_id, npc(x, 'warden'));
  assert.ok(east.lines.includes('npc.warden.engage'), JSON.stringify(east.lines));
});

// Breaks: the gate stays guarded while he walks, the ledger gift raises no trust or the wrong row,
// the look forgets once he is mended, or walking onto the green past 13:00 meets no one.
test('social 18: from 13:00 day 2: the empty gate, the ledger mend, and the green as a meeting', () => {
  let a = go(noon, 'east').world;
  assert.equal(where(a, npc(a, 'warden')), room(a, 'village_green'));
  a = go(a, 'east').world;
  assert.deepEqual([where(a, a.body), engaged(a, a.body)], [room(a, 'tollhouse'), undefined]);
  a = wait(a, DAY + 14 * HOUR).world;
  assert.deepEqual(
    [where(a, npc(a, 'warden')), engaged(a, a.body)],
    [room(a, 'warden_gate'), undefined],
  );
  let b = play(noon, {
    type: 'give',
    item_id: id(noon, 'item', 'mill_ledger'),
    recipient_id: npc(noon, 'warden'),
  }).world;
  assert.deepEqual([fact(b, 'trust', npc(b, 'warden')), mood(b, 'warden')], [1, 'wary']);
  b = go(wait(b, DAY + 14 * HOUR + 1800).world, 'east').world;
  assert.deepEqual(
    [engaged(b, b.body), looks(b, 'warden')[0]],
    [undefined, 'npc.warden.room_watchful'],
  );
  const c = go(wait(go(dawn, 'north').world, DAY + 13 * HOUR + 1800).world, 'south');
  assert.equal(engaged(c.world, c.world.body)?.row.npc_id, npc(c.world, 'warden'));
  assert.ok(c.lines.includes('npc.warden.engage'), JSON.stringify(c.lines));
  const fled = play(c.world, { type: 'flee' }).world;
  assert.notEqual(where(fled, fled.body), room(fled, 'village_green'));
  assert.equal(engaged(fled, fled.body), undefined);
});

/** 09:00 day 1 in Wat's hut with the letter (standing 1 after help); `x` is a world on the green. */
function hut(x = green(ECHO)) {
  x = say(say(x, 'reeve', 'help').world, 'reeve', 'accept').world;
  x = wait(take(x, 'letter'), 9 * HOUR).world;
  return go(go(go(go(x, 'north').world, 'north').world, 'north').world, 'east').world;
}
/** Wat's `choice` for the letter, its scene played to the end. */
function fate(w: World, choice: 'deliver' | 'burn') {
  let x = choose(talk(w, 'wat').world, choice).world;
  while (gameView(x).scene) {
    const s = gameView(x).scene!;
    x = play(x, { type: 'continue', scene: s.scene, line: s.index }).world;
  }
  return x;
}
const knows = (w: World) => ['wat', 'tam', 'nell'].map((k) => fact(w, 'knows_ash', npc(w, k)));
const u = undefined;

// Breaks: the burn writes no letter_burnt, Wat's variant loses to chilled, a hop fires early, late or
// on the wrong subject, Wat's 14:00 case ignores the fact, nell_ash sorts after nell_rumour, the
// press check is wrong, or the deduction reads the wrong topics or grants twice.
test('social 19: burnt at 09:00: Wat at the gate, Tam, Nell; press grants "The surety"; the church "What the letter carried"', () => {
  let x = fate(hut(), 'burn');
  assert.deepEqual(
    [fact(x, 'wardle_standing'), fact(x, 'letter_burnt'), looks(x, 'wat'), knows(x)],
    [-1, true, ['npc.wat.room_ash', 'npc.wat.description_ash'], [u, u, u]],
  );
  const steps = [
    [14 * HOUR, [u, u, u], [true, u, u]],
    [15 * HOUR, [true, u, u], [true, true, u]],
    [DAY + 11 * HOUR, [true, true, u], [true, true, true]],
  ] as const;
  for (const [at, before, after] of steps) {
    x = wait(x, at - 1).world;
    assert.deepEqual(knows(x), before);
    const r = wait(x, at);
    x = r.world;
    assert.deepEqual(knows(x), after);
    if (at === 14 * HOUR) {
      assert.ok(r.lines.includes('npc.wat.goal_gate'), JSON.stringify(r.lines));
      assert.equal(where(x, npc(x, 'wat')), room(x, 'warden_gate'));
      x = go(go(go(go(x, 'west').world, 'south').world, 'south').world, 'south').world;
    }
  }
  assert.equal(where(x, npc(x, 'wat')), room(x, 'shepherd_hut'));
  x = wait(x, DAY + 11 * HOUR + 1800).world;
  for (const result of ['check_failed', 'check_failed', 'press']) {
    const t = talk(x, 'nell');
    assert.equal(t.opened, 'nell_ash');
    const pressed = choose(t.world, 'press');
    assert.equal(outcome(pressed), result);
    x = pressed.world;
  }
  assert.deepEqual([topics(x), talk(x, 'nell').opened], [['topic.surety'], 'nell_rumour']);
  x = go(x, 'west').world;
  x = play(take(x, 'parish_roll'), { type: 'read', target_id: id(x, 'item', 'parish_roll') }).world;
  assert.deepEqual(
    gameView(x).deductions?.map((d) => [d.action, d.from]),
    [['think_letter', ['topic.parish', 'topic.surety']]],
  );
  x = perform(x, 'think_letter').world;
  assert.ok(topics(x).includes('topic.letter'), JSON.stringify(topics(x)));
  assert.equal(refused(x, { type: 'perform', action: 'think_letter' }), 'invalid_state');
});

// Breaks: the delivered letter echoes: Wat walks, a hop fires, or Nell gets the surety.
test('social 20: delivered: Wat stays home, nobody hears, Nell has only the fire', () => {
  let x = fate(hut(), 'deliver');
  assert.deepEqual([fact(x, 'letter_burnt'), fact(x, 'wardle_standing')], [u, 2]);
  const r = wait(x, 16 * HOUR);
  assert.deepEqual(
    [entered(r, 'wat'), where(r.world, npc(x, 'wat'))],
    [false, room(x, 'shepherd_hut')],
  );
  x = go(go(go(go(r.world, 'west').world, 'south').world, 'south').world, 'south').world;
  x = wait(x, DAY + 11 * HOUR + 1800).world;
  assert.deepEqual([knows(x), talk(x, 'nell').opened], [[u, u, u], 'nell_rumour']);
});

// Breaks: an away settlement over the recap threshold drops or adds green arrivals: Tam's, the
// Warden's walk, or Wat's visit to the gate showing on the green. The Book's block is
// mobile/app/book/showcase_recap.test.ts.
test('social 21: forced and burnt, 90000 units away: the green log carries Tam, the Warden and the chill', () => {
  const x = go(
    go(go(go(fate(hut(box), 'burn'), 'west').world, 'south').world, 'south').world,
    'south',
  ).world;
  const r = wait(x, DAY + 14 * HOUR + 1800);
  assert.ok(r.world.state.clock - x.state.clock > 90000);
  const key = (room_id: unknown) =>
    Object.entries(r.world.roomIds)
      .find(([, v]) => v === room_id)?.[0]
      .split('/')[1];
  const who = new Map(['tam', 'warden', 'wat'].map((k) => [npc(x, k) as unknown, k]));
  const moves = r.events
    .filter((e) => e.type === 'entity_entered_room' && who.has(e.entity_id))
    .map((e) => `${who.get(e.entity_id)} ${key(e.room_id)}`);
  // On the green: Tam in (11:00 day 1), out (to the gate, 15:00), in (11:00 day 2); the Warden in
  // (13:00 day 2) and out (14:00). Wat never enters it.
  assert.deepEqual(moves, [
    'tam mill',
    'tam village_green',
    'wat warden_gate',
    'tam warden_gate',
    'wat shepherd_hut',
    'wat fell_top',
    'wat shepherd_hut',
    'tam mill',
    'tam village_green',
    'warden village_green',
    'warden warden_gate',
    'wat warden_gate',
  ]);
  assert.deepEqual(
    r.lines.filter((l) => l.startsWith('narration.chilled')),
    ['narration.chilled.tick', 'narration.chilled.expired'],
  );
});
