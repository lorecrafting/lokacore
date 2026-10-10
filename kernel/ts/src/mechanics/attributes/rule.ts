import { accepted, rejected, type Rule } from '../../runtime/decision.ts';
import type { DeltaOp } from '../../contracts.gen.ts';
import { assigned, type Assigned } from '../fact.ts';
import { acquire } from '../skills.ts';
import { choice, initialValues } from './shared.ts';
import { levelling, write } from '../levelling/shared.ts';
import { refString } from '../../runtime/decision.ts';
import { settleMaxima } from '../resource.ts';

export const decide: Rule<'attributes'> = (world, command) => {
  if (command.payload.type === 'raise_attribute') {
    // Toolbox row 4: one unspent point on one authored attribute.
    const { actor_id, attribute } = command.payload;
    const ref = refString(attribute);
    if (!world.cartridge.attributes?.[ref]) return rejected('not_found');
    const l = levelling(world, actor_id);
    if (!l || l.unspent < 1) return rejected('invalid_state');
    const row = l.row ?? { experience: 0, allocated: {} };
    const allocated = { ...row.allocated, [ref]: (row.allocated[ref] ?? 0) + 1 };
    const ops = [...settleMaxima(world), write(world, actor_id, { ...row, allocated }, 0)];
    return accepted(world, attribute.key, ops, []);
  }
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
