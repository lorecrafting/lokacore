import { knowledgeSave } from './knowledge-save.ts';
import { patrolSave } from './patrol-save.ts';
import { expeditionSave } from './expedition-save.ts';
import { riddleSave, selectorSave } from './riddle-save.ts';
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

// A save holding an accepted cheat opens only on a dev host; here, not in receiptHistory, which some
// cartridges skip. JSON.parse, as replay reads the command: json_extract takes a duplicate key's first.
// ponytail: parses every accepted command on each release open; index only after measuring reopen.
const ACCEPTED = `SELECT command FROM receipt WHERE json_extract(response,'$.kind')='accepted'`;
const hasDevReceipt = (db: Db) =>
  db
    .getAllSync<{ command: string }>(ACCEPTED)
    .some((r) => /^dev_/.test(JSON.parse(r.command)?.payload?.type));

export function receiptRecovery(
  fresh: World,
  world: World,
  db: Db,
  meta: Meta,
  revision: number,
  dev = false,
) {
  if (!dev && hasDevReceipt(db)) throw new SyntaxError('malformed JSON: a dev save');
  jobSave(fresh, world);
  knowledgeSave(world);
  patrolSave(world);
  expeditionSave(world, db, meta, revision);
  selectorSave(world, db, meta);
  riddleSave(world, db, meta);
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
