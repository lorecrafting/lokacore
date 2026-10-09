// `npm run stories:views` (Beads loka-bhb batch 4): replays each named route through the Node Book
// harness and writes the page stories' views (stories/views/<name>.json) and the live stories'
// saves (stories/live/<name>.sql). Seeded ids and a fixed clock make both byte-stable (E5).
import { mkdirSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { book, bundle } from '../book/__tests__/polish-book.test.ts';
import { openGame } from '../../authority/local-story/session.ts';
import { routes, checkpoints, type Harness } from './routes.ts';

const cartridge = bundle('missing_child_v042_hash');
// Counted v4-shaped ids: the same route writes the same rows.
export const seeded = () => {
  let n = 0;
  return () => `00000000-0000-4000-8000-${(++n).toString(16).padStart(12, '0')}`;
};
const host = (wall: number) => ({
  newId: seeded(),
  kernel_version: `loka-kernel@${'0'.repeat(40)}`,
  time: { wall: () => wall, monotonic: () => 0 },
});

// The save as SQL text (schema, then rows): no blob columns, so a text literal or a number each.
const literal = (v: unknown) =>
  v === null ? 'NULL' : typeof v === 'string' ? `'${v.replaceAll("'", "''")}'` : String(v);
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
          (row) => `INSERT INTO "${name}" VALUES (${Object.values(row).map(literal).join(', ')});`,
        ),
    ])
    .join('\n');

// The Book's screen as page stories read it (screenFrom): the view, the detail stack and its logs.
function screenOf(b: Harness) {
  const s = b.p.screen();
  const ids = [
    ...b.stack.flatMap((page: { id?: string; speaker?: string }) => [page.id, page.speaker]),
    s.view.choice?.speaker_id,
    'conversation',
  ].filter((id): id is string => !!id && s.detail(id).length > 0);
  const details = Object.fromEntries(ids.map((id) => [id, s.detail(id)]));
  return { view: s.view, stack: b.stack, log: s.log, combatLog: s.combatLog, details };
}

const replay = (taps: Harness['steps']) => {
  const b = book(cartridge, undefined, seeded()) as Harness;
  for (const [i, step] of taps.entries())
    try {
      typeof step === 'function' ? step(b) : b.tap(step);
    } catch (e) {
      throw new Error(
        `step ${i} (${typeof step === 'function' ? 'fn' : String(step)}): ${(e as Error).message}`,
      );
    }
  return b;
};

// A checkpoint must reopen as the game it was written from (openGame over its dump).
function restored(b: Harness, sql: string) {
  const db = new DatabaseSync(':memory:');
  db.exec(sql);
  const game = openGame(
    {
      execSync: (s: string) => db.exec(s),
      isInTransactionSync: () => db.isTransaction,
      runSync: (s: string, ...p: never[]) => db.prepare(s).run(...p),
      getFirstSync: (s: string, ...p: never[]) => db.prepare(s).get(...p) ?? null,
      getAllSync: (s: string, ...p: never[]) => db.prepare(s).all(...p),
    } as never,
    cartridge,
    host(b.clock.wall),
  );
  if (JSON.stringify(game.view().view) !== JSON.stringify(b.game.view().view))
    throw new Error('a checkpoint does not reopen as its game');
}

/** Every generated file, path (from stories/) to content. */
export function scenarios(): Record<string, string> {
  const files: Record<string, string> = {};
  for (const [name, taps] of Object.entries(routes))
    try {
      files[`views/${name}.json`] = `${JSON.stringify(screenOf(replay(taps)), null, 1)}\n`;
    } catch (e) {
      throw new Error(`route ${name}: ${(e as Error).message}`);
    }
  for (const [name, taps] of Object.entries(checkpoints)) {
    const b = replay(taps);
    const sql = `${dump(b.sql)}\n`;
    restored(b, sql);
    files[`live/${name}.sql`] = sql;
  }
  return files;
}

if (import.meta.main) {
  const stories = new URL('./', import.meta.url);
  for (const [path, content] of Object.entries(scenarios())) {
    mkdirSync(new URL(path.replace(/[^/]*$/, ''), stories), { recursive: true });
    writeFileSync(new URL(path, stories), content);
  }
}
