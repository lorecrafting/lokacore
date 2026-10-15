// Homestead hs-7 on the compiled gift sampler (mechanics.md "Barter (toolbox row kgd.70)"): an
// apple given to the farmer raises his trust once, a dead rat lowers it once, a stone does nothing;
// trust -1, 0 and 1 open his cold, plain and warm dialogue and room line. The trader's
// `knife_for_pelts` (price 0, escrow 2 of pelt_01..03 into the stall, output knife_01, no
// ready_after) hands the knife over for two pelts and no coin. Values are hand-counted from the
// sampler literals.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, gameView, loadCartridge, newWorld, step } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import type { EntityId } from '../src/contracts.gen.ts';
import { decode, encode } from '../src/foundation/canonical.ts';
import { spokenBy } from '../src/mechanics/dialogue/shared.ts';
import { describeEntity } from '../src/mechanics/description_variant/rule.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-gift-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/gift_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const S = 'gift_sampler@0.0.1';
const source = (decode(new TextDecoder().decode(artifact)) as { cartridge: any }).cartridge;
const reload = (change: (c: any) => void = () => {}) => {
  const c = structuredClone(source);
  change(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
};
const sampler = (change?: (c: any) => void) => {
  const r = reload(change);
  assert.ok(r.ok, JSON.stringify(r));
  return r.cartridge as Cartridge;
};
const ref = (kind: string, key: string) =>
  ({ cartridge_id: 'gift_sampler', cartridge_version: '0.0.1', kind, key }) as never;
const id = (w: World, kind: string, k: string) => w.entityIds[`${S}:${kind}/${k}`] as EntityId;
let n = 0;
const run = (w: World, p: object) => {
  n += 1;
  const cid = `dddddddd-7777-4333-8444-${String(n).padStart(12, '0')}`;
  return step(
    w,
    { id: cid, world_context_id: w.context, payload: { actor_id: w.character, ...p } } as never,
    n,
  );
};
const act = (w: World, p: object) => {
  const s = run(w, p);
  assert.equal(s.decision.kind, 'accepted', JSON.stringify(s.decision));
  return s.world;
};
const fresh = (c = sampler()) =>
  newWorld(c, '2c4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e70' as never, [1, 2, 3, 4]);
const farmer = (w: World) => id(w, 'npc', 'farmer');
const trust = (w: World) =>
  Object.entries(w.state.facts ?? {}).find(([k]) => {
    const t = decode(k) as any;
    return t.fact.key === 'trust' && t.subject_id === farmer(w);
  })?.[1] ?? 0;
const give = (w: World, item: string) => {
  const thing = id(w, 'item', item);
  return act(act(w, { type: 'take', item_id: thing }), {
    type: 'give',
    item_id: thing,
    recipient_id: farmer(w),
  });
};
// The item back on the yard floor (no theft in this sampler), ready to be given again.
const retake = (w: World, item: string) => ({
  ...w,
  state: {
    ...w.state,
    containers: { ...w.state.containers, [id(w, 'item', item)]: w.roomIds[`${S}:room/yard`]! },
  },
});
/** The farmer's dialogue and room line, as the player meets them. */
const tier = (w: World) => [
  spokenBy(w, w.character, farmer(w))?.key,
  describeEntity(w, w.character, farmer(w), 'room_line'),
];
const PLAIN = ['farmer_plain', 'npc.farmer.room'];

// Breaks: a like or dislike rule missing or of the wrong sign, the stone counted, the once-only
// flag missing (trust is capped at 1, so the repeat apple is checked after the rat, at 0), a tier
// keyed one off its threshold.
test('an apple warms the farmer once, a stone does nothing, a dead rat cools him once', () => {
  let w = fresh();
  assert.deepEqual([trust(w), ...tier(w)], [0, ...PLAIN]);
  w = give(w, 'stone');
  assert.deepEqual([trust(w), ...tier(w)], [0, ...PLAIN]);
  w = give(w, 'apple');
  assert.deepEqual([trust(w), ...tier(w)], [1, 'farmer_warm', 'npc.farmer.room_warm']);
  w = give(retake(w, 'apple'), 'apple');
  assert.equal(trust(w), 1);
  w = give(w, 'rat');
  assert.deepEqual([trust(w), ...tier(w)], [0, ...PLAIN]);
  w = give(retake(w, 'apple'), 'apple'); // give-retake-give: the apple has paid already
  assert.deepEqual([trust(w), ...tier(w)], [0, ...PLAIN]);
  w = give(retake(w, 'rat'), 'rat');
  assert.equal(trust(w), 0);
});

test('a dead rat first opens the cold tier', () => {
  const w = give(fresh(), 'rat');
  assert.deepEqual([trust(w), ...tier(w)], [-1, 'farmer_cold', 'npc.farmer.room_cold']);
});

const trader = (w: World) => id(w, 'npc', 'trader');
const stall = (w: World) => w.roomIds[`${S}:room/stall`]!;
const knife = (w: World) => id(w, 'item', 'knife_01');
const pelts = (w: World, holder: string) =>
  ['pelt_01', 'pelt_02', 'pelt_03'].filter((k) => w.state.containers[id(w, 'item', k)] === holder)
    .length;
const take = (w: World, ...ks: string[]) =>
  ks.reduce((x, k) => act(x, { type: 'take', item_id: id(x, 'item', k) }), w);
const barter = (w: World, quoted_price = 0) =>
  run(w, {
    type: 'use_service',
    provider_id: trader(w),
    service: ref('service', 'knife_for_pelts'),
    quoted_price,
  });
const offer = (w: World) => gameView(w).entities.find((x) => x.id === trader(w))!.services![0]!;
const refused = (w: World, code: string, reason: string) => {
  const r = barter(w);
  assert.deepEqual(r.decision, { kind: 'rejected', error: { code } });
  assert.equal(r.world, w);
  const a = offer(w).action;
  assert.ok(!a.available);
  assert.deepEqual(a.reason, { code, message: { key: reason } });
};
const pennies = (w: World, who: EntityId) => level(w, who, resourceRef(w, 'pennies'));

// Breaks: the output left in custody (or moved only by a later claim), a job scheduled for an
// untimed output, price 0 charged or refused, quantity ignored (all three pelts go), one pelt
// accepted, the knife handed over twice.
test('two pelts and no coin buy the knife at once; one pelt does not', () => {
  let w = take(fresh(), 'pelt_01');
  refused(w, 'not_owned', 'service.missing_inputs');
  w = take(w, 'pelt_02', 'pelt_03');
  assert.deepEqual([offer(w).price, offer(w).action.available], [0, true]);
  const r = barter(w);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  w = r.world;
  assert.equal(w.state.containers[knife(w)], w.body);
  assert.deepEqual([pelts(w, w.body), pelts(w, stall(w))], [1, 2]);
  assert.deepEqual([pennies(w, w.body), pennies(w, trader(w))], [0, 0]);
  assert.deepEqual(w.state.jobs ?? {}, {});
  refused(w, 'invalid_state', 'service.order_open');
});

// Breaks: the no_output check keyed on ready_after (an untimed barter would take the pelts with
// no knife to hand over).
test('a barter whose knife has left the stall is refused before the pelts move', () => {
  let w = take(fresh(), 'pelt_01', 'pelt_02');
  w = { ...w, state: { ...w.state, containers: { ...w.state.containers, [knife(w)]: trader(w) } } };
  refused(w, 'not_found', 'service.no_output');
});

// Breaks: price 0 admitted for a service with no barter escrow, a negative price admitted, or the
// claim of an untimed output admitted (it would never have a job to claim), the no_output text
// left unchecked for an untimed output.
test('price 0 needs a barter escrow; a price below 0 and a claim of an untimed output are refused', () => {
  const at = `.cartridge.services["${S}:service/knife_for_pelts"]`;
  const bad = (change: (c: any) => void) => {
    const r = reload(change) as any;
    assert.equal(r.ok, false);
    return [r.diagnostic.code, r.diagnostic.path];
  };
  const svc = (c: any) => c.services[`${S}:service/knife_for_pelts`];
  assert.deepEqual(
    bad((c) => {
      svc(c).benefit = { kind: 'entitlement', fact: ref('fact', 'traded_knife') };
      c.text['service.already_paid'] = 'Already yours.';
    }),
    ['SCHEMA_VIOLATION', `${at}.price`],
  );
  assert.deepEqual(
    bad((c) => delete c.text['service.no_output']),
    ['UNRESOLVED_REFERENCE', `${at}.output`],
  );
  assert.deepEqual(
    bad((c) => (svc(c).price = -1)),
    ['SCHEMA_VIOLATION', `${at}.price`],
  );
  assert.deepEqual(
    bad((c) => {
      c.services[`${S}:service/claim`] = {
        ...svc(c),
        key: 'claim',
        price: 1,
        benefit: { kind: 'claim', service: ref('service', 'knife_for_pelts') },
      };
    }),
    ['SCHEMA_VIOLATION', `.cartridge.services["${S}:service/claim"].benefit.service`],
  );
});
