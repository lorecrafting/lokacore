// Saved fact rows (toolbox row W2): each key is the canonical fact MutationTarget of a declared fact
// at this world's character or instance, with a subject exactly for an entity or pair fact, and
// its value is typed (invariant facts_typed). Any other row is save_corrupt, never a later fault.
import { decode } from '../../../kernel/ts/src/foundation/canonical.ts';
import { key } from '../../../kernel/ts/src/foundation/compose.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import type { World } from '../../../kernel/ts/src/runtime/decision.ts';
import { holds } from '../../../kernel/ts/src/runtime/world.ts';

export function factsValid(world: World): boolean {
  const rows = Object.keys(world.state.facts ?? {}).every((text) => {
    let t: any;
    try {
      t = decode(text);
    } catch {
      return false;
    }
    return (
      !validate('MutationTarget', t).length &&
      t.kind === 'fact' &&
      key(t) === text &&
      (t.scope.kind === 'player'
        ? t.scope.character_id === world.character
        : t.scope.world_context_id === world.context)
    );
  });
  return rows && holds('facts_typed', world);
}
