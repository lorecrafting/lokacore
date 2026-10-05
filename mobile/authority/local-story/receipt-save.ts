import { exchangeSave } from './exchange-save.ts';
import { combatReceipts } from './combat-receipt.ts';
import { skillsSave } from './skills-save.ts';
import { dialogueSave } from './dialogue-save.ts';
import { commerceSave } from './commerce-save.ts';
import { deadlineSave } from './deadline-save.ts';
import { finaleSave } from './finale-save.ts';
import type { World } from '../../../kernel/ts/src/runtime/decision.ts';
import type { Db, Meta } from './store.ts';

export function receiptRecovery(fresh: World, world: World, db: Db, meta: Meta, revision: number) {
  skillsSave(world, db, meta);
  combatReceipts(db, `story/${meta.lineage_id}/${world.character}`);
  const exchanges = exchangeSave(fresh, world, db, meta, revision);
  dialogueSave(world, db, meta);
  commerceSave(world, db, meta, revision);
  deadlineSave(world, db, meta, exchanges);
  finaleSave(world, db, meta, revision);
}
