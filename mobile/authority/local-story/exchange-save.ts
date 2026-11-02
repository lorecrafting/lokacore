// Repeat exchanges retain only the latest quest row, so a deadline's terminal fact cannot be read
// against the default or the current value (deadline-receipts.ts).
import type { World } from '../../../kernel/ts/src/runtime/decision.ts';

export const repeatExchanges = (fresh: World, saved: World) =>
  Object.values(saved.cartridge.items ?? {}).some((i) => i.readable) ||
  Object.values(saved.cartridge.quests ?? {}).some((q) => q.patrol || q.exchange) ||
  Object.values(saved.details).some((d) => d.harvest?.careful) ||
  Object.values(saved.entities).some(
    (e) => e.kind === 'npc' && (e.shop?.buy_discount || e.shop?.offers.some((o) => o.stock)),
  ) ||
  Object.keys(fresh.fuelSpecs).length > 0 ||
  saved.state.fuel !== undefined;
