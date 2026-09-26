// Pure invariant checks by id, twin of lib/loka/core/invariants.ex (its moduledoc states the
// observation fields). check(id, observation) is true when the invariant holds.
import type { Json } from './canonical.ts';
import { current, key, same, target, type Result } from './compose.ts';
import { EVALUATION_FAULTS, type DeltaOp } from './contracts.gen.ts';

// Observations are decoded JSON; fields are read loosely, as in the Elixir twin.
type Any = any;

const moved = (r: Result): [string, Json][] =>
  ('changes' in r ? r.changes : [])
    .filter((c) => c.target.kind === 'containment')
    .map((c) => [(c.target as Any).entity_id, c.value]);

// Walking up from e's container reaches e, or runs longer than there are rows (a cycle).
function loops(c: Json | undefined, e: string, final: Map<string, Json>): boolean {
  for (let n = final.size; n > 0; n--) {
    if (c === undefined) return false;
    if (c === e) return true;
    c = final.get(c as string);
  }
  return c !== undefined;
}

// Each op reads one value of its target and leaves another (the Elixir twin's link/1).
function link(op: Any): [Json | undefined, Json] {
  const fixed: Record<string, [Json | undefined, Json]> = {
    'quest.activate': [undefined, 'active'],
    'choice.open': [undefined, 'pending'],
    'choice.resolve': ['pending', 'resolved'],
    'choice.close': ['pending', 'closed'],
    'job.schedule': [undefined, 'pending'],
    'job.complete': ['pending', 'completed'],
  };
  if (fixed[op.op]) return fixed[op.op]!;
  if (op.op === 'fact.assign') return [op.expected, op.value];
  if (op.op === 'entity.transfer') return [op.source_id, op.destination_id];
  if (op.op === 'cooldown.start') return [op.from, op.at];
  return [op.from, op.to];
}

function initial(op: Any, s: Any): Json | undefined {
  const [family] = op.op.split('.');
  if (op.op === 'fact.assign') return s.facts?.[key(target(op))] ?? s.fact_defaults?.[key(op.fact)];
  if (op.op === 'entity.transfer') return s.containers?.[op.entity_id];
  if (family === 'quest') return s.quests?.[op.instance_id]?.state;
  if (family === 'choice') return s.choices?.[op.continuation_id]?.status;
  if (family === 'job') return s.jobs?.[op.job_id]?.status;
  if (family === 'cooldown') return s.cooldowns?.[key(target(op))];
  if (family === 'resource') {
    const spec = s.resource_specs?.[key(op.resource)];
    return spec && current(s.resources?.[key(target(op))], spec, s.clock);
  }
  return s.clock;
}

const CHECKS: Record<string, (o: Any) => boolean> = {
  one_container_per_item: ({ state, result }) => {
    const m = moved(result);
    const ids = new Set(m.map(([e]) => e));
    const containers = state.containers ?? {};
    return (
      ids.size === m.length &&
      m.every(([e, c]) => typeof c === 'string' && Object.hasOwn(containers, e))
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
      [...final].every(([e, c]) => !loops(c, e, final)) &&
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
  // Checks only the read -> write value chain per target (a resource's current value, derived),
  // not capacity, revision, cycle, resource or time bounds.
  delta_preconditions_hold: ({ state, delta, result }) => {
    if ('fault' in result) return true;
    const seen = new Map<string, Json | undefined>();
    for (const op of delta.ops) {
      const k = key(target(op));
      const [need, give] = link(op);
      if (!same(seen.has(k) ? seen.get(k) : initial(op, state), need)) return false;
      seen.set(k, give);
    }
    return true;
  },
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
};

/** True when the invariant holds; throws for an unknown id. */
export function check(id: string, observation: { [field: string]: unknown }): boolean {
  const f = CHECKS[id];
  if (!f) throw new Error(`unknown invariant ${id}`);
  return f(observation);
}
