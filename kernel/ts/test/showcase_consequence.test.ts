import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView } from '../src/index.ts';
import type { World } from '../src/runtime/decision.ts';
import { decode } from '../src/foundation/canonical.ts';
import { engaged } from '../src/mechanics/combat/shared.ts';
import { describeEntity } from '../src/mechanics/description_variant/rule.ts';
import {
  choose,
  DAY,
  fact,
  go,
  green,
  HOUR,
  id,
  labels,
  leave,
  mood,
  npc,
  outcome,
  perform,
  play,
  refused,
  room,
  say,
  take,
  talk,
  topics,
  wait,
  where,
} from './showcase_fixture.ts';

// Cause and effect (docs/showcase/cause-and-effect.md, steps 15 to 21): ECHO's days 2 and 3 are
// clear, so Tam reaches the green at 11:00. Weather oracle as in showcase_social.test.ts: for d in
// 1..3, ECHO 2, 0, 1 (frost, clear, clear).
const ECHO = '5ca5e000-0000-4000-8000-000000000330';
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
  // (13:00 day 2) and out (14:00). Wat never enters it. The Warden's walk out and Wat's visit both
  // fall due at 14:00 day 2; the spec orders neither (the job-id tie-break), so they are a set.
  const ordered = [
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
  ];
  const at14 = ['warden warden_gate', 'wat warden_gate'];
  assert.deepEqual([moves.slice(0, -2), moves.slice(-2).sort()], [ordered, at14]);
  assert.deepEqual(
    r.lines.filter((l) => l.startsWith('narration.chilled')),
    ['narration.chilled.tick', 'narration.chilled.expired'],
  );
});
