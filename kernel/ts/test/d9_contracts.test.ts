import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { bundle, ref } from './transport_fixture.ts';
import { encode } from '../src/foundation/canonical.ts';
import { validate } from '../src/foundation/validate.ts';
import { INSTALLED, loadCartridge, newWorld, type Cartridge } from '../src/index.ts';
import { read } from './read.ts';

const source = JSON.parse(bundle().canonical);
const load = (c: any) =>
  loadCartridge(
    new TextEncoder().encode(
      JSON.stringify({
        cartridge: c,
        content_hash: createHash('sha256').update(encode(c)).digest('hex'),
      }),
    ),
    INSTALLED,
  );

// Breaks: a declared audible room/fact/text silently resolves to a missing or wrong definition.
test('D9 cue references and typed suppression declaration fail closed', () => {
  assert.equal(load(source).ok, true);
  for (const change of [
    (c: any) => c.world.bell_cue.rooms.push(ref('room', 'absent')),
    (c: any) => {
      c.world.bell_cue.fact = ref('room', 'belfry');
    },
    (c: any) => {
      c.world.bell_cue.text = 'absent';
    },
    (c: any) => {
      c.reactions[
        Object.keys(c.reactions).find((k) => k.endsWith('/d9_suppress_hounds'))!
      ].apply[0].plan = ref('population', 'absent');
    },
  ]) {
    const c = structuredClone(source);
    change(c);
    assert.equal(load(c).ok, false);
  }
});

// Breaks: a missing generation, deadline, or cause is accepted as resumable saved control.
test('D9 typed control and cue reject missing evidence and malformed deadlines', () => {
  const control = {
    job_id: 'aaaaaaaa-0000-4000-8000-000000000001',
    next_wander_due: 72000,
    suppression: {
      generation: 1,
      ends_at: 237600,
      job_id: 'aaaaaaaa-0000-4000-8000-000000000002',
      cause_event_id: 'aaaaaaaa-0000-4000-8000-000000000003',
    },
  };
  assert.deepEqual(validate('PopulationControl', control), []);
  for (const field of ['generation', 'ends_at', 'job_id', 'cause_event_id']) {
    const changed = structuredClone(control) as any;
    delete changed.suppression[field];
    assert.ok(validate('PopulationControl', changed).length, field);
  }
  const late = structuredClone(control);
  late.suppression.ends_at = -1;
  assert.ok(validate('PopulationControl', late).length);
  const record = {
    command_id: 'aaaaaaaa-0000-4000-8000-000000000001',
    lines: [{ key: 'narration.ring_bell' }],
    cue: {
      source_event_id: 'aaaaaaaa-0000-4000-8000-000000000003',
      command_id: 'aaaaaaaa-0000-4000-8000-000000000001',
      actor_id: 'aaaaaaaa-0000-4000-8000-000000000004',
      observer_id: 'aaaaaaaa-0000-4000-8000-000000000004',
      room_id: 'aaaaaaaa-0000-4000-8000-000000000005',
      logical_time: 64800,
      key: 'narration.bell_cue',
    },
  };
  assert.deepEqual(validate('NarrationRecord', record), []);
  for (const field of Object.keys(record.cue)) {
    const changed = structuredClone(record) as any;
    delete changed.cue[field];
    assert.ok(validate('NarrationRecord', changed).length, field);
  }
});

// Breaks: adding Bram or cue content shifts fresh identities without updating the release pin.
test('independent v036 allocation pins all 191 starting identities', () => {
  const pin = read('protocol/fixtures/missing_child_v036_hash.json');
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
        `population/${origin.by.key}/slot${origin.slot}/${origin.role === 'hound' ? 'member' : 'pelt'}`
      ] = id;
    else actual[`${entity.kind}/${entity.key}`] = id;
  }
  for (const [id, job] of Object.entries(world.state.jobs ?? {}))
    actual[job.job.kind === 'population' ? `population/${job.job.key}/job` : `job/${job.job.key}`] =
      id;
  for (const [slot, id] of Object.entries(world.slots)) actual[`slot/${slot}`] = id;
  assert.deepEqual(actual, read('protocol/fixtures/missing_child_v036_ids.json'));
});
