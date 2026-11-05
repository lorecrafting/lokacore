import assert from 'node:assert/strict';
import { test } from 'node:test';
import { step, type World } from '../src/index.ts';
import { validate } from '../src/foundation/validate.ts';
import { id, liquidFresh } from './liquid_fixture.ts';

const fresh = liquidFresh();
const skin = fresh.entityIds[id('item', 'waterskin')];
const water = Object.values(fresh.cartridge.liquids!)[0];
const ref = (kind: string, key: string) => ({
  cartridge_id: fresh.cartridge.manifest.id,
  cartridge_version: fresh.cartridge.manifest.version,
  kind,
  key,
});
const mv = Object.keys(fresh.state.resources!).find(
  (k) => k.includes('"mv"') && k.includes(fresh.body),
)!;

// Breaks: Drink drops the liquid's restore, or overfills the pool past its maximum.
test('a liquid restoring mv raises it by its amount and stops at the pool maximum', () => {
  let world: World = {
    ...fresh,
    cartridge: {
      ...fresh.cartridge,
      liquids: {
        [id('liquid', 'water')]: { ...water, resource: ref('resource', 'mv'), amount: 6 },
      },
    },
    state: {
      ...fresh.state,
      containers: { ...fresh.state.containers, [skin]: fresh.body },
      liquids: { ...fresh.state.liquids, [skin]: { kind: ref('liquid', water.key), quantity: 4 } },
      resources: { ...fresh.state.resources, [mv]: { ...fresh.state.resources![mv], value: 90 } },
    },
  };
  const levels = [];
  for (const n of [1, 2, 3]) {
    const payload = { type: 'consume' as const, actor_id: world.character, item_id: skin };
    const next = step(
      world,
      {
        id: `aaaaaaaa-0000-4000-8000-00000000000${n}`,
        world_context_id: world.context,
        payload,
      },
      n,
    );
    assert.equal(next.decision.kind, 'accepted', JSON.stringify(next.decision));
    world = next.world;
    levels.push(world.state.resources![mv].value);
  }
  // A drink at the maximum is still admitted (mechanics.md Admission binds only edibles).
  assert.deepEqual(levels, [96, 100, 100]);
});

// Breaks: a loaded liquid carries resource or amount alone, so the restore adds NaN to the pool.
test('LiquidDefinition refuses resource without amount and amount without resource', () => {
  assert.notDeepEqual(
    validate('LiquidDefinition', { ...water, resource: ref('resource', 'mv') }),
    [],
  );
  assert.notDeepEqual(validate('LiquidDefinition', { ...water, amount: 6 }), []);
  assert.deepEqual(
    validate('LiquidDefinition', { ...water, resource: ref('resource', 'mv'), amount: 6 }),
    [],
  );
});
