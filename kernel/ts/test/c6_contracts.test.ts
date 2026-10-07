import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFS } from '../src/contracts.gen.ts';
import { validate, type Defs } from '../src/foundation/validate.ts';
import { read } from './read.ts';

const id = 'aaaaaaaa-0000-4000-8000-000000000001';
const row = {
  kind: 'expedition',
  actor_id: id,
  body_id: id,
  quest_instance_id: id,
  attempt_id: id,
  cursor: 0,
  sheltered: false,
  status: 'active',
};
const quest = Object.values(
  read('kernel/ts/test/fixtures/c6-provisional-artifact.json').cartridge.quests,
).find((q: any) => q.key === 'a_night_in_the_marsh') as any;

// Breaks: a malformed persisted attempt loses its actor/body/generation or admits an unbounded cursor.
test('expedition row requires its bindings and bounded stage, with a red control for every guard', () => {
  assert.deepEqual(validate('ExpeditionAttempt', row), []);
  for (const field of [
    'kind',
    'actor_id',
    'body_id',
    'quest_instance_id',
    'attempt_id',
    'cursor',
    'sheltered',
    'status',
  ]) {
    const incomplete = { ...row } as Record<string, unknown>;
    delete incomplete[field];
    assert.notDeepEqual(validate('ExpeditionAttempt', incomplete), [], field);
    const mutant = structuredClone(DEFS) as Defs;
    mutant.ExpeditionAttempt.required = (mutant.ExpeditionAttempt.required as string[]).filter(
      (key) => key !== field,
    );
    assert.deepEqual(
      validate('ExpeditionAttempt', incomplete, mutant),
      [],
      `missing ${field} red control`,
    );
  }
  for (const [field, cursor] of [
    ['minimum', -1],
    ['maximum', 33],
  ] as const) {
    assert.notDeepEqual(validate('ExpeditionAttempt', { ...row, cursor }), []);
    const mutant = structuredClone(DEFS) as Defs;
    delete mutant.ExpeditionAttempt.properties!.cursor[field];
    assert.deepEqual(validate('ExpeditionAttempt', { ...row, cursor }, mutant), [], field);
  }
  for (const [field, value, guard] of [
    ['kind', 'patrol', 'const'],
    ['status', 'pending', 'enum'],
  ] as const) {
    const invalid = { ...row, [field]: value };
    assert.notDeepEqual(validate('ExpeditionAttempt', invalid), [], field);
    const mutant = structuredClone(DEFS) as Defs;
    delete mutant.ExpeditionAttempt.properties![field][guard];
    assert.deepEqual(
      validate('ExpeditionAttempt', invalid, mutant),
      [],
      `${field}.${guard} red control`,
    );
  }
});

// Breaks: source contracts allow missing route, shelter/reward metadata or oversized route/footprint.
test('expedition quest requires its owned declarations and bounded route/reward', () => {
  assert.deepEqual(validate('QuestDefinition', quest), []);
  for (const [section, fields] of [
    [
      '',
      [
        'start_room',
        'start_detail',
        'shelter_room',
        'shelter_detail',
        'route',
        'footprint',
        'survived_fact',
        'faction',
        'faction_delta',
        'hound_population',
        'narration',
        'actions',
      ],
    ],
    ['narration', ['start', 'restart', 'shelter', 'failed', 'completed']],
    ['actions', ['start', 'restart', 'shelter']],
    ['route', ['from', 'direction', 'to']],
  ] as const)
    for (const field of fields) {
      const bad = structuredClone(quest);
      const target =
        section === 'route'
          ? bad.expedition.route[0]
          : section
            ? bad.expedition[section]
            : bad.expedition;
      delete target[field];
      assert.notDeepEqual(validate('QuestDefinition', bad), [], `${section}.${field}`);
      const mutant = structuredClone(DEFS) as Defs;
      const expedition = mutant.QuestDefinition.properties!.expedition as any;
      const schema =
        section === 'route'
          ? expedition.properties.route.items
          : section
            ? expedition.properties[section]
            : expedition;
      schema.required = schema.required.filter((key: string) => key !== field);
      assert.deepEqual(
        validate('QuestDefinition', bad, mutant),
        [],
        `${section}.${field} red control`,
      );
    }
  for (const [field, value] of [
    ['route', []],
    ['route', Array(33).fill(quest.expedition.route[0])],
    ['footprint', [quest.expedition.start_room]],
    ['footprint', Array(33).fill(quest.expedition.start_room)],
    ['faction_delta', -101],
    ['faction_delta', 0],
  ] as const) {
    assert.notDeepEqual(
      validate('QuestDefinition', {
        ...quest,
        expedition: { ...quest.expedition, [field]: value },
      }),
      [],
      field,
    );
    const mutant = structuredClone(DEFS) as Defs;
    const schema = (mutant.QuestDefinition.properties!.expedition as any).properties[field];
    const bound =
      field === 'faction_delta'
        ? value === 0
          ? 'maximum'
          : 'minimum'
        : Array.isArray(value) && value.length === 33
          ? 'maxItems'
          : 'minItems';
    delete schema[bound];
    assert.deepEqual(
      validate(
        'QuestDefinition',
        { ...quest, expedition: { ...quest.expedition, [field]: value } },
        mutant,
      ),
      [],
      `${field}.${bound} red control`,
    );
  }
});

// Breaks: the wire loses an expedition detail/binding, or projects a stage/count outside its budget.
test('expedition command, transition and journal contracts fail closed with individual red controls', () => {
  const command = {
    type: 'expedition',
    actor_id: id,
    detail_id: id,
    transition: 'start',
    cursor: 0,
  };
  const op = {
    op: 'expedition.transition',
    writer_group: 0,
    quest_instance_id: id,
    expected: null,
    value: row,
  };
  const expedition = {
    quest_instance_id: id,
    attempt_id: id,
    cursor: 0,
    required: 5,
    sheltered: false,
    status: 'active',
  };
  const view = {
    quest: {
      cartridge_id: 'ashmere_missing_child',
      cartridge_version: '0.0.38',
      kind: 'quest',
      key: 'a_night_in_the_marsh',
    },
    title: 'quest.a_night_in_the_marsh.title',
    state: 'active',
    expedition,
  };
  const schema = (defs: Defs, contract: string): any =>
    contract === 'QuestView'
      ? defs.QuestView.properties!.expedition
      : (defs[contract].oneOf as any[]).find((branch) =>
          contract === 'CommandPayload'
            ? branch.properties.type.const === 'expedition'
            : branch.properties.op.const === 'expedition.transition',
        );
  for (const [contract, value, required] of [
    ['CommandPayload', command, ['actor_id', 'detail_id', 'transition']],
    ['DeltaOp', op, ['writer_group', 'quest_instance_id', 'expected', 'value']],
    [
      'QuestView',
      view,
      ['quest_instance_id', 'attempt_id', 'cursor', 'required', 'sheltered', 'status'],
    ],
  ] as const) {
    assert.deepEqual(validate(contract, value), []);
    for (const field of required) {
      const incomplete = structuredClone(value) as any;
      delete (contract === 'QuestView' ? incomplete.expedition : incomplete)[field];
      assert.notDeepEqual(validate(contract, incomplete), [], `${contract}.${field}`);
      const mutant = structuredClone(DEFS) as Defs;
      const declaration = schema(mutant, contract);
      declaration.required = declaration.required.filter((key: string) => key !== field);
      assert.deepEqual(
        validate(contract, incomplete, mutant),
        [],
        `${contract}.${field} red control`,
      );
    }
  }
  for (const [contract, field, value, bound] of [
    ['CommandPayload', 'cursor', -1, 'minimum'],
    ['CommandPayload', 'cursor', 33, 'maximum'],
    ['QuestView', 'cursor', -1, 'minimum'],
    ['QuestView', 'cursor', 33, 'maximum'],
    ['QuestView', 'required', 0, 'minimum'],
    ['QuestView', 'required', 33, 'maximum'],
  ] as const) {
    const invalid =
      contract === 'QuestView'
        ? { ...view, expedition: { ...expedition, [field]: value } }
        : { ...command, [field]: value };
    assert.notDeepEqual(validate(contract, invalid), [], `${contract}.${field}.${bound}`);
    const mutant = structuredClone(DEFS) as Defs;
    delete schema(mutant, contract).properties[field][bound];
    assert.deepEqual(
      validate(contract, invalid, mutant),
      [],
      `${contract}.${field}.${bound} red control`,
    );
  }
  for (const [contract, field, value] of [
    ['CommandPayload', 'transition', 'complete'],
    ['QuestView', 'status', 'pending'],
  ] as const) {
    const invalid =
      contract === 'QuestView'
        ? { ...view, expedition: { ...expedition, [field]: value } }
        : { ...command, [field]: value };
    assert.notDeepEqual(validate(contract, invalid), [], field);
    const mutant = structuredClone(DEFS) as Defs;
    delete schema(mutant, contract).properties[field].enum;
    assert.deepEqual(validate(contract, invalid, mutant), [], `${field}.enum red control`);
  }
});
