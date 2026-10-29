import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validate } from '../src/foundation/validate.ts';
import { trainingBundle } from './training_fixture.ts';
const c = JSON.parse(trainingBundle().canonical);
const ref = (kind: string, key: string) => ({
  cartridge_id: 'cellar_sampler',
  cartridge_version: '0.0.9',
  kind,
  key,
});

// Breaks: malformed skill, fee, weapon or view data crosses the generated contract boundary.
test('new typed contracts require independent fields and reject boundary values', () => {
  const cases: [string, any, string[]][] = [
    [
      'SkillDefinition',
      {
        key: 'swords',
        label: 'skill.swords',
        requirement: 'skill.requirement',
      },
      ['key', 'label', 'requirement'],
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
