// Aimed spells (loka-x6t.109) on the spell effects sampler edited in-test: flamma aimed at room
// occupants and ward too (no npc), lux aimed at the inventory with has_tag silver (no item), the orb
// tagged silver. An aimed spell is offered on its target's entry and cast with target_id.
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
import { validate } from '../src/foundation/validate.ts';
import { identify, resolve } from '../src/commands/invocation.ts';
import { check } from '../src/runtime/invariants.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { dark } from '../src/mechanics/light/shared.ts';
import { activeStatuses } from '../src/mechanics/status/shared.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-aimed-spells-'));
const file = join(scratch, 'artifact.json');
execFileSync('mix', ['loka.compile', 'cartridges/spell_effects_sampler', file], {
  cwd: fileURLToPath(new URL('../../../', import.meta.url)),
  stdio: 'pipe',
});
const artifact = readFileSync(file);
rmSync(scratch, { recursive: true });
const P = 'spell_effects_sampler@0.0.1';
const R = (key: string) => `${P}:recipe/${key}`;
const rec = (k: string) => `.cartridge.recipes[${JSON.stringify(R(k))}]`;
const seq = (k: string) => `${rec(k)}.outcomes.success.sequence[0]`;

function variant(change: (c: Record<string, any>) => void) {
  const c = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  change(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
}
const aim = (c: Record<string, any>, k: string, scopes: string[], arg: string) => {
  c.recipes[R(k)].target.aimed = { scopes };
  delete c.recipes[R(k)].outcomes.success.sequence[0][arg];
};
/** The sampler with flamma, ward and lux aimed (kernel_api 1.119) and the orb tagged silver. */
function aimedChange(c: Record<string, any>) {
  c.manifest.requires.kernel_api.at_least = '1.119';
  for (const caps of [c.lock.capabilities, c.manifest.requires.capabilities]) caps.tags = 1;
  aim(c, 'flamma', ['room_occupants'], 'npc');
  aim(c, 'ward', ['room_occupants'], 'npc');
  aim(c, 'lux', ['inventory'], 'item');
  c.recipes[R('lux')].policy.root = { op: 'has_tag', subject: 'target', tag: 'silver' };
  c.items[`${P}:item/orb`].tags = ['silver'];
}
const loaded = variant(aimedChange);
assert.ok(loaded.ok, JSON.stringify(loaded));
const aimed = loaded.cartridge as Cartridge;
const plain = (loadCartridge(artifact, INSTALLED) as { cartridge: Cartridge }).cartridge;

let n = 0;
const play = (w: World, payload: object) =>
  step(
    w,
    {
      id: `eeeeeeee-1090-4109-8109-${String(++n).padStart(12, '0')}`,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...payload },
    } as never,
    n,
  );
function ok(r: ReturnType<typeof step>) {
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
const code = (r: ReturnType<typeof step>) =>
  r.decision.kind === 'rejected' ? r.decision.error.code : r.decision.kind;
const at = (w: World, word: string, key?: string) =>
  play(w, { type: 'cast', word, ...(key && { target_id: w.entityIds[`${P}:${key}`] }) });
const hall = (c = aimed) => {
  n = 0;
  return newWorld(c, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e29' as never, [1, 2, 3, 4]);
};
/** Orb (and glowdust) taken, east into the crypt, lit by aimed lux at the orb. */
function crypt(c = aimed): World {
  let w = hall(c);
  for (const i of ['orb', 'glowdust'])
    w = ok(play(w, { type: 'take', item_id: w.entityIds[`${P}:item/${i}`] }));
  w = ok(play(w, { type: 'move', direction: 'east' }));
  assert.equal(dark(w, w.character), true);
  w = ok(at(w, 'lux', 'item/orb'));
  assert.equal(dark(w, w.character), false); // 7: the tagged held orb lights
  return w;
}
const wightHp = (w: World) => level(w, w.entityIds[`${P}:npc/wight`]!, resourceRef(w, 'hp'));
const entry = (w: World, id: string) =>
  [...gameView(w).entities, ...gameView(w).inventory].find((e) => e.id === id);

// Breaks: the aimed offer is missing from the wight's entry or lacks command cast / its target spec,
// the spell still shows in spell_words, a refused target lists it, or the view leaves the schema.
test('flamma is offered on the wight, not in spell_words; lux lists only on the tagged orb', () => {
  const w = crypt();
  const wight = w.entityIds[`${P}:npc/wight`]!;
  const view = gameView(w);
  assert.deepEqual(validate('GameView', view), []);
  const flamma = entry(w, wight)!.actions.find((a) => a.action_key === 'flamma');
  assert.deepEqual(flamma && { ...flamma, label: undefined }, {
    action_key: 'flamma',
    command: 'cast',
    label: undefined,
    target: { kind: 'entity', scopes: ['room_occupants'] },
    input: [],
    target_ids: [wight],
    available: true,
  });
  assert.deepEqual(view.spell_words ?? [], []);
  const keys = (key: string) =>
    entry(w, w.entityIds[`${P}:${key}`]!)!.actions.map((a) => a.action_key);
  const orb = entry(w, w.entityIds[`${P}:item/orb`]!)!.actions.find((a) => a.action_key === 'lux');
  assert.equal(orb?.available, true); // its policy read with the orb as target
  assert.ok(!keys('item/glowdust').includes('lux')); // 7: untagged: not listed
});

// Breaks: an aimed cast hits the wrong body (the caster), skips the target check, or the
// completion's subject is not the target.
test('cast flamma at the wight: 8 fire after resistance is 4; ward lands on the wight', () => {
  const w = crypt();
  const wight = w.entityIds[`${P}:npc/wight`]!;
  const bolt = at(w, 'flamma', 'npc/wight');
  assert.equal(wightHp(ok(bolt)), 4);
  const done =
    bolt.decision.kind === 'accepted' &&
    bolt.decision.events.find((e) => e.payload.type === 'action_completed');
  assert.equal(done && (done.payload as { subject_id?: string }).subject_id, wight);
  const warded = ok(at(w, 'ward', 'npc/wight'));
  const holders = [wight, w.character].map((b) => activeStatuses(warded, b as never).length);
  assert.deepEqual(holders, [1, 0]);
});

// Breaks: invalid_target is not given for a missing, a foreign-scope or an unaimed target, an
// unknown word tells a target error (leaking which words are spells), or perform reaches a spell.
test('refusals: no target, unaimed with a target, out of scope, unknown word, perform', () => {
  const w = crypt();
  assert.equal(code(at(w, 'flamma')), 'invalid_target');
  assert.equal(code(at(hall(), 'flamma', 'item/glowdust')), 'invalid_target'); // a floor item
  assert.equal(code(at(hall(), 'lux', 'item/orb')), 'invalid_target'); // inventory: not held
  assert.equal(code(at(w, 'lux', 'item/glowdust')), 'invalid_state'); // 7: untagged held
  assert.equal(code(at(w, 'zzz', 'npc/wight')), 'invalid_state');
  const target_id = w.entityIds[`${P}:npc/wight`];
  assert.equal(code(play(w, { type: 'perform', action: 'flamma', target_id })), 'not_found');
  const old = ok(play(hall(plain), { type: 'take', item_id: w.entityIds[`${P}:item/orb`] }));
  assert.equal(code(at(old, 'lux', 'item/orb')), 'invalid_target'); // lux unaimed
});

// Breaks: an aimed offer's invocation does not resolve to cast with its word and target, its keyed
// step does not bind the aimed offer, or a second aimed cast in a fight is refused.
test('the offer resolves to cast {word, target_id}; a second bolt in a fight kills', () => {
  let w = crypt();
  const wight = w.entityIds[`${P}:npc/wight`]!;
  const i = identify('aimed-test', w.character, {
    invocation_id: 'bbbbbbbb-0000-4000-8000-000000001090',
    actor_id: w.character,
    action_key: 'flamma',
    target_ids: [wight],
    input: {},
  } as never);
  const command = resolve(w, i as never);
  assert.deepEqual('payload' in command && command.payload, {
    type: 'cast',
    actor_id: w.character,
    word: 'flamma',
    target_id: wight,
  });
  w = ok(play(w, { type: 'attack', target_id: wight }));
  const keyed = {
    id: 'eeeeeeee-1090-4109-8109-0000000000aa',
    world_context_id: w.context,
    payload: (command as { payload: object }).payload,
  };
  w = ok(step(w, keyed as never, ++n, 'flamma' as never)); // the Book's keyed invocation
  w = ok(at(w, 'flamma', 'npc/wight'));
  assert.equal(wightHp(w), 0);
});

// Breaks: the invariant finds no entry for a targeted cast, or takes another spell's offer on the
// same target (ward accepted while its offer is unavailable, flamma's listed first and available).
test('invariant: a cast accepted at a target whose aimed offer is unavailable disagrees', () => {
  const w = crypt();
  const view = gameView(w);
  const command = {
    world_context_id: w.context,
    payload: {
      type: 'cast',
      actor_id: w.character,
      word: 'ward',
      target_id: w.entityIds[`${P}:npc/wight`],
    },
  };
  const words = { flamma: 'flamma', ward: 'ward' };
  const { decision } = at(w, 'ward', 'npc/wight');
  assert.ok(check('gameview_agrees_with_admission', { view, command, decision, words }));
  const off = structuredClone(view) as any;
  const keys = (e: any) => e.actions.map((a: { action_key: string }) => a.action_key);
  const wight = off.entities.find((e: { id: string }) => e.id === command.payload.target_id);
  assert.deepEqual(keys(wight), ['attack', 'flamma', 'ward']); // flamma's offer is found first
  Object.assign(wight.actions[2], { available: false, reason: { code: 'insufficient_resource' } });
  assert.equal(
    check('gameview_agrees_with_admission', { view: off, command, decision, words }),
    false,
  );
  const other = structuredClone(view) as any; // a non-cast entry under the same key is not the offer
  other.entities
    .find((e: { id: string }) => e.id === command.payload.target_id)
    .actions.unshift({ action_key: 'ward', available: false, reason: { code: 'invalid_state' } });
  assert.ok(check('gameview_agrees_with_admission', { view: other, command, decision, words }));
});

// Breaks: an unlearned word aimed at an unseen target tells not_present (or a bad target tells
// invalid_target), so a refusal shows which words are spells (PM ruling: the word first).
test('an unlearned or unknown word is invalid_state before any target check', () => {
  const unlearned = variant((c) => {
    aimedChange(c);
    c.facts[`${P}:fact/flamma_known`].value_type.default = false;
  }) as { cartridge: Cartridge };
  const h = hall(unlearned.cartridge);
  assert.equal(code(at(h, 'flamma', 'item/glowdust')), 'invalid_state');
  const offers = gameView(crypt(unlearned.cartridge)).entities.flatMap((e) =>
    e.actions.map((a) => a.action_key),
  );
  assert.ok(!offers.includes('flamma')); // not even on the wight
  let w = hall();
  for (const i of ['orb', 'glowdust'])
    w = ok(play(w, { type: 'take', item_id: w.entityIds[`${P}:item/${i}`] }));
  w = ok(play(w, { type: 'move', direction: 'east' })); // dark: the wight is unseen
  assert.equal(code(at(w, 'flamma', 'npc/wight')), 'not_present');
  assert.equal(code(at(w, 'zzz', 'npc/wight')), 'invalid_state');
});

// Breaks: the TS loader admits a step without its npc on an unaimed spell, a scope outside
// room_occupants and inventory, aimed on a non-spell target, or aimed below 1.119 (both kernels;
// content_spell_effects_test.exs).
test('loader: aimed rows refused', () => {
  const rows: [(c: Record<string, any>) => void, string, string][] = [
    [
      (c) => delete c.recipes[R('flamma')].outcomes.success.sequence[0].npc,
      'SCHEMA_VIOLATION',
      `${seq('flamma')}.npc`,
    ],
    [
      (c) => (
        aimedChange(c),
        (c.recipes[R('flamma')].target.aimed.scopes = ['inspectable_details'])
      ),
      'SCHEMA_VIOLATION',
      `${rec('flamma')}.target.aimed.scopes[0]`,
    ],
    [
      (c) => (
        aimedChange(c),
        (c.recipes[R('ward')].target = {
          kind: 'use',
          tool: { tag: 'silver' },
          aimed: { scopes: ['inventory'] },
        })
      ),
      'UNKNOWN_FIELD', // the loader's code for a field its schema branch lacks
      `${rec('ward')}.target.aimed`,
    ],
    [
      (c) => (aimedChange(c), (c.manifest.requires.kernel_api.at_least = '1.118')),
      'KERNEL_API_RANGE_INVALID',
      '.cartridge.manifest.requires.kernel_api.at_least',
    ],
  ];
  for (const [change, diagnostic, path] of rows) {
    const r = variant(change);
    assert.deepEqual(r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path], [diagnostic, path]);
  }
});
