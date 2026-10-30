// Toolbox row 21 on the compiled durability sampler (mechanics.md "Durability, crafting quality
// and repair"): the iron sword hits for a sure 5 and wears 1 off `edge` (0..2, default 2) per hit;
// unarmed is a sure 1; the straw dummy has 30 HP and never hits; the smith's `mend` costs 2 of the
// player's 5 pennies and restores up to 2 edge. Expected numbers are hand-computed.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { gameView, newWorld } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { value } from '../src/mechanics/fact.ts';
import { cartridgeOf, commands, ctx, reload } from './harness.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-durability-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/durability_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const S = 'durability_sampler@0.0.1';
const ref = (kind: string, key: string) =>
  ({ cartridge_id: 'durability_sampler', cartridge_version: '0.0.1', kind, key }) as never;

const base = cartridgeOf(artifact);
function sampler(edit?: (c: any) => void) {
  const r = reload(base, edit);
  assert.ok(r.ok, JSON.stringify(r));
  return r.cartridge as Cartridge;
}

const stream = commands('eeeeeeee-2121-4121-8121', 'aaaaaaaa-0000-4000-8000');
const { send, play } = stream;
const round = (w: World) => stream.elapsed(w, w.state.clock + 150);
const e = (w: World, kind: string, key: string) => w.entityIds[`${S}:${kind}/${key}`]!;
const sword = (w: World) => e(w, 'item', 'sword');
const dummy = (w: World) => level(w, e(w, 'npc', 'dummy'), resourceRef(w, 'hp'));
const pennies = (w: World, who = w.body) => level(w, who as never, resourceRef(w, 'pennies'));
const edge = (w: World, item = sword(w)) => value(w, w.character, ref('fact', 'edge'), item);
const name = (w: World) => gameView(w).equipment!.find((s) => s.item?.id === sword(w))?.item?.name;
const mend = (w: World) =>
  send(w, {
    type: 'use_service',
    provider_id: e(w, 'npc', 'smith'),
    service: ref('service', 'mend'),
    quoted_price: 2,
  });
const offer = (w: World) =>
  gameView(w).entities.find((x) => x.id === e(w, 'npc', 'smith'))!.services![0].action;

/** As `ancestry`, take and wield `item` and attack the dummy. */
function armed(content = sampler(), item = 'sword', ancestry = 'smith') {
  stream.n = 0;
  let w = newWorld(content, ctx('3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e21'), [2, 1, 2, 1]);
  w = play(w, { type: 'choose_ancestry', ancestry });
  w = play(w, { type: 'take', item_id: e(w, 'item', item) });
  return play(w, { type: 'wear', item_id: e(w, 'item', item) });
}
/** As `ancestry`, carry the sword and the hammer (a use target lies in the body, not a slot). */
function forging(content: Cartridge, ancestry = 'smith') {
  stream.n = 0;
  let w = newWorld(content, ctx('3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e21'), [2, 1, 2, 1]);
  w = play(w, { type: 'choose_ancestry', ancestry });
  w = play(w, { type: 'take', item_id: e(w, 'item', 'sword') });
  return play(w, { type: 'take', item_id: e(w, 'item', 'hammer') });
}
const fight = (w: World) => play(w, { type: 'attack', target_id: e(w, 'npc', 'dummy') });
/** Leave the fight and come back to the smith. */
const disengage = (w: World) =>
  play(play(w, { type: 'flee' }), { type: 'move', direction: 'south' });

// Breaks: no wear op, wear on a miss, no broken clause (the third hit deals 5), `<` for `<=` in
// broken, a broken weapon still worn, repair adding past the maximum, a repaired sword striking
// unarmed, the fee not moved.
test('the sword breaks after two hits, the smith mends it for two pennies and it strikes again', () => {
  let w = round(fight(armed()));
  assert.deepEqual([dummy(w), edge(w)], [25, 1]);
  w = round(w);
  assert.deepEqual([dummy(w), edge(w), name(w)], [20, 0, 'item.sword.short_broken']);
  w = round(w);
  assert.deepEqual([dummy(w), edge(w)], [19, 0], 'broken: unarmed, no further wear');
  w = disengage(w);
  assert.equal(offer(w).available, true);
  w = mend(w).world;
  assert.deepEqual([pennies(w), pennies(w, e(w, 'npc', 'smith')), edge(w)], [3, 2, 2]);
  w = round(fight(w));
  assert.deepEqual([dummy(w), edge(w)], [14, 1]);
  w = mend(disengage(w)).world;
  assert.deepEqual([edge(w), pennies(w)], [2, 1], 'capped at the maximum, not 3');
});

// Breaks: the headroom refusal is dropped (charged at full edge), the offer and the command
// disagree, any carried weapon is repaired, or a short purse is charged.
test('mend refuses a sword at full edge, one not wielded and a short purse, before any charge', () => {
  const refused = (w: World, code: string, key: string) => {
    const r = mend(w);
    assert.deepEqual(r.decision, { kind: 'rejected', error: { code } });
    const shown = offer(w);
    assert.deepEqual(shown.available === false && shown.reason, { code, message: { key } });
    return r.world;
  };
  assert.equal(pennies(refused(armed(), 'invalid_state', 'service.full_durability')), 5);
  const worn = sampler((c) => (c.facts[`${S}:fact/edge`].value_type.default = 1));
  const w = armed(worn);
  const carried = play(w, { type: 'remove', item_id: sword(w) });
  assert.equal(pennies(refused(carried, 'invalid_state', 'service.nothing_to_repair')), 5);
  const poor = sampler((c) => {
    c.facts[`${S}:fact/edge`].value_type.default = 1;
    c.resources[`${S}:resource/pennies`].start = 1;
  });
  assert.equal(edge(refused(armed(poor), 'insufficient_resource', 'service.unaffordable')), 1);
  assert.equal(edge(mend(play(carried, { type: 'wear', item_id: sword(w) })).world), 2);
});

// Breaks: a miss wears the weapon, or a fully resisted hit (loss 0) does not.
test('the wooden sword misses and keeps its edge; a resisted hit still wears', () => {
  const w = round(fight(armed(sampler(), 'stick')));
  assert.deepEqual([dummy(w), edge(w, e(w, 'item', 'stick'))], [30, 2]);
  const straw = sampler((c) => (c.npcs[`${S}:npc/dummy`].resistances = { sharp: 100 }));
  const resisted = round(fight(armed(straw)));
  assert.deepEqual([dummy(resisted), edge(resisted)], [30, 1]);
});

// Breaks: repair mends whatever weapon is wielded, not only one whose durability is its fact.
test('mend refuses a wielded weapon whose durability is another fact', () => {
  const temper = sampler((c) => {
    const edge = c.facts[`${S}:fact/edge`];
    c.facts[`${S}:fact/temper`] = {
      ...edge,
      key: 'temper',
      value_type: { ...edge.value_type, default: 1 },
    };
    c.facts[`${S}:fact/edge`].value_type.default = 1;
    c.items[`${S}:item/sword`].weapon.durability.fact = ref('fact', 'temper');
  });
  const r = mend(armed(temper));
  assert.deepEqual(r.decision, { kind: 'rejected', error: { code: 'invalid_state' } });
  const shown = offer(armed(temper));
  assert.deepEqual(shown.available === false && shown.reason, {
    code: 'invalid_state',
    message: { key: 'service.nothing_to_repair' },
  });
});

// Breaks: the durability owner check is dropped, so a scripted action or a reaction writes the edge.
test('only combat and the smith write the edge', () => {
  const assign = { op: 'fact.assign', fact: ref('fact', 'edge'), value: 0 };
  const scripted = sampler((c) =>
    c.scripted_actions[`${S}:action/forge`].outcomes.success.sequence.push(assign),
  );
  const w = forging(scripted);
  const forged = send(w, {
    type: 'perform',
    action: 'forge',
    target_id: sword(w),
    item_id: e(w, 'item', 'hammer'),
  });
  assert.deepEqual(forged.decision, { kind: 'fault', code: 'evaluator_error' });
  const reaction = sampler((c) => {
    c.lock.capabilities.reaction = c.manifest.requires.capabilities.reaction = 1;
    c.reactions = {
      [`${S}:reaction/blunt`]: {
        key: 'blunt',
        on: { event: 'item_acquired' },
        steps: [{ ...assign, item: ref('item', 'sword') }],
      },
    };
  });
  let x = newWorld(reaction, ctx('3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e21'), [2, 1, 2, 1]);
  x = play(x, { type: 'choose_ancestry', ancestry: 'smith' });
  assert.deepEqual(send(x, { type: 'take', item_id: sword(x) }).decision, {
    kind: 'fault',
    code: 'evaluator_error',
  });
});

// Breaks: the forge check does not set the band, the variant does not read it, or a forged
// sword is offered the forge again.
test('the forge sets a fine or crude band by strength, once', () => {
  for (const [ancestry, band, short] of [
    ['smith', 'fine', 'item.sword.short_fine'],
    ['scholar', 'crude', 'item.sword.short_crude'],
  ]) {
    const w = forging(sampler(), ancestry);
    const ids = { target_id: sword(w), item_id: e(w, 'item', 'hammer') };
    const forged = play(w, { type: 'perform', action: 'forge', ...ids });
    const shown = gameView(forged).inventory.find((x) => x.id === sword(w))!;
    assert.deepEqual(
      [value(forged, w.character, ref('fact', 'quality'), sword(w)), shown.name],
      [band, short],
    );
    assert.equal(
      send(forged, { type: 'perform', action: 'forge', ...ids }).decision.kind,
      'rejected',
    );
    assert.ok(!shown.actions.some((a) => a.action_key === 'forge'), 'not offered again');
  }
});
