import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stepElapsed, type World } from '../src/index.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { key } from '../src/foundation/compose.ts';
import { ids, run, fixture } from './c4_pack_fixture.ts';

const HOUR = 3600;
const PLAN = Object.keys(fixture().state.population_plans!)[0]!;

function elapse(w: World, until: number, revision: number) {
  const from = w.state.clock;
  const id = elapsedCommandId(run, w.context, from, until) as never;
  const payload = { type: 'elapsed', actor_id: w.character, run_id: run, from, until } as const;
  const r = stepElapsed(w, { id, world_context_id: w.context, payload }, revision);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return { world: r.world, events: r.decision.kind === 'accepted' ? r.decision.events : [] };
}

// Ids minted under job CommandIds differ between the two plays (loka-qi0r ruling), so ids map to
// the authored key, or a spawned entity's slot, generation and role.
function project(w: World, events: readonly { logical_time: number; payload: object }[]) {
  const authored = Object.fromEntries(Object.entries(ids).map(([k, v]) => [v, k]));
  const name = (v: unknown) => {
    const o = w.state.created?.[v as string]?.origin;
    return (
      authored[v as string] ??
      (o?.kind === 'spawned' ? `slot${o.slot}/g${o.generation}/${o.member_id === v}` : v)
    );
  };
  const control = w.state.population_plans![PLAN]!;
  return {
    clock: w.state.clock,
    rooms: Object.fromEntries(
      Object.entries(w.state.containers).map(([e, r]) => [String(name(e)), name(r)]),
    ),
    slots: Object.entries(w.state.population_slots!).map(([, s]) => ({
      ...s,
      member_id: name(s.member_id),
    })),
    next_wander_due: control.next_wander_due,
    plan_job_due: w.state.jobs![control.job_id]!.due_time,
    pending: Object.values(w.state.jobs!)
      .flatMap((j) => (j.status === 'pending' ? [`${j.job.key}@${j.due_time}`] : []))
      .sort(),
    events: events.map((e) => [
      e.logical_time,
      Object.fromEntries(
        Object.entries(e.payload).map(([k, v]) => [k, k === 'type' ? v : name(v)]),
      ),
    ]),
  };
}

function hourly(w: World, hours: number) {
  const events = [];
  for (let i = 1; i <= hours; i++) {
    const r = elapse(w, w.state.clock + HOUR, i);
    events.push(...r.events);
    w = r.world;
  }
  return project(w, events);
}

// Breaks (loka-6ql4): a plan successor inside the advance (the advance faults nonfuture_job), a
// crossed hour that births, wanders or retargets at the row's own time instead of that hour, plan
// control written by a crossed step, or a wander boundary skipped while control is unwritten.
test('one elapsed advance over 25 hours or 3 days plays the pack as hour-by-hour play', () => {
  const w = fixture();
  const runs = [25, 72].map((hours) => {
    const one = elapse(w, w.state.clock + hours * HOUR, 1);
    const p = project(one.world, one.events);
    assert.deepEqual(p, hourly(w, hours), `${hours} hours`);
    return p;
  });
  // Hand-checked: from 18:00, 25 hours ends at 19:00 after 25 hourly wanders (H1 home → nest);
  // wander and night boundary (20:00) coincide at 158400.
  const day = runs[0]!;
  assert.equal(day.rooms['population/fen_hounds/slot1/member'], 'room/adder_nest');
  assert.equal(day.next_wander_due, 158400);
  assert.equal(day.plan_job_due, 158400);
});

// Breaks (loka-6ql4): a crossed sub-step off the wander grid taking its own hour as the wander
// boundary. With a 3-hour interval the 20:00 night boundary (158400) is off the grid: hour-by-hour
// play wanders next at 162000, not at 158400.
test('a crossed night boundary off a 3-hour wander grid keeps the grid', () => {
  const w = fixture(undefined, 3 * HOUR);
  const one = elapse(w, w.state.clock + 27 * HOUR, 1);
  const p = project(one.world, one.events);
  assert.deepEqual(p, hourly(w, 27));
  assert.equal(p.next_wander_due, 172800);
});
