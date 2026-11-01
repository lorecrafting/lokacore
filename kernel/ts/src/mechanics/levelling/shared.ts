// Toolbox row 4 (docs/system/mechanics.md experience and levelling): one levelling row per
// character; level and unspent points are derived on read, never stored.
import type {
  CharacterId,
  DefinitionRef,
  DeltaOp,
  DomainEvent,
  LevellingRow,
  Text,
} from '../../contracts.gen.ts';
import { key } from '../../foundation/compose.ts';
import { saturate } from '../../foundation/int.ts';
import { bodyOf, type Mint, type World } from '../../runtime/decision.ts';
import type { Base } from '../fact.ts';
import { adjust } from '../resource.ts';

const NONE: LevellingRow = { experience: 0, allocated: {} };

type Set = Extract<DeltaOp, { op: 'levelling.set' }>;
type Spec = NonNullable<NonNullable<World['cartridge']['world']>['levelling']>;
/** How many thresholds `experience` has reached (the level minus 1). */
const reached = (spec: Spec, experience: number) =>
  spec.thresholds.filter((t) => t <= experience).length;

/** The actor's row, level, experience, thresholds around it (next absent at the top), unspent points. */
export function levelling(world: World, actor: CharacterId) {
  const spec = world.cartridge.world?.levelling;
  if (!spec) return;
  const row = world.state.levelling?.[actor];
  const { experience, allocated } = row ?? NONE;
  const r = reached(spec, experience);
  const spent = Object.values(allocated).reduce((a, n) => a + n, 0);
  const unspent = spec.points_per_level * r - spent;
  return {
    row,
    level: r + 1,
    experience,
    from: spec.thresholds[r - 1] ?? 0,
    next: spec.thresholds[r],
    unspent,
  };
}

/**
 * The cartridge's gained line when `ops` (a whole proposal from `world`) add to `actor`'s
 * experience, then its level_up line when they raise the level, or its death penalty narration
 * when they lower the experience (only a death's loss does): the stored row against the last
 * write's value (mechanics.md rows 4 and 47).
 */
export function levelUp(world: World, actor: CharacterId, ops: readonly DeltaOp[]): Text[] {
  const spec = world.cartridge.world?.levelling;
  const last = ops.filter((o) => o.op === 'levelling.set' && o.character_id === actor).at(-1);
  if (!spec || last?.op !== 'levelling.set') return [];
  const from = world.state.levelling?.[actor]?.experience ?? 0;
  const to = last.value.experience;
  const lost = world.cartridge.world?.death?.penalty?.experience?.narration;
  if (to < from) return lost ? [{ key: lost }] : [];
  return [
    ...(spec.gained && to > from ? [{ key: spec.gained, bindings: { amount: to - from } }] : []),
    ...(reached(spec, to) > reached(spec, from) ? [{ key: spec.level_up }] : []),
  ];
}

/**
 * A level_reached for each threshold a sequence's folded levelling write raises its character
 * past, ascending (row 4); a fall crosses none. `join` numbers each one's position.
 */
export function levelsReached(
  world: World,
  own: readonly DeltaOp[],
  base: Base,
  mint: Mint,
): readonly DomainEvent[] {
  const spec = world.cartridge.world?.levelling;
  if (!spec) return [];
  return oneWrite(own).flatMap((o) => {
    if (o.op !== 'levelling.set') return [];
    const { character_id } = o;
    const from = reached(spec, o.expected?.experience ?? 0);
    return spec.thresholds.slice(from, reached(spec, o.value.experience)).map((_, i) => ({
      id: mint() as DomainEvent['id'],
      ...base,
      actor_id: character_id, // a rule on it runs for the character who levelled
      scope: { kind: 'player' as const, character_id },
      position: 0, // mutate-skip: join overwrites it
      payload: { type: 'level_reached' as const, character_id, level: from + i + 2 },
    }));
  });
}

/**
 * One levelling write per character per proposal (row 4; compose faults a row written by two
 * groups): each character's last write, which already holds every earlier grant, expecting the
 * row before the first. A single write is returned unchanged.
 */
export function oneWrite(ops: readonly DeltaOp[]): DeltaOp[] {
  const first = new Map<CharacterId, Set>();
  const last = new Map<CharacterId, Set>();
  for (const o of ops)
    if (o.op === 'levelling.set') {
      if (!first.has(o.character_id)) first.set(o.character_id, o);
      last.set(o.character_id, o);
    }
  return ops.flatMap((o): DeltaOp[] => {
    if (o.op !== 'levelling.set') return [o];
    if (last.get(o.character_id) !== o) return [];
    const { expected } = first.get(o.character_id)!;
    return [expected === o.expected ? o : { ...o, expected }];
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

/**
 * A reaction's resource.adjust on the actor's body, clamped to its bounds and after the rule's
 * earlier `ops`, so two compose. Nothing without a body or a change. `at`: the composer folds from
 * the base clock otherwise and refuses the settled regen.
 */
export function adjusted(
  then: World,
  actor: CharacterId,
  step: { resource: DefinitionRef; by: number },
  writer_group: number,
  ops: readonly DeltaOp[],
): DeltaOp[] {
  const body = bodyOf(then, actor);
  if (!body) return [];
  const levels: Record<string, number> = {};
  for (const o of ops)
    if (o.op === 'resource.adjust')
      levels[key({ kind: 'resource', resource: o.resource, entity_id: o.entity_id })] = o.to;
  const { op } = adjust(then, body, step.resource, step.by, levels, true);
  return op.from === op.to ? [] : [{ ...op, writer_group, at: then.state.clock }];
}

/** `amount` more experience for the actor, saturating at the ResourceInt maximum. */
export function grant(world: World, actor: CharacterId, amount: number, group: number) {
  if (!world.cartridge.world?.levelling || amount <= 0) return [];
  const row = world.state.levelling?.[actor] ?? NONE;
  return [write(world, actor, { ...row, experience: saturate(row.experience + amount) }, group)];
}

/**
 * A death's experience loss (row 47): floor(experience * percent / 100), never below the
 * threshold of the actor's level (0 below the first); a loss of 0 writes nothing.
 */
export function lose(world: World, actor: CharacterId, percent: number, group: number) {
  const spec = world.cartridge.world?.levelling;
  const row = world.state.levelling?.[actor] ?? NONE;
  if (!spec) return [];
  const floor = spec.thresholds.filter((t) => t <= row.experience).at(-1) ?? 0;
  const experience = Math.max(floor, row.experience - Math.floor((row.experience * percent) / 100));
  return experience === row.experience ? [] : [write(world, actor, { ...row, experience }, group)];
}
