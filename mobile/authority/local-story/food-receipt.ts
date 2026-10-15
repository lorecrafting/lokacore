// Eat owns World narration and binds only its own retained command/definition evidence.
import type { Command, DecisionResult } from '../../../kernel/ts/src/contracts.gen.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import type { World } from '../../../kernel/ts/src/runtime/decision.ts';
import { specOf } from '../../../kernel/ts/src/mechanics/status/shared.ts';
export function eatReceipt(
  world: World,
  command: Command,
  command_id: string,
  d: Extract<DecisionResult, { kind: 'accepted' }>,
): undefined {
  const p = command.payload;
  if (p.type !== 'eat') throw new Error('malformed JSON: invalid committed Eat');
  const item = world.entities[p.item_id];
  // Line 0 is the meal's; each later line is a distinct `applies` status's applied line, in order
  // (a refresh or an immune eater is silent, so any of them may be missing).
  const applied = (item?.kind === 'item' && item.edible?.applies) || [];
  let next = 0;
  const statusLine = ({ key }: { key: string }) => {
    while (next < applied.length && specOf(world, applied[next])?.narration.applied !== key) next++;
    return next++ < applied.length;
  };
  if (
    validate('Command', command).length ||
    command.id !== command_id ||
    p.actor_id !== world.character ||
    d.outcome !== 'eaten' ||
    d.item_id !== p.item_id ||
    item?.kind !== 'item' ||
    !item.edible ||
    d.narration?.[0]?.key !== item.edible.narration ||
    !d.narration.slice(1).every(statusLine)
  )
    throw new Error('malformed JSON: invalid committed Eat');
  return undefined;
}
