import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { cartridge } from './combat_fixture.ts';
import { encode } from '../src/foundation/canonical.ts';
import { loadCartridge, INSTALLED, newWorld, type Cartridge, type World } from '../src/index.ts';
import { key } from '../src/foundation/compose.ts';
import type { DefinitionRef } from '../src/contracts.gen.ts';

export function trainingBundle(stat = 10, chance = 0, start = 0) {
  const c: any = structuredClone(cartridge);
  const ref = (kind: string, key: string) => ({
    cartridge_id: c.manifest.id,
    cartridge_version: c.manifest.version,
    kind,
    key,
  });
  const text = 'training.test';
  const named = (kind: string, name: string) =>
    `${c.manifest.id}@${c.manifest.version}:${kind}/${name}`;
  c.manifest.requires.kernel_api.at_least = '1.18';
  for (const cap of ['skills', 'attributes', 'commerce'])
    c.manifest.requires.capabilities[cap] = c.lock.capabilities[cap] = 1;
  c.text[text] = 'Controlled training.';
  c.attributes = Object.fromEntries(
    ['str', 'dex'].map((k) => [named('attribute', k), { key: k, start: stat }]),
  );
  c.skills = Object.fromEntries(
    ['swords', 'dodge'].map((k) => [
      named('skill', k),
      {
        key: k,
        label: text,
        requirement: text,
        qualification: {
          policy_version: 1,
          root: {
            op: 'stat_compare',
            attribute: ref('attribute', k === 'swords' ? 'str' : 'dex'),
            at_least: 10,
          },
        },
      },
    ]),
  );
  for (const k of ['swords', 'dodge'])
    c.facts[named('fact', `skill_${k}`)] = {
      key: `skill_${k}`,
      version: 1,
      value_type: { type: 'bool', default: false },
      scopes: ['player'],
      meaning: `Skill ${k}'s acquisition (skills@1): only skills@1 writes it.`,
    };
  c.resources[named('resource', 'pennies')] = {
    key: 'pennies',
    minimum: 0,
    maximum: 1000,
    start: 10,
    gain: 0,
  };
  c.npcs[named('npc', 'teacher')] = {
    key: 'teacher',
    keywords: ['teacher'],
    short: text,
    room_line: text,
    description: text,
    room: ref('room', 'lantern_cellar'),
    resource_starts: { pennies: 0 },
  };
  c.items[named('item', 'sword')] = {
    key: 'sword',
    keywords: ['sword'],
    short: text,
    room_line: text,
    description: text,
    location: { in: 'npc', npc: ref('npc', 'teacher') },
    mass_grams: 500,
    slot: 'wield',
    weapon: {
      skill: ref('skill', 'swords'),
      attack: { chance: 100, damage_min: 3, damage_max: 3 },
    },
  };
  c.items[named('item', 'shield')] = {
    key: 'shield',
    keywords: ['shield'],
    short: text,
    room_line: text,
    description: text,
    location: { in: 'npc', npc: ref('npc', 'teacher') },
    mass_grams: 400,
    slot: 'off_hand',
    block_chance: 100,
  };
  for (const skill of ['swords', 'dodge']) {
    const roles: any = { teacher: { role: 'npc', npc: ref('npc', 'teacher') } };
    const option: any = {
      label: text,
      narration: text,
      sequence: [{ op: 'skill.acquire', skill: ref('skill', skill) }],
      lesson_payment: { to: 'teacher', resource: ref('resource', 'pennies'), amount: 4 },
    };
    if (skill === 'swords') {
      roles.sword = { role: 'item', item: ref('item', 'sword') };
      option.receive = { item: 'sword', from: 'teacher' };
    }
    c.dialogues[named('dialogue', `learn_${skill}`)] = {
      key: `learn_${skill}`,
      npc: ref('npc', 'teacher'),
      roles,
      policy: {
        policy_version: 1,
        root:
          skill === 'swords'
            ? { op: 'all', items: [] }
            : { op: 'fact_compare', fact: ref('fact', 'skill_swords'), equals: true },
      },
      prompt: text,
      choices: { learn: option },
    };
  }
  c.calendar = { start };
  c.entry = ref('room', 'lantern_cellar');
  c.npcs[named('npc', 'teacher')].shop = {
    resource: ref('resource', 'pennies'),
    offers: [{ item: ref('item', 'shield'), buy: 4, sell: 2 }],
    bought: text,
    sold: text,
  };
  for (const s of Object.values(c.resources) as any[]) {
    s.gain = 0;
    if (s.regen) for (const p of Object.keys(s.regen.by_position)) s.regen.by_position[p] = 0;
  }
  c.world.combat.player_attack = { chance: 100, damage_min: 1, damage_max: 1 };
  c.world.combat.dodge = { skill: ref('skill', 'dodge'), chance };
  c.world.combat.narration.dodge = c.world.combat.narration.block = text;
  for (const n of Object.values(c.npcs) as any[])
    if (n.attack) n.attack = { chance: 100, damage_min: 1, damage_max: 1 };
  return bundleOf(c);
}
export function bundleOf(c: any) {
  const canonical = encode(c);
  return { canonical, sha256: createHash('sha256').update(canonical).digest('hex') };
}
export function productionBundle() {
  const artifact = JSON.parse(readFileSync(process.env.C1_ARTIFACT!, 'utf8'));
  return { canonical: encode(artifact.cartridge), sha256: artifact.content_hash };
}
export function trainingWorld(stat = 10, chance = 0): World {
  const b = trainingBundle(stat, chance);
  const loaded = loadCartridge(
    new TextEncoder().encode(
      JSON.stringify({ cartridge: JSON.parse(b.canonical), content_hash: b.sha256 }),
    ),
    INSTALLED,
  );
  assert.ok(loaded.ok, JSON.stringify(loaded));
  const w = newWorld(
    loaded.cartridge as Cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as World['context'],
    [1, 2, 3, 4],
  );
  return {
    ...w,
    state: {
      ...w.state,
      resources: {
        ...w.state.resources,
        [key({
          kind: 'resource',
          resource: trainingRef(w, 'resource', 'pennies' as DefinitionRef['key']),
          entity_id: w.body,
        })]: { value: 10, at: 0 },
      },
      containers: {
        ...w.state.containers,
        [w.body]:
          w.roomIds[
            `${w.cartridge.manifest.id}@${w.cartridge.manifest.version}:room/lantern_cellar`
          ],
      },
    },
  };
}
export const trainingRef = (w: World, kind: string, key: DefinitionRef['key']): DefinitionRef => ({
  cartridge_id: w.cartridge.manifest.id,
  cartridge_version: w.cartridge.manifest.version,
  kind,
  key,
});
export function learned(w: World, skill: string): World {
  const at = key({
    kind: 'fact',
    fact: trainingRef(w, 'fact', `skill_${skill}` as DefinitionRef['key']),
    scope: { kind: 'player', character_id: w.character },
  });
  return { ...w, state: { ...w.state, facts: { ...w.state.facts, [at]: true } } };
}
export function wield(w: World, slot = 'wield'): World {
  const item =
    w.entityIds[
      `${w.cartridge.manifest.id}@${w.cartridge.manifest.version}:item/${slot === 'wield' ? 'sword' : 'shield'}`
    ];
  return {
    ...w,
    state: { ...w.state, containers: { ...w.state.containers, [item]: w.slots[slot] } },
  };
}
