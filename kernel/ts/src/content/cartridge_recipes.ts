// Only tipSpec (cartridge_position.ts) and tipUses (cartridge.ts lockStage, which slice B2 deletes) remain; recipes.ex checks recipes.
import { step, type Obj } from './cartridge_refs.ts';

/** Toolbox row W23: the FactSpec the compiler adds for a recipe's tip (recipes.ex tip_spec). */
export const tipSpec = (key: string) => ({
  key: `seen_tip_${key}`,
  version: 1,
  value_type: { type: 'bool', default: false },
  scopes: ['player'],
  meaning: `Recipe ${key}'s tip was shown (action_recipe@1): only that recipe writes it.`,
});

/** A tip's seen_tip_<key> assignment uses fact_changed (the lock stage, content/cartridge.ts). */
export const tipUses = (c: Obj) =>
  Object.entries((c.recipes ?? {}) as Obj)
    .filter(([, r]) => r.tip)
    .map(([ref]) => ['event', 'fact_changed', `.cartridge.recipes${step(ref)}.tip`]) as [
    'event',
    string,
    string,
  ][];
