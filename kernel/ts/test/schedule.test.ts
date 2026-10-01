// schedule@1, behavior@1 and calendar@1 (Early R7/R8 S; 04 §5.4; 06 §13; 21 §4, §10): the
// fresh world's first job, the due-job drain in wait and in a recipe's duration, run_job and its
// job CommandId, and the loader's schedule and calendar checks. Worlds are the ferry known answer
// (protocol/fixtures/cartridge_ferry_hash.json: the world starts at 06:00 with Bram at the ferry
// landing, his daily schedule landing from hour 6 and village green from hour 19, a one-hour
// coil_rope recipe at the landing), variants re-hashed with node:crypto over their canonical
// bytes. Ids are IdSource and job CommandIds over the literal inputs, computed with
// Python hashlib (numeric profile); times are hand-derived from the fixed calendar units
// (command.schema.json LogicalTime: 3600 a hour, 86400 a day), and pre-release-proof.md's Bram
// (landing 06:00-19:00, green otherwise).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import type { Command, DefinitionRef } from '../src/contracts.gen.ts';
import { loadCartridge, type Cartridge, type World } from '../src/index.ts';
import { decode, encode } from '../src/canonical.ts';
import { newWorld, step } from '../src/world.ts';
import { read } from './read.ts';

const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const CMD = 'e5f6a7b8-c9d0-8e1f-8a2b-4c5d6e7f8a9b';
const F = 'ashmere_ferry@0.0.1';
const ref = (kind: string, key: string) =>
  ({ cartridge_id: 'ashmere_ferry', cartridge_version: '0.0.1', kind, key }) as DefinitionRef;
const BRAM = ref('npc', 'bram');
// Fresh-world ids under the nil CommandId: ordinal 2 the landing, 3 the green, 4 the mooring
// post, 5 Bram, 6 his first job.
const LANDING = '1a7c3699-2844-8a55-b29f-eac079c7bf50';
const GREEN = '91fde0fc-dd14-846f-826e-245e45d16ec7';
const BRAM_ID = 'ff864ad5-cd56-80c8-9392-dc88bdc28fd2';
const J0 = '6a70d262-b6ea-8b64-9809-ec7f79d1521e';
// J1: ordinal 0 under J0's run_job at 19:00, whose CommandId is
// ["loka-job-command-v1", J0, 68400] (63bed74b-a081-88a7-9adc-a76f5846057f).
const J1 = '5786a91b-185a-8097-aff4-19944692e75c';
const RUN_J0 = '63bed74b-a081-88a7-9adc-a76f5846057f';
// Ordinal 1 under that run_job: Bram's entity_entered_room.
const ARRIVED = 'de2dcdb6-b269-8159-b084-258a27e0ec96';
const H = (h: number) => h * 3600;

const load = (f: (c: any) => void) => {
  const c = structuredClone(read('protocol/fixtures/cartridge_ferry_hash.json').value);
  f(c);
  // Canonical bytes (JSON.stringify would put the schedule's integer-like keys first).
  const text = encode(c);
  const h = createHash('sha256').update(text).digest('hex');
  return loadCartridge(new TextEncoder().encode(`{"cartridge":${text},"content_hash":"${h}"}`), {
    kernel_api: '1.0',
    capabilities: Object.fromEntries(Object.keys(c.lock.capabilities).map((k) => [k, [1]])),
    content_schema: 1,
    rule_ir: 1,
    client_features: [],
  });
};
const world = (f: (c: any) => void = () => {}): World => {
  const loaded = load(f);
  assert.ok(loaded.ok, JSON.stringify(loaded));
  return newWorld(loaded.cartridge as Cartridge, CONTEXT as World['context'], [1, 2, 3, 4]);
};
const cmd = (w: World, payload: object, id = CMD): Command =>
  ({ id, world_context_id: CONTEXT, payload: { actor_id: w.character, ...payload } }) as Command;
const wait = (w: World, until: number) => step(w, cmd(w, { type: 'wait', until }));
const job = (due_time: number, status: 'pending' | 'completed' = 'pending') => ({
  job: BRAM,
  due_time,
  status,
});

// Ada, a second scheduled NPC sorting before Bram, so her job takes ordinal 7 and Bram's 8.
const ADA_JOB = '0f5f2329-bcff-82f4-948a-3d22a75fb068';
const BRAM_JOB = 'd530207e-b845-8be5-9d53-b44b2cf5d8a1';
const withAda = (schedule: object) =>
  world((c) => {
    const bram = c.npcs[`${F}:npc/bram`];
    c.npcs[`${F}:npc/ada`] = { ...bram, key: 'ada', keywords: ['ada'], daily_schedule: schedule };
  });
const landing = ref('room', 'ferry_landing');
const green = ref('room', 'village_green');

// Breaks: the calendar start ignored (the world at midnight), the first job missing, minted
// under another ordinal, or due at a transition not strictly after the start.
test('a fresh world starts at 06:00 with Bram at the landing and his job due at 19:00', () => {
  const w = world();
  assert.equal(w.state.clock, H(6));
  assert.equal(w.state.containers[BRAM_ID], LANDING);
  assert.deepEqual(w.state.jobs, { [J0]: job(H(19)) });
  // A start on a listed hour schedules the next one (strictly later; 04 §5.4): 19:00 to 06:00.
  const late = world((c) => (c.calendar.start = H(19)));
  assert.deepEqual(late.state.jobs, { [J0]: job(H(24 + 6)) });
});

// Breaks: the drain skipped, a job run under the client CommandId tag or the wait's own, the
// next occurrence computed from the wait's target instead of the job's due time, the job's ops
// left in the root's writer group, Bram moved before his hour, or his arrival not reported (a
// reaction on entity_entered_room would never see him), reported at the wait's time instead of
// his, or not correlated to the wait.
test('wait to 19:00 moves Bram to the green through his job; 18:59 does not', () => {
  const w = world();
  const early = wait(w, H(19) - 60);
  assert.equal(early.decision.kind, 'accepted');
  assert.equal(early.world.state.containers[BRAM_ID], LANDING);
  assert.deepEqual(early.world.state.jobs, { [J0]: job(H(19)) });

  const { decision, world: after } = wait(w, H(19) + 1800);
  assert.equal(decision.kind, 'accepted');
  assert.deepEqual(decision.kind === 'accepted' && decision.delta.ops, [
    { op: 'time.advance', writer_group: 0, from: H(6), to: H(19) + 1800 },
    {
      op: 'entity.transfer',
      writer_group: 1,
      entity_id: BRAM_ID,
      source_id: LANDING,
      destination_id: GREEN,
    },
    { op: 'job.complete', writer_group: 1, job_id: J0 },
    { op: 'job.schedule', writer_group: 1, job_id: J1, job: BRAM, due_time: H(24 + 6) },
  ]);
  assert.deepEqual(decision.kind === 'accepted' && decision.events, [
    {
      id: ARRIVED,
      world_context_id: CONTEXT,
      scope: { kind: 'instance', world_context_id: CONTEXT },
      logical_time: H(19),
      position: 1,
      causation_id: RUN_J0,
      correlation_id: CMD,
      payload: { type: 'entity_entered_room', entity_id: BRAM_ID, room_id: GREEN },
    },
  ]);
  assert.equal(after.state.clock, H(19) + 1800);
  assert.equal(after.state.containers[BRAM_ID], GREEN);
  assert.deepEqual(after.state.jobs, { [J0]: job(H(19), 'completed'), [J1]: job(H(30)) });
});

// Breaks: `<=` for `<` in the strictly-later-than-target rule (04 §5.4), or a fault that
// commits part of the advance.
test('a job its own advance would schedule at or before the target faults the whole wait', () => {
  const w = world();
  // From 06:00 to 06:00 next day: Bram's 19:00 job schedules 06:00 next day, the target itself.
  const out = wait(w, H(30));
  assert.deepEqual(out.decision, {
    kind: 'fault',
    code: 'nonfuture_job',
    target: { kind: 'job', job_id: J1 },
  });
  assert.equal(out.world, w);
  assert.equal(wait(w, H(30) - 1).decision.kind, 'accepted');
});

// Breaks: the drain sorted by job id only (due time ignored) or in row order.
test('due jobs run in due-time order across one advance', () => {
  const w = withAda({ '6': landing, '20': green });
  assert.deepEqual(w.state.jobs, {
    [ADA_JOB]: { job: ref('npc', 'ada'), due_time: H(20), status: 'pending' },
    [BRAM_JOB]: job(H(19)),
  });
  const { decision } = wait(w, H(20));
  const ops = decision.kind === 'accepted' ? decision.delta.ops : [];
  assert.deepEqual(
    ops.filter((o) => o.op === 'job.complete').map((o) => [o.writer_group, o.job_id]),
    [
      [1, BRAM_JOB],
      [2, ADA_JOB],
    ],
  );
});

// Breaks: equal due times ordered by row order instead of job id (code-point order), which a
// store or a canonical reload may change (slice Q's blocker), so writer groups would move.
test('jobs due at one time run in job-id order whatever the row order', () => {
  const w = withAda({ '6': landing, '19': green });
  const reversed = Object.fromEntries(Object.entries(w.state.jobs!).reverse());
  const reloaded = decode(encode(w.state as never)) as unknown as World['state'];
  for (const state of [{ ...w.state, jobs: reversed }, reloaded]) {
    const { decision } = wait({ ...w, state }, H(19));
    const ops = decision.kind === 'accepted' ? decision.delta.ops : [];
    assert.deepEqual(
      ops.filter((o) => o.op === 'job.complete').map((o) => [o.writer_group, o.job_id]),
      [
        [1, ADA_JOB],
        [2, BRAM_JOB],
      ],
    );
  }
});

// Breaks: run_job admitted from outside the drain (a client could run or replay a job; 04 §1).
test('a run_job submitted to step is refused and changes nothing', () => {
  const w = world();
  const run = { id: CMD, world_context_id: CONTEXT, payload: { type: 'run_job', job_id: J0 } };
  const out = step(w, run as Command);
  assert.deepEqual(out.decision, { kind: 'rejected', error: { code: 'not_found' } });
  assert.equal(out.world, w);
});

// Breaks: a recipe's duration skipping a due job (04 §5.4: an action's time cost is an explicit
// advance), the job's ops sharing the recipe's writer group.
test("a recipe's duration runs the job due inside it in the player's proposal", () => {
  const w = wait(world(), H(18) + 1800).world;
  const { decision, world: after } = step(w, cmd(w, { type: 'perform', action: 'coil_rope' }));
  assert.equal(decision.kind, 'accepted');
  const ops = decision.kind === 'accepted' ? decision.delta.ops : [];
  assert.deepEqual(
    ops.map((o) => [o.op, o.writer_group]),
    [
      ['time.advance', 0],
      ['entity.transfer', 1],
      ['job.complete', 1],
      ['job.schedule', 1],
    ],
  );
  // The recipe's own events first (custom_event, action_completed), then Bram's arrival.
  assert.deepEqual(
    decision.kind === 'accepted' && decision.events.map((e) => [e.position, e.payload.type]),
    [
      [1, 'custom_event'],
      [2, 'action_completed'],
      [3, 'entity_entered_room'],
    ],
  );
  assert.equal(after.state.clock, H(19) + 1800);
  assert.equal(after.state.containers[BRAM_ID], GREEN);
});

// Breaks (resource.schema.json ResourceSpec start, a new body's value): a body that regenerates
// from time 0 to the calendar's start, so a 06:00 world starting with mv 0 can still move.
test('a body starts with its resources at their start values at the calendar start', () => {
  const w = world((c) => (c.resources[`${F}:resource/mv`].start = 0));
  const out = step(w, cmd(w, { type: 'move', direction: 'north' }));
  assert.deepEqual(out.decision, { kind: 'rejected', error: { code: 'insufficient_resource' } });
});

// Breaks: an advance over the job budgets committing part of itself (time or jobs) instead of
// faulting whole (04 §5.4): 65 due jobs each schedule one, over created_jobs (64).
test('an advance over a job budget faults whole, in a wait and in a recipe', () => {
  const w = world();
  const many = Object.fromEntries(
    Array.from({ length: 65 }, (_, i) => [
      `00000000-0000-8000-8000-${String(i).padStart(12, '0')}`,
      job(H(19)),
    ]),
  );
  const crowded = { ...w, state: { ...w.state, jobs: many } };
  const budget = { kind: 'fault', code: 'budget_exceeded' };
  const waited = wait(crowded, H(20));
  assert.deepEqual(waited.decision, budget);
  assert.equal(waited.world, crowded);
  const late = { ...crowded, state: { ...crowded.state, clock: H(18) + 1800 } };
  const performed = step(late, cmd(late, { type: 'perform', action: 'coil_rope' }));
  assert.deepEqual(performed.decision, budget);
  assert.equal(performed.world, late);
});

const fails = (
  f: (c: any) => void,
  code: string,
  path: string,
  data = {},
  suggested: string[] = [],
) =>
  assert.deepEqual(load(f), {
    ok: false,
    diagnostic: {
      severity: 'error',
      code,
      path,
      message_key: `diagnostics.${code.toLowerCase()}`,
      data,
      suggested_capabilities: suggested,
    },
  });
const unlock = (c: any, cap: string) => {
  delete c.manifest.requires.capabilities[cap];
  delete c.lock.capabilities[cap];
};

// Breaks: the loader admitting what the compiler rejects (test/loka/content_ferry_test.exs): a
// schedule naming a room the cartridge lacks (run_job would move Bram nowhere), a schedule or
// calendar whose owner (behavior@1, calendar@1) is not locked, or a schedule without schedule@1
// (the drain would run its jobs under a capability the cartridge never declared), a calendar
// start past day 1 (its first job's due time could leave the safe integers and the first save
// throw), or an action built on run_job (authority-internal, 04 §1: a dead action).
test('the loader checks schedule rooms and the schedule and calendar owners', () => {
  const bram = `.cartridge.npcs["${F}:npc/bram"]`;
  fails(
    (c) => (c.npcs[`${F}:npc/bram`].daily_schedule['19'] = ref('room', 'shed')),
    'UNRESOLVED_REFERENCE',
    `${bram}.daily_schedule.19`,
    { target: `${F}:room/shed` },
  );
  fails(
    (c) => unlock(c, 'behavior'),
    'UNDECLARED_CAPABILITY',
    `${bram}.daily_schedule`,
    { capability: 'behavior' },
    ['behavior@1'],
  );
  fails(
    (c) => unlock(c, 'schedule'),
    'UNDECLARED_CAPABILITY',
    `${bram}.daily_schedule`,
    { capability: 'schedule' },
    ['schedule@1'],
  );
  fails((c) => (c.calendar.start = 86400), 'SCHEMA_VIOLATION', '.cartridge.calendar.start', {
    error: 'above_maximum',
  });
  fails(
    (c) =>
      (c.actions[`${F}:action/hurry`] = {
        key: 'hurry',
        label: 'actions.coil_rope',
        accessibility: 'actions.coil_rope',
        target: { kind: 'none' },
        command: 'run_job',
        priority: 0,
        input: [],
        policy: { policy_version: 1, root: { op: 'all', items: [] } },
      }),
    'UNKNOWN_COMMAND',
    `.cartridge.actions["${F}:action/hurry"].command`,
  );
  fails(
    (c) => unlock(c, 'calendar'),
    'UNDECLARED_CAPABILITY',
    '.cartridge.calendar',
    { capability: 'calendar' },
    ['calendar@1'],
  );
});
