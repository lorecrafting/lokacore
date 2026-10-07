import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { encode } from '../src/foundation/canonical.ts';
import { test } from 'node:test';
import { DEFS } from '../src/contracts.gen.ts';
import { validate, type Defs } from '../src/foundation/validate.ts';
import { read } from './read.ts';
import { INSTALLED, loadCartridge, newWorld, type Cartridge } from '../src/index.ts';

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
  read('protocol/fixtures/missing_child_v041_hash.json').value.quests,
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
      cartridge_version: '0.0.41',
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

// Breaks: changing cast or cue content shifts fresh identities without updating the release pin.
test('final C6 allocation pins the shelter detail and all starting identities', () => {
  const pin = read('protocol/fixtures/missing_child_v041_hash.json');
  const loaded = loadCartridge(
    new TextEncoder().encode(
      JSON.stringify({
        cartridge: pin.value,
        content_hash: pin.sha256,
      }),
    ),
    INSTALLED,
  );
  assert.ok(loaded.ok);
  const world = newWorld(
    (loaded as { cartridge: Cartridge }).cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
  const actual: Record<string, string> = {
    character: world.character,
    body: world.body,
    consumed: world.consumed!,
  };
  for (const [id, room] of Object.entries(world.rooms)) actual[`room/${room.key}`] = id;
  for (const [id, detail] of Object.entries(world.details))
    actual[`detail/${world.rooms[detail.room].key}/${detail.key}`] = id;
  for (const [id, entity] of Object.entries(world.entities)) {
    const origin = world.state.created?.[id]?.origin;
    if (origin?.kind === 'spawned')
      actual[
        `population/${origin.by.key}/slot${origin.slot}/${origin.role === 'hound' ? 'member' : origin.role}`
      ] = id;
    else actual[`${entity.kind}/${entity.key}`] = id;
  }
  for (const [id, job] of Object.entries(world.state.jobs ?? {}))
    actual[job.job.kind === 'population' ? `population/${job.job.key}/job` : `job/${job.job.key}`] =
      id;
  for (const [slot, id] of Object.entries(world.slots)) actual[`slot/${slot}`] = id;
  assert.deepEqual(actual, read('protocol/fixtures/missing_child_v041_ids.json'));
});

// Breaks: a structurally valid route claims a transfer that its source room's exit cannot make.
test('C6 loader refuses an independently rehashed impossible physical route', () => {
  const cartridge = structuredClone(read('protocol/fixtures/missing_child_v041_hash.json').value);
  const quest = Object.values(cartridge.quests).find(
    (q: any) => q.key === 'a_night_in_the_marsh',
  ) as any;
  quest.expedition.route[0].direction = 'north';
  const loaded = loadCartridge(
    new TextEncoder().encode(
      JSON.stringify({
        cartridge,
        content_hash: createHash('sha256').update(encode(cartridge)).digest('hex'),
      }),
    ),
    INSTALLED,
  );
  assert.equal(loaded.ok, false);
  if (loaded.ok) throw Error('impossible physical route loaded');
  assert.equal(loaded.diagnostic.code, 'OUTCOME_MISMATCH');
  assert.ok(loaded.diagnostic.path.endsWith('.expedition.route[0]'));
});
