import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import type { World } from '../../../kernel/ts/src/runtime/decision.ts';

/** Reject unsafe JSON before canonical receipt replay proves identity and exact provenance. */
export function knowledgeSave(world: World) {
  if (!world.cartridge.lock.capabilities.knowledge) return;
  for (const [contract, rows] of [
    ['VisitedRoom', world.state.visited_rooms],
    ['ObservedNpc', world.state.observed_npcs ?? {}],
  ] as const) {
    if (
      !rows ||
      typeof rows !== 'object' ||
      Array.isArray(rows) ||
      Object.values(rows).some((row) => validate(contract, row).length)
    )
      throw new SyntaxError('malformed JSON: knowledge rows');
  }
}
