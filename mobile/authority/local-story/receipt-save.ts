import { knowledgeSave } from './knowledge-save.ts';
import { patrolSave } from './patrol-save.ts';
import { expeditionSave } from './expedition-save.ts';
import { riddleSave, selectorSave } from './riddle-save.ts';
import { topicsSave } from './topics-save.ts';
import { exchangeSave } from './exchange-save.ts';
import { liquidSave } from './liquid-save.ts';
import { combatReceipts } from './combat-receipt.ts';
import { skillsSave } from './skills-save.ts';
import { dialogueSave } from './dialogue-save.ts';
import { commerceSave } from './commerce-save.ts';
import { deadlineSave } from './deadline-save.ts';
import { deerSave } from './deer-save.ts';
import { jobSave } from './job-save.ts';
import type { World } from '../../../kernel/ts/src/runtime/decision.ts';
import type { Db, Meta } from './store.ts';

// A save holding an accepted cheat opens only on a dev host; here, not in receiptHistory, which
// some cartridges skip. ponytail: scans the receipts on each release open, as receiptHistory does;
// index only after measuring reopen.
const DEV_RECEIPT = `SELECT 1 FROM receipt WHERE json_extract(response,'$.kind')='accepted'
  AND json_extract(command,'$.payload.type') GLOB 'dev_*' LIMIT 1`;

export function receiptRecovery(
  fresh: World,
  world: World,
  db: Db,
  meta: Meta,
  revision: number,
  dev = false,
) {
  if (!dev && db.getFirstSync(DEV_RECEIPT)) throw new SyntaxError('malformed JSON: a dev save');
  jobSave(fresh, world);
  knowledgeSave(world);
  patrolSave(world);
  expeditionSave(world, db, meta, revision);
  selectorSave(world, db, meta);
  riddleSave(world, db, meta);
  topicsSave(world, db, meta);
  skillsSave(world, db, meta);
  combatReceipts(db, `story/${meta.lineage_id}/${world.character}`);
  const liquids = liquidSave(fresh, world, db, meta, revision);
  const exchanges = exchangeSave(fresh, world, db, meta, revision, liquids);
  dialogueSave(world, db, meta);
  commerceSave(fresh, world, db, meta, revision);
  deadlineSave(world, db, meta, exchanges);
  if (Object.values(world.cartridge.populations ?? {}).some((p) => p.sight))
    deerSave(world, db, meta);
}
