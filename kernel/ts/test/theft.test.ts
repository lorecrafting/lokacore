// Toolbox rows 33 and 34 on the compiled theft sampler (mechanics.md "Theft, fence and witnessed
// offense"): the square's merchant (alertness 0, alone) holds a purse with a coin in it; the market's
// shopkeeper (alertness 0) holds and sells a clean ring beside the guard (alertness 3, hostile while
// wanted); the alley's fence buys stolen purses and rings (sell 3); the strongroom's vault (pennies 20)
// holds a ledger under an always-refusing get lock. The player starts with 10 pennies, stealth 0.
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
import { statusKey } from '../src/mechanics/status/shared.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-theft-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/theft_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const S = 'theft_sampler@0.0.1';
const ref = (kind: string, key: string) =>
  ({ cartridge_id: 'theft_sampler', cartridge_version: '0.0.1', kind, key }) as never;

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
const diagnostic = (edit: (c: any) => void) => {
  const r = reload(edit);
  return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path];
};
function fresh(edit?: (c: any) => void) {
  const r = reload(edit);
  assert.ok(r.ok, JSON.stringify(r));
  n = 0;
  return newWorld(r.cartridge as Cartridge, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e33' as never, [1]);
}

let n = 0;
function send(w: World, payload: object) {
  const id = `eeeeeeee-3333-4033-8033-${String(++n).padStart(12, '0')}`;
  const command = {
    id,
    world_context_id: w.context,
    payload: { actor_id: w.character, ...payload },
  };
  return step(w, command as never, n);
}
function play(w: World, payload: object) {
  const r = send(w, payload);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return { w: r.world, d: r.decision as Extract<typeof r.decision, { kind: 'accepted' }> };
}
const refused = (w: World, payload: object) => {
  const r = send(w, payload);
  return r.decision.kind === 'accepted' ? 'accepted' : (r.decision as any).error.code;
};
const npc = (w: World, k: string) => w.entityIds[`${S}:npc/${k}`]!;
const item = (w: World, k: string) => w.entityIds[`${S}:item/${k}`]!;
const pennies = (w: World, who = w.body) => level(w, who, resourceRef(w, 'pennies'));
const stolen = (w: World, k: string) => value(w, w.character, ref('fact', 'stolen'), item(w, k));
const wanted = (w: World) => value(w, w.character, ref('fact', 'wanted'));
const go = (w: World, direction: string) => play(w, { type: 'move', direction }).w;
const take = (w: World, k: string) => ({ type: 'take', item_id: item(w, k) });
const lines = (d: { narration?: readonly { key: unknown }[] }) =>
  (d.narration ?? []).map((t) => t.key);
/** Each event's type, position and the fact or custom event it names. */
const kinds = (d: { events: readonly { position: number; payload: object }[] }) =>
  d.events.map(({ position, payload: p }: any) => [p.type, position, (p.fact ?? p.event)?.key]);
const alertness = (k: string, v: number) => (c: any) =>
  (c.npcs[`${S}:npc/${k}`].attributes = [{ attribute: ref('attribute', 'alertness'), value: v }]);

// Breaks: NPC holdings listed without world.theft (transcripts.test.ts pins Chapter 1), listed at
// depth (the coin inside the purse), or listed without take.
test("1. the square lists the merchant's purse, directly held, with take", () => {
  const w = fresh();
  const merchant = gameView(w).entities.find((e) => e.id === npc(w, 'merchant'))!;
  assert.deepEqual(
    merchant.contents?.map((c) => [c.id, c.actions.map((a) => [a.action_key, a.available])]),
    [[item(w, 'purse'), [['take', true]]]],
  );
});

// Breaks: noticing with <= (alertness 0 vs stealth 0 seen), the victim counted as its own
// bystander, the stolen mark not written, or the skill use not recorded.
test('2. lifting the purse from the lone merchant is unseen and marks it stolen', () => {
  const w0 = fresh();
  const { w, d } = play(w0, take(w0, 'purse'));
  assert.equal(w.state.containers[item(w, 'purse')], w.body);
  assert.equal(stolen(w, 'purse'), true);
  assert.equal(wanted(w), false);
  assert.deepEqual(kinds(d), [
    ['item_acquired', 1, undefined],
    ['fact_changed', 2, 'stolen'],
    ['fact_changed', 3, 'uses_stealth'],
  ]);
  assert.deepEqual(lines(d), ['theft.unseen']);
  assert.equal(d.delta.ops.filter((o) => o.op === 'fact.assign').length, 2);
});

// Breaks: the fence check skipped or compared loosely, either way: a stolen ring sold back to its
// clean shop, a clean ring sold to the fence, a clean ring refused by its shop, or the fence
// refusing a stolen purse.
test('3. a stolen ring will not sell back to the shopkeeper; the fence buys the stolen purse', () => {
  let c = go(fresh(), 'west');
  const clean = { provider_id: npc(c, 'shopkeeper'), item_id: item(c, 'ring') };
  c = go(go(play(c, { type: 'buy', ...clean, quoted_price: 8 }).w, 'east'), 'east');
  const fenced = { type: 'sell', provider_id: npc(c, 'fence'), item_id: clean.item_id };
  assert.equal(refused(c, { ...fenced, quoted_price: 3 }), 'invalid_state'); // a fence takes no clean ring
  c = play(go(go(c, 'west'), 'west'), { type: 'sell', ...clean, quoted_price: 5 }).w;
  assert.equal(pennies(c), 7); // 10 - 8 + 5: the clean ring sells back
  let w = fresh();
  w = play(w, take(w, 'purse')).w;
  w = go(w, 'west');
  w = play(w, take(w, 'ring')).w;
  const shopkeeper = npc(w, 'shopkeeper');
  const sell = { type: 'sell', provider_id: shopkeeper, item_id: item(w, 'ring'), quoted_price: 5 };
  assert.equal(refused(w, sell), 'invalid_state');
  const shelf = gameView(w).entities.find((e) => e.id === shopkeeper)!.shop![0]!.sell;
  assert.deepEqual([shelf.available, shelf.reason], [false, 'invalid_state']);
  w = go(go(w, 'east'), 'east');
  const fence = npc(w, 'fence');
  w = play(w, { type: 'sell', provider_id: fence, item_id: item(w, 'purse'), quoted_price: 3 }).w;
  assert.equal(pennies(w), 13);
  assert.equal(w.state.containers[item(w, 'purse')], fence);
  assert.equal(stolen(w, 'purse'), true);
});

// Breaks: a sighted bystander (the guard) not counted, the notice on the victim instead of the
// thief, or the notice before the stolen mark and skill use.
test('4. lifting the ring beside the guard is seen: theft_seen on the thief, wanted', () => {
  let w = go(fresh(), 'west');
  const r = play(w, take(w, 'ring'));
  w = r.w;
  assert.deepEqual(kinds(r.d), [
    ['item_acquired', 1, undefined],
    ['fact_changed', 2, 'stolen'],
    ['fact_changed', 3, 'uses_stealth'],
    ['custom_event', 4, 'theft_seen'],
    ['fact_changed', 5, 'wanted'],
  ]);
  assert.equal((r.d.events[3]!.payload as any).subject_id, w.body);
  assert.deepEqual(lines(r.d), ['theft.seen']);
  assert.equal(wanted(w), true);
  // 5. Breaks: the guard not hostile on wanted.
  const back = play(go(w, 'east'), { type: 'move', direction: 'west' }).d;
  const open = back.delta.ops.find((o) => o.op === 'encounter.open') as any;
  assert.equal(open?.npc_id, npc(w, 'guard'));
  assert.ok(lines(back).includes('guard.collars'));
});

// Breaks: witnesses ignoring concealment (the shopkeeper sees a hidden thief), or concealment
// fooling the victim's own notice.
test('6. a hidden thief is still noticed by an alert victim, never by a bystander', () => {
  const hide = (w: World) => {
    const row = { [statusKey(w.body, ref('status', 'hidden'))]: { generation: 1, active: true } };
    return { ...w, state: { ...w.state, statuses: { ...w.state.statuses, ...row } } } as World;
  };
  let w = hide(go(fresh(), 'west'));
  assert.deepEqual(lines(play(w, take(w, 'badge')).d), ['theft.seen']);
  w = hide(go(fresh(alertness('guard', 0)), 'west'));
  const r = play(w, take(w, 'badge'));
  assert.deepEqual([lines(r.d), wanted(r.w)], [['theft.unseen'], false]);
});

// Breaks: the NPC get lock not read (the vault's ledger taken), or theft reaching past what an
// NPC directly holds (the coin inside the merchant's purse).
test('7. the vault refuses its ledger; nested items stay out of reach', () => {
  let w = fresh();
  assert.equal(refused(w, take(w, 'coin')), 'not_present');
  w = go(w, 'south');
  assert.equal(refused(w, take(w, 'ledger')), 'permission_denied');
  assert.equal(w.state.containers[item(w, 'ledger')], npc(w, 'vault'));
  assert.deepEqual(
    [pennies(w, npc(w, 'vault')), value(w, w.character, ref('fact', 'savings'))],
    [20, 0],
  );
});

// Breaks (twin of test/loka/content_theft_test.exs): each loader refusal below loading.
test('8. loader: vault lock, reserved stolen fact, fence offers, floors, stolen fact scope', () => {
  const F = `${S}:npc/fence`;
  const API = '.cartridge.manifest.requires.kernel_api.at_least';
  const api = (c: any) => (c.manifest.requires.kernel_api.at_least = '1.93');
  assert.equal(
    diagnostic(() => {}),
    'loaded',
  );
  assert.deepEqual(
    diagnostic((c) => delete c.npcs[`${S}:npc/vault`].locks),
    ['SCHEMA_VIOLATION', `.cartridge.services["${S}:service/deposit"].benefit.vault`],
  );
  assert.deepEqual(
    diagnostic((c) =>
      c.reactions[`${S}:reaction/theft_seen`].apply.push({
        op: 'fact.assign',
        fact: ref('fact', 'stolen'),
        value: true,
      }),
    ),
    ['RESERVED_FACT', `.cartridge.reactions["${S}:reaction/theft_seen"].apply[1].fact`],
  );
  assert.deepEqual(
    diagnostic((c) => {
      c.npcs[F].shop.offers[0].stock = {
        items: [ref('item', 'purse'), ref('item', 'coin')],
        buy: [6, 6],
      };
    }),
    ['SCHEMA_VIOLATION', `.cartridge.npcs["${F}"].shop.offers[0].stolen`],
  );
  assert.deepEqual(diagnostic(api), ['KERNEL_API_RANGE_INVALID', API]);
  const bare = (c: any) => {
    api(c);
    delete c.world.theft;
  };
  assert.deepEqual(
    diagnostic((c) => {
      bare(c);
      delete c.npcs[F].shop;
    }),
    ['KERNEL_API_RANGE_INVALID', API],
  ); // the vault's NPC lock alone
  assert.deepEqual(
    diagnostic((c) => {
      bare(c);
      delete c.npcs[`${S}:npc/vault`].locks;
    }),
    ['KERNEL_API_RANGE_INVALID', API],
  ); // the fence's stolen offers alone
  assert.deepEqual(
    diagnostic((c) => {
      api(c);
      delete c.npcs[F].shop;
      delete c.npcs[`${S}:npc/vault`].locks;
    }),
    ['KERNEL_API_RANGE_INVALID', API],
  ); // world.theft alone
  assert.deepEqual(
    diagnostic((c) => delete c.npcs[F].shop.offers[0].stolen),
    ['UNRESOLVED_REFERENCE', `.cartridge.npcs["${F}"].shop`],
  );
  assert.deepEqual(
    diagnostic((c) => (c.facts[`${S}:fact/stolen`].scopes = ['player'])),
    ['FACT_SCOPE_UNSUPPORTED', '.cartridge.world.theft.stolen'],
  );
});
