// Repeat exchanges retain only the latest quest row; existing receipts prove their historical revisions.
import { receiptHistory } from './receipt-history.ts';
import type { World } from '../../../kernel/ts/src/runtime/decision.ts';
import type { Db, Meta } from './store.ts';

/** Reuse the kernel's exact admission/lowering at each original revision, including unrelated custody/faction changes. */
export function exchangeSave(
  fresh: World,
  saved: World,
  db: Db,
  meta: Meta,
  revision: number,
  historyChecked: boolean,
): boolean {
  if (
    !Object.values(saved.cartridge.quests ?? {}).some((q) => q.patrol) &&
    !Object.values(saved.cartridge.quests ?? {}).some((q) => q.exchange) &&
    !Object.keys(fresh.fuelSpecs).length &&
    saved.state.fuel === undefined
  )
    return false;
  if (!historyChecked) receiptHistory(fresh, saved, db, meta, revision);
  return true;
}
