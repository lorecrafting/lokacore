// Toolbox row W13 (docs/system/mechanics.md Tracks and trails): a trail is two engine facts per
// room, the exit a leaver last left it by and when, per_subject on the room (compiler-added:
// trail_<plan>_exit/_at for a plan with `trail`, trail_exit/_at for characters when some plan
// `hunts`; all instance scope: tracks are world state, so no actor picks a row). Written with
// fact.assign (fact_changed follows, runtime/proposal.ts);
// fresh while now - at < world.trails.fresh_for, derived on read, never ticked.
import { key } from '../foundation/compose.ts';
import type {
  DefinitionRef,
  DeltaOp,
  EntityId,
  Key,
  PopulationPlan,
  TextKey,
} from '../contracts.gen.ts';
import type { World } from '../runtime/decision.ts';
import { npcPassage } from './movement/shared.ts';

const fact = (world: World, name: string): DefinitionRef => ({
  cartridge_id: world.cartridge.manifest.id,
  cartridge_version: world.cartridge.manifest.version,
  kind: 'fact',
  key: name as DefinitionRef['key'],
});

// The plan's trail facts, or the characters' when `plan` is undefined.
const facts = (world: World, plan?: string) =>
  (plan ? [`trail_${plan}_exit`, `trail_${plan}_at`] : ['trail_exit', 'trail_at']).map((n) =>
    fact(world, n),
  );

// The instance-scope MutationTarget of trail fact `f` in `room`, and its value there.
const target = (world: World, f: DefinitionRef, room: EntityId) => ({
  fact: f,
  scope: { kind: 'instance' as const, world_context_id: world.context },
  subject_id: room,
});
const value = (world: World, f: DefinitionRef, room: EntityId) =>
  world.state.facts?.[key({ kind: 'fact', ...target(world, f, room) })] ??
  world.factDefaults[key(f)];

/** The exit the trail of `plan` (or the characters') in `room` leads by while fresh at `now`. */
export function fresh(world: World, room: EntityId, now: number, plan?: string): Key | undefined {
  const trails = world.cartridge.world?.trails;
  const [exit, at] = facts(world, plan).map((f) => value(world, f, room));
  return trails && exit !== 'none' && now - (at as number) < trails.fresh_for
    ? (exit as Key)
    : undefined;
}

/**
 * A hunting plan's member's exit from `here` (taken before its wander): the characters' fresh
 * trail, when npcPassage admits it; false when a character's body is in `here` (the member holds).
 */
export function chase(
  world: World,
  plan: PopulationPlan,
  here: EntityId,
  now: number,
  walker?: EntityId,
) {
  if (!plan.hunts) return undefined;
  const bodies = Object.keys(world.knownEntities).filter(
    (id) => world.knownEntities[id]!.kind === 'body',
  );
  if (bodies.some((b) => world.state.containers[b] === here)) return false;
  const exit = fresh(world, here, now);
  const room = world.rooms[here];
  return exit && !npcPassage(world, room, exit, walker)
    ? ([exit, room.exits[exit as keyof typeof room.exits]!] as const)
    : undefined;
}

/**
 * The fact.assign ops saying `plan`'s member (or a character) left `room` by `exit` at `at`: none
 * unless the plan has `trail` (for a character: unless some plan `hunts`).
 */
export function left(
  world: World,
  room: EntityId,
  exit: string,
  at: number,
  plan?: PopulationPlan,
): DeltaOp[] {
  const populations = Object.values(world.cartridge.populations ?? {});
  if (plan ? !plan.trail : !populations.some((p) => p.hunts)) return [];
  const [e, t] = facts(world, plan?.key);
  return [
    [e, exit],
    [t, at],
  ].map(([f, v]) => ({
    op: 'fact.assign',
    writer_group: 0,
    ...target(world, f as DefinitionRef, room),
    expected: value(world, f as DefinitionRef, room),
    value: v as Key | number,
  }));
}

/** `ops` keeping only the first trail write of each target (one write per room and plan). */
export function once(ops: readonly DeltaOp[]): DeltaOp[] {
  const seen = new Set<string>();
  return ops.filter((o) => {
    if (o.op !== 'fact.assign' || !o.fact.key.startsWith('trail_')) return true;
    const { op: _, writer_group: _g, expected: _e, value: _v, ...target } = o;
    const at = key({ kind: 'fact', ...target });
    return !seen.has(at) && !!seen.add(at);
  });
}

/** A passed track check's line after the outcome's: the lead text of the trail's exit. */
export const trailLead = (world: World, exit?: Key): { key: TextKey }[] =>
  exit ? [{ key: world.cartridge.world!.trails!.leads[exit as 'east']! }] : [];
