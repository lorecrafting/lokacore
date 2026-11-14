// The R1 replay as a child process: `author.ts` runs it after a good compile so a slow path never
// holds the watcher's event loop (SQLite and `replay` are synchronous). Reads one JSON argv and
// prints `{checked, covered}` as JSON on stdout, and always exits 0: a failure to check is the
// caller's to show, not a crash. `{source, canonical, sha256}` is the artifact the compile just made.
//
// `covered` (R2, docs/design/story-tooling.md `### R2`) rides the same child for the same reason, and
// replays each checkpoint a second time against a marked copy, because a reaction's firing is only
// visible in `narration` (coverage.ts:20-24). The spec's known limit takes that cost.
import { readFileSync } from 'node:fs';
import { loadCartridge } from '../src/index.ts';
import { INSTALLED } from '../src/index.ts';
import { artifactBytes } from './compiled.ts';
import { checkpoints } from './checkpoints.ts';
import { covered } from './covered.ts';
import type { Checked } from './checkpoints.ts';
import type { Covered } from './covered.ts';

const [file, ...rest] = process.argv.slice(2);
if (!file || rest.length) {
  console.error('usage: node check_child.ts <request.json>');
  process.exit(2);
}
let out: { checked: Checked[]; covered: Covered } | string;
try {
  const { source, canonical, sha256 } = JSON.parse(readFileSync(file, 'utf8')) as {
    source: string;
    canonical: string;
    sha256: string;
  };
  const bundled = { canonical, sha256 };
  const loaded = loadCartridge(artifactBytes(bundled), INSTALLED);
  out = loaded.ok
    ? { checked: checkpoints(source, bundled), covered: covered(source, bundled) }
    : 'the compiled artifact does not load';
} catch (e) {
  out = (e as Error).message;
}
console.log(JSON.stringify(out));
