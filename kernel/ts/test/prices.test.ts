// Toolbox row W11 on the compiled prices sampler (mechanics.md "Stock-sensitive prices"): the
// fishmonger holds fish_a, fish_b, fish_c and a basket (not in the set) and 20 pennies; her one offer
// is fish_a with `stock {items [fish_a, fish_b, fish_c], buy [5, 3, 2]}`, buy 5, sell 1; the player
// has 20 pennies; `trade` moves one fish of the set from the fisher to the fishmonger every 3600 s
// up to 3. This world context's EntityIds sort fish_c < fish_b < fish_a, so Buy takes fish_c, then fish_b,
// then fish_a, and Sell gives back the lowest held. Expected values are hand-counted from those literals.
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
import { encode } from '../src/foundation/canonical.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-prices-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/prices_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const S = 'prices_sampler@0.0.1';
const ref = (key: string) =>
  ({ cartridge_id: 'prices_sampler', cartridge_version: '0.0.1', kind: 'item', key }) as never;

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
function fresh(edit?: (c: any) => void) {
  const r = reload(edit);
  assert.ok(r.ok, JSON.stringify(r));
  n = 0;
  return newWorld(
    r.cartridge as Cartridge,
    '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e21' as never,
    [1, 2, 3, 4],
  );
}

let n = 0;
function send(w: World, payload: object) {
  const id = `ffffffff-2020-4020-8020-${String(++n).padStart(12, '0')}`;
  const command = { id, world_context_id: w.context, payload };
  return step(w, { ...command, payload: { actor_id: w.character, ...payload } } as never, n);
}
function play(w: World, payload: object) {
  const r = send(w, payload);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
const fish = (w: World, k: string) => w.entityIds[`${S}:item/fish_${k}`]!;
const npc = (w: World, k: string) => w.entityIds[`${S}:npc/${k}`]!;
const pennies = (w: World, who = w.body) => level(w, who, resourceRef(w, 'pennies'));
const row = (w: World) => gameView(w).entities.find((x) => x.id === npc(w, 'fishmonger'))!.shop![0];
/** The fish of the set `holder` holds directly, in key order. */
const held = (w: World, holder: string) =>
  ['a', 'b', 'c'].filter((k) => w.state.containers[fish(w, k)] === holder);
const press = (w: World, type: 'buy' | 'sell', quoted_price: number) =>
  send(w, {
    type,
    item_id: fish(w, 'a'),
    provider_id: npc(w, 'fishmonger'),
    quoted_price,
  });
const trade = (w: World, type: 'buy' | 'sell', quoted: number) => {
  const r = press(w, type, quoted);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r;
};

// Breaks: the price read from the flat offer (a shows 5), the count over everything she holds (the
// basket makes 4: no price), the shelf skipping the table (view 5, press refused), the first held
// instance not moved (Buy moves fish_a while she still has fish_c).
test('the fishmonger prices fish by how many she holds; a stale quote is refused', () => {
  let w = fresh();
  const monger = npc(w, 'fishmonger');
  assert.deepEqual(row(w).buy, { price: 2, available: true });

  // a. 3 held: 2. The receipt moves fish_c, the lowest EntityId of the set.
  let r = trade(w, 'buy', 2);
  if (r.decision.kind !== 'accepted') return;
  const moves = r.decision.delta.ops.filter((o) => o.op === 'entity.transfer');
  assert.deepEqual(
    moves.map((o) => [o.entity_id, o.source_id, o.destination_id]),
    [[fish(w, 'c'), monger, w.body]],
  );
  assert.deepEqual(
    r.decision.events.map((e) => e.payload),
    [{ type: 'item_acquired', item_id: fish(w, 'c'), holder_id: w.body }],
  );
  w = r.world;
  assert.deepEqual([pennies(w), pennies(w, monger)], [18, 22]);
  assert.deepEqual([held(w, w.body), held(w, monger)], [['c'], ['a', 'b']]);

  // b. 2 held: 3; a press quoted 2 is stale.
  assert.deepEqual(row(w).buy, { price: 3, available: true });
  const stale = press(w, 'buy', 2);
  assert.deepEqual(stale.decision, { kind: 'rejected', error: { code: 'invalid_state' } });
  assert.equal(stale.world, w);
  w = trade(w, 'buy', 3).world;
  assert.deepEqual([pennies(w), held(w, w.body), held(w, monger)], [15, ['b', 'c'], ['a']]);

  // c. 1 held: 5; then none held: unavailable as a sold-out offer.
  assert.deepEqual(row(w).buy, { price: 5, available: true });
  w = trade(w, 'buy', 5).world;
  assert.deepEqual([pennies(w), held(w, w.body), held(w, monger)], [10, ['a', 'b', 'c'], []]);
  assert.deepEqual(row(w).buy, { price: 5, available: false, reason: 'not_owned' });
  assert.deepEqual(press(w, 'buy', 5).decision, {
    kind: 'rejected',
    error: { code: 'not_owned' },
  });

  // d. Sell gives back fish_c (the lowest held) for the flat 1; she holds 1 again: 5.
  assert.deepEqual(row(w).sell, { price: 1, available: true });
  r = trade(w, 'sell', 1);
  w = r.world;
  assert.deepEqual([pennies(w), held(w, w.body), held(w, monger)], [11, ['a', 'b'], ['c']]);
  assert.deepEqual(row(w).buy, { price: 5, available: true });
});

// g. Breaks: the trade entry names the fishmonger's set wrongly or replenish refuses an NPC source
// (the fish stays with the fisher and the price stays 5).
test('a trade job moves a fish from the fisher to the fishmonger and the price follows', () => {
  let w = fresh();
  const monger = npc(w, 'fishmonger'),
    fisher = npc(w, 'fisher');
  w = trade(trade(w, 'buy', 2).world, 'buy', 3).world;
  w = play(w, { type: 'give', item_id: fish(w, 'c'), recipient_id: fisher });
  assert.deepEqual([held(w, fisher), held(w, monger), row(w).buy.price], [['c'], ['a'], 5]);
  w = play(w, { type: 'wait', until: 28800 });
  assert.deepEqual([held(w, fisher), held(w, monger), row(w).buy.price], [[], ['a', 'c'], 3]);
});

// e. Breaks: each declaration check dropped (a set naming a plain offer's item, a flat buy other
// than the first entry, an unresolved set item too), the discount bound skipping the table, or the
// 1.82 floor lowered.
test('the loader refuses a malformed stock table and a kernel_api below 1.82', () => {
  const offer = (c: any) => c.npcs[`${S}:npc/fishmonger`].shop.offers[0];
  const refused = (edit: (c: any) => void) => {
    const r = reload(edit);
    return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path, r.diagnostic.data?.error];
  };
  const at = `.cartridge.npcs["${S}:npc/fishmonger"].shop.offers[0].stock`;
  const invalid = ['SCHEMA_VIOLATION', at, 'invalid_value'];
  assert.deepEqual(
    refused((c) => offer(c).stock.buy.pop()),
    invalid,
  );
  assert.deepEqual(
    refused((c) => offer(c).stock.items.reverse()),
    invalid,
  );
  assert.deepEqual(
    refused((c) => (offer(c).stock.items[2] = ref('fish_b'))),
    ['DUPLICATE_DEFINITION', `${at}.items`, undefined],
  );
  const basket = ref('basket');
  assert.deepEqual(
    refused((c) => {
      c.npcs[`${S}:npc/fishmonger`].shop.offers.push({ item: basket, buy: 1, sell: 1 });
      offer(c).stock.items[2] = basket;
    }),
    ['DUPLICATE_DEFINITION', `${at}.items`, undefined],
  );
  assert.deepEqual(
    refused((c) => (offer(c).buy = 4)),
    invalid,
  );
  assert.deepEqual(
    refused((c) => (offer(c).stock.items[2] = ref('nowhere'))),
    ['UNRESOLVED_REFERENCE', `${at}.items[2]`, undefined],
  );
  // The discount minimum must not exceed any table entry (fish_c alone costs 2).
  const discount = (minimum: number) => (c: any) => {
    const npc = c.npcs[`${S}:npc/fishmonger`];
    npc.shop.buy_discount = { friendly: true, numerator: 1, denominator: 2, minimum };
    npc.disposition = { friendly: { policy_version: 1, root: { op: 'all', items: [] } } };
    c.manifest.requires.capabilities.policy = c.lock.capabilities.policy = 1;
  };
  assert.deepEqual(refused(discount(2)), 'loaded');
  assert.deepEqual(refused(discount(3)), [
    'RESOURCE_SPEC_INVALID',
    `.cartridge.npcs["${S}:npc/fishmonger"].shop.buy_discount`,
    undefined,
  ]);
  assert.deepEqual(
    refused((c) => (c.manifest.requires.kernel_api.at_least = '1.81')),
    ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least', undefined],
  );
});
