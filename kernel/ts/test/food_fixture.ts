// Controlled D4 worlds over the frozen toolbox_showcase KAT; every asserted number is set here or in the test.
import assert from 'node:assert/strict';
import { fragment } from './fragment.ts';
import type { World } from '../src/index.ts';
import type { Command } from '../src/contracts.gen.ts';
const f = fragment('protocol/fixtures/toolbox_showcase_hash.json');
export const { prefix, ref } = f;
// Three held-food stand-ins cloned from the showcase loaf; mv starts at 50 so an Eat of 6 reads 56.
function base(c: any) {
  c.calendar.start = 0;
  c.resources[`${prefix}:resource/mv`].start = 50;
  const loaf = c.items[`${prefix}:item/loaf`];
  for (const n of [1, 2, 3])
    c.items[`${prefix}:item/apple_0${n}`] = {
      ...structuredClone(loaf),
      key: `apple_0${n}`,
      keywords: [`apple_0${n}`],
      edible: { ...structuredClone(loaf.edible), amount: 6 },
    };
}
export function bundle(change: (c: any) => void = () => {}) {
  return f.bundle((c) => {
    base(c);
    change(c);
  });
}
export const load = (change: (c: any) => void = () => {}) =>
  f.load((c) => {
    base(c);
    change(c);
  });
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
    'populations',
    'barriers',
    'attributes',
    'scripted_actions',
    'actions',
    'facts',
    'npcs',
    'replenish',
    'statuses',
  ])
    c[section] = {};
  delete c.alternates;
  delete c.speech;
  delete c.structures;
  delete c.map_positions;
  c.facts = { [`${prefix}:fact/position`]: position };
  c.world = { carry: { max_grams: 12000 } };
  const inn = c.rooms[`${prefix}:room/crossroads_inn`];
  delete inn.details.sign_hub.readable;
  c.rooms = { [`${prefix}:room/crossroads_inn`]: { ...inn, exits: {} } };
  c.items = Object.fromEntries(
    Object.entries(c.items).filter(([r]) => /:item\/apple_0[123]$/.test(r)),
  );
  for (const i of Object.values<any>(c.items)) delete i.edible.cures;
  for (const name of Object.keys(c.resources))
    if (!['hp', 'mv'].includes(c.resources[name].key)) delete c.resources[name];
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
  return f.genesis((c) => {
    base(c);
    change(c);
  });
}
export const entity = (w: World, kind: string, key: string) =>
  w.entityIds[`${prefix}:${kind}/${key}`];
export const command = (w: World, n: number, p: object): Command => ({
  id: `cccccccc-4444-4333-8444-${String(n).padStart(12, '0')}` as never,
  world_context_id: w.context,
  payload: { actor_id: w.character, ...p } as never,
});
