// R1 (docs/design/story-tooling.md §2): the checkpoints a compile should re-test. `bin/loka check`
// reports the same thing on the command line; this is the editor's copy, run after a good compile so
// a saved path the edit just broke is named without the owner asking.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { frozenClock, replay, type Step } from '../../../mobile/app/author/place.ts';
import type { DecisionResult } from '../src/contracts.gen.ts';
import {
  KERNEL_ID,
  openGame,
  type Bundled,
} from '../../../mobile/authority/local-story/session.ts';
import type { Db } from '../../../mobile/authority/local-story/store.ts';

/** R1's verdict for one checkpoint, as docs/design/story-tooling.md §2 names it: `ok`, or the step
 * that refused with its words. `live.Message` carries these; declared here, where they are made. */
export type Checked = { name: string } & ({ ok: true } | { ok: false; step: number; why: string });

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
export function replayed(bundled: Bundled, steps: Step[]): string | undefined {
  return play(bundled, steps).failed;
}

/** One path replayed on `bundled`, handing every decision the session saved to `each` with the game
 * that made it (R2 reads its narration and events). The replay stops at the first step it does not
 * save and accept, and says why; a caller wanting partial coverage ignores that. */
export type Each = (
  game: { dialogueOf: (continuation: string) => string | undefined },
  d: DecisionResult,
) => void;
export function play(bundled: Bundled, steps: Step[], each?: Each): { failed?: string } {
  const sql = new DatabaseSync(':memory:');
  let moved = 0;
  let id = 0; // mutate-skip: any start gives unique ids
  try {
    const game = openGame(memory(sql), bundled, {
      kernel_version: `${KERNEL_ID}@${'0'.repeat(40)}`,
      newId: () => `aaaaaaaa-0000-4000-8000-${(++id).toString().padStart(12, '0')}`, // mutate-skip: any unique id
      time: frozenClock(() => moved),
      dev: true, // a recorded cheat replays here as in the preview
    });
    // A session emits `completion` on a pulse, not on `invoke`, so the saved decision is read off the
    // reply here; `replay` keeps only the failure.
    const watched = each
      ? {
          ...game,
          invoke: (intent: Parameters<typeof game.invoke>[0]) => {
            const reply = game.invoke(intent);
            if (reply.kind === 'saved') each(game, reply.decision);
            return reply;
          },
        }
      : game;
    const { failed } = replay(steps, watched, (ms) => (moved += ms), undefined); // off the browser: no budget
    return { failed };
  } finally {
    sql.close();
  }
}

/** The checkpoint files in `source`, by name, in a fixed order. */
export function names(source: string): string[] {
  const dir = join(source, 'checkpoints');
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .sort()
    : [];
}

/** One checkpoint file's steps; `undefined` when the file is not one, which R1's verdict says. */
export function stepsOf(source: string, file: string): Step[] | undefined {
  try {
    const { steps } = JSON.parse(readFileSync(join(source, 'checkpoints', file), 'utf8')) as {
      steps: Step[];
    };
    return Array.isArray(steps) ? steps : undefined;
  } catch {
    return undefined; // unreadable is not a checkpoint either
  }
}

/** Why this checkpoint does not replay, or `undefined` when it does. A file that is not a
 * checkpoint, or a cartridge that does not load, is the reason: the editor must not hide either. */
export function replayed1(source: string, file: string, bundled: Bundled): string | undefined {
  try {
    const steps = stepsOf(source, file);
    if (!steps || !steps.length)
      throw new Error('a checkpoint is {"steps": [...]} with at least one step');
    return replayed(bundled, steps);
  } catch (e) {
    return `not replayed (${(e as Error).message})`;
  }
}

/** `replay`'s `failed` words as R1's shape: the step number it names, and the rest as its reason.
 * `replay` says `step 4 (advance 100): ...`, so the reason drops its own leading "step N:", which
 * would otherwise print twice under the row's step number. */
export function verdict(name: string, failure: string | undefined): Checked {
  if (!failure) return { name, ok: true };
  const m = /^step (\d+)(?: \([^)]*\))?: ([\s\S]*)$/.exec(failure);
  return m
    ? { name, ok: false, step: Number(m[1]), why: m[2] }
    : { name, ok: false, step: 0, why: failure };
}

/** Every checkpoint in a cartridge, replayed on the artifact the compile just made. A cartridge
 * with no checkpoints answers `[]`: nothing to re-test is not a failure. */
export function checkpoints(source: string, bundled: Bundled): Checked[] {
  return names(source).map((file) => verdict(file.slice(0, -5), replayed1(source, file, bundled)));
}
