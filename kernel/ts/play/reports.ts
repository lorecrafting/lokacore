// The pacing and fight reports on the dev artifact, run as child processes under a time limit
// (kernel/ts/play/live.ts serves them). `fights` alone skips the pacing sim, which takes minutes
// (loka-wfrgk.79); `wield` is an item key, so every fight is fought with that weapon in hand
// (docs/rnd/gui-editor-design-2026-11-04.md §4.2).
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { artifactBytes } from './compiled.ts';
import type { Fights, FightsReport, LevelRows, Numbers, PoolsReport, Section } from './numbers.ts';

// The panel waits this long per report: fight.ts --seeds 8 took 46 s on the showcase (M1, loka-wfrgk.79).
const OPTS = { maxBuffer: 256 * 1024 * 1024, killSignal: 'SIGKILL' } as const;

/** A report in a child, so a slow cartridge blocks no other route and is killed at the limit. */
export const limited = <T>(args: string[], seconds: number) =>
  new Promise<Section<T>>((done) => {
    execFile(process.execPath, args, { ...OPTS, timeout: seconds * 1000 }, (e, out, err) => {
      if (e)
        return done({
          why: e.killed
            ? `timed out after ${seconds} s; bin/loka sim <cartridge dir> runs it with no limit`
            : err.trim() || e.message,
        });
      try {
        done({ report: JSON.parse(out) as T });
      } catch (bad) {
        done({ why: `not a report: ${(bad as Error).message}` }); // a throw here kills the watcher
      }
    });
  });

const SECONDS = 90; // the panel waits this long per report: fight.ts --seeds 8 took 46 s on the showcase (M1, loka-wfrgk.79); mutate-skip: a measured limit

export async function numbers(
  artifact: string,
  fights = false,
  wield?: string,
): Promise<Numbers | Fights> {
  const dev = JSON.parse(readFileSync(artifact, 'utf8'));
  const tmp = mkdtempSync(join(tmpdir(), 'loka-numbers-')); // the reports read a compiled artifact
  try {
    const file = join(tmp, 'artifact.json');
    writeFileSync(file, artifactBytes(dev));
    const play = (name: string) => join(import.meta.dirname, name);
    const flag = wield ? ['--wield', wield] : [];
    const fought = limited<FightsReport>(
      [play('fight.ts'), file, '--seeds', '8', ...flag],
      SECONDS,
    );
    if (fights) return { hash: dev.sha256, fights: await fought };
    const pace = [play('sim.ts'), '--artifact', file, '--seeds', '4'];
    const pacing = limited<{ pools: PoolsReport; levels: LevelRows }>(pace, SECONDS);
    return { hash: dev.sha256, pacing: await pacing, fights: await fought };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
