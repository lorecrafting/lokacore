import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFS } from '../src/contracts.gen.ts';
import { validate, type Defs } from '../src/foundation/validate.ts';
import { fragment } from './fragment.ts';

const id = 'aaaaaaaa-0000-4000-8000-000000000001';
const { ref, prefix, load } = fragment('protocol/fixtures/toolbox_showcase_hash.json');
const visit = { actor_id: id, room_id: id };
const observation = { ...visit, npc_id: id, at: 0 };
const room = { id, title: 'room.crossroads_inn.title', x: 0, y: 0, z: 0 };
const cases: [string, any, string?][] = [
  ['VisitedRoom', visit],
  ['ObservedNpc', observation],
  ['MapPosition', { room: ref('room', 'crossroads_inn'), x: 0, y: 0, z: 0 }],
  [
    'KnockResponse',
    {
      npc: ref('npc', 'smith'),
      room: ref('room', 'woodstore'),
      answered: 'knock.store.answered',
      unanswered: 'knock.store.unanswered',
    },
  ],
  ['KnownRoomView', room],
  ['KnownConnectionView', { from: id, to: id, direction: 'north' }],
  ['KnownNpcView', { id, name: 'npc.smith.short' }],
  ['UnexploredExitView', { from: id, direction: 'east' }],
  ['MapView', { rooms: [room], links: [], unexplored: [{ from: id, direction: 'east' }] }],
  ['MutationTarget', { kind: 'visit', ...visit }, 'visit'],
  ['MutationTarget', { kind: 'observation', actor_id: id, npc_id: id }, 'observation'],
  ['DeltaOp', { op: 'visit.record', writer_group: 0, ...visit, value: visit }, 'visit.record'],
  [
    'DeltaOp',
    {
      op: 'observation.record',
      writer_group: 0,
      actor_id: id,
      npc_id: id,
      from: null,
      value: observation,
    },
    'observation.record',
  ],
  ['CommandPayload', { type: 'where', actor_id: id, target_id: id }, 'where'],
  ['CommandPayload', { type: 'knock', actor_id: id, direction: 'north' }, 'knock'],
  ['LocatedNpc', { target_id: id, status: 'here', room_id: id }, 'here'],
  ['LocatedNpc', { target_id: id, status: 'last_seen', room_id: id, at: 0 }, 'last_seen'],
  ['LocatedNpc', { target_id: id, status: 'unknown' }, 'unknown'],
];

// Breaks: incomplete knowledge/location/door records or unbounded drawing coordinates pass wire admission.
test('D10 contracts require each binding and bound with executable schema red controls', () => {
  for (const [contract, value, tag] of cases) {
    assert.deepEqual(validate(contract, value), [], contract);
    const original: any = (DEFS as any)[contract];
    const shape: any = tag
      ? original.oneOf.find((b: any) =>
          Object.values(b.properties).some((p: any) => p.const === tag),
        )
      : original;
    const defs = { ...DEFS, D10Probe: shape } as Defs;
    for (const field of shape.required) {
      const invalid = { ...value };
      delete invalid[field];
      assert.notDeepEqual(validate('D10Probe', invalid, defs), [], `${contract}.${field}`);
      const mutant = structuredClone(defs);
      (mutant.D10Probe as any).required = shape.required.filter((k: string) => k !== field);
      assert.deepEqual(validate('D10Probe', invalid, mutant), [], `${contract}.${field} red`);
    }
    for (const [field, property] of Object.entries(shape.properties) as [string, any][]) {
      for (const guard of ['minimum', 'maximum', 'const', 'enum']) {
        if (property[guard] === undefined) continue;
        const bad =
          guard === 'minimum'
            ? property.minimum - 1
            : guard === 'maximum'
              ? property.maximum + 1
              : '__invalid__';
        const invalid = { ...value, [field]: bad };
        assert.notDeepEqual(
          validate('D10Probe', invalid, defs),
          [],
          `${contract}.${field}.${guard}`,
        );
        const mutant = structuredClone(defs);
        delete (mutant.D10Probe as any).properties[field][guard];
        assert.deepEqual(
          validate('D10Probe', invalid, mutant),
          [],
          `${contract}.${field}.${guard} red`,
        );
      }
    }
  }
});

// Breaks: an unexplored stub carries its unvisited destination's id or title onto the wire.
// Declared properties close the object (validate.ts), so the red control declares the leaked key.
test('an unexplored stub admits no destination id or title, with a declared-key red control', () => {
  for (const key of ['to', 'title']) {
    const leak = { from: id, direction: 'east', [key]: id };
    assert.notDeepEqual(validate('MapView', { rooms: [], links: [], unexplored: [leak] }), [], key);
    const mutant = structuredClone(DEFS) as any;
    mutant.UnexploredExitView.properties[key] = {};
    assert.deepEqual(
      validate('MapView', { rooms: [], links: [], unexplored: [leak] }, mutant),
      [],
      `${key} red`,
    );
  }
});

// Breaks: an empty map-position declaration bypasses the wire's nonempty requirement.
test('compiled map-position arrays reject empty declarations with a minItems red control', () => {
  const cartridge: any = (DEFS as any).CompiledCartridge.oneOf.find(
    (b: any) => b.properties.format.const === 'loka-cartridge-v2',
  );
  const defs = { ...DEFS, D10Probe: cartridge.properties.layout } as Defs;
  assert.notDeepEqual(validate('D10Probe', [], defs), []);
  const mutant = structuredClone(defs);
  delete (mutant.D10Probe as any).minItems;
  assert.deepEqual(validate('D10Probe', [], mutant), []);
});

// Showcase plus an inline Knock on the Smithy's south store door, answered by the smith.
const smithy = `${prefix}:room/smithy`;
const knock = (c: any) => {
  c.rooms[smithy].exits.south.knock = {
    npc: ref('npc', 'smith'),
    room: ref('room', 'woodstore'),
    answered: 'knock.store.answered',
    unanswered: 'knock.store.unanswered',
  };
  c.text['knock.store.answered'] = 'The smith calls back.';
  c.text['knock.store.unanswered'] = 'No one answers.';
};

// Breaks: the loader refuses a valid Knock door or loads a non-numeric map coordinate.
test('D10 loader loads Knock and refuses a malformed map coordinate', () => {
  assert.equal(load(knock).ok, true);
  const loaded = load((c) => (knock(c), (c.layout[0].x = '0')));
  assert.equal(loaded.ok, false);
  if (loaded.ok) return;
  assert.deepEqual(
    [loaded.diagnostic.code, loaded.diagnostic.path],
    ['SCHEMA_VIOLATION', '.cartridge.layout[0].x'],
  );
});
