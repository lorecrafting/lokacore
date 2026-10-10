// The showcase hub and body district walked step by step (docs/showcase/hub-and-first-districts.md,
// "Hub" and "Guided loop and expected outcomes" of the Fell Road). Each test continues the world
// the one before it left, so a step's expected outcome is checked in the plan's order.
// Weather oracle, independent of the kernel: for d in 1..3 the first 4 bytes of
// `printf 'weather:<BODY>:<d>' | shasum -a 256`, big-endian, mod 7 (clear 2, frost, rain, gale,
// heat, drought): 2, 3, 6, so days 1 to 3 are frost, rain and drought.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView } from '../src/index.ts';
import type { World } from '../src/runtime/decision.ts';
import { describeEntity } from '../src/mechanics/description_variant/rule.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import {
  attribute,
  DAY,
  fresh,
  go,
  HOUR,
  id,
  labels,
  play,
  perform,
  pool,
  ref,
  refused,
  detail,
  take,
  wait,
} from './showcase_fixture.ts';

const BODY = '5ca5e000-0000-4000-8000-000000000241';
const AT_SEVEN = 7 * HOUR;
const wear = (w: World, item: string) =>
  play(take(w, item), { type: 'wear', item_id: id(w, 'item', item) }).world;
const place = (w: World) => gameView(w).place.description.key;
const shown = (w: World, npc: string) =>
  gameView(w).entities.find((e) => e.id === id(w, 'npc', npc));
const hpOf = (w: World, npc: string) => level(w, id(w, 'npc', npc), resourceRef(w, 'hp'));
const where = (w: World, npc: string) => w.state.containers[id(w, 'npc', npc)];

// Breaks: the entry room, a pool's start, an attribute's start, an exit or the in-place sign is wrong; Hob's asleep
// variant reads the wrong hours.
test('hub: a new character starts in the inn at 07:00 day 1 with the planned pools', () => {
  const w = fresh(BODY);
  assert.equal(w.state.clock, AT_SEVEN);
  assert.equal(w.state.containers[w.body], w.roomIds[ref('room', 'crossroads_inn')]);
  const pools = ['hp', 'hunger', 'thirst', 'pennies'].map((k) => pool(w, k));
  assert.deepEqual(pools, [10, 10, 10, 10]);
  assert.deepEqual(
    ['str', 'dex', 'cha'].map((k) => attribute(w, k)),
    [10, 10, 6],
  );
  assert.deepEqual(
    gameView(w)
      .exits.map((e) => e.direction)
      .sort(),
    ['east', 'north'],
  );
  const sign = play(w, { type: 'read', target_id: detail(w, 'sign_hub') });
  assert.deepEqual(sign.lines, ['readable.sign_hub']);
  assert.equal(shown(w, 'hob')?.name, 'npc.hob.short');
  assert.equal(shown(wait(w, DAY + HOUR).world, 'hob')?.name, 'npc.hob.short_asleep');
});

let w: World;
let atGate: World;

// Breaks: the sign grants a topic or reads other text.
test('body 1: the Fell Road signpost reads its text and grants no topic', () => {
  atGate = go(fresh(BODY), 'north').world;
  const r = play(atGate, { type: 'read', target_id: detail(atGate, 'sign_body') });
  assert.ok(r.lines.includes('readable.sign_body'), JSON.stringify(r.lines));
  assert.equal(gameView(r.world).topics, undefined);
});

// Breaks: the frost rule or the needs rule is missing or reads the wrong weather or room.
test('body 2: the bare fell on a frost day chills, starves and parches in one receipt', () => {
  const r = go(atGate, 'north');
  for (const k of ['chilled', 'hungry', 'thirsty'])
    assert.ok(r.lines.includes(`narration.${k}.applied`), JSON.stringify(r.lines));
  assert.deepEqual(labels(r.world), ['condition.chilled', 'condition.hungry', 'condition.thirsty']);
  assert.equal(place(r.world), 'room.fell_top.frost');
  w = r.world;
});

// Breaks: the hourly refresh repeats the applied line, a tick lands at the wrong time or the
// needs tick at the wrong rate.
test('body 3: two hours on the fell: one chill tick, two need ticks, a silent refresh', () => {
  const r = wait(w, 9 * HOUR);
  assert.deepEqual(
    [pool(r.world, 'hp'), pool(r.world, 'hunger'), pool(r.world, 'thirst')],
    [9, 8, 8],
  );
  assert.ok(!r.lines.includes('narration.chilled.applied'), JSON.stringify(r.lines));
  w = r.world;
  // Wat arrived at 08:00 with the bare player on the moor: only his own frost rule's chill, none
  // of the player's needs or other drains (his `immune` list).
  const wat = id(w, 'npc', 'wat');
  const his = Object.entries(w.state.statuses ?? {}).filter(
    ([k, r]) => r.active && k.includes(wat),
  );
  assert.deepEqual(
    his.map(([k]) => JSON.parse(k).status.key),
    ['chilled'],
  );
});

// Breaks: shelter keeps refreshing, or the refresh moved more than ends_at (row 1): the 09:00
// refresh ends it at 32400 + 9000 = 41400 (11:30); the 11:00 tick (25200 + 2 x 7200) puts hp at 8.
test('body 4: under the roof the chill ticks once more at 11:00 and expires at 11:30', () => {
  w = go(w, 'south').world;
  w = wait(w, 11 * HOUR).world;
  assert.equal(pool(w, 'hp'), 8);
  assert.ok(labels(w).includes('condition.chilled'));
  const r = wait(w, 11 * HOUR + 1800);
  assert.ok(r.lines.includes('narration.chilled.expired'), JSON.stringify(r.lines));
  assert.ok(!labels(r.world).includes('condition.chilled'));
  w = r.world;
});

// Breaks: the `not wearing warm` leaf is missing or reads carried items.
test('body 5: a worn cloak keeps the frost out; the frost variant still shows', () => {
  const r = go(wear(w, 'cloak'), 'north');
  assert.ok(!r.lines.includes('narration.chilled.applied'), JSON.stringify(r.lines));
  assert.ok(!labels(r.world).includes('condition.chilled'));
  assert.equal(place(r.world), 'room.fell_top.frost');
  w = r.world;
});

// Breaks: the rain rule reads the wrong garment tag or the wrong weather.
test('body 6: on a rain day the cloak lets the rain in; the oilskin keeps it out', () => {
  const rainy = wear(wait(atGate, DAY + AT_SEVEN).world, 'cloak');
  assert.ok(labels(go(rainy, 'north').world).includes('condition.soaked'));
  const dry = go(wear(rainy, 'oilskin'), 'north').world;
  assert.ok(!labels(dry).includes('condition.soaked'));
  assert.equal(place(dry), 'room.fell_top.rain');
});

// Breaks: Wat's frost rule is missing or does not reach the entrant NPC (row G3, W3 filter); his
// variants read the wrong status; his schedule hours are wrong. Chilled at 28800: a tick at
// 36000 (hp 9), the end at 37800 (10:30). The cloak keeps the player's own frost rule off him.
test('body 7: Wat arrives at 08:00, is chilled, leaves at 09:00, ticks at 10:00, recovers at 10:30', () => {
  let x = go(wear(atGate, 'cloak'), 'north').world;
  const arrival = wait(x, 8 * HOUR);
  assert.ok(!arrival.lines.includes('narration.chilled.applied'), JSON.stringify(arrival.lines));
  x = arrival.world;
  assert.equal(where(x, 'wat'), x.roomIds[ref('room', 'fell_top')]);
  const line = (v: World) => describeEntity(v, v.character, id(v, 'npc', 'wat'), 'room_line');
  assert.equal(line(x), 'npc.wat.room_chilled');
  assert.equal(shown(x, 'wat')?.description, 'npc.wat.description_chilled');
  x = wait(x, 9 * HOUR).world;
  assert.equal(where(x, 'wat'), x.roomIds[ref('room', 'shepherd_hut')]);
  x = wait(x, 10 * HOUR).world;
  assert.equal(hpOf(x, 'wat'), 9);
  assert.equal(line(x), 'npc.wat.room_chilled');
  x = wait(x, 10 * HOUR + 1800).world;
  assert.equal(line(x), 'npc.wat.room');
});

// Breaks: bread or water ends the wrong status, or bread feeds the hunger pool instead of mv.
test('body 8: in the hut bread ends hungry and water ends thirsty', () => {
  w = go(w, 'east').world;
  const [hunger, mv] = [pool(w, 'hunger'), pool(w, 'mv')];
  w = play(take(w, 'hut_loaf'), { type: 'eat', item_id: id(w, 'item', 'hut_loaf') }).world;
  assert.deepEqual([pool(w, 'hunger'), pool(w, 'mv')], [hunger, Math.min(100, mv! + 5)]);
  assert.deepEqual(labels(w), ['condition.thirsty']);
  w = play(take(w, 'trough_skin'), {
    type: 'drink',
    vessel_id: id(w, 'item', 'trough_skin'),
  }).world;
  assert.deepEqual(labels(w), []);
  w = play(w, { type: 'drop', item_id: id(w, 'item', 'trough_skin') }).world;
});

// Breaks: world.carry or the derived carry table is missing, or might does not raise str (the
// quern weighs 7000; the worn cloak 500 and the held cask 100 + 2 doses x 50 count).
test('body 9-10: the quern is too heavy until the draught; a second dose never stacks', () => {
  w = go(go(w, 'west').world, 'west').world;
  assert.equal(refused(w, { type: 'take', item_id: id(w, 'item', 'quern') }), 'too_heavy');
  const drink = (v: World) => play(v, { type: 'drink', vessel_id: id(v, 'item', 'cask') });
  const r = drink(take(w, 'cask'));
  assert.ok(r.lines.includes('narration.might.applied'), JSON.stringify(r.lines));
  assert.equal(attribute(r.world, 'str'), 13);
  w = take(r.world, 'quern');
  const ends = (v: World) =>
    gameView(v).conditions!.find((c) => c.label === 'condition.might')!.ends_at;
  const before = ends(w);
  w = wait(w, w.state.clock + 60).world;
  w = drink(w).world;
  assert.deepEqual([attribute(w, 'str'), ends(w)], [13, before + 60]);
});

// Breaks: the opposed check reads no rating, or dex 10 passes a rating of 11.
test('body 11: the knucklebones beat dex 10', () => {
  w = play(w, { type: 'drop', item_id: id(w, 'item', 'quern') }).world;
  assert.ok(perform(w, 'throw_bones').lines.includes('narration.throw_bones.failure'));
});

// Breaks: the song misses the performer or Orla, the tip repeats, or inspired lasts the wrong span.
test('body 12: a song inspires the player and Orla, dex 12 wins the throw; both fade at 1800', () => {
  w = take(w, 'lute');
  const song = perform(w, 'play_song');
  assert.deepEqual(song.lines, [
    'narration.play_song',
    'tip.play_song',
    'narration.inspired.applied',
  ]);
  w = song.world;
  assert.ok(labels(w).includes('condition.inspired'));
  assert.equal(shown(w, 'orla')?.description, 'npc.orla.description_inspired');
  assert.equal(attribute(w, 'dex'), 12);
  const again = perform(w, 'throw_bones');
  assert.ok(again.lines.includes('narration.throw_bones.success'), JSON.stringify(again.lines));
  assert.ok(!perform(again.world, 'play_song').lines.includes('tip.play_song'));
  w = wait(again.world, w.state.clock + 1800).world;
  assert.ok(!labels(w).includes('condition.inspired'));
  assert.deepEqual(
    [attribute(w, 'dex'), shown(w, 'orla')?.description],
    [10, 'npc.orla.description'],
  );
});

// Breaks: the dry rule is missing, water does not cure parched, or clock_hour skips the dry rule.
test('body 13: a drought day parches on the fell; a drink ends it; the next hour brings it back', () => {
  let x = wait(wait(atGate, DAY + AT_SEVEN).world, 2 * DAY + AT_SEVEN).world;
  x = go(x, 'north').world;
  assert.ok(labels(x).includes('condition.parched'));
  x = take(go(x, 'east').world, 'trough_skin');
  x = go(x, 'west').world;
  x = play(x, { type: 'drink', vessel_id: id(x, 'item', 'trough_skin') }).world;
  assert.ok(!labels(x).includes('condition.parched'));
  x = wait(x, 2 * DAY + 8 * HOUR).world;
  assert.ok(labels(x).includes('condition.parched'));
});

// Breaks: a sandbox entry rule is missing or the Drover's opposed check reads the wrong NPC.
test('sandbox: the fold chills on a frost day; the Drover moves only under might', () => {
  let x = go(atGate, 'east').world;
  assert.ok(labels(x).includes('condition.chilled'));
  assert.ok(perform(x, 'shove_drover').lines.includes('narration.shove_drover.failure'));
  x = play(take(x, 'fold_cask'), { type: 'drink', vessel_id: id(x, 'item', 'fold_cask') }).world;
  assert.ok(perform(x, 'shove_drover').lines.includes('narration.shove_drover.success'));
});
