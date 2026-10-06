// Eat owns World narration and binds only its own retained command/definition evidence.
import type { Command, DecisionResult } from '../../../kernel/ts/src/contracts.gen.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import type { World } from '../../../kernel/ts/src/runtime/decision.ts';
export function eatReceipt(
  world: World,
  command: Command,
  command_id: string,
  d: Extract<DecisionResult, { kind: 'accepted' }>,
): undefined {
  const p = command.payload;
  if (p.type !== 'eat') throw new Error('malformed JSON: invalid committed Eat');
  const item = world.entities[p.item_id];
  if (
    validate('Command', command).length ||
    command.id !== command_id ||
    p.actor_id !== world.character ||
    d.outcome !== 'eaten' ||
    d.item_id !== p.item_id ||
    item?.kind !== 'item' ||
    !item.edible ||
    d.narration?.length !== 1 ||
    d.narration[0].key !== item.edible.narration
  )
    throw new Error('malformed JSON: invalid committed Eat');
  return undefined;
}
