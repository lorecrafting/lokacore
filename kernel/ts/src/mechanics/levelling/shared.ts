// Toolbox row 4 (docs/system/mechanics.md experience and levelling): one levelling row per
// character; level and unspent points are derived on read, never stored.
import type { CharacterId, DeltaOp, LevellingRow } from '../../contracts.gen.ts';
import { saturate } from '../../foundation/int.ts';
import type { World } from '../../runtime/decision.ts';

const NONE: LevellingRow = { experience: 0, allocated: {} };

/** The actor's row, level, next threshold (absent at the top) and unspent points; none undeclared. */
export function levelling(world: World, actor: CharacterId) {
  const spec = world.cartridge.world?.levelling;
  if (!spec) return;
  const row = world.state.levelling?.[actor];
  const { experience, allocated } = row ?? NONE;
  const reached = spec.thresholds.filter((t) => t <= experience).length;
  const spent = Object.values(allocated).reduce((a, n) => a + n, 0);
  const unspent = spec.points_per_level * reached - spent;
  return { row, level: reached + 1, next: spec.thresholds[reached], unspent };
}

/** The checked write of the actor's row to `value`, expecting the row `world` holds. */
export const write = (
  world: World,
  actor: CharacterId,
  value: LevellingRow,
  writer_group: number,
): DeltaOp => ({
  op: 'levelling.set',
  writer_group,
  character_id: actor,
  expected: world.state.levelling?.[actor] ?? null,
  value,
});

/** `amount` more experience for the actor, saturating at the ResourceInt maximum. */
export function grant(world: World, actor: CharacterId, amount: number, group: number) {
  if (!world.cartridge.world?.levelling || amount <= 0) return [];
  const row = world.state.levelling?.[actor] ?? NONE;
  return [write(world, actor, { ...row, experience: saturate(row.experience + amount) }, group)];
}
