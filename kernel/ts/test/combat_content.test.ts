import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { loadCartridge } from '../src/content/cartridge.ts';
import { encode } from '../src/foundation/canonical.ts';
import { read } from './read.ts';

const base = read('protocol/fixtures/sampler_v008_hash.json').value;
const prefix = `${base.manifest.id}@${base.manifest.version}`;
const npcKey = `${prefix}:npc/cellar_rat_1`;
const factKey = `${prefix}:fact/rat_dead`;
const ref = (kind: string, key: string) => ({
  cartridge_id: base.manifest.id,
  cartridge_version: base.manifest.version,
  kind,
  key,
});
const attack = { chance: 80, damage_min: 1, damage_max: 3 };
function cartridge() {
  const c = structuredClone(base);
  c.manifest.requires.kernel_api.at_least = '1.6';
  c.manifest.requires.capabilities.combat = c.lock.capabilities.combat = 1;
  c.world.combat = {
    player_attack: { ...attack },
    interval: 2,
    sleep_multiplier: 2,
    flee_multiplier: 3,
    narration: Object.fromEntries(
      ['player_hit', 'player_miss', 'npc_hit', 'npc_miss', 'player_died', 'npc_died'].map((k) => [
        k,
        'test.combat',
      ]),
    ),
  };
  c.text['test.combat'] = 'Test.';
  c.npcs[npcKey].attack = { ...attack };
  c.facts[factKey] = {
    key: 'rat_dead',
    version: 1,
    scopes: ['player'],
    value_type: { type: 'bool', default: false },
    meaning: 'Rat defeated',
  };
  c.world.death_credit = [
    {
      npc: ref('npc', 'cellar_rat_1'),
      room: ref('room', 'lantern_cellar'),
      fact: ref('fact', 'rat_dead'),
    },
  ];
  return c;
}
function load(c: any) {
  return loadCartridge(
    new TextEncoder().encode(
      JSON.stringify({
        cartridge: c,
        content_hash: createHash('sha256').update(encode(c)).digest('hex'),
      }),
    ),
    {
      kernel_api: '1.6',
      content_schema: 1,
      rule_ir: 1,
      client_features: [],
      capabilities: Object.fromEntries(
        Object.keys(cartridge().lock.capabilities).map((k) => [k, [1]]),
      ),
    },
  );
}

// Breaks: loader ignores the combat boundary and admits unsupported or impossible attack profiles.
test('combat artifact requires executable API, owners, ordered damage and explicit NPC HP', () => {
  assert.ok(load(cartridge()).ok);
  const cases: [string, (c: any) => void, string, string][] = [
    [
      'old API',
      (c) => {
        c.manifest.requires.kernel_api.at_least = '1.5';
      },
      'KERNEL_API_RANGE_INVALID',
      '.cartridge.manifest.requires.kernel_api.at_least',
    ],
    [
      'player bounds',
      (c) => {
        c.world.combat.player_attack.damage_min = 4;
      },
      'SCHEMA_VIOLATION',
      '.cartridge.world.combat.player_attack.damage_max',
    ],
    [
      'NPC bounds',
      (c) => {
        c.npcs[npcKey].attack.damage_min = 4;
      },
      'SCHEMA_VIOLATION',
      `.cartridge.npcs["${npcKey}"].attack.damage_max`,
    ],
    [
      'NPC HP',
      (c) => {
        delete c.npcs[npcKey].hp;
      },
      'SCHEMA_VIOLATION',
      `.cartridge.npcs["${npcKey}"].hp`,
    ],
    [
      'missing settings',
      (c) => {
        delete c.world.combat;
      },
      'SCHEMA_VIOLATION',
      `.cartridge.npcs["${npcKey}"].attack`,
    ],
  ];
  for (const cap of ['combat', 'schedule', 'death'])
    cases.push([
      `missing ${cap}`,
      (c) => {
        delete c.manifest.requires.capabilities[cap];
        delete c.lock.capabilities[cap];
        if (cap === 'schedule') {
          delete c.manifest.time_policy;
          for (const npc of Object.values(c.npcs) as any[]) delete npc.daily_schedule;
          for (const resource of Object.values(c.resources) as any[]) delete resource.regen;
        }
      },
      'UNDECLARED_CAPABILITY',
      '.cartridge.world.combat',
    ]);
  for (const [name, mutate, code, path] of cases) {
    const c = cartridge();
    mutate(c);
    const result = load(c);
    assert.ok(!result.ok, name);
    if (!result.ok) {
      assert.equal(result.diagnostic.code, code, name);
      assert.equal(result.diagnostic.path, path, name);
    }
  }
});

// Breaks: death credit can target an unrelated room/NPC, duplicate a victim/fact, or reuse a true/global fact.
test('death credit binds unique local attackable NPCs and false player Boolean facts', () => {
  const cases: [string, (c: any) => void, string, string][] = [
    [
      'credit without combat',
      (c) => {
        delete c.world.combat;
        delete c.npcs[npcKey].attack;
      },
      'SCHEMA_VIOLATION',
      '.cartridge.world.death_credit',
    ],
    [
      'noncombat NPC',
      (c) => {
        delete c.npcs[npcKey].attack;
      },
      'SCHEMA_VIOLATION',
      '.cartridge.world.death_credit[0].npc',
    ],
    [
      'wrong room',
      (c) => {
        c.world.death_credit[0].room.key = 'chapel_nave';
      },
      'SCHEMA_VIOLATION',
      '.cartridge.world.death_credit[0].room',
    ],
    [
      'wrong scope',
      (c) => {
        c.facts[factKey].scopes = ['instance'];
      },
      'SCHEMA_VIOLATION',
      '.cartridge.world.death_credit[0].fact',
    ],
    [
      'true default',
      (c) => {
        c.facts[factKey].value_type.default = true;
      },
      'SCHEMA_VIOLATION',
      '.cartridge.world.death_credit[0].fact',
    ],
    [
      'integer fact',
      (c) => {
        c.facts[factKey].value_type = { type: 'int', default: 0 };
      },
      'SCHEMA_VIOLATION',
      '.cartridge.world.death_credit[0].fact',
    ],
    [
      'duplicate NPC',
      (c) => {
        c.facts[`${prefix}:fact/rat_dead_two`] = { ...c.facts[factKey], key: 'rat_dead_two' };
        c.world.death_credit.push({
          ...c.world.death_credit[0],
          fact: ref('fact', 'rat_dead_two'),
        });
      },
      'SCHEMA_VIOLATION',
      '.cartridge.world.death_credit[0].npc',
    ],
    [
      'duplicate fact',
      (c) => {
        c.npcs[`${prefix}:npc/cellar_rat_2`].attack = { ...attack };
        c.world.death_credit.push({ ...c.world.death_credit[0], npc: ref('npc', 'cellar_rat_2') });
      },
      'SCHEMA_VIOLATION',
      '.cartridge.world.death_credit[0].fact',
    ],
  ];
  for (const field of ['npc', 'room', 'fact'])
    cases.push([
      `missing ${field}`,
      (c) => {
        c.world.death_credit[0][field].key = 'missing';
      },
      'UNRESOLVED_REFERENCE',
      `.cartridge.world.death_credit[0].${field}`,
    ]);
  cases.push([
    'foreign reference',
    (c) => {
      c.world.death_credit[0].npc.cartridge_id = 'elsewhere';
    },
    'UNRESOLVED_REFERENCE',
    '.cartridge.world.death_credit[0].npc',
  ]);
  cases.push([
    'wrong kind',
    (c) => {
      c.world.death_credit[0].fact.kind = 'room';
      c.world.death_credit[0].fact.key = 'lantern_cellar';
    },
    'UNRESOLVED_REFERENCE',
    '.cartridge.world.death_credit[0].fact',
  ]);
  for (const [name, mutate, code, path] of cases) {
    const c = cartridge();
    mutate(c);
    const result = load(c);
    assert.ok(!result.ok, name);
    if (!result.ok) {
      assert.equal(result.diagnostic.code, code, name);
      assert.equal(result.diagnostic.path, path, name);
    }
  }
});

// Breaks: a missing combat narration key reaches a due round and renders an unresolved text key.
test('every combat narration role names existing cartridge text', () => {
  for (const field of [
    'player_hit',
    'player_miss',
    'npc_hit',
    'npc_miss',
    'player_died',
    'npc_died',
  ]) {
    const c = cartridge();
    c.world.combat.narration[field] = 'missing';
    const result = load(c);
    assert.ok(!result.ok, field);
    if (!result.ok) {
      assert.equal(result.diagnostic.code, 'UNRESOLVED_REFERENCE');
      assert.equal(result.diagnostic.path, `.cartridge.world.combat.narration.${field}`);
    }
  }
});

// Breaks: a cartridge can start combat but every fatal round fails without corpse/shrine settings.
test('combat requires executable death settings even without authored corpse templates', () => {
  const c = cartridge();
  delete c.world.death;
  for (const [key, item] of Object.entries(c.items) as [string, any][])
    if (item.location.in === 'template') delete c.items[key];
  const result = load(c);
  assert.ok(!result.ok);
  if (!result.ok) {
    assert.equal(result.diagnostic.code, 'SCHEMA_VIOLATION');
    assert.equal(result.diagnostic.path, '.cartridge.world.death');
  }
});
