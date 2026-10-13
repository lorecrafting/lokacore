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
import { INSTALLED, gameView, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { encode } from '../src/foundation/canonical.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
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
// missing (a retry takes two more and pays again), the inputs checked before the open order (one
// ore held reads missing_inputs), an extra event.
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
  const open = { code: 'invalid_state', message: { key: 'service.order_open' } };
  assert.deepEqual(offer(w), { ...offer(w), available: false, reason: open });
  refused(w, 'invalid_state');

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

// Breaks: the payment refusal skipped when the inputs are held (the ore leaves, the order is set).
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

// Toolbox row 20b (mechanics.md "Timed job claim and cancel"): `commission` also carries
// `ready_after 3600, output sword`; `claim` and `cancel` cost 1 penny each.
const sword = (w: World) => w.entityIds[`${S}:item/sword`]!;
const use = (w: World, key: string, quoted_price = 1) =>
  send(w, {
    type: 'use_service',
    provider_id: smith(w),
    service: ref('service', key),
    quoted_price,
  });
const offers = (w: World) =>
  gameView(w)
    .entities.find((x) => x.id === smith(w))!
    .services!.map((s) => s.action);
const elapse = (w: World, until: number) => {
  const run_id = `aaaaaaaa-2020-4020-8020-${String(++n).padStart(12, '0')}`;
  const from = w.state.clock;
  const payload = { type: 'elapsed', actor_id: w.character, run_id, from, until };
  const command = { id: elapsedCommandId(run_id, w.context, from, until), payload };
  const r = stepElapsed(w, { ...command, world_context_id: w.context } as never, n);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
};
const ordering = (content = sampler()) => {
  const w = take(fresh(content), 'a', 'b');
  return used(w, 'commission', 3);
};
const used = (w: World, key: string, quoted_price = 1) => {
  const r = use(w, key, quoted_price);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
};
const refusedUse = (w: World, key: string, code: string, reason: string, price = 1) => {
  const r = use(w, key, price);
  assert.deepEqual(r.decision, { kind: 'rejected', error: { code } });
  assert.equal(r.world, w);
  const at = offers(w).find((o) => o.action_key === key)!;
  assert.deepEqual(at, { ...at, available: false, reason: { code, message: { key: reason } } });
};
const vaulted = (w: World) => [count(w, w.body), count(w, vault(w)), ordered(w)];

// Breaks: no job scheduled (the claim succeeds at once), the claim leaves `ordered` true (a second
// claim takes nothing but pays), the sword not moved, the not_ready or no_output check missing, a
// re-order taken with the sword gone from custody (the order could never be claimed).
test('the sword is ready an hour after the order and is claimed once', () => {
  let w = ordering();
  const c0 = w.state.clock;
  assert.deepEqual([pennies(w), pennies(w, smith(w)), ...vaulted(w)], [7, 3, 0, 2, true]);
  refusedUse(w, 'claim', 'invalid_state', 'service.not_ready');
  w = elapse(w, c0 + 3599);
  refusedUse(w, 'claim', 'invalid_state', 'service.not_ready');
  w = elapse(w, c0 + 3600);
  assert.deepEqual(
    offers(w).map((o) => [o.action_key, o.available]),
    [
      ['commission', false],
      ['claim', true],
      ['cancel', false],
    ],
  );
  refusedUse(w, 'cancel', 'invalid_state', 'service.ready');
  const gone = { ...w.state.containers, [sword(w)]: smith(w) };
  refusedUse(
    { ...w, state: { ...w.state, containers: gone } },
    'claim',
    'not_found',
    'service.no_output',
  );
  w = used(w, 'claim');
  assert.equal(w.state.containers[sword(w)], w.body);
  assert.deepEqual([pennies(w), pennies(w, smith(w)), ...vaulted(w)], [6, 4, 0, 2, false]);
  refusedUse(w, 'claim', 'invalid_state', 'service.no_order');
  refusedUse(w, 'cancel', 'invalid_state', 'service.no_order');
  refusedUse(w, 'commission', 'not_found', 'service.no_output', 3);
});

// Breaks: the fee returned (more than 6 pennies), the inputs kept in the vault, `ordered` left
// true (a second cancel pays again).
test('a cancel before the due time returns the ore, never the price', () => {
  let w = ordering();
  w = elapse(w, w.state.clock + 1800);
  w = used(w, 'cancel');
  assert.deepEqual([pennies(w), pennies(w, smith(w)), ...vaulted(w)], [6, 4, 2, 0, false]);
  assert.equal(w.state.containers[sword(w)], vault(w));
  refusedUse(w, 'cancel', 'invalid_state', 'service.no_order');
  refusedUse(w, 'claim', 'invalid_state', 'service.no_order');
});

// Breaks: ready read from the marker or any completed job instead of "no pending job of that
// service": the cancelled order's inert job would make the new order ready at C0 + 3600.
test('a new order after a cancel waits for its own job', () => {
  let w = ordering();
  const c0 = w.state.clock;
  w = elapse(w, c0 + 1800);
  w = used(w, 'cancel');
  w = used(w, 'commission', 3);
  assert.deepEqual([pennies(w), ...vaulted(w)], [3, 0, 2, true]);
  w = elapse(w, c0 + 3600);
  refusedUse(w, 'claim', 'invalid_state', 'service.not_ready');
  w = elapse(w, c0 + 5399);
  refusedUse(w, 'claim', 'invalid_state', 'service.not_ready');
  w = elapse(w, c0 + 5400);
  w = used(w, 'claim');
  assert.equal(w.state.containers[sword(w)], w.body);
});

// Twin of test/loka/content_escrow_test.exs. Breaks: the loader admits claim, cancel or a timed
// escrow below API 1.80, a claim naming a service with no ready_after, an output outside custody,
// a timed escrow without the schedule capability, another entitlement naming the timed order's
// fact (it would open an order with no ore and no job), or a claim or cancel without its texts.
test('the loader keeps claim and cancel to API 1.80, a timed commission and its texts', () => {
  const diagnostic = (edit: (c: any) => void) => {
    const r = reload(edit);
    return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path];
  };
  const at = (k: string) => `.cartridge.services["${S}:service/${k}"]`;
  const svc = (c: any, k: string) => c.services[`${S}:service/${k}`];
  const cases: [(c: any) => void, unknown][] = [
    [
      (c) => (c.manifest.requires.kernel_api.at_least = '1.79'),
      ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'],
    ],
    [
      (c) => (svc(c, 'claim').benefit.service = ref('service', 'cancel')),
      ['SCHEMA_VIOLATION', `${at('claim')}.benefit.service`],
    ],
    [
      (c) => (svc(c, 'cancel').benefit.service = ref('service', 'nowhere')),
      ['UNRESOLVED_REFERENCE', `${at('cancel')}.benefit.service`],
    ],
    [
      (c) => (c.items[`${S}:item/sword`].location.room = ref('room', 'forge')),
      ['SCHEMA_VIOLATION', `${at('commission')}.benefit.escrow.output`],
    ],
    [
      (c) => (svc(c, 'commission').benefit.escrow.output = ref('item', 'nowhere')),
      ['UNRESOLVED_REFERENCE', `${at('commission')}.benefit.escrow.output`],
    ],
    [
      (c) => {
        delete c.lock.capabilities.schedule;
        delete c.manifest.requires.capabilities.schedule;
        delete c.manifest.time_policy;
      },
      ['UNDECLARED_CAPABILITY', `${at('commission')}.benefit.escrow.ready_after`],
    ],
    [
      (c) => {
        svc(c, 'cancel').benefit = { kind: 'entitlement', fact: ref('fact', 'ordered') };
        c.text['service.already_paid'] = 'Already paid.';
      },
      ['SCHEMA_VIOLATION', `${at('cancel')}.benefit.fact`],
    ],
    [(c) => delete c.text['service.not_ready'], ['UNRESOLVED_REFERENCE', `${at('claim')}.wait`]],
    [(c) => delete c.text['service.no_output'], ['UNRESOLVED_REFERENCE', `${at('claim')}.output`]],
    [(c) => delete c.text['service.ready'], ['UNRESOLVED_REFERENCE', `${at('cancel')}.ready`]],
    [(c) => delete c.text['service.no_order'], ['UNRESOLVED_REFERENCE', `${at('cancel')}.order`]],
  ];
  for (const [edit, expected] of cases) assert.deepEqual(diagnostic(edit), expected);
});
