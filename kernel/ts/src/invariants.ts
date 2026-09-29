// Pure invariant checks by id, twin of lib/loka/core/invariants.ex (its moduledoc states the
// observation fields). check(id, observation) is true when the invariant holds. The checks
// after STEP read one kernel step and are TypeScript only (rules are TypeScript, ADR-074).
import type { Json } from './canonical.ts';
import { current, key, same, target, type Result } from './compose.ts';
import {
  CAPABILITY_OWNERS,
  EVALUATION_FAULTS,
  type AdvertisedAction,
  type DeltaOp,
  type ExitView,
  type GameView,
} from './contracts.gen.ts';
import { validate } from './validate.ts';

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
  if (family === 'barrier')
    return s.barriers?.[key(target(op))] ?? s.barrier_initial?.[key(op.barrier)];
  if (family === 'resource') {
    const spec = s.resource_specs?.[key(op.resource)];
    return spec && current(s.resources?.[key(target(op))], spec, s.clock);
  }
  return s.clock;
}

const LEGAL: Record<string, string[]> = {
  active: ['objectives_complete', 'failed', 'abandoned'],
  objectives_complete: ['resolved', 'failed', 'abandoned'],
  failed: ['active'],
  abandoned: ['active'],
};
const DOOR: Record<string, string[]> = {
  closed: ['open', 'locked'],
  open: ['closed'],
  locked: ['closed'],
};

function transferValid(op: Any, containers: Map<string, string>, capacities: Any): boolean {
  const path = new Set<string>();
  for (let at = op.destination_id; at !== undefined; at = containers.get(at)) {
    if (at === op.entity_id || path.has(at)) return false;
    path.add(at);
  }
  const cap = capacities?.[op.destination_id];
  if (cap === undefined) return true;
  let held = 0;
  for (const [e, c] of containers) if (e !== op.entity_id && c === op.destination_id) held++;
  return held < cap;
}

function questValid(op: Any, quests: Map<string, Any>): boolean {
  if (op.op === 'quest.activate')
    return ![...quests.values()].some(
      (q) =>
        same(q.quest, op.quest) &&
        same(q.scope, op.scope) &&
        ['active', 'objectives_complete'].includes(q.state),
    );
  return (
    (LEGAL[op.from] ?? []).includes(op.to) &&
    (op.to === 'resolved'
      ? op.outcome !== undefined
      : op.to === 'failed' || op.outcome === undefined)
  );
}

function extra(
  op: Any,
  s: Any,
  horizon: number,
  containers: Map<string, string>,
  quests: Map<string, Any>,
): boolean {
  switch (op.op) {
    case 'entity.transfer':
      return transferValid(op, containers, s.capacities);
    case 'quest.activate':
    case 'quest.transition':
      return questValid(op, quests);
    case 'choice.resolve': {
      const row = s.choices?.[op.continuation_id];
      return (
        Array.isArray(row?.choice_ids) &&
        row.choice_ids.includes(op.choice_id) &&
        row.opened_revision === op.expected_revision
      );
    }
    case 'job.schedule':
      return op.due_time > horizon;
    case 'job.complete':
      return s.jobs?.[op.job_id]?.due_time <= horizon;
    case 'time.advance':
      return op.to > op.from;
    case 'resource.adjust': {
      const spec = s.resource_specs?.[key(op.resource)];
      return spec !== undefined && op.to >= spec.minimum && op.to <= spec.maximum;
    }
    case 'cooldown.start':
      return op.at === s.clock;
    case 'barrier.transition':
      return Object.hasOwn(DOOR, op.from) && DOOR[op.from]!.includes(op.to);
    default:
      return true;
  }
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
  // Replay the contract preconditions on independent overlays; never use compose's result to
  // compute the expected answer. A fault vacuously holds this success-only invariant.
  delta_preconditions_hold: ({ state, delta, result }) => {
    if ('fault' in result) return true;
    if (!Number.isInteger(state.clock)) return false;
    const seen = new Map<string, Json | undefined>();
    const containers = new Map<string, string>(Object.entries(state.containers ?? {}));
    const quests = new Map<string, Any>(Object.entries(state.quests ?? {}));
    let horizon = state.clock;
    for (const op of delta.ops) if (op.op === 'time.advance') horizon = op.to;
    for (const op of delta.ops) {
      const k = key(target(op));
      const [need, give] = link(op);
      if (
        !same(seen.has(k) ? seen.get(k) : initial(op, state), need) ||
        !extra(op, state, horizon, containers, quests)
      )
        return false;
      seen.set(k, give);
      if (op.op === 'entity.transfer') containers.set(op.entity_id, op.destination_id);
      if (op.op === 'quest.activate')
        quests.set(op.instance_id, { quest: op.quest, scope: op.scope, state: 'active' });
      if (op.op === 'quest.transition')
        quests.set(op.instance_id, { ...quests.get(op.instance_id), state: op.to });
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
  // STEP: `before` and `after` are the State around step(command) = decision; `view` is the
  // actor's GameView of the world before it.
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
  // The view's entry for the command (its exit for a move, else its action) and admission agree
  // (04 §15, §19): available is never refused with a code the view shows for that entry;
  // unavailable is never accepted, and a refusal with such a code is the view's code.
  gameview_agrees_with_admission: ({ view, command, decision }) => {
    const entry = advertised(view, command.payload);
    const code = decision.kind === 'rejected' ? decision.error.code : undefined;
    const type = command.payload.type; // own keys only: an action may be keyed `constructor`
    const shown = Object.hasOwn(SHOWN, type) ? SHOWN[type]! : [];
    if (!entry) return true;
    if (entry.available) return !shown.includes(code);
    return decision.kind !== 'accepted' && (!shown.includes(code) || code === entry.reason.code);
  },
};

// The codes the view can show on an entry: an exit's passage and fare; a recipe's policy and
// admission. ponytail: an engine verb's policy is always true, so it shows none; a cartridge
// action with a policy on an engine command joins when a cartridge authors one.
const SHOWN: Readonly<Record<string, readonly string[]>> = {
  move: ['exit_closed', 'exit_locked', 'insufficient_resource'],
  perform: ['invalid_state', 'cooldown', 'insufficient_resource'],
};

function advertised(view: GameView, p: Any): ExitView | AdvertisedAction | undefined {
  if (p.type === 'move') return view.exits.find((e) => e.direction === p.direction);
  const id = p.type === 'perform' ? undefined : (p.item_id ?? p.target_id);
  if (id === undefined) {
    const key = p.type === 'perform' ? p.action : p.type;
    return view.actions.find((a) => a.action_key === key);
  }
  const held = [...view.entities, ...view.inventory].find((e) => e.id === id);
  return held?.actions.find((a) => a.action_key === p.type);
}

/** True when the invariant holds; throws for an unknown id. */
export function check(id: string, observation: { [field: string]: unknown }): boolean {
  const f = CHECKS[id];
  if (!f) throw new Error(`unknown invariant ${id}`);
  return f(observation);
}
