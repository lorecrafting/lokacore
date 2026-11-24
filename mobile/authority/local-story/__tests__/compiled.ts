// A source cartridge compiled by the Elixir compiler, as the session's Bundled (Book tests).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { story } from '../../../../kernel/ts/play/story.ts';
import { encode } from '../../../../kernel/ts/src/foundation/canonical.ts';

const root = fileURLToPath(new URL('../../../../', import.meta.url));

export function compiled(dir: string) {
  const scratch = mkdtempSync(join(tmpdir(), 'loka-compiled-'));
  try {
    execFileSync('mix', ['loka.compile', dir, join(scratch, 'a.json')], {
      cwd: root,
      stdio: 'pipe',
    });
    const artifact = JSON.parse(readFileSync(join(scratch, 'a.json'), 'utf8'));
    return { canonical: encode(artifact.cartridge), sha256: artifact.content_hash as string };
  } finally {
    rmSync(scratch, { recursive: true });
  }
}

/** The author server's /story map of a source cartridge (Build map tests). */
export const storyMap = (dir: string) => story(join(root, dir), compiled(dir), []).map;
