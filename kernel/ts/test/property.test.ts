// Toolbox rows 24 and 25 on the compiled property sampler (mechanics.md "Property and bank"): the
// player starts in the lane with 30 pennies; the seller's `buy_hut` costs 10 and sets `owns_hut`,
// which the hut's enter lock and the chest's get and put locks read. Clerk A (lane) and clerk B
// (market) each offer `deposit` and `withdraw` of 10 pennies for a fee of 1, into the vault NPC
// (pennies 20, other customers' money) on the `savings` account (int 0..1000, default 0). Expected values are hand-counted
// from those literals.
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

const scratch = mkdtempSync(join(tmpdir(), 'loka-property-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/property_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const S = 'property_sampler@0.0.1';
const ref = (kind: string, key: string) =>
  ({ cartridge_id: 'property_sampler', cartridge_version: '0.0.1', kind, key }) as never;

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
  return newWorld(r.cartridge as Cartridge, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e24' as never, [1]);
}

let n = 0;
function send(w: World, payload: object) {
  const id = `eeeeeeee-2424-4024-8024-${String(++n).padStart(12, '0')}`;
  const command = { id, world_context_id: w.context, payload };
  return step(w, { ...command, payload: { actor_id: w.character, ...payload } } as never, n);
}
const code = (w: World, payload: object) => {
  const d = send(w, payload).decision;
  return d.kind === 'accepted' ? 'accepted' : (d as any).error.code;
};
function play(w: World, payload: object) {
  const r = send(w, payload);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
const npc = (w: World, k: string) => w.entityIds[`${S}:npc/${k}`]!;
const item = (w: World, k: string) => w.entityIds[`${S}:item/${k}`]!;
const room = (w: World, k: string) => w.roomIds[`${S}:room/${k}`]!;
const pennies = (w: World, who = w.body) => level(w, who, resourceRef(w, 'pennies'));
const savings = (w: World) => value(w, w.character, ref('fact', 'savings'));
const go = (direction: string) => ({ type: 'move', direction });
const use = (w: World, provider: string, service: string, quoted_price: number) => ({
  type: 'use_service',
  provider_id: npc(w, provider),
  service: ref('service', service),
  quoted_price,
});
const buy = (w: World) => play(w, use(w, 'seller', 'buy_hut', 10));
const offer = (w: World, provider: string, i: number) =>
  gameView(w).entities.find((x) => x.id === npc(w, provider))!.services![i]!.action;
/** [player, vault, clerk A, clerk B] pennies and the account. */
const books = (w: World) => [
  pennies(w),
  pennies(w, npc(w, 'vault')),
  pennies(w, npc(w, 'clerk_a')),
  pennies(w, npc(w, 'clerk_b')),
  savings(w),
];
const noFunds = { code: 'invalid_state', message: { key: 'service.no_funds' } };

// Breaks: the hut's enter lock removed (north accepted before purchase), the chest's get or put
// lock removed, or the entitlement not written (north still refused after buying).
test('a, b. the hut refuses a stranger; bought for 10, the owner enters and uses the chest', () => {
  let w = fresh();
  w = play(w, { type: 'take', item_id: item(w, 'pebble') });
  assert.equal(code(w, go('north')), 'permission_denied');
  w = buy(w);
  assert.deepEqual([pennies(w), pennies(w, npc(w, 'seller'))], [20, 10]);
  assert.equal(value(w, w.character, ref('fact', 'owns_hut')), true);
  w = play(w, go('north'));
  assert.equal(w.state.containers[w.body], room(w, 'hut'));
  const chest = item(w, 'chest');
  w = play(w, { type: 'put', item_id: item(w, 'pebble'), container_id: chest });
  assert.equal(w.state.containers[item(w, 'pebble')], chest);
  w = play(w, { type: 'take', item_id: item(w, 'pebble') });
  assert.equal(w.state.containers[item(w, 'pebble')], w.body);
});

// Breaks: a walking NPC evaluates the enter lock (owns_hut is the player's fact, so the thief
// would still be refused: the open-door case pins the lock refusal), the barrier lock verb does
// not need the key, or the key does not reopen the door.
test('c. the thief is refused the owned hut, open or locked; the key lets the owner back in', () => {
  let w = buy(fresh());
  assert.equal(w.state.containers[npc(w, 'thief')], room(w, 'lane'));
  const open = play(w, { type: 'wait', until: 8.5 * 3600 });
  assert.equal(open.state.containers[npc(open, 'thief')], room(open, 'lane')); // door open
  w = play(w, go('north'));
  w = play(w, { type: 'take', item_id: item(w, 'hut_key') });
  w = [
    go('south'),
    { type: 'close', direction: 'north' },
    { type: 'lock', direction: 'north' },
  ].reduce(play, w);
  assert.equal(code(w, go('north')), 'exit_locked');
  w = play(w, { type: 'wait', until: 8.5 * 3600 });
  assert.equal(w.state.containers[npc(w, 'thief')], room(w, 'lane'));
  w = [
    { type: 'unlock', direction: 'north' },
    { type: 'open', direction: 'north' },
    go('north'),
  ].reduce(play, w);
  assert.equal(w.state.containers[w.body], room(w, 'hut'));
});

// Breaks: withdraw ignores the account (f pays out of the vault's 20), the deposit or withdraw skips the vault
// transfer (vault stays 0 or the player is not paid), the account not written or written by the
// wrong sign, the fee merged with the amount, a branch keeping its own balance (B cannot pay what
// A took), or an offer not sharing the use's transition (h).
test('d, e, f, h. deposit 10 at A, withdraw 10 at B, a second withdraw finds no funds', () => {
  let w = buy(fresh());
  assert.deepEqual(books(w), [20, 20, 0, 0, 0]);
  assert.equal(offer(w, 'clerk_a', 0).available, true);
  assert.deepEqual(offer(w, 'clerk_a', 1), {
    ...offer(w, 'clerk_a', 1),
    available: false,
    reason: noFunds,
  });

  const r = send(w, use(w, 'clerk_a', 'deposit_a', 1));
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  if (r.decision.kind !== 'accepted') return;
  assert.equal(r.decision.outcome, 'service_used');
  assert.deepEqual(
    r.decision.events.map((x) => x.payload.type),
    ['fact_changed'],
  );
  w = r.world;
  assert.deepEqual(books(w), [9, 30, 1, 0, 10]);

  w = play(w, go('east'));
  assert.equal(offer(w, 'clerk_b', 1).available, true);
  w = play(w, use(w, 'clerk_b', 'withdraw_b', 1));
  assert.deepEqual(books(w), [18, 20, 1, 1, 0]);

  assert.deepEqual(offer(w, 'clerk_b', 1), {
    ...offer(w, 'clerk_b', 1),
    available: false,
    reason: noFunds,
  });
  const again = send(w, use(w, 'clerk_b', 'withdraw_b', 1));
  assert.deepEqual(again.decision, {
    kind: 'rejected',
    error: { code: 'invalid_state' },
  });
  assert.equal(again.world, w);
});

// Breaks: the deposit not chained on the fee (a purse of 10 pays fee and amount from 10), or a
// deposit the purse cannot cover accepted or offered.
test('h. a purse of 10 cannot deposit 10 after the fee; offer and use agree', () => {
  const w = fresh((c) => (c.resources[`${S}:resource/pennies`].start = 10));
  const unaffordable = { code: 'insufficient_resource', message: { key: 'service.unaffordable' } };
  assert.deepEqual(offer(w, 'clerk_a', 0), {
    ...offer(w, 'clerk_a', 0),
    available: false,
    reason: unaffordable,
  });
  const r = send(w, use(w, 'clerk_a', 'deposit_a', 1));
  assert.deepEqual(r.decision, { kind: 'rejected', error: { code: 'insufficient_resource' } });
  assert.deepEqual(books(w), [10, 20, 0, 0, 0]);
});

// Twin of test/loka/content_property_test.exs. Breaks: the loader admits deposit or withdraw
// below API 1.83, an account that is not a bounded int player fact from 0, a vault that is not an
// NPC holding the currency, branches on one account with different vaults or currencies, another benefit or an
// authored dialogue write on the account, or a bank service without service.no_funds.
test('g. the loader keeps the bank to API 1.83, a bounded account and one vault', () => {
  const diagnostic = (edit: (c: any) => void) => {
    const r = reload(edit);
    return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path];
  };
  const at = (k: string) => `.cartridge.services["${S}:service/${k}"]`;
  const benefit = (c: any, k: string) => c.services[`${S}:service/${k}`].benefit;
  const savings = (c: any) => c.facts[`${S}:fact/savings`];
  const cases: [(c: any) => void, unknown][] = [
    [() => {}, 'loaded'],
    [
      (c) => (c.manifest.requires.kernel_api.at_least = '1.82'),
      ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'],
    ],
    [
      (c) => (savings(c).value_type.minimum = -5),
      ['SCHEMA_VIOLATION', `${at('deposit_a')}.benefit.account`],
    ],
    [
      (c) => (savings(c).value_type = { type: 'bool', default: false }),
      ['SCHEMA_VIOLATION', `${at('deposit_a')}.benefit.account`],
    ],
    [
      (c) => (benefit(c, 'deposit_a').account = ref('fact', 'nowhere')),
      ['UNRESOLVED_REFERENCE', `${at('deposit_a')}.benefit.account`],
    ],
    [
      (c) => (benefit(c, 'deposit_a').vault = ref('npc', 'nowhere')),
      ['UNRESOLVED_REFERENCE', `${at('deposit_a')}.benefit.vault`],
    ],
    [
      (c) => delete c.npcs[`${S}:npc/vault`].resource_starts,
      ['SCHEMA_VIOLATION', `${at('deposit_a')}.benefit.vault`],
    ],
    [
      (c) => (benefit(c, 'withdraw_b').vault = ref('npc', 'clerk_a')),
      ['SCHEMA_VIOLATION', `${at('deposit_a')}.benefit.vault`],
    ],
    [
      (c) => {
        c.services[`${S}:service/withdraw_b`].currency = ref('resource', 'hp');
        c.npcs[`${S}:npc/vault`].resource_starts.hp = 0;
      },
      ['SCHEMA_VIOLATION', `${at('deposit_a')}.benefit.vault`],
    ],
    [
      (c) => {
        c.manifest.requires.capabilities.dialogue = c.lock.capabilities.dialogue = 1;
        const sequence = [{ op: 'fact.adjust', fact: ref('fact', 'savings'), amount: 1 }];
        c.dialogues = {
          [`${S}:dialogue/gift`]: {
            key: 'gift',
            npc: ref('npc', 'clerk_a'),
            policy: { policy_version: 1, root: { op: 'all', items: [] } },
            prompt: 'service.deposit',
            roles: { clerk: { role: 'npc', npc: ref('npc', 'clerk_a') } },
            choices: { gift: { label: 'service.deposit', narration: 'npc.vault.short', sequence } },
          },
        };
      },
      ['RESERVED_FACT', `.cartridge.dialogues["${S}:dialogue/gift"].choices.gift.sequence[0].fact`],
    ],
    [
      (c) => (c.services[`${S}:service/buy_hut`].benefit.fact = ref('fact', 'savings')),
      ['SCHEMA_VIOLATION', `${at('buy_hut')}.benefit.fact`],
    ],
    [
      (c) => delete c.text['service.no_funds'],
      ['UNRESOLVED_REFERENCE', `${at('deposit_a')}.funds`],
    ],
  ];
  for (const [edit, expected] of cases) assert.deepEqual(diagnostic(edit), expected, String(edit));
});
