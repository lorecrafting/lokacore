// Homestead row hs-5 on the compiled kitchen sampler (mechanics.md "Cooking"): the cook's `stew`
// commission (1 penny) takes 2 of the five pond fish into the larder and is ready 300 s later;
// `claim` (1 penny) hands over the stew. The stew restores 10 mv and `applies [fed]`
// (str +1 for 3600 s; str starts at 10, mv at 80). Expected values are hand-counted from those
// literals.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { gameView, newWorld, step } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { value } from '../src/mechanics/attributes/shared.ts';
import { currentStatus } from '../src/mechanics/status/shared.ts';
import { pending } from '../src/mechanics/dialogue/shared.ts';
import { level as skillLevel, practice } from '../src/mechanics/skill_level.ts';
import { value as fact } from '../src/mechanics/fact.ts';
import { cartridgeOf, commands, ctx, reload } from './harness.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-kitchen-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/kitchen_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const S = 'kitchen_sampler@0.0.1';
const ref = (kind: string, key: string) =>
  ({ cartridge_id: 'kitchen_sampler', cartridge_version: '0.0.1', kind, key }) as never;

const base = cartridgeOf(artifact);
const loaded = reload(base);
assert.ok(loaded.ok, JSON.stringify(loaded));
const content = loaded.cartridge as Cartridge;

const stream = commands('cccccccc-4545-4545-8545', 'aaaaaaaa-4545-4545-8545');
const { send, play } = stream;
const wait = (w: World, seconds: number) => stream.elapsed(w, w.state.clock + seconds);
const fresh = (c = content) => {
  stream.n = 0;
  return newWorld(c, ctx('4f5a6b7c-8d9e-4a0b-9c1d-2e3f4a5b6c7d'), [1, 2, 3, 4]);
};
const item = (w: World, k: string) => w.entityIds[`${S}:item/${k}`]!;
const cook = (w: World) => w.entityIds[`${S}:npc/cook`]!;
const room = (w: World, k: string) => w.roomIds[`${S}:room/${k}`]!;
const fish = (w: World, holder: string) =>
  [1, 2, 3, 4, 5].filter((i) => w.state.containers[item(w, `fish_0${i}`)] === holder).length;
const use = (w: World, service: string) =>
  send(w, {
    type: 'use_service',
    provider_id: cook(w),
    service: ref('service', service),
    quoted_price: 1,
  });
const refused = (w: World, service: string, code: string, key: string) => {
  const r = use(w, service);
  assert.deepEqual(r.decision, { kind: 'rejected', error: { code } });
  const offer = gameView(w)
    .entities.find((x) => x.id === cook(w))!
    .services!.find((s) => s.service.key === service)!.action;
  assert.deepEqual(offer.available ? undefined : offer.reason, { code, message: { key } });
};
/** Fetch `k` fish from the pond and come back to the kitchen. */
const catchFish = (w: World, ...ks: string[]) => {
  w = play(w, { type: 'move', direction: 'north' });
  for (const k of ks) w = play(w, { type: 'take', item_id: item(w, k) });
  return play(w, { type: 'move', direction: 'south' });
};
const str = (w: World) => value(w, w.character, ref('attribute', 'str'));
const mv = (w: World) => level(w, w.body, resourceRef(w, 'mv'))!;
/** A world holding the claimed stew, at C0 + 300 after the order. */
const served = (c = content) => {
  let w = use(catchFish(fresh(c), 'fish_01', 'fish_02'), 'stew').world;
  w = wait(w, 300);
  return play(w, {
    type: 'use_service',
    provider_id: cook(w),
    service: ref('service', 'claim'),
    quoted_price: 1,
  });
};

// Breaks: the order taken with one fish, quantity ignored, ready_after ignored (claim at +299),
// the stew not handed over at +300, or the spent fish never back in the pond.
test('two fish order a stew that is ready 300 s later; the larder restocks the pond', () => {
  let w = catchFish(fresh(), 'fish_01');
  refused(w, 'stew', 'not_owned', 'service.missing_inputs');
  w = catchFish(w, 'fish_02');
  const r = use(w, 'stew');
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  w = r.world;
  assert.deepEqual([fish(w, w.body), fish(w, room(w, 'larder'))], [0, 2]);
  w = wait(w, 299);
  refused(w, 'claim', 'invalid_state', 'service.not_ready');
  w = wait(w, 1);
  w = play(w, {
    type: 'use_service',
    provider_id: cook(w),
    service: ref('service', 'claim'),
    quoted_price: 1,
  });
  assert.equal(w.state.containers[item(w, 'stew_plain_01')], w.body);
  w = wait(w, 3600);
  assert.deepEqual([fish(w, room(w, 'larder')), fish(w, room(w, 'pond'))], [0, 5]);
});

// Breaks: `applies` ignored (no fed, str 10), applied before the meal or to the wrong holder,
// the fed line missing or before the meal's, or the buff never expiring (11 at +3600).
test('eating the stew restores mv and makes the eater fed for an hour', () => {
  let w = served();
  const before = mv(w);
  const r = send(w, { type: 'eat', item_id: item(w, 'stew_plain_01') });
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  if (r.decision.kind !== 'accepted') return;
  // No reaction listens for status_applied here, so the shared step emits none (status reader 2).
  assert.deepEqual(
    [r.decision.events, r.decision.narration?.map((t) => t.key)],
    [[], ['narration.eat_stew_plain', 'narration.fed.applied']],
  );
  w = r.world;
  assert.deepEqual([mv(w) - before, str(w)], [10, 11]);
  w = wait(w, 3600);
  assert.equal(str(w), 10);
});

// Breaks: a meal that cures and applies one status writing both a cure and a refresh of the row.
test('a meal that cures and applies the active fed writes it once: the cure wins', () => {
  const r = reload(base, (c) => {
    const stew = c.items[`${S}:item/stew_plain_01`].edible;
    c.items[`${S}:item/fish_03`].edible = { ...stew };
    stew.cures = [ref('status', 'fed')];
  });
  assert.ok(r.ok, JSON.stringify(r));
  let w = catchFish(served(r.cartridge as Cartridge), 'fish_03');
  w = play(w, { type: 'eat', item_id: item(w, 'fish_03') });
  assert.equal(str(w), 11);
  w = play(w, { type: 'eat', item_id: item(w, 'stew_plain_01') });
  assert.equal(str(w), 10);
});

// Breaks: Eat's writer composition missing `status` (`food: ['status']`, runtime/decision.ts), so
// the first status_applied faults unowned_event once a reaction listens; or a refresh not silent.
test('a reaction on status_applied hears the first fed, and a refresh stays silent', () => {
  const r = reload(base, (c) => {
    c.reactions[`${S}:reaction/fed_seen`] = {
      key: 'fed_seen',
      on: { event: 'status_applied', status: ref('status', 'fed') },
      steps: [
        { op: 'status.apply', status: ref('status', 'spoiling'), item: ref('item', 'fish_05') },
      ],
    };
    c.items[`${S}:item/fish_03`].edible = { ...c.items[`${S}:item/stew_plain_01`].edible };
  });
  assert.ok(r.ok, JSON.stringify(r));
  let w = catchFish(served(r.cartridge as Cartridge), 'fish_03');
  const types = (k: string) => {
    const d = send(w, { type: 'eat', item_id: item(w, k) });
    assert.equal(d.decision.kind, 'accepted', JSON.stringify(d.decision));
    w = d.world;
    return d.decision.kind === 'accepted'
      ? [d.decision.events.map((e) => e.payload.type), d.decision.narration?.length]
      : [];
  };
  assert.deepEqual(types('stew_plain_01'), [['status_applied', 'status_applied'], 2]);
  assert.ok(currentStatus(w, item(w, 'fish_05'), ref('status', 'spoiling')));
  assert.deepEqual(types('fish_03'), [[], 1]);
});

// Breaks: a meal with `applies` refused at full mv, or eaten there when nothing would newly land:
// a plain meal, an immune eater, or fed already active (PM rulings: the buff applies, the restore
// is capped; a meal that would land no new status is refused as a plain meal).
test('at full mv the stew applies fed; a plain, immune or refresh-only meal is refused', () => {
  const r = reload(base, (c) => {
    const { applies: _, ...plain } = c.items[`${S}:item/stew_plain_01`].edible;
    c.items[`${S}:item/fish_03`].edible = plain;
    c.items[`${S}:item/fish_04`].edible = c.items[`${S}:item/stew_plain_01`].edible;
  });
  assert.ok(r.ok, JSON.stringify(r));
  let w = wait(catchFish(served(r.cartridge as Cartridge), 'fish_03', 'fish_04'), 7200);
  assert.equal(mv(w), 100);
  const refused = (w: World, k: string) =>
    assert.deepEqual(send(w, { type: 'eat', item_id: item(w, k) }).decision, {
      kind: 'rejected',
      error: { code: 'invalid_state' },
    });
  refused(w, 'fish_03');
  const body = { ...w.entities[w.body], immune: [ref('status', 'fed')] };
  refused({ ...w, entities: { ...w.entities, [w.body]: body } } as World, 'fish_04');
  w = play(w, { type: 'eat', item_id: item(w, 'stew_plain_01') });
  assert.deepEqual([mv(w), str(w)], [100, 11]);
  refused(w, 'fish_04');
});

// Breaks: the keep reaction missing, the W6 variant not reading spoiling, the spoil reaction not
// moving the stew. Known limit (mechanics.md Cooking): a service claim emits no item_acquired, so
// a claimed stew does not spoil until it is next acquired.
test('a claimed stew keeps until it is next acquired, then films and lands in the midden', () => {
  let w = wait(served(), 86400);
  const stew = item(w, 'stew_plain_01');
  assert.equal(w.state.containers[stew], w.body);
  assert.equal(currentStatus(w, stew, ref('status', 'spoiling')), undefined);
  w = play(w, { type: 'drop', item_id: stew });
  w = play(w, { type: 'take', item_id: stew });
  w = play(w, { type: 'drop', item_id: stew });
  assert.equal(
    gameView(w).entities.find((e) => e.id === stew)?.name,
    'item.stew_plain.short_spoiling',
  );
  w = wait(w, 86400);
  assert.equal(w.state.containers[stew], room(w, 'midden'));
});

// Breaks: an empty edible `applies` list (minItems) loads.
test('the loader refuses an empty applies list', () => {
  const r = reload(base, (c) => (c.items[`${S}:item/stew_plain_01`].edible.applies = []));
  assert.deepEqual(r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path], [
    'SCHEMA_VIOLATION',
    `.cartridge.items["${S}:item/stew_plain_01"].edible.applies`,
  ]);
});

// Homestead hs-13 (mechanics.md "Self-cooking"): the cook teaches `cooking` (growth [2, 4]) free;
// `cook_stew` at the hearth (rating 1) needs cooking 1 and 2 held fish, `cook_feast` cooking 2 and
// 3 fish; both send the fish to the larder and take the dish from it (three hearty stews, one
// feast). `hearty` is str +2 for 3600 s.
const cooking = ref('skill', 'cooking');
const uses = (w: World) => fact(w, w.character, practice(cooking));
const pennies = (w: World) => level(w, w.body, resourceRef(w, 'pennies'));
const cookOffer = (w: World, action: string) => {
  let found: { available: boolean; reason?: object } | undefined;
  JSON.stringify(gameView(w), (_, v) => (v?.action_key === action ? (found = v) : v));
  assert.ok(found, `${action} offered`);
  return found.available ? 'available' : found.reason;
};
/** Perform `action`; the offer agrees (refusals carry their message key on the offer only). */
const cook_ = (w: World, action: string) => {
  const r = send(w, { type: 'perform', action });
  const offer = cookOffer(w, action);
  if (r.decision.kind === 'rejected')
    assert.equal((offer as { code?: string }).code, r.decision.error.code);
  else assert.equal(offer, 'available');
  return r;
};
/** The refused offer's message key (null: none). */
const refusal = (w: World, action: string) => {
  assert.equal(cook_(w, action).decision.kind, 'rejected');
  return (cookOffer(w, action) as { message?: { key: string } }).message?.key ?? null;
};
const cooked = (w: World, action: string) => {
  const r = cook_(w, action);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r;
};
const learn = (w: World) => {
  w = play(w, { type: 'talk', target_id: cook(w) });
  const [continuation_id] = pending(w, w.character)!;
  return play(w, { type: 'choose', choice_id: 'learn', continuation_id });
};
/** Hold `k` fish: wait on the larder's restock until the pond has enough, then fetch them. */
const gather = (w: World, k: number) => {
  for (let h = 0; fish(w, room(w, 'pond')) + fish(w, w.body) < k; h++) {
    assert.ok(h < 48, 'the pond never restocks');
    w = wait(w, 3600);
  }
  const pond = [1, 2, 3, 4, 5]
    .map((i) => `fish_0${i}`)
    .filter((f) => w.state.containers[item(w, f)] === room(w, 'pond'));
  return catchFish(w, ...pond.slice(0, k - fish(w, w.body)));
};
const holder = (w: World, k: string) => w.state.containers[item(w, k)];

// Breaks: the stew offered or cooked without the box (skill_compare 1 at level 0), a paid lesson,
// one fish enough (quantity 2) or the shortage losing its reason, the stew not from the larder or
// the fish not to it, a crafted stew not spoiling, the feast at uses 1 (skill_compare 2) or with
// two fish (quantity 3), the growth step [2, 4] off by one, or a fourth stew from an empty larder.
test('the cook teaches cooking free; stews and the feast are cooked at the hearth', () => {
  assert.equal(refusal(gather(fresh(), 2), 'cook_stew'), null); // level 0 < 1, no message
  // After the learn the cook has nothing to say: talk is refused.
  const teaches = (w: World) => {
    const r = send(w, { type: 'talk', target_id: cook(w) });
    return (
      r.decision.kind === 'accepted' && JSON.stringify(gameView(r.world).choice).includes('"learn"')
    );
  };
  assert.equal(teaches(fresh()), true);
  let w = learn(fresh());
  assert.deepEqual([pennies(w), teaches(w)], [pennies(fresh()), false]);
  w = gather(w, 1);
  assert.equal(skillLevel(w, w.character, cooking), 1);
  assert.equal(refusal(w, 'cook_stew'), 'craft.cook_stew.needs'); // 1 fish < 2
  w = gather(w, 2);
  let r = cooked(w, 'cook_stew');
  w = r.world;
  assert.equal((r.decision as { outcome?: string }).outcome, 'success');
  assert.deepEqual(
    [holder(w, 'stew_hearty_01'), fish(w, room(w, 'larder')), uses(w)],
    [w.body, 2, 1],
  );
  assert.ok(currentStatus(w, item(w, 'stew_hearty_01'), ref('status', 'spoiling')));
  w = gather(w, 3);
  assert.equal(refusal(w, 'cook_feast'), null); // uses 1: level 1 < 2
  w = cooked(w, 'cook_stew').world;
  assert.deepEqual([uses(w), skillLevel(w, w.character, cooking)], [2, 2]);
  w = gather(w, 2);
  assert.equal(refusal(w, 'cook_feast'), 'craft.cook_feast.needs'); // 2 fish < 3
  w = cooked(gather(w, 3), 'cook_feast').world;
  assert.deepEqual(
    [holder(w, 'feast_01'), uses(w), skillLevel(w, w.character, cooking)],
    [w.body, 3, 2],
  );
  assert.ok(currentStatus(w, item(w, 'feast_01'), ref('status', 'spoiling')));
  w = cooked(gather(w, 2), 'cook_stew').world;
  assert.deepEqual([uses(w), skillLevel(w, w.character, cooking)], [4, 3]);
  assert.equal(refusal(gather(w, 2), 'cook_stew'), null); // larder empty of hearty stews
  w = play(w, { type: 'eat', item_id: item(w, 'stew_hearty_01') });
  assert.equal(str(w), 12);
  w = wait(w, 3600);
  assert.equal(str(w), 10);
  assert.equal(str(play(w, { type: 'eat', item_id: item(w, 'feast_01') })), 12);
});

// Breaks: a failed cook keeps the fish or still hands out a stew (the brief's "boils over").
test('at a hearth rated 2 the level-1 cook boils the pot over: fish lost, no stew', () => {
  const r = reload(base, (c) => (c.rooms[`${S}:room/kitchen`].details.hearth.rating = 2));
  assert.ok(r.ok, JSON.stringify(r));
  const w0 = gather(learn(fresh(r.cartridge as Cartridge)), 2);
  const d = cooked(w0, 'cook_stew');
  const w = d.world;
  assert.equal((d.decision as { outcome?: string }).outcome, 'failure');
  assert.deepEqual(
    [fish(w, w.body), fish(w, room(w, 'larder')), holder(w, 'stew_hearty_01'), uses(w)],
    [0, 2, room(w, 'larder'), 1],
  );
});

// Breaks (faucet probe): an eaten or spoiled hearty stew back in the larder, so the returned fish
// cook a fourth.
test('eaten and spoiled stews never refill the larder', () => {
  let w = learn(fresh());
  for (let i = 0; i < 3; i++) w = cooked(gather(w, 2), 'cook_stew').world;
  w = play(w, { type: 'eat', item_id: item(w, 'stew_hearty_01') });
  w = wait(w, 86400);
  assert.deepEqual(
    ['stew_hearty_02', 'stew_hearty_03'].map((k) => holder(w, k)),
    [room(w, 'midden'), room(w, 'midden')],
  );
  assert.equal(refusal(gather(w, 2), 'cook_stew'), null);
});
