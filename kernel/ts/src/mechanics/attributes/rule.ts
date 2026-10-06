import { accepted, rejected, type Rule } from '../../runtime/decision.ts';
import type { DeltaOp } from '../../contracts.gen.ts';
import { assigned, type Assigned } from '../fact.ts';
import { acquire } from '../skills.ts';
import { choice, initialValues } from './shared.ts';

export const decide: Rule<'attributes'> = (world, command) => {
  const { actor_id, ancestry } = command.payload;
  const declaration = world.cartridge.ancestries?.[ancestry];
  if (!declaration) return rejected('not_found');
  if (choice(world, actor_id)) return rejected('invalid_state');
  const row = { ancestry, attributes: initialValues(world, declaration) };
  const selection: DeltaOp = {
    op: 'character.select',
    writer_group: 0,
    character_id: actor_id,
    value: row,
  };
  let run: Assigned = { ops: [selection], position: 0, facts: {} };
  if (declaration.skill) run = acquire(world, actor_id, run, declaration.skill);
  if (declaration.faction) run = assigned(world, actor_id, run, declaration.faction);
  return accepted(world, ancestry, run.ops, []);
};
