// Vessel rows retain exact historical quantity and custody through ordinary receipts.
import { liquidRowValid } from '../../../kernel/ts/src/foundation/compose_liquid.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import type { World } from '../../../kernel/ts/src/runtime/decision.ts';

export function liquidSave(fresh: World, world: World) {
  const expected = Object.keys(fresh.liquidSpecs ?? {}),
    actual = Object.keys(world.state.liquids ?? {});
  if (
    expected.length !== actual.length ||
    actual.some(
      (item) =>
        validate('LiquidRow', world.state.liquids?.[item]).length ||
        !liquidRowValid(world.state.liquids?.[item], fresh.liquidSpecs[item]),
    )
  )
    throw new SyntaxError('malformed JSON: inconsistent vessel rows');
}
