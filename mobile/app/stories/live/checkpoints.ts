// Spike: writes stories/live/<name>.sql by replaying a named route through the Node Book harness.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { book, bundle } from '../../book/__tests__/polish-book.test.ts';
import { openGame } from '../../../authority/local-story/session.ts';

// The save as SQL text (schema, then rows): no blob columns, so a text literal or a number each.
const dump = (sql: DatabaseSync) =>
  (
    sql.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table'").all() as {
      name: string;
      sql: string;
    }[]
  )
    .flatMap(({ name, sql: create }) => [
      `${create};`,
      ...sql
        .prepare(`SELECT * FROM "${name}"`)
        .all()
        .map(
          (row) =>
            `INSERT INTO "${name}" VALUES (${Object.values(row)
              .map((v) =>
                v === null
                  ? 'NULL'
                  : typeof v === 'string'
                    ? `'${v.replaceAll("'", "''")}'`
                    : String(v),
              )
              .join(', ')});`,
        ),
    ])
    .join('\n');

const cartridge = bundle('missing_child_v042_hash');
const routes: Record<string, string[]> = { 'first-room': ['Fen-born', 'Continue'] };
const out = new URL('./', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
for (const [name, taps] of Object.entries(routes)) {
  const t0 = performance.now();
  const b = book(cartridge);
  for (const label of taps) b.tap(label);
  const replay = performance.now() - t0;
  const file = `${out}${name}.db`;
  rmSync(file, { force: true });
  b.sql.exec(`VACUUM INTO '${file}'`); // reopened below, then removed
  writeFileSync(`${out}${name}.sql`, dump(b.sql));
  // reopen check: the file restores as the same game
  const t1 = performance.now();
  const sql = new DatabaseSync(file);
  const db = {
    execSync: (s: string) => sql.exec(s),
    isInTransactionSync: () => sql.isTransaction,
    runSync: (s: string, ...p: never[]) => sql.prepare(s).run(...p),
    getFirstSync: (s: string, ...p: never[]) => sql.prepare(s).get(...p) ?? null,
    getAllSync: (s: string, ...p: never[]) => sql.prepare(s).all(...p),
  };
  const game = openGame(db as never, cartridge, {
    newId: crypto.randomUUID,
    kernel_version: 'other-kernel@dirty',
    time: { wall: () => Number(process.env.WALL ?? 10000), monotonic: () => 0 },
  });
  const restore = performance.now() - t1;
  sql.close();
  rmSync(file);
  const same = JSON.stringify(game.view().view) === JSON.stringify(b.game.view().view);
  console.log(name, {
    replay_ms: Math.round(replay),
    restore_ms: Math.round(restore),
    same,
    labels: b.labels(),
  });
}
