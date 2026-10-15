// Homestead row hs-5 on the compiled kitchen sampler (mechanics.md "Cooking"): the cook's `stew`
// commission (1 penny) takes 2 of the five pond fish into the larder and is ready 300 s later;
// `claim` (1 penny) hands over the stew. The stew restores 10 mv and `applies [fed]`
// (str +1 for 3600 s; str starts at 10, mv at 80). Expected values are hand-counted from those
// literals.
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
import { encode } from '../src/foundation/canonical.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { value } from '../src/mechanics/attributes/shared.ts';
import { currentStatus } from '../src/mechanics/status/shared.ts';

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

function reload(edit: (c: any) => void = () => {}) {
  const c = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  edit(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
}
const loaded = reload();
assert.ok(loaded.ok, JSON.stringify(loaded));
const content = loaded.cartridge as Cartridge;

let n = 0;
const send = (w: World, payload: object) =>
  step(
    w,
    {
      id: `cccccccc-4545-4545-8545-${String(++n).padStart(12, '0')}`,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...payload },
    } as never,
    n,
  );
function play(w: World, payload: object) {
  const r = send(w, payload);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
function wait(w: World, seconds: number) {
  const run_id = `aaaaaaaa-4545-4545-8545-${String(++n).padStart(12, '0')}`;
  const from = w.state.clock,
    until = from + seconds;
  const payload = { type: 'elapsed', actor_id: w.character, run_id, from, until };
  const command = { id: elapsedCommandId(run_id, w.context, from, until), payload };
  const r = stepElapsed(w, { ...command, world_context_id: w.context } as never, n);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
const fresh = (c = content) => {
  n = 0;
  return newWorld(c, '4f5a6b7c-8d9e-4a0b-9c1d-2e3f4a5b6c7d' as never, [1, 2, 3, 4]);
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
  const r = reload((c) => {
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
  const r = reload((c) => {
    c.reactions[`${S}:reaction/fed_seen`] = {
      key: 'fed_seen',
      on: { event: 'status_applied', status: ref('status', 'fed') },
      apply: [
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

// Breaks: a meal with `applies` refused at full mv, or a meal with nothing to apply or cure
// eaten there (PM ruling: the buff applies, the restore is capped).
test('at full mv the stew still applies fed; a plain meal is refused', () => {
  const r = reload((c) => {
    const { applies: _, ...plain } = c.items[`${S}:item/stew_plain_01`].edible;
    c.items[`${S}:item/fish_03`].edible = plain;
  });
  assert.ok(r.ok, JSON.stringify(r));
  let w = wait(catchFish(served(r.cartridge as Cartridge), 'fish_03'), 7200);
  assert.equal(mv(w), 100);
  assert.deepEqual(send(w, { type: 'eat', item_id: item(w, 'fish_03') }).decision, {
    kind: 'rejected',
    error: { code: 'invalid_state' },
  });
  w = play(w, { type: 'eat', item_id: item(w, 'stew_plain_01') });
  assert.deepEqual([mv(w), str(w)], [100, 11]);
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

// Breaks (one row per new loader check): an unresolved `applies` ref, an empty list (minItems), a meal status that moves
// the derived hp maximum (loka-kgd.50). The 1.101 floor row is in loader_floors.json.
test('the loader refuses an unresolved applies and a meal that moves hp_max', () => {
  const at = `.cartridge.items["${S}:item/stew_plain_01"].edible.applies[0]`;
  const diagnostic = (edit: (c: any) => void) => {
    const r = reload(edit);
    assert.equal(r.ok, false);
    return r.ok ? [] : [r.diagnostic.code, r.diagnostic.path];
  };
  const stew = (c: any) => c.items[`${S}:item/stew_plain_01`].edible;
  assert.deepEqual(
    diagnostic((c) => (stew(c).applies = [ref('status', 'nothing')])),
    ['UNRESOLVED_REFERENCE', at],
  );
  assert.deepEqual(
    diagnostic((c) => (stew(c).applies = [])),
    ['SCHEMA_VIOLATION', at.slice(0, -3)],
  );
  const hpMax = { terms: [{ attribute: ref('attribute', 'str'), per_point: 1, pivot: 10 }] };
  assert.deepEqual(
    diagnostic((c) => (c.world.derived = { hp_max: hpMax })),
    ['SCHEMA_VIOLATION', at],
  );
});
