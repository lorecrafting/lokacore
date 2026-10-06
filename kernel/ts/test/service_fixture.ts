import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { encode } from '../src/foundation/canonical.ts';
import { level } from '../src/mechanics/resource.ts';
import { key } from '../src/foundation/compose.ts';
import {
  INSTALLED,
  loadCartridge,
  newWorld,
  step,
  type Cartridge,
  type World,
} from '../src/index.ts';
import type { Command, DefinitionRef } from '../src/contracts.gen.ts';
import { read } from './read.ts';

export const pin = read('protocol/fixtures/missing_child_v025_hash.json');
export const prefix = 'ashmere_missing_child@0.0.25';
export const ref = (kind: string, name: string): DefinitionRef => ({
  cartridge_id: 'ashmere_missing_child' as never,
  cartridge_version: '0.0.25' as never,
  kind: kind as never,
  key: name as never,
});
export function bundle(change: (c: any) => void = () => {}) {
  const c = structuredClone(pin.value);
  c.entry.key = 'drowned_lantern';
  c.calendar.start = 0;
  c.resources[`${prefix}:resource/mv`].start = 50;
  change(c);
  const canonical = encode(c);
  return { canonical, sha256: createHash('sha256').update(canonical).digest('hex') };
}
export function fresh(change: (c: any) => void = () => {}) {
  const b = bundle(change),
    loaded = loadCartridge(
      new TextEncoder().encode(`{"cartridge":${b.canonical},"content_hash":"${b.sha256}"}`),
      INSTALLED,
    );
  assert.ok(loaded.ok, JSON.stringify(loaded));
  const world = newWorld(
    loaded.cartridge as Cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
  return { ...world, state: world.state as any };
}
export const entity = (w: World, kind: string, name: string) =>
  w.entityIds[`${prefix}:${kind}/${name}`];
export const resourceKey = (w: World, holder: string, name: string) =>
  key({ kind: 'resource', resource: ref('resource', name), entity_id: holder });
export const amounts = (w: World) =>
  [w.body, entity(w, 'npc', 'maud')].map(
    (id) => w.state.resources![resourceKey(w, id, 'pennies')].value,
  );
export const mv = (w: World) => level(w, w.body, ref('resource', 'mv'))!;
export const stock = (w: World) =>
  w.state.resources![resourceKey(w, entity(w, 'npc', 'maud'), 'lantern_meals')].value;
export const ale = (w: World) => w.state.liquids![entity(w, 'item', 'lantern_ale_cask')];
export function run(w: World, name: string, ordinal = 1, change: object = {}) {
  const s = w.cartridge.services![`${prefix}:service/${name}`];
  return step(
    w,
    {
      id: `aaaaaaaa-0000-4000-8000-${String(ordinal).padStart(12, '0')}`,
      world_context_id: w.context,
      payload: {
        type: 'use_service',
        actor_id: w.character,
        provider_id: entity(w, 'npc', 'maud'),
        service: ref('service', name),
        quoted_price: s.price,
        ...change,
      },
    } as Command,
    ordinal,
    s.action,
  );
}
