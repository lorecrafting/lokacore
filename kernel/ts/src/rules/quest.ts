// quest@1 (capability_registry.json; 06 §1, §2 Activation modes, §4): accept_quest creates the
// actor's QuestInstance of the offered quest, active, at player scope: one quest.activate and its
// quest_activated. The ActionSet admits it only through that quest's offer, which is withdrawn
// once the actor has an instance of it (actions.ts), so a second accept and a quest the cartridge
// does not declare are refused before this rule. The outcome is activated_with_possession when a
// current_state objective already holds (04 §5.2: state credit at activation, not a replayed
// event; adverse-cases.json early-possession), else activated; nothing is stored for it.
import { accepted, event, type Rule } from '../decision.ts';
import { holdsNow, instanceId } from '../quest.ts';

export const decide: Rule<'quest'> = (world, command, mint, steps = { n: 0 }) => {
  const { quest, actor_id } = command.payload;
  const instance_id = instanceId(mint);
  const scope = { kind: 'player', character_id: actor_id } as const;
  const op = { op: 'quest.activate', writer_group: 0, quest, scope, instance_id } as const;
  const activated = { type: 'quest_activated', quest, instance_id } as const;
  const outcome = holdsNow(world, actor_id, quest, steps)
    ? 'activated_with_possession'
    : 'activated';
  return accepted(world, outcome, [op], [event(world, command, mint, 1, activated)]);
};
