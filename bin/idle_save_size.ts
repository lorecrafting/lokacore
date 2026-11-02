// An hour of foreground idle on the showcase, ticked as App.tsx does: file size, receipts, trace.
// usage: mise exec -- node bin/idle_save_size.ts [ticks]   (default 14400: 250 ms each)
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compiled } from '../mobile/authority/local-story/__tests__/compiled.ts';
import {
  elapsedHost,
  receipts,
} from '../mobile/authority/local-story/__tests__/elapsed-host.test.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-idle-'));
const path = join(scratch, 'save.db');
const clock = { wall: 10000, mono: 0 };
const a = elapsedHost(path, clock, compiled('cartridges/toolbox_showcase'));
const moved = a.game.invoke({ action_key: 'move', target_ids: [], input: { direction: 'south' } });
if (moved.kind !== 'saved') throw new Error(moved.kind);
const count = (table: string) => a.sql.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n;
const start = { bytes: statSync(path).size, receipts: receipts(a.sql) };

const ticks = Number(process.argv[2] ?? 14400);
const exec = a.db.execSync.bind(a.db);
let commits = 0;
a.db.execSync = (q: string) => {
  if (q === 'COMMIT') commits++;
  exec(q);
};
const t0 = performance.now();
for (let n = 0; n < ticks; n++) {
  clock.wall += 250;
  clock.mono += 250;
  let status = a.game.pulse();
  while (status.kind === 'catching_up') status = a.game.pulse('drain');
  if (status.kind !== 'ready') throw new Error(status.kind);
}
const ms = performance.now() - t0;
// What the player can see of the hour: every row but the clock-only ones, and the world (head
// revision included: it still moves per tick).
const decisions = (
  a.sql.prepare('SELECT response FROM receipt ORDER BY rowid').all() as {
    response: string;
  }[]
).map((r) => JSON.parse(r.response));
const eventful = decisions.filter((d) => d.delta.ops.length > 1 || d.events.length);
const tables = a.sql
  .prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      AND name NOT IN ('receipt', 'trace', 'elapsed') ORDER BY name`,
  )
  .all() as { name: string }[];
const sha = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const rowsOf = (name: string) => a.sql.prepare(`SELECT * FROM "${name}"`).all();
console.log(
  JSON.stringify({
    ticks,
    commits,
    start,
    bytes: statSync(path).size,
    receipts: receipts(a.sql),
    trace_rows: count('trace'),
    ms_per_tick: ms / ticks,
    eventful_rows: eventful.length,
    eventful_sha256: sha(eventful),
    world_sha256: sha(tables.map((t) => [t.name, rowsOf(t.name)])),
  }),
);
a.sql.close();
rmSync(scratch, { recursive: true });
process.exit(0); // the test file imported above must not run its tests here
