import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gameView } from '../src/index.ts';
import { id, liquidFresh } from './liquid_fixture.ts';

const fresh = liquidFresh();
const skin = fresh.entityIds[id('item', 'waterskin')];
const water = Object.values(fresh.cartridge.liquids!)[0];

// Breaks: a worn vessel loses its Drink (the worn list skips foodActions, loka-kgd.209).
test('a filled vessel in a slot still offers Drink', () => {
  const kind = {
    cartridge_id: fresh.cartridge.manifest.id,
    cartridge_version: fresh.cartridge.manifest.version,
    kind: 'liquid',
    key: water.key,
  };
  const worn = {
    ...fresh,
    state: {
      ...fresh.state,
      containers: { ...fresh.state.containers, [skin]: Object.values(fresh.slots)[0] },
      liquids: { ...fresh.state.liquids, [skin]: { kind, quantity: 4 } },
    },
  };
  const item = gameView(worn).equipment!.find((s) => s.item?.id === skin)!.item!;
  assert.ok(item.actions.some((a) => a.command === 'consume' && a.available));
});
