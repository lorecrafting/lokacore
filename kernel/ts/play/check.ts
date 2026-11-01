// `bin/loka check <cartridge dir>` (docs/guides/writing-the-game.md#test-your-checkpoints): compiles
// the cartridge as the author preview does, then replays each `checkpoints/*.json` on a fresh
// session through the preview's own replay(), with no Book and so no prompt. Prints one line per
// checkpoint, `ok` or the first refused step, and exits 1 if any failed. No `random` in the host
// and the frozen clock: the same seed and time as the preview, so a run repeats there.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { frozenClock, replay, type Step } from '../../../mobile/app/author/place.ts';
import {
  KERNEL_ID,
  openGame,
  type Bundled,
} from '../../../mobile/authority/local-story/session.ts';
import type { Db } from '../../../mobile/authority/local-story/store.ts';
import { compiled } from './compiled.ts';

/** A save in memory on the same SQLite the tests' host uses. */
function memory(sql: DatabaseSync): Db {
  return {
    execSync: (q) => sql.exec(q),
    runSync: (q, ...p) => sql.prepare(q).run(...p),
    getFirstSync: <T>(q: string, ...p: (string | number | null)[]) =>
      (sql.prepare(q).get(...p) ?? null) as T | null,
    getAllSync: <T>(q: string, ...p: (string | number | null)[]) => sql.prepare(q).all(...p) as T[],
    isInTransactionSync: () => sql.isTransaction,
  };
}

/** `undefined` when the whole path is accepted, else why it stopped. */
function replayed(bundled: Bundled, steps: Step[]): string | undefined {
  const sql = new DatabaseSync(':memory:');
  let moved = 0;
  let id = 0; // mutate-skip: any start gives unique ids
  try {
    const game = openGame(memory(sql), bundled, {
      kernel_version: `${KERNEL_ID}@${'0'.repeat(40)}`,
      newId: () => `aaaaaaaa-0000-4000-8000-${(++id).toString().padStart(12, '0')}`, // mutate-skip: any unique id
      time: frozenClock(() => moved),
    });
    return replay(steps, game, (ms) => (moved += ms)).failed;
  } finally {
    sql.close();
  }
}

/** The report's lines and whether every checkpoint passed. */
function check(source: string): { lines: string[]; ok: boolean } {
  const dir = join(source, 'checkpoints');
  const names = existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .sort()
    : [];
  if (!names.length) return { lines: [`no checkpoints in ${dir}`], ok: false };
  const bundled = compiled(source);
  if (typeof bundled === 'string') return { lines: [`not compiled: ${bundled}`], ok: false };
  let ok = true;
  const lines = names.map((file) => {
    let why: string | undefined;
    try {
      const { steps } = JSON.parse(readFileSync(join(dir, file), 'utf8')) as { steps: Step[] };
      if (!Array.isArray(steps) || !steps.length)
        throw new Error('a checkpoint is {"steps": [...]} with at least one step');
      why = replayed(bundled, steps);
    } catch (e) {
      why = `not replayed (${(e as Error).message})`;
    }
    if (why) ok = false;
    return `${file.slice(0, -5)}: ${why ?? 'ok'}`;
  });
  return { lines, ok };
}

const [dir, ...rest] = process.argv.slice(2);
if (!dir || rest.length) {
  console.error('usage: bin/loka check <cartridge dir>');
  process.exit(2);
}
const { lines, ok } = check(resolve(dir));
for (const line of lines) console.log(line);
process.exit(ok ? 0 : 1);
