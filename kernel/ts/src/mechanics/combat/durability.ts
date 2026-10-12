// Toolbox row 21 (mechanics.md "Durability, crafting quality and repair"): the wielded weapon's
// durability, a W2 entity fact, worn by each hit of its own attack and broken at its minimum.
import type { CharacterId, EncounterRow, EntityId, WeaponProfile } from '../../contracts.gen.ts';
import { refString, type World } from '../../runtime/decision.ts';
import { KernelError } from '../../foundation/error.ts';
import { assigned, bounded, value } from '../fact.ts';
import type { Round } from './round.ts';

/** The weapon a hit wears: its durability declaration and EntityId. */
export type Worn = NonNullable<WeaponProfile['durability']> & { id: EntityId };

// A hit of the wielded weapon's own attack takes `wear` off its durability fact,
// clamped to the fact's minimum; the next causal position stays free for the host's fact_changed.
export function wear(world: World, row: EncounterRow, worn: Worn, r: Round) {
  const current = value(world, row.character_id, worn.fact, worn.id);
  const next = bounded(world, worn.fact, current, -worn.wear);
  if (next === undefined) throw new KernelError('precondition_failed');
  const start = { ops: [], position: r.position, facts: {} };
  const step = { fact: worn.fact, value: next, subject: worn.id };
  const done = assigned(world, row.character_id, start, step, 'durability');
  r.ops.push(...done.ops);
  r.position = done.position;
}

// A weapon whose durability fact reads at or below its minimum is broken.
export function broken(world: World, actor: CharacterId, id: EntityId, weapon: WeaponProfile) {
  const d = weapon.durability;
  if (!d) return false;
  const type = world.cartridge.facts[refString(d.fact)].value_type;
  return type.type === 'int' && (value(world, actor, d.fact, id) as number) <= type.minimum!;
}
