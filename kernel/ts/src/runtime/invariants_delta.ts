import { knowledgeHolds } from './invariants_knowledge.ts';
import { foodTransferValid } from './invariants_food.ts';
import { fuelValid } from './invariants_fuel.ts';
import { resourceAfter } from './invariants_resource.ts';
import { gate } from './invariants_gate.ts';
import type { Json } from '../foundation/canonical.ts';
import { key, same, target } from '../foundation/compose.ts';
import { validate } from '../foundation/validate.ts';
import type { DeltaOp } from '../contracts.gen.ts';
type Any = any;
function link(op: Any): [Json | undefined, Json] {
  const fixed: Record<string, [Json | undefined, Json]> = {
    'quest.activate': [undefined, 'active'],
    'quest.retire': ['resolved', null],
    'choice.open': [undefined, 'pending'],
    'choice.resolve': ['pending', 'resolved'],
    'choice.close': ['pending', 'closed'],
    'choice.attempt': ['pending', 'pending'],
  };
  if (fixed[op.op]) return fixed[op.op]!;
  if (op.op === 'character.select') return [undefined, op.value];
  if (op.op === 'fact.assign') return [op.expected, op.value];
  if (op.op === 'bleed.transition' || op.op === 'status.transition') return [op.expected, op.value];
  if (op.op === 'expedition.transition') return [op.expected, op.value];
  if (op.op === 'entity.create') return [undefined, op.identity];
  if (op.op === 'entity.transfer') return [op.source_id, op.destination_id];
  if (op.op === 'cooldown.start') return [op.from, op.at];
  return [op.from, op.to];
}

function initial(op: Any, s: Any): Json | undefined {
  const [family] = op.op.split('.');
  if (op.op === 'character.select') return s.characters?.[op.character_id];
  if (op.op === 'fact.assign') return s.facts?.[key(target(op))] ?? s.fact_defaults?.[key(op.fact)];
  if (op.op === 'fuel.set') return s.fuel?.[op.item_id];
  if (op.op === 'entity.create') return s.created?.[op.identity.id];
  if (op.op === 'entity.transfer') return s.containers?.[op.entity_id];
  if (family === 'quest') return s.quests?.[op.instance_id]?.state;
  if (family === 'choice') return s.choices?.[op.continuation_id]?.status;
  if (family === 'bleed') return s.bleeds?.[op.body_id] ?? null;
  if (family === 'status') return s.statuses?.[key(target(op))] ?? null;
  if (family === 'expedition') return s.expeditions?.[op.quest_instance_id] ?? null;
  if (family === 'cooldown') return s.cooldowns?.[key(target(op))];
  if (family === 'barrier')
    return s.barriers?.[key(target(op))] ?? s.barrier_initial?.[key(op.barrier)];
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
  if (op.op === 'quest.retire') {
    const q = quests.get(op.instance_id);
    return q?.state === 'resolved' && same(q.quest, op.quest) && same(q.scope, op.scope);
  }
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

function offeredChoice(op: Any, s: Any): boolean {
  const row = s.choices?.[op.continuation_id];
  return (
    Array.isArray(row?.choice_ids) &&
    row.choice_ids.includes(op.choice_id) &&
    row.opened_revision === op.expected_revision
  );
}

function extra(
  op: Any,
  s: Any,
  containers: Map<string, string>,
  quests: Map<string, Any>,
): boolean {
  switch (op.op) {
    case 'fuel.set':
      return fuelValid(op, s);
    case 'entity.transfer':
      return foodTransferValid(op, s) && transferValid(op, containers, s.capacities);
    case 'quest.retire':
    case 'quest.activate':
    case 'quest.transition':
      return questValid(op, quests);
    case 'choice.resolve':
      return offeredChoice(op, s);
    case 'time.advance':
      return op.to > op.from;
    case 'cooldown.start':
      return op.at === s.clock;
    case 'barrier.transition':
      return Object.hasOwn(DOOR, op.from) && DOOR[op.from]!.includes(op.to);
    default:
      return true;
  }
}

export function deltaPreconditions(state: Any, ops: DeltaOp[], result: Any) {
  if ('fault' in result) return true;
  if (!gate(state, ops, result) || !knowledgeHolds(state, ops, result)) return false;
  const seen = new Map<string, Json | undefined>();
  const containers = new Map<string, string>(Object.entries(state.containers ?? {}));
  const quests = new Map<string, Any>(Object.entries(state.quests ?? {}));
  const resources = new Map<string, Json>();
  let horizon = state.clock;
  for (const op of ops) if (op.op === 'time.advance') horizon = op.to;
  for (const op of ops) {
    if (separatelyChecked(op)) continue;
    const k = key(target(op));
    const [need, give] = link(op);
    if (op.op === 'resource.adjust') {
      const before = resources.has(k) ? resources.get(k) : state.resources?.[k];
      const after = resourceAfter(op, state, before, horizon);
      if (!after) return false;
      resources.set(k, after);
      continue;
    }
    if (
      !same(seen.has(k) ? seen.get(k) : initial(op, state), need) ||
      !extra(op, state, containers, quests)
    )
      return false;
    seen.set(k, give);
    if (op.op === 'fuel.set') resources.set(k, give);
    if (op.op === 'entity.transfer') containers.set(op.entity_id, op.destination_id);
    if (op.op === 'quest.activate')
      quests.set(op.instance_id, { quest: op.quest, scope: op.scope, state: 'active' });
    if (op.op === 'quest.retire') quests.delete(op.instance_id);
    if (op.op === 'quest.transition')
      quests.set(op.instance_id, { ...quests.get(op.instance_id), state: op.to });
  }
  return [...resources].every(([k, expected]) =>
    result.changes.some((r: Any) => key(r.target) === k && same(r.value, expected)),
  );
}

function separatelyChecked(op: DeltaOp) {
  return (
    [
      'visit.record',
      'observation.record',
      'escort.transition',
      'patrol.transition',
      'crow.transition',
      'liquid.set',
      'resource.initialize',
    ].includes(op.op) ||
    op.op.startsWith('population.') ||
    ['water.', 'encounter.', 'job.'].some((p) => op.op.startsWith(p))
  );
}
