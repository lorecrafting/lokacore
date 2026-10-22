// Practical-skills fragment on the frozen harvest_sampler KAT: a careful mining harvest, a haggle
// buy discount and a teacher for each, under a 5000 g carry ceiling (docs/system/mechanics.md).
import { decode } from '../src/foundation/canonical.ts';
import { key } from '../src/foundation/compose.ts';
import type { World } from '../src/index.ts';
import type { EntityId } from '../src/contracts.gen.ts';
import { fragment } from './fragment.ts';

export const sampler = fragment('protocol/fixtures/harvest_sampler_hash.json');
export const { ref, prefix } = sampler;
const named = (kind: string, k: string) => `${prefix}:${kind}/${k}`;
const caps = ['attributes', 'resource', 'commerce', 'dialogue'];
/** The fragment change: `stat` is INT and DEX, `pennies` and `mv` the player's starts. */
export const practical = (stat: number, pennies: number, mv: number) => (c: any) => {
  for (const cap of caps) c.manifest.requires.capabilities[cap] = c.lock.capabilities[cap] = 1;
  c.world = { carry: { max_grams: 5000 } };
  c.items[named('item', 'stick')].mass_grams = 100; // a carry ceiling needs every mass
  c.items[named('item', 'ore_03')] = {
    ...c.items[named('item', 'ore_01')],
    keywords: ['ore', 'ore_03'],
    key: 'ore_03',
  };
  c.rooms[named('room', 'mine')].details.seam.harvest.items.push(ref('item', 'ore_03'));
  c.attributes = {
    [named('attribute', 'int')]: { key: 'int', start: stat },
    [named('attribute', 'dex')]: { key: 'dex', start: stat },
  };
  const r = c.resources;
  r[named('resource', 'pennies')] = {
    key: 'pennies',
    minimum: 0,
    maximum: 1000,
    start: pennies,
    gain: 0,
  };
  r[named('resource', 'mv')] = { ...r[named('resource', 'mv')], maximum: 100, start: mv };
  const npc = (k: string, extra = {}) => ({
    key: k,
    keywords: [k],
    short: `npc.${k}.short`,
    room_line: `npc.${k}.room`,
    description: `npc.${k}.description`,
    room: ref('room', 'mine'),
    resource_starts: { pennies: 20 },
    ...extra,
  });
  const offers = [
    ['lamp', 10, 4],
    ['rope', 3, 1],
    ['nail', 1, 1],
  ] as const;
  c.npcs = {
    [named('npc', 'miner')]: npc('miner'),
    [named('npc', 'smith')]: npc('smith', {
      shop: {
        resource: ref('resource', 'pennies'),
        offers: offers.map(([item, buy, sell]) => ({ item: ref('item', item), buy, sell })),
        bought: 'shop.bought',
        sold: 'shop.sold',
        buy_discount: { skill: ref('skill', 'haggle'), numerator: 9, denominator: 10, minimum: 1 },
      },
    }),
  };
  for (const [item] of offers)
    c.items[named('item', item)] = {
      key: item,
      keywords: [item],
      short: 'item.ware.short',
      room_line: 'item.ware.room',
      description: 'item.ware.description',
      mass_grams: 100,
      location: { in: 'npc', npc: ref('npc', 'smith') },
    };
  const qualification = (attribute: string) => ({
    policy_version: 1,
    root: {
      op: 'all',
      items: [
        { op: 'stat_compare', attribute: ref('attribute', attribute), at_least: 10 },
        { op: 'resource_compare', resource: ref('resource', 'mv'), at_least: 5 },
      ],
    },
  });
  c.dialogues = {};
  for (const [skill, attribute, teacher] of [
    ['mining', 'int', 'miner'],
    ['haggle', 'dex', 'smith'],
  ]) {
    c.skills[named('skill', skill)] = {
      ...c.skills[named('skill', 'mining')],
      key: skill,
      label: `skill.${skill}.label`,
      requirement: `skill.${skill}.requirement`,
      qualification: qualification(attribute),
    };
    c.facts[named('fact', `skill_${skill}`)] = {
      key: `skill_${skill}`,
      version: 1,
      scopes: ['player'],
      value_type: { type: 'bool', default: false },
      meaning: `Skill ${skill}'s acquisition (skills@1): only skills@1 writes it.`,
    };
    const teacherRef = ref('npc', teacher);
    c.dialogues[named('dialogue', `${teacher}_${skill}`)] = {
      key: `${teacher}_${skill}`,
      npc: teacherRef,
      roles: { teacher: { role: 'npc', npc: teacherRef } },
      policy: {
        policy_version: 1,
        root: { op: 'fact_compare', fact: ref('fact', `skill_${skill}`), equals: false },
      },
      prompt: 'teacher.prompt',
      label: 'teacher.choice',
      choices: {
        learn: {
          label: 'teacher.choice',
          narration: 'teacher.learned',
          sequence: [{ op: 'skill.acquire', skill: ref('skill', skill) }],
          lesson_payment: { to: 'teacher', resource: ref('resource', 'pennies'), amount: 2 },
        },
      },
    };
  }
  Object.assign(c.text, {
    'npc.miner.short': 'the miner',
    'npc.miner.room': 'A [miner] leans on the wall.',
    'npc.miner.description': 'A miner who teaches careful work.',
    'npc.smith.short': 'the smith',
    'npc.smith.room': 'A [smith] keeps a stall.',
    'npc.smith.description': 'A smith who sells wares and teaches haggling.',
    'item.ware.short': 'a ware',
    'item.ware.room': 'A [ware] lies here.',
    'item.ware.description': 'A ware from the stall.',
    'shop.bought': 'You buy it.',
    'shop.sold': 'You sell it.',
    'teacher.prompt': 'The teacher waits.',
    'teacher.choice': 'Take a lesson',
    'teacher.learned': 'You learn the skill.',
    'skill.haggle.label': 'Haggling',
    'skill.haggle.requirement': 'Anyone may haggle once taught.',
  });
};
export function practicalBundle(stat = 10, pennies = 3, mv = 5) {
  const b = sampler.bundle(practical(stat, pennies, mv));
  return { ...b, value: decode(b.canonical) as any };
}
export const practicalWorld = (stat = 10, pennies = 3, mv = 5) =>
  sampler.genesis(practical(stat, pennies, mv));
const ids = practicalWorld().entityIds;
export const id = (kind: string, k: string) => ids[named(kind, k)] as EntityId;
export const patch = Object.keys(practicalWorld().details)[0] as EntityId; // the seam, the only detail
export const learned = (w: World, skill: string): World => ({
  ...w,
  state: {
    ...w.state,
    facts: {
      ...w.state.facts,
      [key({
        kind: 'fact',
        fact: ref('fact', `skill_${skill}`),
        scope: { kind: 'player', character_id: w.character },
      })]: true,
    },
  },
});
export const pool = (w: World, name: string, entity = w.body) =>
  key({ kind: 'resource', resource: ref('resource', name), entity_id: entity });
