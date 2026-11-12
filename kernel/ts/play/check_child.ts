// The R1 replay as a child process: `author.ts` runs it after a good compile so a slow path never
// holds the watcher's event loop (SQLite and `replay` are synchronous). Reads one JSON argv, prints
// the `Checked[]` as JSON on stdout, and always exits 0: a failure to check is the caller's to show,
// not a crash. `{source, canonical, sha256}` is the artifact the compile just made.
import { readFileSync } from 'node:fs';
import { loadCartridge } from '../src/index.ts';
import { INSTALLED } from '../src/index.ts';
import { artifactBytes } from './compiled.ts';
import { checkpoints } from './checkpoints.ts';
import type { Checked } from './checkpoints.ts';

const [file, ...rest] = process.argv.slice(2);
if (!file || rest.length) {
  console.error('usage: node check_child.ts <request.json>');
  process.exit(2);
}
let out: Checked[] | string;
try {
  const { source, canonical, sha256 } = JSON.parse(readFileSync(file, 'utf8')) as {
    source: string;
    canonical: string;
    sha256: string;
  };
  const bundled = { canonical, sha256 };
  const loaded = loadCartridge(artifactBytes(bundled), INSTALLED);
  out = loaded.ok ? checkpoints(source, bundled) : 'the compiled artifact does not load';
} catch (e) {
  out = (e as Error).message;
}
console.log(JSON.stringify(out));
