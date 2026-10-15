// Homestead row hs-5 on the compiled kitchen sampler (mechanics.md "Cooking"): the cook's `stew`
// commission (1 penny) takes 2 of the five pond fish into the larder and is ready 300 s later;
// `claim` (1 penny) hands over the stew. The stew restores 10 mv and `applies [hearty]`
// (str +2 for 3600 s; str starts at 10, mv at 80). Expected values are hand-counted from those
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
  assert.equal(w.state.containers[item(w, 'stew_01')], w.body);
  w = wait(w, 3600);
  assert.deepEqual([fish(w, room(w, 'larder')), fish(w, room(w, 'pond'))], [0, 5]);
});

// Breaks: `applies` ignored (no hearty, str 10), applied before the meal or to the wrong holder,
// the hearty line missing or before the meal's, or the buff never expiring (12 at +3600).
test('eating the stew restores mv and makes the eater hearty for an hour', () => {
  let w = served();
  const before = mv(w);
  const r = send(w, { type: 'eat', item_id: item(w, 'stew_01') });
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  if (r.decision.kind !== 'accepted') return;
  // No reaction listens for status_applied here, so the shared step stays silent (status reader 2).
  assert.deepEqual(
    [r.decision.events, r.decision.narration?.map((t) => t.key)],
    [[], ['narration.eat_stew', 'narration.hearty.applied']],
  );
  w = r.world;
  assert.deepEqual([mv(w) - before, str(w)], [10, 12]);
  w = wait(w, 3600);
  assert.equal(str(w), 10);
});

// Breaks: a meal that cures and applies one status writing both a cure and a refresh of the row.
test('a meal that cures and applies the active hearty writes it once: the cure wins', () => {
  const r = reload((c) => {
    const stew = c.items[`${S}:item/stew_01`].edible;
    c.items[`${S}:item/fish_03`].edible = { ...stew };
    stew.cures = [ref('status', 'hearty')];
  });
  assert.ok(r.ok, JSON.stringify(r));
  let w = catchFish(served(r.cartridge as Cartridge), 'fish_03');
  w = play(w, { type: 'eat', item_id: item(w, 'fish_03') });
  assert.equal(str(w), 12);
  w = play(w, { type: 'eat', item_id: item(w, 'stew_01') });
  assert.equal(str(w), 10);
});

// Breaks: the keep reaction missing, the W6 variant not reading spoiling, the spoil reaction not
// moving the stew. Known gap (open with the PM): a service claim emits no item_acquired, so the
// stew starts spoiling only once it is dropped and taken again.
test('a stew taken and held a day reads as filmed, then lands in the midden', () => {
  let w = served();
  w = play(w, { type: 'drop', item_id: item(w, 'stew_01') });
  w = play(w, { type: 'take', item_id: item(w, 'stew_01') });
  w = play(w, { type: 'drop', item_id: item(w, 'stew_01') });
  const stew = gameView(w).entities.find((e) => e.id === item(w, 'stew_01'));
  assert.equal(stew?.name, 'item.stew.short_spoiling');
  w = wait(w, 86400);
  assert.equal(w.state.containers[item(w, 'stew_01')], room(w, 'midden'));
});

// Breaks (one row per new loader check): an unresolved `applies` ref, an empty list (minItems), a meal status that moves
// the derived hp maximum (loka-kgd.50). The 1.101 floor row is in loader_floors.json.
test('the loader refuses an unresolved applies and a meal that moves hp_max', () => {
  const at = `.cartridge.items["${S}:item/stew_01"].edible.applies[0]`;
  const diagnostic = (edit: (c: any) => void) => {
    const r = reload(edit);
    assert.equal(r.ok, false);
    return r.ok ? [] : [r.diagnostic.code, r.diagnostic.path];
  };
  const stew = (c: any) => c.items[`${S}:item/stew_01`].edible;
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
