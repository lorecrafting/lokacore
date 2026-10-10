// Toolbox row W24 (deadline-save.ts): a generic deadline (no fact, no bound offer) is skipped by the
// legacy reconciliation. Break: the gate on the legacy fact removed, so the quest's missing receive
// offer makes every save holding it save_corrupt (malformed JSON).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deadlineSave } from './deadline-save.ts';
import { fresh } from './__tests__/chandlers-setup.test.ts';

test('a save whose cartridge has a generic deadline reconciles without a bound offer', () => {
  const quests = structuredClone(fresh.cartridge.quests!);
  const bell = Object.keys(quests).find((k) => k.endsWith('quest/bell_of_ashmere'))!;
  quests[bell] = { ...quests[bell]!, deadline: { after: 60, outcome: 'prior' } };
  const world = { ...fresh, cartridge: { ...fresh.cartridge, quests } };
  const meta = { lineage_id: 'l' } as Parameters<typeof deadlineSave>[2];
  assert.doesNotThrow(() => deadlineSave(world, {} as never, meta));
});
