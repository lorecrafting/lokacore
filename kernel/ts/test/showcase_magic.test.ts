// The magic district, slice M1 (docs/showcase/magic-district.md steps 1-5; Beads loka-y6yg.35):
// the Loft's spells cost ma and ash, lux lights the held lantern, the reading room hushes the
// voice for 120 s, the grimoire teaches flamma and resolves the hedge-wizard's errand, whose 30
// experience and one cha point unlock ward. The steps share one world, in order.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView, newWorld } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { validate } from '../src/foundation/validate.ts';
import { fuelView } from '../src/mechanics/light/shared.ts';
import {
  act,
  attribute,
  choose,
  content,
  detail,
  fact,
  go,
  id,
  labels,
  perform,
  play,
  ref,
  refused,
  take,
  talk,
  wait,
} from './showcase_fixture.ts';

const CTX = '5ca5e000-0000-4000-8000-00000000a61c';
const C = { cartridge_id: 'toolbox_showcase', cartridge_version: '0.0.1' };
const view = (w: World) => {
  const v = gameView(w);
  assert.deepEqual(validate('GameView', v), []);
  return v;
};
const words = (w: World) => view(w).spell_words;
const chip = (w: World, key: string) => view(w).actions.find((a) => a.action_key === key);
const pools = (w: World) =>
  Object.fromEntries(
    (view(w).resources ?? [])
      .filter((r) => ['ma', 'ash'].includes(r.resource.key))
      .map((r) => [r.resource.key, r.current]),
  );
const cast = (w: World, word: string) => play(w, { type: 'cast', word });
const lit = (w: World) => fuelView(w, id(w, 'item', 'lantern'))?.lit;
const raise = (w: World, key: string) =>
  play(w, { type: 'raise_attribute', attribute: { ...C, kind: 'attribute', key } }).world;

/** Up the ladder, lux taught and the errand accepted. */
function taught(c: Cartridge = content) {
  let w = go(newWorld(c, CTX as never, [1, 2, 3, 4]), 'up').world;
  w = choose(talk(w, 'hedge_wizard').world, 'teach').world;
  w = choose(talk(w, 'hedge_wizard').world, 'accept').world;
  return w;
}
/** Through the reading room: the grimoire read after the hush, back in the loft. */
function read(w: World) {
  w = go(w, 'north').world;
  w = wait(w, w.state.clock + 120).world;
  w = take(w, 'grimoire');
  w = play(w, { type: 'read', target_id: id(w, 'item', 'grimoire') }).world;
  return go(w, 'south').world;
}

let w: World;

// Breaks: the hub has no ladder up, the sign is not readable in the loft, or an unlearned spell
// leaks into spell_words.
test('magic 1: up the ladder; the sign reads and the Word bar is empty', () => {
  w = go(newWorld(content, CTX as never, [1, 2, 3, 4]), 'up').world;
  const sign = play(w, { type: 'read', target_id: detail(w, 'sign_magic') });
  assert.deepEqual(sign.lines, ['readable.sign_magic']);
  assert.equal(words(w), undefined);
});

// Breaks: the wizard opens the errand before teaching lux, the errand is not accepted, lux casts
// without ash or spends the wrong pools, the gather adds no ash, the cast leaves the held lantern
// unlit or writes an ignite line, a cast without the lantern is refused or keeps its pools, or
// the climb back to the loft closes the errand before flamma is known.
test('magic 2: taught lux; it needs ash; the cast spends 2 ma and 1 ash and lights the lantern', () => {
  const first = talk(w, 'hedge_wizard');
  assert.equal(first.opened, 'wizard_lux');
  w = choose(first.world, 'teach').world;
  assert.equal(fact(w, 'lux_known'), true);
  const second = talk(w, 'hedge_wizard');
  assert.equal(second.opened, 'wizard_errand');
  w = choose(second.world, 'accept').world;
  assert.equal(view(w).journal[0]?.state, 'active');
  assert.deepEqual(words(w), [
    { word: 'lux', available: false, reason: { code: 'insufficient_resource' } },
  ]);
  assert.equal(refused(w, { type: 'cast', word: 'lux' }), 'insufficient_resource');
  w = perform(w, 'gather_ash').world;
  assert.deepEqual(pools(w), { ma: 5, ash: 1 });
  const bare = cast(w, 'lux');
  assert.deepEqual(pools(bare.world), { ma: 3, ash: 0 });
  assert.equal(lit(bare.world), false);
  w = take(w, 'lantern');
  const r = cast(w, 'lux');
  assert.deepEqual(r.lines, ['narration.lux']);
  w = r.world;
  assert.deepEqual(pools(w), { ma: 3, ash: 0 });
  assert.equal(lit(w), true);
  w = go(go(w, 'down').world, 'up').world; // the loft climb closes only a met errand
  assert.equal(view(w).journal[0]?.state, 'active');
});

// Breaks: the hush is not applied on entry or ends early or late, it leaves the cast, the say or
// the shout open, the grimoire does not teach flamma, the level-up line is missing or doubled, or
// the errand does not resolve in the read itself.
test('magic 3: the reading room hushes for 120 s; the grimoire teaches flamma and ends the errand', () => {
  w = go(perform(w, 'gather_ash').world, 'north').world; // ash in hand: the hush, not the cost, refuses
  const entered = w.state.clock;
  assert.ok(labels(w).includes('condition.hushed'));
  assert.equal(refused(w, { type: 'cast', word: 'lux' }), 'invalid_state');
  assert.equal(refused(w, { type: 'say', word: 'hello' }), 'invalid_state');
  assert.equal(refused(w, { type: 'shout', word: 'hello' }), 'invalid_state');
  assert.equal(words(w)?.[0]?.available, false);
  assert.equal(chip(w, 'say'), undefined); // a blocked verb offers no chip
  const still = wait(w, entered + 119).world;
  assert.equal(refused(still, { type: 'cast', word: 'lux' }), 'invalid_state');
  w = wait(still, entered + 120).world;
  assert.ok(!labels(w).includes('condition.hushed'));
  assert.equal(words(w)?.[0]?.available, true);
  assert.equal(chip(w, 'say')?.available, true);
  w = take(w, 'grimoire'); // a readable item reads in hand
  const r = act(w, { type: 'read', target_id: id(w, 'item', 'grimoire') });
  assert.equal(r.decision.kind, 'accepted');
  w = r.world;
  assert.equal(r.lines.filter((l) => l === 'levelling.level_up').length, 1);
  assert.equal(fact(w, 'flamma_known'), true);
  assert.equal(view(w).journal[0]?.state, 'resolved');
});

// Breaks: the errand pays no ward_taught or experience, or ward's policy passes at cha 6 or fails at cha 7 (the cha boundary).
test('magic 4: level 2 from the errand; ward needs cha 7, one raise', () => {
  w = go(w, 'south').world;
  assert.equal(fact(w, 'ward_taught'), true);
  assert.deepEqual(view(w).levelling, { level: 2, experience: 30, next: 100, unspent: 1 });
  const ward = {
    word: 'ward',
    available: false,
    reason: { code: 'invalid_state', message: { key: 'reason.ward' } },
  };
  assert.deepEqual(
    words(w)?.find((s) => s.word === 'ward'),
    ward,
  );
  w = raise(w, 'cha');
  assert.equal(attribute(w, 'cha'), 7);
  assert.deepEqual(
    words(w)?.find((s) => s.word === 'ward'),
    { word: 'ward', available: true },
  );
});

// Breaks: ward's level floor passes at level 1 (29 experience, cha 7 from the start) or fails at
// level 2 (30): the level boundary of the same policy.
test('magic 4b: ward needs level 2 at the exact threshold', () => {
  const at = (grant: number) => {
    const c = structuredClone(content) as any;
    c.attributes[ref('attribute', 'cha')].start = 7;
    c.reactions[ref('reaction', 'errand_reward')].apply.find(
      (s: any) => s.op === 'experience.grant',
    ).amount = grant;
    const v = read(taught(c));
    return words(v)?.find((s) => s.word === 'ward')?.available;
  };
  assert.deepEqual([at(29), at(30)], [false, true]);
});

// Breaks: the grimoire read before the errand is accepted leaves the errand open for good (its
// fact_changed has already fired), so ward is never taught; or the loft entry resolves it
// before it is accepted.
test('magic 4c: the grimoire read first; the errand resolves on the next climb to the loft', () => {
  let v = go(newWorld(content, CTX as never, [1, 2, 3, 4]), 'up').world;
  v = read(choose(talk(v, 'hedge_wizard').world, 'teach').world);
  v = choose(talk(v, 'hedge_wizard').world, 'accept').world;
  assert.equal(view(v).journal[0]?.state, 'active');
  v = go(go(v, 'down').world, 'up').world; // the wizard hears of it when you come back up
  assert.equal(view(v).journal[0]?.state, 'resolved');
  assert.equal(fact(v, 'ward_taught'), true);
});

// Breaks: ward does not apply warded or spend its ma, or a second cast re-announces the status.
test('magic 5: ward applies warded and costs 1 ma; a second cast only refreshes it', () => {
  const r = act(w, { type: 'cast', word: 'ward' });
  assert.equal(r.decision.kind, 'accepted');
  w = r.world;
  assert.ok(r.lines.includes('narration.warded.applied'));
  assert.ok(labels(w).includes('condition.warded'));
  assert.equal(pools(w).ma, 2);
  const types = (x: typeof r) =>
    x.decision.kind === 'accepted' ? x.decision.events.map((e) => e.payload.type) : [];
  // No reaction listens on status_applied yet (the golem's, M3), so the landing emits no event.
  assert.deepEqual(types(r), ['action_completed']);
  const again = act(w, { type: 'cast', word: 'ward' });
  assert.deepEqual(types(again), ['action_completed']);
  assert.ok(!again.lines.includes('narration.warded.applied'));
});
