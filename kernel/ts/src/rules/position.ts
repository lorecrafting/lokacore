// position@1 (capability_registry.json; mechanics.md position@1; 00 §4.3 as amended by
// c1-position): stand, sit, rest and sleep set the actor's position, the engine fact the compiler
// adds when the lock holds position (cartridge.md Compiler), by one fact.assign whose expected
// value is the current position; the same position is invalid_state. The host logs fact_changed.
// ponytail: no position changes regeneration; the bonuses (00 §4.2) join with the time model.
import { accepted, refString, rejected, type Rule } from '../decision.ts';
import { assigned } from '../fact.ts';
import { fact, positionOf, VERBS } from '../position.ts';

export const decide: Rule<'position'> = (world, command) => {
  const { type, actor_id } = command.payload;
  const [to, outcome] = VERBS[type]!;
  // `to` as the FactSpec's Key (the loader holds the spec to the engine's, cartridge_position.ts).
  const t = world.cartridge.facts[refString(fact(world))]!.value_type;
  const v = t.type === 'enum' ? t.values.find((k) => k === to) : undefined;
  if (v === undefined || positionOf(world, actor_id) === v) return rejected('invalid_state');
  const start = { ops: [], position: 0, facts: {} };
  const { ops } = assigned(world, actor_id, start, { fact: fact(world), value: v });
  return accepted(world, outcome, ops, []);
};
