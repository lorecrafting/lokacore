// The pacing and fight reports on the dev artifact, run as child processes under a time limit
// (kernel/ts/play/live.ts serves them). `fights` alone skips the pacing sim, which takes minutes
// (loka-wfrgk.79); `wield` is an item key, so every fight is fought with that weapon in hand
// (docs/rnd/gui-editor-design-2026-11-04.md §4.2).
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { limited } from './live.ts';
import { artifactBytes } from './compiled.ts';
import type { Fights, FightsReport, LevelRows, Numbers, PoolsReport } from './numbers.ts';

// The panel waits this long per report: fight.ts --seeds 8 took 46 s on the showcase (M1, loka-wfrgk.79).
const SECONDS = 90; // matches live.ts's, the limit the panel waits

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
