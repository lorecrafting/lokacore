// Controlled D4 worlds; hand-checked answers belong in tests, not this setup.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { read } from './read.ts';
import { encode } from '../src/foundation/canonical.ts';
import { loadCartridge, newWorld, INSTALLED, type Cartridge, type World } from '../src/index.ts';
import type { DefinitionRef, Command } from '../src/contracts.gen.ts';
export const prefix = 'ashmere_missing_child@0.0.34';
export const ref = (kind: string, key: string): DefinitionRef => ({
  cartridge_id: 'ashmere_missing_child' as never,
  cartridge_version: '0.0.34' as never,
  kind,
  key: key as never,
});
export function bundle(change: (c: any) => void = () => {}) {
  const c = structuredClone(read('protocol/fixtures/missing_child_v034_hash.json').value);
  c.entry.key = 'orchard';
  c.calendar.start = 0;
  c.resources[`${prefix}:resource/mv`].start = 50;
  change(c);
  const canonical = encode(c);
  return { canonical, sha256: createHash('sha256').update(canonical).digest('hex') };
}
export function onlyFood(c: any) {
  const position = c.facts[`${prefix}:fact/position`];
  for (const section of [
    'quests',
    'reactions',
    'dialogues',
    'story_points',
    'scenes',
    'skills',
    'topics',
    'liquids',
    'services',
    'transports',
    'populations',
    'population_bundles',
    'barriers',
    'attributes',
    'recipes',
    'policies',
    'actions',
    'facts',
    'npcs',
  ])
    c[section] = {};
  c.facts = { [`${prefix}:fact/position`]: position };
  delete c.chapters;
  c.world = { carry: { max_grams: 12000 } };
  c.rooms = {
    [`${prefix}:room/orchard`]: {
      key: 'orchard',
      title: 'room.orchard.title',
      description: 'room.orchard.description',
      exits: {},
      details: c.rooms[`${prefix}:room/orchard`].details,
    },
  };
  c.items = Object.fromEntries(
    Object.entries(c.items).filter(([r]) => /:item\/apple_0[123]$/.test(r)),
  );
  for (const name of Object.keys(c.resources))
    if (!['hp', 'mv', 'ma'].includes(c.resources[name].key)) delete c.resources[name];
  c.manifest.requires.capabilities = {
    movement: 1,
    containment: 1,
    food: 1,
    resource: 1,
    position: 1,
    fact: 1,
    policy: 1,
    schedule: 1,
    calendar: 1,
    inspectable_detail: 1,
  };
  c.lock.capabilities = { ...c.manifest.requires.capabilities };
}
export function fresh(change: (c: any) => void = () => {}): World {
  const b = bundle(change),
    loaded = loadCartridge(
      new TextEncoder().encode(`{"cartridge":${b.canonical},"content_hash":"${b.sha256}"}`),
      INSTALLED,
    );
  assert.ok(loaded.ok, JSON.stringify(loaded));
  return newWorld(
    loaded.cartridge as Cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
}
export const entity = (w: World, kind: string, key: string) =>
  w.entityIds[`${prefix}:${kind}/${key}`];
export const command = (w: World, n: number, p: object): Command => ({
  id: `cccccccc-4444-4333-8444-${String(n).padStart(12, '0')}` as never,
  world_context_id: w.context,
  payload: { actor_id: w.character, ...p } as never,
});
