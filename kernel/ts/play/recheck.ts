// R1's replay as the watcher runs it (docs/design/story-tooling.md §2): after a good compile, in a
// child process (a synchronous SQLite and `replay` would hold the watcher's event loop), cached by
// artifact sha so a retry of the same bytes is not a second replay, and only the newest run reports.
//
// Kept out of author.ts so the watcher module stays about compiling and serving; this is the one
// place that knows a check is a child process.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Checked } from './checkpoints.ts';

const root = resolve(import.meta.dirname, '../../..');
const checked = new Map<string, Checked[]>();
let runs = 0;

/** The artifact sha alone is not the identity of a check: `checkpoints/` is deliberately outside
 * the compiled bytes (lib/loka/content/source_files.ex:15), so editing a path would otherwise
 * replay nothing and keep its old verdict. This folds in each checkpoint file's own bytes. */
export function only(source: string, sha256: string): string {
  const at = join(source, 'checkpoints');
  const h = createHash('sha256').update(sha256);
  for (const name of readdirSync(at).sort()) h.update(name).update(readFileSync(join(at, name)));
  return h.digest('hex');
}

/** The verdicts for this artifact, replaying at most once per sha. A cartridge with no
 * `checkpoints/` answers `[]` at once, so the common case never pays for the child. A check that
 * could not run is one row saying why: never a silent `[]`, which would read as "all fine". */
export function recheck(source: string, canonical: string, sha256: string): Promise<Checked[]> {
  const mine = ++runs;
  if (!existsSync(join(source, 'checkpoints'))) return Promise.resolve([]);
  const key = only(source, sha256);
  const cached = checked.get(key);
  if (cached) return Promise.resolve(cached);
  const tmp = mkdtempSync(join(tmpdir(), 'loka-check-'));
  const request = join(tmp, 'request.json');
  writeFileSync(request, JSON.stringify({ source, canonical, sha256 }));
  return new Promise<Checked[]>((done) => {
    let out = '';
    const run = spawn(process.execPath, [join(import.meta.dirname, 'check_child.ts'), request], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'ignore'], // stdin ignored: the child reads its request from the file
    });
    run.stdout.on('data', (chunk) => (out += chunk));
    run.on('error', () => {}); // `close` follows with the failure's code
    run.on('close', () => {
      rmSync(tmp, { recursive: true, force: true });
      const result = read(out);
      if (result.length) checked.set(key, result);
      if (mine === runs) done(result); // an older run's answer is spent
    });
  });
}

/** The child's stdout as verdicts. Its own words, or no words, become the one failing row. */
function read(out: string): Checked[] {
  try {
    const parsed = JSON.parse(out) as Checked[] | string;
    return Array.isArray(parsed)
      ? parsed
      : [{ name: 'checkpoints', ok: false, step: 0, why: parsed }];
  } catch {
    return [{ name: 'checkpoints', ok: false, step: 0, why: 'the check did not answer' }];
  }
}
