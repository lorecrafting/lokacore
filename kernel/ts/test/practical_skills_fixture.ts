// Controlled D12 chapter declarations on frozen D1; release/allocation pins remain provisional.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { read } from './read.ts';
import { encode } from '../src/foundation/canonical.ts';
import { key } from '../src/foundation/compose.ts';
import { loadCartridge, INSTALLED, newWorld, type Cartridge, type World } from '../src/index.ts';
import type { DefinitionRef } from '../src/contracts.gen.ts';
export const ids = read('protocol/fixtures/missing_child_v030_ids.json');
export const ref = (kind: string, name: string) =>
  ({
    cartridge_id: 'ashmere_missing_child',
    cartridge_version: '0.0.30',
    kind,
    key: name,
  }) as DefinitionRef;
const named = (kind: string, name: string) => `ashmere_missing_child@0.0.30:${kind}/${name}`;
const source = (path: string) => read(`cartridges/ashmere_missing_child/${path}.json`);
export function practicalBundle(stat = 10, room = 'willow_shade', pennies = 3, mv = 5) {
  const c = structuredClone(read('protocol/fixtures/missing_child_v030_hash.json').value);
  c.entry = ref('room', room);
  c.resources[named('resource', 'pennies')].start = pennies;
  c.resources[named('resource', 'mv')].start = mv;
  c.attributes[named('attribute', 'int')] = { key: 'int', start: stat };
  c.attributes[named('attribute', 'dex')].start = stat;
  c.text = source('text');
  for (const [skill, teacher] of [
    ['herbalism', 'sedge'],
    ['haggle', 'peg'],
  ]) {
    const s = source(`skills/${skill}`);
    s.key = skill;
    for (const leaf of s.qualification.root.items) {
      if (leaf.attribute) leaf.attribute = ref('attribute', leaf.attribute);
      if (leaf.resource) leaf.resource = ref('resource', leaf.resource);
    }
    c.skills[named('skill', skill)] = s;
    c.facts[named('fact', `skill_${skill}`)] = {
      ...c.facts[named('fact', 'skill_swim')],
      key: `skill_${skill}`,
      meaning: `Skill ${skill}'s acquisition (skills@1): only skills@1 writes it.`,
    };
    const d = source(`dialogues/${teacher}_${skill}`);
    d.key = `${teacher}_${skill}`;
    d.npc = ref('npc', teacher);
    d.roles.teacher.npc = ref('npc', teacher);
    d.policy.root.fact = ref('fact', `skill_${skill}`);
    d.choices.learn.sequence[0].skill = ref('skill', skill);
    d.choices.learn.lesson_payment.resource = ref('resource', 'pennies');
    c.dialogues[named('dialogue', d.key)] = d;
  }
  const careful = source('rooms/willow_shade').details.fenwort_patch.harvest.careful;
  careful.skill = ref('skill', careful.skill);
  c.rooms[named('room', 'willow_shade')].details.fenwort_patch.harvest.careful = careful;
  const discount = source('npcs/peg').shop.buy_discount;
  discount.skill = ref('skill', discount.skill);
  c.npcs[named('npc', 'peg')].shop.buy_discount = discount;
  c.actions[named('action', 'gather_carefully')] = {
    key: 'gather_carefully',
    ...source('actions/gather_carefully'),
  };
  const canonical = encode(c);
  return { value: c, canonical, sha256: createHash('sha256').update(canonical).digest('hex') };
}
export function practicalWorld(stat = 10, room = 'willow_shade', pennies = 3, mv = 5) {
  const b = practicalBundle(stat, room, pennies, mv);
  const loaded = loadCartridge(
    new TextEncoder().encode(JSON.stringify({ cartridge: b.value, content_hash: b.sha256 })),
    INSTALLED,
  );
  assert.ok(loaded.ok, JSON.stringify(loaded));
  return newWorld(
    loaded.cartridge as Cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
}
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
