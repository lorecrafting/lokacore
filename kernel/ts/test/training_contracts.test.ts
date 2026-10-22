import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validate } from '../src/foundation/validate.ts';
import { loadCartridge, INSTALLED } from '../src/index.ts';
import { trainingBundle, bundleOf } from './training_fixture.ts';
const c = JSON.parse(trainingBundle().canonical);
const ref = (kind: string, key: string) => ({
  cartridge_id: 'cellar_sampler',
  cartridge_version: '0.0.9',
  kind,
  key,
});
function load(value: any) {
  const b = bundleOf(value);
  return loadCartridge(
    new TextEncoder().encode(JSON.stringify({ cartridge: value, content_hash: b.sha256 })),
    INSTALLED,
  );
}

// Breaks: malformed skill, fee, weapon or view data crosses the generated contract boundary.
test('new typed contracts require independent fields and reject boundary values', () => {
  const cases: [string, any, string[]][] = [
    [
      'SkillDefinition',
      {
        key: 'swords',
        label: 'skill.swords',
        requirement: 'skill.requirement',
        qualification: { policy_version: 1, root: { op: 'all', items: [] } },
      },
      ['key', 'label', 'requirement', 'qualification'],
    ],
    [
      'WeaponProfile',
      { skill: ref('skill', 'swords'), attack: { chance: 100, damage_min: 3, damage_max: 3 } },
      ['skill', 'attack'],
    ],
    [
      'SkillView',
      {
        skill: ref('skill', 'swords'),
        label: 'skill.swords',
        requirement: 'skill.requirement',
        acquired: true,
        qualified: false,
        usable: false,
      },
      ['skill', 'label', 'requirement', 'acquired', 'qualified', 'usable'],
    ],
    ['AttributeView', { attribute: ref('attribute', 'str'), value: 10 }, ['attribute', 'value']],
  ];
  for (const [contract, value, fields] of cases) {
    assert.deepEqual(validate(contract, value), []);
    for (const field of fields) {
      const mutant = { ...value };
      delete mutant[field];
      assert.ok(validate(contract, mutant).length, contract + field);
    }
  }
  const choice = {
    label: 'lesson.label',
    narration: 'lesson.result',
    sequence: [{ op: 'skill.acquire', skill: ref('skill', 'swords') }],
    lesson_payment: { to: 'teacher', resource: ref('resource', 'pennies'), amount: 4 },
  };
  assert.deepEqual(validate('DialogueChoice', choice), []);
  for (const field of ['op', 'skill']) {
    const m = structuredClone(choice);
    delete (m.sequence[0] as any)[field];
    assert.ok(validate('DialogueChoice', m).length, field);
  }
  for (const field of ['to', 'resource', 'amount']) {
    const m = structuredClone(choice);
    delete (m.lesson_payment as any)[field];
    assert.ok(validate('DialogueChoice', m).length, field);
  }
  for (const amount of [0, 2147483648, 1.5])
    assert.ok(
      validate('DialogueChoice', {
        ...choice,
        lesson_payment: { ...choice.lesson_payment, amount },
      }).length,
    );
  const item = c.items['cellar_sampler@0.0.9:item/shield'];
  for (const block_chance of [-1, 101, 1.5])
    assert.ok(validate('ItemDefinition', { ...item, block_chance }).length);
  const p = {
    type: 'attack_result',
    encounter_id: 'aaaaaaaa-0000-4000-8000-000000000001',
    attacker_id: 'aaaaaaaa-0000-4000-8000-000000000002',
    target_id: 'aaaaaaaa-0000-4000-8000-000000000003',
    hit: false,
    loss: 0,
    prevented_by: 'parry',
  };
  assert.ok(validate('EventPayload', p).length);
});

// Breaks: loader permits counterfeit acquisition writers, unresolved requirements, bad slots or unfunded teachers.
test('skill loader owns reserved acquisition, qualifications, teacher funding and real equipment shapes', () => {
  assert.ok(load(c).ok);
  const mutants: ((c: any) => void)[] = [
    (c) => delete c.facts['cellar_sampler@0.0.9:fact/skill_swords'],
    (c) => (c.facts['cellar_sampler@0.0.9:fact/skill_swords'].value_type.default = true),
    (c) =>
      (c.skills['cellar_sampler@0.0.9:skill/swords'].qualification.root.attribute = ref(
        'attribute',
        'missing',
      )),
    (c) => (c.items['cellar_sampler@0.0.9:item/sword'].slot = 'off_hand'),
    (c) => (c.items['cellar_sampler@0.0.9:item/shield'].slot = 'wield'),
    (c) => (c.items['cellar_sampler@0.0.9:item/sword'].weapon.attack.damage_min = 4),
    (c) => (c.items['cellar_sampler@0.0.9:item/sword'].weapon.skill = ref('skill', 'missing')),
    (c) => delete c.world.combat.narration.block,
    (c) => delete c.npcs['cellar_sampler@0.0.9:npc/teacher'].resource_starts,
    (c) => {
      const lesson = c.dialogues['cellar_sampler@0.0.9:dialogue/learn_swords'];
      delete lesson.choices.learn.lesson_payment;
      lesson.roles = {};
    },
    (c) =>
      (c.dialogues['cellar_sampler@0.0.9:dialogue/learn_swords'].choices.learn.sequence = [
        { op: 'fact.assign', fact: ref('fact', 'skill_swords'), value: true },
      ]),
    (c) => {
      const learn = c.dialogues['cellar_sampler@0.0.9:dialogue/learn_swords'].choices.learn;
      learn.sequence = [...learn.sequence, ...learn.sequence];
    },
  ];
  for (const mutate of mutants) {
    const m = structuredClone(c);
    mutate(m);
    assert.equal(load(m).ok, false);
  }
  // A scene ending that writes the reserved skill fact counterfeits acquisition (the scenes arm of
  // the reserved-writer walk); the same ending writing an ordinary fact loads.
  for (const [fact, code] of [
    ['rat_1_killed', undefined],
    ['skill_swords', 'RESERVED_FACT'],
  ] as const) {
    const m = structuredClone(c);
    const P = 'cellar_sampler@0.0.9';
    m.story_points[`${P}:story_point/lantern_resolved`].outcomes.kept = {
      scene: ref('scene', 'lantern_kept'),
    };
    m.facts[`${P}:fact/story_point_lantern_resolved`] = {
      key: 'story_point_lantern_resolved',
      version: 1,
      value_type: {
        type: 'enum',
        values: ['unreached', 'carry', 'kept', 'leave'],
        default: 'unreached',
      },
      scopes: ['player'],
      meaning: "Story point lantern_resolved's reached outcome (scene@1): only scene@1 writes it.",
    };
    m.scenes[`${P}:scene/lantern_kept`].on_end = {
      story_point: ref('story_point', 'lantern_resolved'),
      outcome: 'kept',
      assign: [{ fact: ref('fact', fact), value: true }],
    };
    const r = load(m);
    assert.equal(r.ok ? undefined : r.diagnostic.code, code, fact);
  }
});
