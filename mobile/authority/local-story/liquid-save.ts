// Vessel rows retain exact historical quantity and custody through ordinary receipts.
import { receiptHistory } from './receipt-history.ts';
import { liquidRowValid } from '../../../kernel/ts/src/foundation/compose_liquid.ts';
import { validate } from '../../../kernel/ts/src/foundation/validate.ts';
import type { World } from '../../../kernel/ts/src/runtime/decision.ts';
import type { Db, Meta } from './store.ts';

export function liquidSave(fresh: World, world: World, db: Db, meta: Meta, revision: number) {
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
  if (
    !fresh.cartridge.world?.water &&
    !expected.length &&
    !Object.keys(fresh.cartridge.services ?? {}).length &&
    !Object.keys(fresh.cartridge.transports ?? {}).length &&
    !Object.keys(fresh.populationSpecs ?? {}).length
  )
    return false;
  receiptHistory(fresh, world, db, meta, revision);
  return true;
}
