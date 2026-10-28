// Homestead hs-3, fishing (docs/system/mechanics.md Fishing) on the compiled fishing sampler: the
// bank holds a rod (tag wooden), a sack and the pool (tag water); the larder holds trout_01,
// trout_02, eel_01 and salmon_01. A passing `fish` cast emits `bite`; three reactions run the
// trout (06:00-18:00), eel (other hours) and salmon (rain) entries, each larder to bank, cap 1.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, gameView, loadCartridge, newWorld } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { commands, ctx } from './harness.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), 'loka-fishing-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/fishing_sampler', file], {
    cwd: root,
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const loaded = loadCartridge(artifact, INSTALLED);
assert.ok(loaded.ok, JSON.stringify(loaded));
const content = loaded.cartridge as Cartridge;

const stream = commands('eeeeeeee-5555-4555-8555');
const { send: play } = stream;
const ok = (w: World, payload: object) => {
  const r = play(w, payload);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
};
const id = (w: World, key: string) => w.entityIds[`fishing_sampler@0.0.1:item/${key}`]!;
const room = (w: World, key: string) => w.roomIds[`fishing_sampler@0.0.1:room/${key}`]!;
const FISH = ['trout_01', 'trout_02', 'eel_01', 'salmon_01'];
/** The fish whose holder is `where` (a room key), by key. */
const fishIn = (w: World, where: string) =>
  FISH.filter((k) => w.state.containers[id(w, k)] === room(w, where));

// Oracle, independent of the kernel: with this world id days 1 and 2 rain and day 3 is clear
// (first 4 bytes of SHA-256 of `weather:<id>:<d>` mod 2, clear first; calendar.ts weather).
const CONTEXT = '3d7f2b0c-8e4a-4f6b-9c2d-1a3e5f7b9d2c';
const HOUR = 3600;
const DAY = 24 * HOUR;
// Found by trial: the luck check's single draw under 50 passes with PASS and fails with FAIL.
const PASS = [2, 2, 2, 2];
const FAIL = [1, 1, 1, 1];
/** A fresh world with the rod in hand, waited to `clock`. */
function holding(clock: number): World {
  const w = newWorld(content, ctx(CONTEXT), PASS as never);
  const held = ok(w, { type: 'take', item_id: id(w, 'rod') });
  return clock > 0 ? ok(held, { type: 'wait', until: clock }) : held;
}
/** Cast `item` at `target` with the luck draw fixed by `rng`. */
const cast = (w: World, rng: number[], target = 'pool', item = 'rod') =>
  play({ ...w, state: { ...w.state, rng } } as World, {
    type: 'perform',
    action: 'fish',
    target_id: id(w, target),
    item_id: id(w, item),
  });
/** The fish a passing cast at `clock` lands on the bank. */
const landed = (clock: number) => {
  const r = cast(holding(clock), PASS);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return fishIn(r.world, 'bank');
};
const TROUT = /^trout_0[12]$/;

// Breaks: the bite reaches no catch rule, a when is dropped (eel or salmon by a clear day), or
// an entry moves more than its cap.
test('a passing cast at 10:00 on a clear day lands one trout and nothing else', () => {
  const fish = landed(2 * DAY + 10 * HOUR);
  assert.equal(fish.length, 1, JSON.stringify(fish));
  assert.match(fish[0]!, TROUT);
});

// Breaks: the eel when loses its `not`, or the trout window wraps past 18:00.
test('a passing cast at 22:00 on a clear day lands the eel only', () => {
  assert.deepEqual(landed(2 * DAY + 22 * HOUR), ['eel_01']);
});

// Breaks: the salmon rule ignores weather or reads another field, or rain blocks the trout.
test('a passing cast at 10:00 on a rainy day lands a trout and the salmon', () => {
  const fish = landed(10 * HOUR);
  assert.equal(fish.length, 2, JSON.stringify(fish));
  assert.match(fish[0]!, TROUT);
  assert.equal(fish[1], 'salmon_01');
});

// Breaks: either window edge moves off its hour (from inclusive, to exclusive), or the rules read
// the clock after the cast's 60 s instead of at its start (17:59:30 would land the eel).
test('the trout window is 06:00 inclusive to 18:00 exclusive at the cast start', () => {
  const D = 2 * DAY;
  assert.deepEqual(landed(D + 6 * HOUR - 1), ['eel_01']);
  assert.match(landed(D + 6 * HOUR)[0]!, TROUT);
  assert.match(landed(D + 18 * HOUR - 1)[0]!, TROUT);
  assert.deepEqual(landed(D + 18 * HOUR), ['eel_01']);
});

// Breaks: the salmon rule reads the next day's weather, or rain outlasts its day.
test('the salmon bites until the last second of the rainy day 2 and not at day 3 00:00', () => {
  assert.deepEqual(landed(2 * DAY - 1), ['eel_01', 'salmon_01']);
  assert.deepEqual(landed(2 * DAY), ['eel_01']);
});

// Breaks: a failed check still emits the bite, the failure skips the cooldown, or the cooldown
// runs from the end of the cast or lasts another length than 600 s.
test('a failing cast moves nothing and still starts the 600 s cooldown', () => {
  const start = 2 * DAY + 10 * HOUR;
  const r = cast(holding(start), FAIL);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  assert.deepEqual(fishIn(r.world, 'bank'), []);
  assert.equal(fishIn(r.world, 'larder').length, 4);
  const early = ok(r.world, { type: 'wait', until: start + 599 });
  assert.deepEqual(cast(early, PASS).decision, { kind: 'rejected', error: { code: 'cooldown' } });
  const ready = ok(early, { type: 'wait', until: start + 600 });
  const again = cast(ready, PASS);
  assert.equal(again.decision.kind, 'accepted', JSON.stringify(again.decision));
  assert.equal(fishIn(again.world, 'bank').length, 1);
});

// Breaks: an entry ignores its cap (a second trout while one waits on the bank), or the larder
// is not the only source (a third trout after both are taken: the catch became a faucet).
test('the bank holds one trout at a time and the larder bounds the catch', () => {
  let w = holding(2 * DAY + 10 * HOUR);
  const fish = (world: World) => {
    const r = cast(world, PASS);
    assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
    return ok(r.world, { type: 'wait', until: r.world.state.clock + 600 });
  };
  w = fish(w);
  const first = fishIn(w, 'bank');
  w = fish(w);
  assert.deepEqual(fishIn(w, 'bank'), first);
  w = ok(w, { type: 'take', item_id: id(w, first[0]!) });
  w = fish(w);
  const second = fishIn(w, 'bank');
  assert.equal(second.length, 1);
  assert.notEqual(second[0], first[0]);
  w = ok(w, { type: 'take', item_id: id(w, second[0]!) });
  w = fish(w);
  assert.deepEqual(fishIn(w, 'bank'), []);
  assert.deepEqual(fishIn(w, 'larder'), ['eel_01', 'salmon_01']);
});

// Breaks: the fish card shows without a rod in hand, the tool gate reads a looser tag than rod
// (a held wooden item that is no rod fishes), or the held rod stops offering it.
test('the cast card is listed with the rod in hand and unlisted without it', () => {
  const offers = (w: World) => JSON.stringify(gameView(w)).includes('"action_key":"fish"');
  assert.equal(offers(newWorld(content, ctx(CONTEXT), PASS as never)), false);
  const w = holding(0);
  const rod = id(w, 'rod');
  const stick = { ...w.entities[rod]!, tags: ['wooden'] } as never;
  assert.equal(offers({ ...w, entities: { ...w.entities, [rod]: stick } }), false);
  const card = gameView(w)
    .inventory.find((i) => i.id === id(w, 'rod'))!
    .actions.find((a) => a.action_key === 'fish')!;
  assert.equal(card.available, true);
  assert.ok(card.target_ids!.includes(id(w, 'pool')));
});

// Breaks: the target policy drops has_tag water (a cast at the sack), the held-tool rule admits a
// rod inside a worn sack, or the carry limit goes (the pool could be taken off the bank).
test('a cast at anything but water, or with the rod in a worn sack, is refused', () => {
  const w = holding(2 * DAY + 10 * HOUR);
  assert.equal(play(w, { type: 'take', item_id: id(w, 'pool') }).decision.kind, 'rejected');
  assert.deepEqual(cast(w, PASS, 'sack').decision, {
    kind: 'rejected',
    error: { code: 'invalid_state' },
  });
  let s = ok(w, { type: 'take', item_id: id(w, 'sack') });
  s = ok(s, { type: 'put', item_id: id(s, 'rod'), container_id: id(s, 'sack') });
  s = ok(s, { type: 'wear', item_id: id(s, 'sack') });
  assert.deepEqual(cast(s, PASS).decision, { kind: 'rejected', error: { code: 'not_present' } });
});

// Breaks: the spoil rule moves the fish anywhere but the midden or before its day is up, or the
// restock entry skips the midden or runs off its daily grid.
test('a taken trout spoils to the midden after a day and is restocked at the next midnight', () => {
  let w = cast(holding(2 * DAY + 10 * HOUR), PASS).world;
  const [trout] = fishIn(w, 'bank');
  w = ok(w, { type: 'take', item_id: id(w, trout!) });
  const taken = w.state.clock;
  w = ok(w, { type: 'wait', until: taken + DAY - 1 });
  assert.equal(w.state.containers[id(w, trout!)], w.state.containers[id(w, 'rod')]);
  w = ok(w, { type: 'wait', until: taken + DAY });
  assert.deepEqual(fishIn(w, 'midden'), [trout]);
  w = ok(w, { type: 'wait', until: 4 * DAY - 1 });
  assert.deepEqual(fishIn(w, 'midden'), [trout]);
  w = ok(w, { type: 'wait', until: 4 * DAY });
  assert.deepEqual(fishIn(w, 'larder'), FISH);
});
