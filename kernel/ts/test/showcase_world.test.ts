// The showcase world district (Tidewater Steps) walked step by step
// (docs/showcase/hub-and-first-districts.md, "World district", guided loop). Each test continues
// the world the one before it left. Weather oracle, independent of the kernel: for d in 1..4 the
// first 4 bytes of `printf 'weather:<WORLD>:<d>' | shasum -a 256`, big-endian, mod 7 (clear 2,
// frost, rain, gale, heat, drought): 1, 1, 0, 0, so days 1 to 4 are clear and no weather drain or
// variant touches the outcomes. Tide: high from 21600 to 43200 of each 43200; lunar: full from
// 172800 (day 3, 00:00) of each 345600; season: winter from 259200 (day 4).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView } from '../src/index.ts';
import { describe } from '../src/mechanics/description_variant/rule.ts';
import type { World } from '../src/runtime/decision.ts';
import {
  act,
  DAY,
  fresh,
  go,
  HOUR,
  id,
  perform,
  play,
  pool,
  ref,
  refused,
  detail,
  take,
  wait,
} from './showcase_fixture.ts';

const WORLD = '5ca5e000-0000-4000-8000-000000000268';
const place = (w: World) => gameView(w).place.description.key;
const here = (w: World) => w.state.containers[w.body];
const exits = (w: World) =>
  gameView(w)
    .exits.map((e) => e.direction)
    .sort();
const offersOpen = (w: World, direction: string) =>
  !!gameView(w)
    .exits.find((e) => e.direction === direction)
    ?.door?.actions.some((a) => a.available && a.action_key === 'open');

let w: World;

// Breaks: the sign reads other text, the narration key has no alternates, or the visit counter
// misses a re-entry.
test('world 1: the signpost reads; twelve looks show all three lines; a second visit', () => {
  w = go(fresh(WORLD), 'east').world;
  const read = play(w, { type: 'read', target_id: detail(w, 'sign_world') });
  assert.deepEqual(read.lines, ['readable.sign_world']);
  const seen = new Set<string>();
  for (let i = 0; i < 12; i += 1) {
    const r = perform(w, 'look_about');
    r.lines.forEach((l) => seen.add(l));
    w = r.world;
  }
  const looks = ['narration.look_about', 'narration.look_about_b', 'narration.look_about_c'];
  assert.deepEqual([...seen].sort(), looks);
  w = go(go(w, 'west').world, 'east').world;
});

// Breaks: the tide gate ignores its opens_when, the tide cut is wrong, or the high-tide variant
// is missing or ordered behind a season line.
test('world 2: at 07:00 the tide is high: the gate refuses, the room says why, no Open', () => {
  assert.equal(w.state.clock, 7 * HOUR);
  assert.equal(refused(w, { type: 'open', direction: 'east' }), 'invalid_state');
  assert.equal(place(w), 'room.shore_steps.high_tide');
  assert.equal(offersOpen(w, 'east'), false);
});

// Breaks: the climb face is missing, its damage differs, or the rope is not checked.
test('world 3-4: the drop without the rope hurts 3 and lands on the stair; with it, nothing', () => {
  w = go(go(w, 'north').world, 'north').world;
  const fall = go(w, 'down');
  assert.deepEqual(fall.lines, ['narration.fell']);
  assert.equal(pool(fall.world, 'hp'), 7);
  assert.equal(here(fall.world), w.roomIds[ref('room', 'smugglers_stair')]);
  w = take(go(fall.world, 'up').world, 'rope');
  const safe = go(w, 'down');
  assert.deepEqual([safe.lines, pool(safe.world, 'hp')], [[], 7]);
  w = safe.world;
});

// Breaks: the search window is missing or does not wrap, or the hidden exit shows before the fact.
test('world 5: at 10:00 the cleft search is unavailable and the cave shows only west', () => {
  w = wait(go(w, 'down').world, 10 * HOUR).world;
  assert.equal(here(w), w.roomIds[ref('room', 'sea_cave')]);
  const search = gameView(w).actions.find((a) => a.action_key === 'search_cleft');
  assert.equal(search?.available, false);
  assert.equal(act(w, { type: 'perform', action: 'search_cleft' }).decision.kind, 'rejected');
  assert.deepEqual(exits(w), ['west']);
});

// Breaks: low tide does not open the gate, or the third visit does not read the familiar line.
test('world 6: at 12:00 the gate opens; the third visit to the shore is the familiar line', () => {
  w = wait(w, 12 * HOUR).world;
  w = play(w, { type: 'open', direction: 'west' }).world;
  w = go(w, 'west').world;
  assert.equal(place(w), 'room.shore_steps.familiar');
});

// Breaks: the gate closes on the tide, the search fact or tip is missing, or the map hides the link.
test('world 7: at 20:00 the open gate admits; the search finds the stair, once with the tip', () => {
  w = go(wait(w, 20 * HOUR).world, 'east').world;
  const found = perform(w, 'search_cleft');
  assert.deepEqual(found.lines, ['narration.search_cleft', 'tip.search_cleft']);
  w = found.world;
  assert.deepEqual(exits(w), ['up', 'west']);
  const cave = w.roomIds[ref('room', 'sea_cave')];
  const links = gameView(w)
    .map!.links.filter((l) => l.from === cave)
    .map((l) => l.direction);
  assert.deepEqual(links.sort(), ['up', 'west']);
  assert.ok(!perform(w, 'search_cleft').lines.includes('tip.search_cleft'));
  w = go(w, 'up').world;
});

// Breaks: the moon door ignores the lunar cut, or the cliff's dark-moon variant is missing.
test('world 9: the moon door refuses on day 2 at 23:00 and opens at day 3, 00:00', () => {
  let x = wait(w, DAY + 23 * HOUR).world;
  x = go(x, 'up').world;
  assert.equal(refused(x, { type: 'open', direction: 'east' }), 'invalid_state');
  assert.equal(place(x), 'room.cliff_top.dark_moon');
  x = wait(x, 2 * DAY).world;
  assert.equal(place(x), 'room.cliff_top.full_moon');
  x = go(play(x, { type: 'open', direction: 'east' }).world, 'east').world;
  assert.equal(here(x), x.roomIds[ref('room', 'tide_pools')]);
});

// Breaks: Idony's short variant reads the wrong hours or her winter variant the wrong season.
test('world 8: on day 4 at 03:00 Idony dozes in her winter shawls; after 06:00 she wakes', () => {
  w = go(go(wait(w, 3 * DAY + 3 * HOUR).world, 'up').world, 'south').world;
  const idony = (v: World) => gameView(v).entities.find((e) => e.id === id(v, 'npc', 'idony'))!;
  assert.deepEqual(
    [idony(w).name, idony(w).description],
    ['npc.idony.short_asleep', 'npc.idony.description_winter'],
  );
  w = wait(w, 3 * DAY + 6 * HOUR).world;
  assert.equal(idony(w).name, 'npc.idony.short');
});

// Breaks: a sandbox detail variant reads the wrong sky field, or the pool cleft keeps the night window.
test('sandbox: the pool details show weather, tide and season; the pool cleft searches by day', () => {
  const shows = (v: World, key: string) =>
    describe(
      v,
      v.character,
      Object.values(v.details).find((d) => d.key === key)!,
    );
  const sky = (v: World) => ['pool_sky', 'pool_water', 'pool_shore'].map((k) => shows(v, k));
  let x = go(go(fresh(WORLD), 'east').world, 'south').world;
  assert.deepEqual(sky(x), [
    'detail.pool_sky.clear',
    'detail.pool_water.high',
    'detail.pool_shore.spring',
  ]);
  assert.deepEqual(exits(go(x, 'east').world), ['west']);
  x = wait(x, 12 * HOUR).world;
  assert.equal(shows(x, 'pool_water'), 'detail.pool_water.low');
  x = perform(x, 'search_pool_cleft').world;
  assert.deepEqual(exits(go(x, 'east').world), ['up', 'west']);
});
