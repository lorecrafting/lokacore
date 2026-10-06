// Published v030: a foreign-world service is correctly refused, but the sim oracle calls it a mismatch.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { INSTALLED, loadCartridge, newWorld, step, gameView } from '../../../kernel/ts/src/index.ts';
import { gameview_agrees_with_admission } from '../../../kernel/ts/src/view/invariants_view.ts';
const fixture = JSON.parse(readFileSync(new URL('../../../protocol/fixtures/missing_child_v030_hash.json', import.meta.url)));
const loaded = loadCartridge(Buffer.from(JSON.stringify({ cartridge: fixture.value, content_hash: fixture.sha256 })), INSTALLED);
assert.ok(loaded.ok);
let world = newWorld(loaded.cartridge, '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f', [1, 2, 3, 4]);
let ordinal = 0;
const command = (payload, context = world.context) => ({
  id: `bbbbbbbb-0000-4000-8000-${String(++ordinal).padStart(12, '0')}`,
  world_context_id: context,
  payload: { actor_id: world.character, ...payload },
});
for (const direction of ['north', 'east']) {
  const result = step(world, command({ type: 'move', direction }), ordinal);
  assert.equal(result.decision.kind, 'accepted');
  world = result.world;
}
const view = gameView(world);
const maud = view.entities.find((e) => e.name === 'npc.maud.short');
const offer = maud.services.find((s) => s.service.key === 'lantern_meal');
assert.equal(offer.action.available, true);
const payload = { type: 'use_service', provider_id: maud.id, service: offer.service, quoted_price: offer.price };
const foreign = command(payload, '80bb96e1-f6d7-8212-aba3-6dc0ebd97dba');
const refused = step(world, foreign, ordinal, offer.action.action_key);
assert.deepEqual(refused.decision, { kind: 'rejected', error: { code: 'not_found' } });
assert.equal(refused.world, world);
const oracle = gameview_agrees_with_admission({ view, command: foreign, decision: refused.decision, action_key: offer.action.action_key });
assert.equal(oracle, false);
const lawful = step(world, command(payload), ordinal, offer.action.action_key);
assert.equal(lawful.decision.kind, 'accepted');
console.log(JSON.stringify({ baseline: 'published v030', moves: ['north', 'east'], offer: 'lantern_meal', available: true, foreign_world_decision: refused.decision, world_unchanged: refused.world === world, oracle_for_foreign: oracle, lawful_world_decision: lawful.decision.kind }));
