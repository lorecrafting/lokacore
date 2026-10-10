// Toolbox row 4 (docs/system/mechanics.md experience and levelling): one levelling row per
// character; level and unspent points are derived on read, never stored.
import type { CharacterId, DeltaOp, LevellingRow, Text } from '../../contracts.gen.ts';
import { saturate } from '../../foundation/int.ts';
import type { World } from '../../runtime/decision.ts';
import { statusKey } from '../status/shared.ts';

const NONE: LevellingRow = { experience: 0, allocated: {} };

type Spec = NonNullable<NonNullable<World['cartridge']['world']>['levelling']>;
/** How many thresholds `experience` has reached (the level minus 1). */
const reached = (spec: Spec, experience: number) =>
  spec.thresholds.filter((t) => t <= experience).length;

/** The actor's row, level, experience, next threshold (absent at the top) and unspent points. */
export function levelling(world: World, actor: CharacterId) {
  const spec = world.cartridge.world?.levelling;
  if (!spec) return;
  const row = world.state.levelling?.[actor];
  const { experience, allocated } = row ?? NONE;
  const r = reached(spec, experience);
  const spent = Object.values(allocated).reduce((a, n) => a + n, 0);
  const unspent = spec.points_per_level * r - spent;
  return { row, level: r + 1, experience, next: spec.thresholds[r], unspent };
}

/**
 * The cartridge's level_up line when `ops` (a whole proposal from `world`) raise the player
 * character's level: the stored row against the last write's value (mechanics.md row 4).
 */
export function levelUp(world: World, ops: readonly DeltaOp[]): Text[] {
  const spec = world.cartridge.world?.levelling;
  const last = ops
    .filter((o) => o.op === 'levelling.set' && o.character_id === world.character)
    .at(-1);
  if (!spec || last?.op !== 'levelling.set') return [];
  const from = world.state.levelling?.[world.character]?.experience ?? 0;
  return reached(spec, last.value.experience) > reached(spec, from) ? [{ key: spec.level_up }] : [];
}

// The rows a proposal writes at most once (compose faults a row written by two groups): a
// character's levelling (row 4) and a body's status (row 1: a due tick and a clock_hour refresh,
// row W25, can land in one settlement).
const merged = (o: DeltaOp) =>
  o.op === 'levelling.set'
    ? `levelling:${o.character_id}`
    : o.op === 'status.transition'
      ? statusKey(o.body_id, o.status)
      : undefined;
type Merged = Extract<DeltaOp, { op: 'levelling.set' | 'status.transition' }>;

/**
 * One write per merged row per proposal: each row's last write, which already holds every
 * earlier one (each sequence reads the proposal so far), expecting the row before the first.
 * A single write is returned unchanged.
 */
export function oneWrite(ops: readonly DeltaOp[]): DeltaOp[] {
  const first = new Map<string, Merged>();
  const last = new Map<string, Merged>();
  for (const o of ops) {
    const k = merged(o);
    if (!k) continue;
    if (!first.has(k)) first.set(k, o as Merged);
    last.set(k, o as Merged);
  }
  return ops.flatMap((o): DeltaOp[] => {
    const k = merged(o);
    if (!k) return [o];
    if (last.get(k) !== o) return [];
    const { expected } = first.get(k)!;
    return [expected === (o as Merged).expected ? o : ({ ...o, expected } as DeltaOp)];
  });
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
