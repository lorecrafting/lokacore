// position@1 (capability_registry.json; mechanics.md position@1; 00 §4.3 as amended by
// c1-position): stand, sit, rest and sleep set the actor's position, the engine fact the compiler
// adds when the lock holds position (cartridge.md Compiler), by one fact.assign whose expected
// value is the current position, after opted pools settle and change rate. The same position
// is invalid_state. The host logs fact_changed. A Sleep provokes a hostile NPC in the room (toolbox
// row W9: G11's engage, as walking in does).
import { accepted, bodyOf, refString, rejected, event, type Rule } from '../../runtime/decision.ts';
import { assigned } from '../fact.ts';
import { fact, positionOf, VERBS } from './shared.ts';
import { recoveryAdjustments } from '../resource.ts';
import { engage } from '../disposition.ts';

export const decide: Rule<'position'> = (world, command, mint, steps = { n: 0 }) => {
  const { type, actor_id } = command.payload;
  const verb = VERBS[type];
  if (!verb) return rejected('invalid_state');
  const [to, outcome] = verb;
  // `to` as the FactSpec's Key (the loader holds the spec to the engine's, content/cartridge_position.ts).
  const t = world.cartridge.facts[refString(fact(world))]!.value_type;
  const v = t.type === 'enum' ? t.values.find((k) => k === to) : undefined;
  if (v === undefined || positionOf(world, actor_id) === v) return rejected('invalid_state');
  const body = bodyOf(world, actor_id);
  if (!body) return rejected('not_found');
  const start = { ops: recoveryAdjustments(world, body, to), position: 0, facts: {} };
  const run = assigned(world, actor_id, start, { fact: fact(world), value: v });
  const events =
    type === 'rest'
      ? [
          event(world, command, mint, run.position + 1, {
            type: 'rested',
            body_id: body,
            room_id: world.state.containers[body],
          }),
        ]
      : [];
  // PM provisional, owner question (loka-kgd.119): only a Sleep provokes; revert this call to undo it.
  const met =
    type === 'sleep'
      ? engage(world, actor_id, body, world.state.containers[body]!, mint, steps)
      : undefined;
  const narration = met?.narration.length ? met.narration : undefined;
  return accepted(world, outcome, [...run.ops, ...(met?.ops ?? [])], events, narration);
};
