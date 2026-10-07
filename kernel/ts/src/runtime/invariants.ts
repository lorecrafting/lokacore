import { liquidRowsValid } from './invariants_liquid.ts';
import { patrolsHold } from './invariants_patrol.ts';
// Pure checks by id, twin of lib/loka/core/invariants.ex; step checks are TypeScript only.
import { creationsHold } from './invariants_creation.ts';
import { deltaPreconditions } from './invariants_delta.ts';
import type { Json } from '../foundation/canonical.ts';
import { key, same, target, type Result } from '../foundation/compose.ts';
import { CAPABILITY_OWNERS, EVALUATION_FAULTS, type DeltaOp } from '../contracts.gen.ts';
import { gameview_agrees_with_admission } from '../view/invariants_view.ts';
import { validate } from '../foundation/validate.ts';
// Observations are decoded JSON; fields are read loosely, as in the Elixir twin.
type Any = any;
const moved = (r: Result): [string, Json][] =>
  ('changes' in r ? r.changes : [])
    .filter((c) => c.target.kind === 'containment')
    .map((c) => [(c.target as Any).entity_id, c.value]);

// Each ancestor path is marked once, so a long acyclic chain stays linear.
function acyclic(final: Map<string, Json>): boolean {
  const done = new Set<string>();
  for (const root of final.keys()) {
    const path = new Set<string>();
    let at: Json | undefined = root;
    while (typeof at === 'string' && final.has(at) && !done.has(at)) {
      if (path.has(at)) return false;
      path.add(at);
      at = final.get(at);
    }
    for (const e of path) done.add(e);
  }
  return true;
}
// Each op reads one value of its target and leaves another (the Elixir twin's link/1).
const CHECKS: Record<string, (o: Any) => boolean> = {
  patrol_transitions_hold: ({ state, delta, result }) =>
    'fault' in result || patrolsHold(state, delta.ops, result),
  liquid_rows_valid: ({ state, result }) => liquidRowsValid(state, result),
  one_container_per_item: ({ state, delta, result }) => {
    if ('fault' in result) return true;
    const created = new Set(
      (delta?.ops ?? [])
        .filter((o: Any) => o.op === 'entity.create')
        .map((o: Any) => o.identity.id),
    );
    if (!creationsHold(state, delta?.ops ?? [], result)) return false;
    const m = moved(result);
    const ids = new Set(m.map(([e]) => e));
    const containers = state.containers ?? {};
    return (
      ids.size === m.length &&
      m.every(([e, c]) => typeof c === 'string' && (Object.hasOwn(containers, e) || created.has(e)))
    );
  },
  containment_acyclic: ({ state, result }) => {
    const final = new Map<string, Json>([
      ...Object.entries<Json>(state.containers ?? {}),
      ...moved(result),
    ]);
    const counts = new Map<Json, number>();
    for (const c of final.values()) counts.set(c, (counts.get(c) ?? 0) + 1);
    return (
      acyclic(final) &&
      Object.entries<number>(state.capacities ?? {}).every(
        ([c, cap]) => (counts.get(c) ?? 0) <= cap,
      )
    );
  },
  no_last_writer_wins: ({ delta, result }) => {
    const groups = new Map<string, Set<number>>();
    for (const op of delta.ops as DeltaOp[]) {
      const k = key(target(op));
      groups.set(k, (groups.get(k) ?? new Set()).add(op.writer_group));
    }
    return 'fault' in result || [...groups.values()].every((g) => g.size === 1);
  },
  delta_preconditions_hold: ({ state, delta, result }) =>
    deltaPreconditions(state, delta.ops, result),
  fault_discards_whole_proposal: ({ result }) =>
    Object.keys(result).length === 1 &&
    (!('fault' in result) ||
      Object.keys(result.fault).every((k) => ['kind', 'code', 'target'].includes(k))),
  fault_codes_are_evaluation_faults: ({ result }) =>
    !('fault' in result) || EVALUATION_FAULTS.includes(result.fault.code),
  // EntityIds are ASCII by pattern, so string < is code-point order.
  target_candidates_ordered: ({ resolution }) =>
    resolution.kind !== 'ambiguous' ||
    resolution.candidate_ids.every(
      (id: string, i: number, ids: string[]) => i === 0 || ids[i - 1]! < id,
    ),
  no_proposed_event_escapes: ({ decision, commit, published }) => {
    const ok = decision.kind === 'accepted' && commit.status === 'committed';
    const allowed = ok
      ? decision.events.map((event: Json) => ({ committed_revision: commit.revision, event }))
      : [];
    return published.every((p: Json) => allowed.some((a: Json) => same(a, p)));
  },
  // STEP: `before` and `after` are the State around step(command) = decision; `view` is the
  // actor's GameView of the world before it.
  // Only a run_job completes a job, its own (delta.schema.json job.complete): the host's drain
  // gives each run_job its own writer group, never the command's own (0), so a job.complete is
  // the only one of its group, outside group 0, and its job was due by the advance's target.
  job_complete_owned_by_run: ({ decision, before }) => {
    if (decision.kind !== 'accepted') return true;
    const ops: Any[] = decision.delta.ops;
    const to = ops.find((o) => o.op === 'time.advance')?.to;
    const done = ops.filter((o) => o.op === 'job.complete');
    return done.every(
      (o) =>
        o.writer_group > 0 &&
        done.filter((d) => d.writer_group === o.writer_group).length === 1 &&
        before.jobs?.[o.job_id]?.due_time <= to,
    );
  },
  // A rejection or fault leaves the State (clock, containers, RNG, facts, resources, cooldowns,
  // barriers) byte for byte as it was (04 §5.0; §5.2 for a fault).
  rejection_consumes_nothing: ({ decision, before, after }) =>
    decision.kind === 'accepted' || same(before, after),
  // An unregistered command type is never accepted, and an accepted decision is valid against
  // its closed contract, so it names only registered delta ops, events and effects. Policy
  // operators are closed at the cartridge loader (lockStage).
  unknown_types_fail_closed: ({ command, decision }) =>
    decision.kind !== 'accepted' ||
    (Object.hasOwn(CAPABILITY_OWNERS.command, command.payload.type) &&
      validate('DecisionResult', decision).length === 0),
  gameview_agrees_with_admission, // invariants_view.ts
};

/** True when the invariant holds; throws for an unknown id. */
export function check(id: string, observation: { [field: string]: unknown }): boolean {
  const f = CHECKS[id];
  if (!f) throw new Error(`unknown invariant ${id}`);
  return f(observation);
}
