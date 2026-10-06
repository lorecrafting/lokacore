// Current independently pinned B4 chapter and controlled lethal/light-only consumers.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { encode } from '../src/foundation/canonical.ts';
import { loadCartridge, INSTALLED, newWorld, type Cartridge } from '../src/index.ts';
import { read } from './read.ts';
export const bundle = read('protocol/fixtures/missing_child_v021_hash.json');
export const answers = read('protocol/fixtures/missing_child_v021_ids.json');
const c = bundle.value;
const ref = (kind: string, key: string) => ({
  cartridge_id: c.manifest.id,
  cartridge_version: c.manifest.version,
  kind,
  key,
});
const named = (kind: string, key: string) =>
  `${c.manifest.id}@${c.manifest.version}:${kind}/${key}`;
const loaded = loadCartridge(
  new TextEncoder().encode(JSON.stringify({ cartridge: c, content_hash: bundle.sha256 })),
  INSTALLED,
);
assert.ok(loaded.ok, JSON.stringify(loaded));
export const fresh = newWorld(
  loaded.cartridge as Cartridge,
  '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
  [1, 2, 3, 4],
);
export const entity = (name: string) =>
  answers[`item/${name}`] as import('../src/contracts.gen.ts').EntityId;
export const npc = (name: string) =>
  answers[`npc/${name}`] as import('../src/contracts.gen.ts').EntityId;
export const room = (name: string) =>
  answers[`room/${name}`] as import('../src/contracts.gen.ts').EntityId;
/** Controlled lethal producer in an opted room; no production Well Shaft enemy. */
export function lethalLightFixture() {
  const value = structuredClone(c);
  const rat = value.npcs[named('npc', 'cellar_rat_1')];
  rat.room = ref('room', 'well_shaft');
  rat.attack = { chance: 100, damage_min: 10, damage_max: 10 };
  value.world.death_credit = value.world.death_credit.filter(
    (r: any) => r.npc.key !== 'cellar_rat_1',
  );
  const canonical = encode(value),
    sha256 = createHash('sha256').update(canonical).digest('hex');
  const loaded = loadCartridge(
    new TextEncoder().encode(JSON.stringify({ cartridge: value, content_hash: sha256 })),
    INSTALLED,
  );
  assert.ok(loaded.ok, JSON.stringify(loaded));
  return {
    bundle: { value, canonical, sha256 },
    fresh: newWorld(loaded.cartridge as Cartridge, fresh.context, [1, 2, 3, 4]),
  };
}
export function lightOnlyFixture() {
  const value = structuredClone(read('protocol/fixtures/cartridge_items_hash.json').value);
  value.manifest.time_policy = { profile: 'real_elapsed', rate: 50 };
  value.manifest.requires.kernel_api.at_least = '1.19';
  value.manifest.requires.capabilities.light = 1;
  value.lock.capabilities.light = 1;
  value.manifest.requires.capabilities.calendar = 1;
  value.lock.capabilities.calendar = 1;
  value.calendar = { start: 100 };
  value.items['ashmere_items@0.0.1:item/satchel'].container = true;
  const lantern = value.items['ashmere_items@0.0.1:item/lantern'];
  lantern.fuel = {
    ...c.items[named('item', 'torch')].fuel,
    capacity: 8,
    initial: 2,
    supply: {
      cartridge_id: 'ashmere_items',
      cartridge_version: '0.0.1',
      kind: 'item',
      key: 'lamp_oil',
    },
  };
  value.items['ashmere_items@0.0.1:item/lamp_oil'].fuel = {
    kind: 'supply',
    capacity: 6,
    initial: 6,
    unit: 'oil',
  };
  for (const k of ['ignited', 'doused', 'refueled'])
    value.text[`light.${k}`] = c.text[`light.${k}`];
  const canonical = encode(value),
    sha256 = createHash('sha256').update(canonical).digest('hex');
  const loaded = loadCartridge(
    new TextEncoder().encode(JSON.stringify({ cartridge: value, content_hash: sha256 })),
    INSTALLED,
  );
  assert.ok(loaded.ok, JSON.stringify(loaded));
  return {
    bundle: { value, canonical, sha256 },
    fresh: newWorld(loaded.cartridge as Cartridge, fresh.context, [1, 2, 3, 4]),
  };
}
