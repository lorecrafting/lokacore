// Toolbox row W13 (docs/system/mechanics.md Tracks and trails): a trail is two engine facts per
// room, the exit a leaver last left it by and when, per_subject on the room (compiler-added:
// trail_<plan>_exit/_at at instance scope for a plan with `trail`, trail_exit/_at at player scope
// when some plan `hunts`). Written with fact.assign (fact_changed follows, runtime/proposal.ts);
// fresh while now - at < world.trails.fresh_for, derived on read, never ticked.
import { key } from '../foundation/compose.ts';
import type {
  CharacterId,
  DefinitionRef,
  DeltaOp,
  EntityId,
  Key,
  PopulationPlan,
  TextKey,
} from '../contracts.gen.ts';
import type { World } from '../runtime/decision.ts';
import { targetOf, value } from './fact.ts';
import { npcPassage } from './movement/shared.ts';

const fact = (world: World, name: string): DefinitionRef => ({
  cartridge_id: world.cartridge.manifest.id,
  cartridge_version: world.cartridge.manifest.version,
  kind: 'fact',
  key: name as DefinitionRef['key'],
});

// The plan's trail facts, or the player's when `plan` is undefined.
const facts = (world: World, plan?: string) =>
  (plan ? [`trail_${plan}_exit`, `trail_${plan}_at`] : ['trail_exit', 'trail_at']).map((n) =>
    fact(world, n),
  );

/** The exit the trail of `plan` (or `actor`'s) in `room` leads by while fresh at `now`. */
export function fresh(
  world: World,
  actor: CharacterId,
  room: EntityId,
  now: number,
  plan?: string,
): Key | undefined {
  const trails = world.cartridge.world?.trails;
  const [exit, at] = facts(world, plan).map((f) => value(world, actor, f, room));
  return trails && exit !== 'none' && now - (at as number) < trails.fresh_for
    ? (exit as Key)
    : undefined;
}

/**
 * A hunting plan's member's exit from `here` (taken before its wander): the player's fresh trail,
 * when npcPassage admits it.
 */
export function chase(
  world: World,
  plan: PopulationPlan,
  here: EntityId,
  now: number,
  walker?: EntityId,
) {
  const exit = plan.hunts ? fresh(world, world.character, here, now) : undefined;
  const room = world.rooms[here];
  return exit && !npcPassage(world, room, exit, walker)
    ? ([exit, room.exits[exit as keyof typeof room.exits]!] as const)
    : undefined;
}

/**
 * The fact.assign ops saying `plan`'s member (or `actor`) left `room` by `exit` at `at`: none
 * unless the plan has `trail` (for the player: unless some plan `hunts`).
 */
export function left(
  world: World,
  actor: CharacterId,
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
  ].map(([f, v]) => {
    const { kind: _, ...target } = targetOf(world, actor, f as DefinitionRef, room);
    const expected = value(world, actor, f as DefinitionRef, room);
    return { op: 'fact.assign', writer_group: 0, ...target, expected, value: v as Key | number };
  });
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
