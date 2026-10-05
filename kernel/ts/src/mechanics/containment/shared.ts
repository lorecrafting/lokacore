// Derived carrying admission (docs/system/mechanics.md containment@1). The context lives
// only for this decision/list projection; custody and pinned item definitions remain authoritative.
import { LIMITS, type EntityId } from '../../contracts.gen.ts';
import { add } from '../../foundation/int.ts';
import { opened, reach, barrierState } from '../lookups.ts';
import type { Steps, World } from '../../runtime/decision.ts';

type Failure = 'too_heavy' | 'budget_exceeded' | 'precondition_failed' | 'containment_cycle';
type Context = {
  world: World;
  body: EntityId;
  steps: Steps;
  children?: Map<string, string[]>;
  holders?: Set<string>;
  totals: Map<string, number>;
  owned: Map<string, boolean>;
};
const charge = (c: Context) => ++c.steps.n <= LIMITS.query_steps;

/** One shared predicate for voluntary Take, called after existing target/reach admission. */
export function carrying(world: World, body: EntityId, steps: Steps = { n: 0 }) {
  const setting = world.cartridge.world?.carry;
  if (setting === undefined) return (_item: EntityId): Failure | undefined => undefined;
  const max = setting.max_grams;
  const context: Context = { world, body, steps, totals: new Map(), owned: new Map() };
  return (item: EntityId): Failure | undefined => {
    if (!Number.isSafeInteger(max) || max === undefined || max < 0) return 'precondition_failed';
    const custody = underBody(context, item);
    if (typeof custody === 'string') return custody;
    if (custody) return;
    const added = total(context, item);
    if (typeof added === 'string') return added;
    if (added === 0) return;
    const load = total(context, body);
    if (typeof load === 'string') return load;
    return add(load, added) > max ? 'too_heavy' : undefined;
  };
}

function underBody(c: Context, id: string): boolean | Failure {
  const { world, body, owned } = c;
  const path = new Set<string>();
  let at = id;
  while (at !== body && !Object.hasOwn(world.rooms, at) && !owned.has(at)) {
    if (path.has(at)) return 'containment_cycle';
    if (!charge(c)) return 'budget_exceeded';
    path.add(at);
    const parent = world.state.containers[at];
    if (parent === undefined) return 'precondition_failed';
    at = parent;
  }
  const yes = at === body || owned.get(at) === true;
  for (const child of path) owned.set(child, yes);
  return yes;
}

function index(c: Context): Failure | undefined {
  if (c.children) return;
  const rows = new Map<string, string[]>();
  for (const id in c.world.state.containers) {
    if (!Object.hasOwn(c.world.state.containers, id)) continue;
    if (!charge(c)) return 'budget_exceeded';
    const parent = c.world.state.containers[id];
    const held = rows.get(parent);
    if (held) held.push(id);
    else rows.set(parent, [id]);
  }
  c.children = rows;
}

function slotHolder(c: Context, id: string): boolean | Failure {
  if (!c.holders) {
    const holders = new Set<string>();
    for (const key in c.world.slots) {
      if (!Object.hasOwn(c.world.slots, key)) continue;
      if (!charge(c)) return 'budget_exceeded';
      holders.add(c.world.slots[key]);
    }
    c.holders = holders;
  }
  return c.holders.has(id);
}

function shell(c: Context, id: string): number | Failure {
  const entity = c.world.entities[id];
  if (entity?.kind === 'item') {
    const grams = entity.mass_grams;
    return !Number.isInteger(grams) || grams === undefined || grams < 0 || grams > 2147483647
      ? 'precondition_failed'
      : grams;
  }
  if (entity || id === c.body || Object.hasOwn(c.world.rooms, id)) return 0;
  const holder = slotHolder(c, id);
  return typeof holder === 'string' ? holder : holder ? 0 : 'precondition_failed';
}

function total(c: Context, root: string): number | Failure {
  const { totals } = c;
  if (totals.has(root)) return totals.get(root)!;
  const failed = index(c);
  if (failed) return failed;
  const active = new Set<string>();
  const stack: { id: string; mass?: number }[] = [{ id: root }];
  while (stack.length) {
    const node = stack.pop()!;
    if (totals.has(node.id)) continue;
    if (node.mass !== undefined) {
      let sum = node.mass;
      for (const child of c.children!.get(node.id) ?? []) sum = add(sum, totals.get(child)!);
      totals.set(node.id, sum);
      active.delete(node.id);
      continue;
    }
    if (active.has(node.id)) return 'containment_cycle';
    if (!charge(c)) return 'budget_exceeded';
    const mass = shell(c, node.id);
    if (typeof mass === 'string') return mass;
    active.add(node.id);
    stack.push({ id: node.id, mass });
    for (const child of c.children!.get(node.id) ?? []) stack.push({ id: child });
  }
  return totals.get(root)!;
}

/** Put admission and projection share direct source custody, lid, cycle and capacity checks. */
// size: allow 50, one bounded pair query keeps source, reach, lid, ancestry and capacity admission together
export function putRefused(
  world: World,
  body: EntityId,
  item: EntityId,
  destination: EntityId,
  steps: Steps,
) {
  if (++steps.n > LIMITS.query_steps) return 'budget_exceeded' as const;
  if (!Object.hasOwn(world.entities, item) || !Object.hasOwn(world.entities, destination))
    return 'not_found' as const;
  if (
    world.entities[item].kind !== 'item' ||
    world.entities[destination].kind !== 'item' ||
    world.entities[destination].container !== true ||
    world.state.created?.[item]
  )
    return 'invalid_target' as const;
  if (world.state.containers[item] !== body) return 'not_owned' as const;
  const seen = new Set<string>();
  let at: string = destination;
  while (at !== undefined && !Object.hasOwn(world.rooms, at)) {
    if (++steps.n > LIMITS.query_steps) return 'budget_exceeded' as const;
    if (at === item || seen.has(at)) return 'containment_cycle' as const;
    seen.add(at);
    at = world.state.containers[at];
  }
  const reached = reach(world, body, destination, steps);
  if (typeof reached === 'string') return reached;
  if (!reached) return 'not_present' as const;
  const lid = world.entities[destination].barrier;
  if (lid && barrierState(world, lid) !== 'open')
    return barrierState(world, lid) === 'locked'
      ? ('exit_locked' as const)
      : ('exit_closed' as const);
  if (!opened(world, destination, body)) return 'not_present' as const;
  const capacity = world.capacities[destination];
  if (capacity !== undefined) {
    let count = 0;
    for (const child in world.state.containers) {
      if (!Object.hasOwn(world.state.containers, child)) continue;
      if (++steps.n > LIMITS.query_steps) return 'budget_exceeded' as const;
      if (world.state.containers[child] === destination) count++;
    }
    if (count >= capacity) return 'invalid_state' as const;
  }
}
