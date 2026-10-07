import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { DEFS } from '../src/contracts.gen.ts';
import { validate, type Defs } from '../src/foundation/validate.ts';
import { encode } from '../src/foundation/canonical.ts';
import { loadCartridge, INSTALLED } from '../src/index.ts';
import { read } from './read.ts';

const id = 'aaaaaaaa-0000-4000-8000-000000000001';
const ref = (kind: string, key: string) => ({
  cartridge_id: 'ashmere_missing_child',
  cartridge_version: '0.0.42',
  kind,
  key,
});
const visit = { actor_id: id, room_id: id };
const observation = { ...visit, npc_id: id, at: 0 };
const room = { id, title: 'room.ferry_landing.title', x: 0, y: 0, z: 0 };
const cases: [string, any, string?][] = [
  ['VisitedRoom', visit],
  ['ObservedNpc', observation],
  ['MapPosition', { room: ref('room', 'ferry_landing'), x: 0, y: 0, z: 0 }],
  [
    'KnockResponse',
    {
      npc: ref('npc', 'aldric'),
      room: ref('room', 'chapel_nave'),
      answered: 'knock.chapel.answered',
      unanswered: 'knock.chapel.unanswered',
    },
  ],
  ['KnownRoomView', room],
  ['KnownConnectionView', { from: id, to: id, direction: 'north' }],
  ['KnownNpcView', { id, name: 'npc.aldric.short' }],
  ['MapView', { rooms: [room], links: [] }],
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

const pin = read('protocol/fixtures/missing_child_v042_hash.json');
const load = (cartridge: any) =>
  loadCartridge(
    new TextEncoder().encode(
      JSON.stringify({
        cartridge,
        content_hash: createHash('sha256').update(encode(cartridge)).digest('hex'),
      }),
    ),
    {
      ...INSTALLED,
      kernel_api: '1.37',
      capabilities: { ...INSTALLED.capabilities, knowledge: [1] },
    },
  );

// Breaks: a rehashed artifact draws duplicate/unresolved rooms or grants Knock to a non-door face.
test('D10 loader refuses invalid authored map and Knock declarations', () => {
  assert.equal(load(pin.value).ok, true);
  for (const mutate of [
    (c: any) => c.map_positions.pop(),
    (c: any) => (c.map_positions[1] = c.map_positions[0]),
    (c: any) =>
      Object.assign(c.map_positions[1], {
        x: c.map_positions[0].x,
        y: c.map_positions[0].y,
        z: c.map_positions[0].z,
      }),
    (c: any) => (c.map_positions[0].room = ref('room', 'absent')),
    (c: any) => (c.map_positions[0].x = '0'),
    (c: any) => (c.manifest.requires.kernel_api.at_least = '1.36'),
    (c: any) => {
      delete c.lock.capabilities.knowledge;
      delete c.manifest.requires.capabilities.knowledge;
    },
    (c: any) =>
      (c.rooms['ashmere_missing_child@0.0.42:room/chapel_steps'].exits.north.knock.npc = ref(
        'npc',
        'absent',
      )),
    (c: any) =>
      (c.rooms['ashmere_missing_child@0.0.42:room/chapel_steps'].exits.north.knock.room = ref(
        'room',
        'chapel_steps',
      )),
    (c: any) =>
      (c.rooms['ashmere_missing_child@0.0.42:room/chapel_steps'].exits.north.knock.answered =
        'absent'),
  ]) {
    const c = structuredClone(pin.value);
    mutate(c);
    assert.equal(load(c).ok, false);
  }
});
