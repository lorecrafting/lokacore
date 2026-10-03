// quest@1 (capability_registry.json; 06 §1, §2 Activation modes, §4): accept_quest creates the
// actor's QuestInstance of the offered quest (quest.ts activation). The ActionSet admits it only
// through that quest's offer, which is withdrawn once the actor has an instance of it (actions.ts),
// so a second accept and a quest the cartridge does not declare are refused before this rule. The
// outcome is activated_with_possession when a current_state objective already holds (04 §5.2:
// state credit at activation, not a replayed event), else activated; nothing is stored for it.
import { accepted, event, type Rule } from '../decision.ts';
import { activation, holdsNow } from '../quest.ts';

export const decide: Rule<'quest'> = (world, command, mint, steps = { n: 0 }) => {
  const { quest, actor_id } = command.payload;
  const { ops, payload } = activation(mint, actor_id, quest);
  const outcome = holdsNow(world, actor_id, quest, steps)
    ? 'activated_with_possession'
    : 'activated';
  return accepted(world, outcome, ops, [event(world, command, mint, 1, payload)]);
};
