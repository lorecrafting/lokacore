// Toolbox row 20a on the compiled escrow sampler (mechanics.md "Escrow custody"): the smith's
// `commission` costs 3 of the player's 10 pennies and takes 2 of the four ore lying in the forge
// (`escrow {items [ore_a..ore_d], quantity 2, custody vault}`), setting `ordered`. Expected values
// are hand-counted from those literals.
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
import { value } from '../src/mechanics/fact.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-escrow-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/escrow_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const S = 'escrow_sampler@0.0.1';
const ref = (kind: string, key: string) =>
  ({ cartridge_id: 'escrow_sampler', cartridge_version: '0.0.1', kind, key }) as never;

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
function sampler(edit?: (c: any) => void) {
  const r = reload(edit);
  assert.ok(r.ok, JSON.stringify(r));
  return r.cartridge as Cartridge;
}

let n = 0;
function send(w: World, payload: object) {
  const id = `eeeeeeee-2020-4020-8020-${String(++n).padStart(12, '0')}`;
  const command = { id, world_context_id: w.context, payload };
  return step(w, { ...command, payload: { actor_id: w.character, ...payload } } as never, n);
}
function play(w: World, payload: object) {
  const r = send(w, payload);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
function fresh(content = sampler()) {
  n = 0;
  return newWorld(content, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e20' as never, [1, 2, 3, 4]);
}
const ore = (w: World, k: string) => w.entityIds[`${S}:item/ore_${k}`]!;
const smith = (w: World) => w.entityIds[`${S}:npc/smith`]!;
const vault = (w: World) => w.roomIds[`${S}:room/vault`]!;
const take = (w: World, ...ks: string[]) =>
  ks.reduce((x, k) => play(x, { type: 'take', item_id: ore(x, k) }), w);
const pennies = (w: World, who = w.body) => level(w, who, resourceRef(w, 'pennies'));
const ordered = (w: World) => value(w, w.character, ref('fact', 'ordered'));
/** How many of the four ore `holder` holds directly. */
const count = (w: World, holder: string) =>
  ['a', 'b', 'c', 'd'].filter((k) => w.state.containers[ore(w, k)] === holder).length;
const commission = (w: World) =>
  send(w, {
    type: 'use_service',
    provider_id: smith(w),
    service: ref('service', 'commission'),
    quoted_price: 3,
  });
const offer = (w: World) =>
  gameView(w).entities.find((x) => x.id === smith(w))!.services![0].action;
const refused = (w: World, code: string) => {
  const r = commission(w);
  assert.deepEqual(r.decision, { kind: 'rejected', error: { code } });
  assert.equal(r.world, w);
};

// Breaks: no input check (a use with too few ore pays and orders), the escrow transfers dropped
// (the ore stays held), quantity ignored (all three held go), the fact not set or the open check
// missing (a retry takes two more and pays again), a check after the payment, an extra event.
test('the smith takes two ore once; too few is refused and a retry takes none', () => {
  let w = fresh();
  assert.deepEqual([pennies(w), pennies(w, smith(w))], [10, 0]);
  assert.deepEqual(offer(w), {
    ...offer(w),
    available: false,
    reason: { code: 'not_owned', message: { key: 'service.missing_inputs' } },
  });
  refused(w, 'not_owned');

  w = take(w, 'a');
  refused(w, 'not_owned');
  assert.deepEqual([count(w, w.body), pennies(w)], [1, 10]);

  w = take(w, 'b', 'c');
  assert.equal(offer(w).available, true);
  const r = commission(w);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  if (r.decision.kind !== 'accepted') return;
  assert.equal(r.decision.outcome, 'service_used');
  assert.deepEqual(
    r.decision.events.map((x) => x.payload.type),
    ['fact_changed'],
  );
  const moved = r.decision.delta.ops.filter((o) => o.op === 'entity.transfer');
  assert.deepEqual(
    moved.map((o) => [o.writer_group, o.source_id, o.destination_id]),
    [
      [0, w.body, vault(w)],
      [0, w.body, vault(w)],
    ],
  );
  w = r.world;
  assert.deepEqual([count(w, vault(w)), count(w, w.body)], [2, 1]);
  assert.deepEqual([pennies(w), pennies(w, smith(w)), ordered(w)], [7, 3, true]);

  w = take(w, 'd');
  assert.equal(count(w, w.body), 2);
  assert.deepEqual(offer(w), {
    ...offer(w),
    available: false,
    reason: { code: 'invalid_state', message: { key: 'service.order_open' } },
  });
  refused(w, 'invalid_state');
  assert.deepEqual([count(w, w.body), count(w, vault(w))], [2, 2]);
  assert.deepEqual([pennies(w), pennies(w, smith(w))], [7, 3]);
});

// Breaks: inputs moved (or the order set) before the payment check passes.
test('a broke player keeps the ore and gets no order', () => {
  let w = fresh(sampler((c) => (c.resources[`${S}:resource/pennies`].start = 2)));
  w = take(w, 'a', 'b');
  refused(w, 'insufficient_resource');
  assert.deepEqual([count(w, w.body), count(w, vault(w)), ordered(w)], [2, 0, false]);
});

// Breaks: the escrow skips Give's protection, so a protected item goes to the vault.
test('a protected input is refused as Give would refuse it', () => {
  let w = fresh(sampler((c) => (c.items[`${S}:item/ore_b`].give_allowed = false)));
  w = take(w, 'a', 'b');
  refused(w, 'invalid_state');
  assert.deepEqual([count(w, w.body), pennies(w), ordered(w)], [2, 10, false]);
});

// Twin of test/loka/content_escrow_test.exs. Breaks: the loader admits escrow below API 1.79, an
// input that is not an item, a custody that is not a room, a quantity above the inputs, a shop
// offer as an input, or a repeated input, or an escrow without its refusal text.
test('the loader keeps escrow to API 1.79, item inputs, a room custody and its texts', () => {
  const diagnostic = (edit: (c: any) => void) => {
    const r = reload(edit);
    return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path];
  };
  const at = `.cartridge.services["${S}:service/commission"]`;
  const escrow = (c: any) => c.services[`${S}:service/commission`].benefit.escrow;
  const cases: [(c: any) => void, unknown][] = [
    [() => {}, 'loaded'],
    [
      (c) => (c.manifest.requires.kernel_api.at_least = '1.78'),
      ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'],
    ],
    [
      (c) => (escrow(c).items[0] = ref('item', 'nowhere')),
      ['UNRESOLVED_REFERENCE', `${at}.benefit.escrow.items[0]`],
    ],
    [
      (c) => (escrow(c).custody = ref('item', 'ore_a')),
      ['UNRESOLVED_REFERENCE', `${at}.benefit.escrow.custody`],
    ],
    [(c) => (escrow(c).quantity = 5), ['SCHEMA_VIOLATION', `${at}.benefit.escrow.quantity`]],
    [
      (c) => {
        c.manifest.requires.capabilities.commerce = 1;
        c.lock.capabilities.commerce = 1;
        c.npcs[`${S}:npc/smith`].shop = {
          resource: ref('resource', 'pennies'),
          offers: [{ item: ref('item', 'ore_d'), buy: 2, sell: 1 }],
          bought: 'service.unaffordable',
          sold: 'service.unaffordable',
        };
        c.items[`${S}:item/ore_d`].location = { in: 'npc', npc: ref('npc', 'smith') };
      },
      ['SCHEMA_VIOLATION', `${at}.benefit.escrow.items[3]`],
    ],
    [
      (c) => (escrow(c).items[3] = ref('item', 'ore_a')),
      ['DUPLICATE_DEFINITION', `${at}.benefit.escrow.items`],
    ],
    [(c) => delete c.text['service.order_open'], ['UNRESOLVED_REFERENCE', `${at}.headroom`]],
    [(c) => delete c.text['service.missing_inputs'], ['UNRESOLVED_REFERENCE', `${at}.inputs`]],
  ];
  for (const [edit, expected] of cases) assert.deepEqual(diagnostic(edit), expected);
});
