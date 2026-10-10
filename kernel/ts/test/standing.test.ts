// Toolbox rows 15 and G11 on the compiled standing sampler: village standing (an instance fact)
// and per-NPC trust (a pair fact) open a discount, a warm greeting and a hostile guard; a given
// apple raises the receiver's trust, a stone does not; disposition, derived from both, makes Peg
// refuse trade and the guard engage. Expected values are hand-counted from the sampler.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import type { EntityId } from '../src/contracts.gen.ts';
import { decode, encode } from '../src/foundation/canonical.ts';
import { pending, spokenBy } from '../src/mechanics/dialogue/shared.ts';
import { shelf } from '../src/mechanics/commerce/shared.ts';
import { engaged } from '../src/mechanics/combat/shared.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-standing-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/standing_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const loaded = loadCartridge(artifact, INSTALLED);
assert.ok(loaded.ok, JSON.stringify(loaded));
const content = loaded.cartridge as Cartridge;
const source = (decode(new TextDecoder().decode(artifact)) as { cartridge: any }).cartridge;
const S = 'standing_sampler@0.0.1';
const CONTEXT = '1e5f9b6d-4a2c-4d3b-8f8e-7c6b5d4e3f2a';
const id = (w: World, kind: string, k: string) => w.entityIds[`${S}:${kind}/${k}`] as EntityId;
let n = 0;
const run = (w: World, p: object) => {
  n += 1;
  const cid = `dddddddd-5555-4333-8444-${String(n).padStart(12, '0')}`;
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
const fresh = (c = content) => newWorld(c, CONTEXT as never, [1, 2, 3, 4]);
// The sampler loaded with a test-local change to its compiled cartridge.
const reload = (change: (c: any) => void) => {
  const c = structuredClone(source);
  change(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
};
const variant = (change: (c: any) => void) => {
  const r = reload(change);
  assert.ok(r.ok, JSON.stringify(r));
  return r.cartridge as Cartridge;
};
// Talk to Maud and pick `choice`.
const maud = (w: World, choice: string) => {
  const talked = act(w, { type: 'talk', target_id: id(w, 'npc', 'maud') });
  const [continuation_id] = pending(talked, talked.character)!;
  return act(talked, { type: 'choose', choice_id: choice, continuation_id });
};
const trust = (w: World, who: string) =>
  Object.entries(w.state.facts ?? {}).find(([k]) => {
    const t = decode(k) as any;
    return t.fact.key === 'trust' && t.subject_id === id(w, 'npc', who);
  })?.[1] ?? 0;
const give = (w: World, item: string, to: string) => {
  const thing = id(w, 'item', item);
  return act(act(w, { type: 'take', item_id: thing }), {
    type: 'give',
    item_id: thing,
    recipient_id: id(w, 'npc', to),
  });
};
const greeting = (w: World) => spokenBy(w, w.character, id(w, 'npc', 'maud'))?.key;
const bread = (w: World) => shelf(w, id(w, 'npc', 'peg'))![0].buy;

// Breaks: a reaction's fact.adjust writes nothing, writes the giver's body or a shared row, or a
// stone (no authored gift) counts; Maud's warm greeting ignores her pair fact.
test('a given apple raises Maud trust once and opens her warm greeting; a stone does not', () => {
  let w = fresh();
  assert.equal(greeting(w), 'maud_talk');
  w = give(w, 'stone', 'maud');
  assert.equal(trust(w, 'maud'), 0);
  w = act(w, { type: 'take', item_id: id(w, 'item', 'apple') }); // the player holds it: no subject
  assert.equal(trust(w, 'maud'), 0);
  w = act(w, { type: 'give', item_id: id(w, 'item', 'apple'), recipient_id: id(w, 'npc', 'maud') });
  assert.equal(trust(w, 'maud'), 1);
  assert.equal(trust(w, 'guard'), 0);
  assert.equal(greeting(w), 'maud_greet');
});

// Breaks: a friendly discount ignores the disposition (always or never applies), or the buy
// check and the shelf disagree on the price.
test('good standing makes Peg friendly: bread at 2, not 4, and the buy at 2 is accepted', () => {
  let w = fresh();
  assert.deepEqual([bread(w).price, bread(w).available, bread(w).reason], [4, true, undefined]);
  w = maud(w, 'help');
  assert.deepEqual([bread(w).price, bread(w).available], [2, true]);
  assert.equal(greeting(w), 'maud_greet');
  const loaf = id(w, 'item', 'bread');
  const peg = id(w, 'npc', 'peg');
  assert.equal(
    run(w, { type: 'buy', provider_id: peg, item_id: loaf, quoted_price: 4 }).decision.kind,
    'rejected',
  );
  w = act(w, { type: 'buy', provider_id: peg, item_id: loaf, quoted_price: 2 });
  assert.equal(w.state.containers[loaf], w.body);
});

// Breaks: hostility is never derived (Peg trades, the guard lets the player pass), it is stored
// or read from the actor's scope instead of the guard's pair fact (an apple to the guard does not
// calm him), the engage line is missing, or a hostile Peg still talks.
test('low standing makes Peg refuse and the guard engage, unless he trusts the player', () => {
  const pegTalks = (w: World) => run(w, { type: 'talk', target_id: id(w, 'npc', 'peg') });
  assert.equal(pegTalks(fresh()).decision.kind, 'accepted');
  // Wary (no standing change): the guard lets the player walk in; an apple to him earns his trust.
  let wary = act(fresh(), { type: 'take', item_id: id(fresh(), 'item', 'apple') });
  wary = act(wary, { type: 'move', direction: 'east' });
  assert.equal(engaged(wary, wary.body), undefined);
  wary = act(wary, {
    type: 'give',
    item_id: id(wary, 'item', 'apple'),
    recipient_id: id(wary, 'npc', 'guard'),
  });
  const trusted = act(wary, { type: 'move', direction: 'west' });
  const low = maud(fresh(), 'wrong');
  assert.deepEqual([bread(low).available, bread(low).reason], [false, 'invalid_state']);
  assert.equal(pegTalks(low).decision.kind, 'rejected');
  const s = run(low, { type: 'move', direction: 'east' });
  assert.equal(s.decision.kind, 'accepted');
  const fight = engaged(s.world, s.world.body);
  assert.equal(fight?.row.npc_id, id(low, 'npc', 'guard'));
  assert.ok(
    (s.decision as any).narration.some((t: any) => t.key === 'npc.guard.engage'),
    JSON.stringify(s.decision),
  );
  const calm = act(maud(trusted, 'wrong'), { type: 'move', direction: 'east' });
  assert.equal(engaged(calm, calm.body), undefined);
});

// Breaks: friendly is read before hostile, so an NPC for whom both hold sells at the discount
// and talks (mechanics.md G11: hostile while its condition holds, else friendly).
test('hostile wins over friendly when both hold', () => {
  const always = variant((c) => {
    c.npcs[`${S}:npc/peg`].disposition.friendly.root = { op: 'all', items: [] };
  });
  assert.equal(bread(fresh(always)).price, 2);
  const low = maud(fresh(always), 'wrong');
  assert.equal(bread(low).available, false);
  assert.equal(
    run(low, { type: 'talk', target_id: id(low, 'npc', 'peg') }).decision.kind,
    'rejected',
  );
});

// Breaks: a hostile NPC engages in a sanctuary, or on a flight into its room (G11 Limits).
test('no engage in a sanctuary or on a flight into a hostile room; a walk-in engages', () => {
  const calm = variant((c) => (c.rooms[`${S}:room/gate`].sanctuary = true));
  const safe = act(maud(fresh(calm), 'wrong'), { type: 'move', direction: 'east' });
  assert.equal(engaged(safe, safe.body), undefined);
  // Peg armed as the guard is: hostile at low standing, she engages a walk-in to the square.
  const armed = variant((c) => {
    const peg = c.npcs[`${S}:npc/peg`];
    const guard = c.npcs[`${S}:npc/guard`];
    Object.assign(peg, { hp: guard.hp, attack: guard.attack });
    peg.disposition.engage = guard.disposition.engage;
  });
  const fight = act(maud(fresh(armed), 'wrong'), { type: 'move', direction: 'east' });
  assert.equal(engaged(fight, fight.body)?.row.npc_id, id(fight, 'npc', 'guard'));
  const fled = act(fight, { type: 'flee' });
  assert.equal(fled.state.containers[fled.body], fled.roomIds[`${S}:room/square`]);
  assert.equal(engaged(fled, fled.body), undefined);
  let w = act(fresh(armed), { type: 'take', item_id: id(fresh(armed), 'item', 'apple') });
  w = act(w, { type: 'move', direction: 'east' });
  w = act(w, {
    type: 'give',
    item_id: id(w, 'item', 'apple'),
    recipient_id: id(w, 'npc', 'guard'),
  });
  w = act(maud(act(w, { type: 'move', direction: 'west' }), 'wrong'), {
    type: 'move',
    direction: 'east',
  });
  w = act(w, { type: 'move', direction: 'west' });
  assert.equal(engaged(w, w.body)?.row.npc_id, id(w, 'npc', 'peg'));
});

// Breaks: the loader admits row 15 or G11 below 1.47, a reaction fact.adjust on a non-int fact,
// an engage line on an NPC without an attack, a disposition on a spawn template (its walk-in
// encounter has no active_ids, so the save would not reopen), or a friendly discount without a friendly
// disposition, or one with a skill too (the schema's exactlyOneRequired).
test('rows 15 and G11 need 1.47, an int fact, an engage only with an attack, a friendly NPC', () => {
  const guard = `.cartridge.npcs[${JSON.stringify(`${S}:npc/guard`)}]`;
  const peg = `.cartridge.npcs[${JSON.stringify(`${S}:npc/peg`)}]`;
  const gift = `.cartridge.reactions[${JSON.stringify(`${S}:reaction/gift_apple`)}]`;
  const rows: [(c: any) => void, string, string][] = [
    [
      (c) => {
        // Without W2's pair fact, whose own floor would report the same diagnostic.
        delete c.facts[`${S}:fact/trust`].per_subject;
        c.dialogues[`${S}:dialogue/maud_greet`].policy.root = { op: 'all', items: [] };
        const hostile = c.npcs[`${S}:npc/guard`].disposition.hostile;
        hostile.root = hostile.root.items[0];
        c.manifest.requires.kernel_api.at_least = '1.46';
      },
      'KERNEL_API_RANGE_INVALID',
      '.cartridge.manifest.requires.kernel_api.at_least',
    ],
    [
      (c) => {
        const value_type = { type: 'bool', default: false };
        c.facts[`${S}:fact/flag`] = {
          key: 'flag',
          meaning: 'A flag.',
          scopes: ['instance'],
          value_type,
          version: 1,
        };
        c.reactions[`${S}:reaction/gift_apple`].apply[0].fact.key = 'flag';
      },
      'FACT_TYPE_MISMATCH',
      `${gift}.apply[0].fact`,
    ],
    [(c) => delete c.npcs[`${S}:npc/guard`].attack, 'SCHEMA_VIOLATION', `${guard}.disposition`],
    [
      (c) => (c.npcs[`${S}:npc/guard`].spawn_template = true),
      'SCHEMA_VIOLATION',
      `${guard}.disposition`,
    ],
    [
      (c) => delete c.npcs[`${S}:npc/peg`].disposition.friendly,
      'RESOURCE_SPEC_INVALID',
      `${peg}.shop.buy_discount`,
    ],
    [
      (c) =>
        (c.npcs[`${S}:npc/peg`].shop.buy_discount.skill = {
          cartridge_id: 'standing_sampler',
          cartridge_version: '0.0.1',
          kind: 'skill',
          key: 'haggle',
        }),
      'SCHEMA_VIOLATION',
      `${peg}.shop.buy_discount`,
    ],
  ];
  for (const [change, code, path] of rows) {
    const r = reload(change);
    assert.deepEqual(r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path], [code, path]);
  }
});
