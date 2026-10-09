// `bin/loka dev <cartridge dir> [--watch]` (docs/BUILDERS-GUIDE.md#preview-an-edit): compiles the
// cartridge, checks that the kernel loads it, then replaces the author preview's artifact
// (mobile/app/metro.config.js), which Metro reloads. A failed compile or load says why and leaves the last
// good artifact in place. LOKA_DEV_CARTRIDGE (set by tests; `npm run author` sets it for Metro
// inline, never export it) moves the artifact.
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  watch,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { INSTALLED, loadCartridge } from '../src/index.ts';

const root = resolve(import.meta.dirname, '../../..');
const out = resolve(
  root,
  'mobile/app',
  process.env.LOKA_DEV_CARTRIDGE ?? '.dev-cartridge/current.json',
);
const [dir, flag, ...rest] = process.argv.slice(2);
if (!dir || (flag !== undefined && flag !== '--watch') || rest.length) {
  console.error('usage: bin/loka dev <cartridge dir> [--watch]');
  process.exit(2);
}
const source = resolve(dir);

// A compiler diagnostic or warning (one JSON line, mix loka.compile) in plain words.
function plain(line: string): string {
  try {
    const d = JSON.parse(line) as {
      severity?: string;
      path?: string;
      code?: string;
      data?: object;
    };
    const data = Object.entries(d.data ?? {}).map(([k, v]) => `${k} ${JSON.stringify(v)}`);
    const what = (d.code ?? 'unknown problem').toLowerCase().replaceAll('_', ' ');
    return `${d.severity ?? 'error'} at ${d.path || 'the cartridge'}: ${what}${data.length ? ` (${data.join(', ')})` : ''}`;
  } catch {
    return line;
  }
}

function build(): boolean {
  const started = performance.now();
  const tmp = mkdtempSync(join(tmpdir(), 'loka-dev-'));
  try {
    const artifact = join(tmp, 'artifact.json');
    const run = spawnSync('mise', ['exec', '--', 'mix', 'loka.compile', source, artifact], {
      cwd: root,
      encoding: 'utf8',
    });
    const said = `${run.stderr ?? ''}`.split('\n').filter((l) => l.startsWith('{'));
    for (const line of said) console.error(plain(line));
    if (run.status !== 0) {
      if (!said.length) console.error(run.error?.message ?? run.stderr);
      console.error(`Not compiled; the preview keeps the last good cartridge.`);
      return false;
    }
    const bytes = readFileSync(artifact);
    const loaded = loadCartridge(bytes, INSTALLED);
    const parts = /^\{"cartridge":(.*),"content_hash":"([0-9a-f]{64})"\}$/s.exec(bytes.toString());
    if (!loaded.ok || !parts) {
      // the app rebuilds exactly these bytes from {canonical, sha256} (session.ts cartridgeOf)
      const why = loaded.ok ? 'not in canonical artifact form' : JSON.stringify(loaded);
      console.error(`The kernel refuses the compiled cartridge: ${why}`);
      console.error(`The preview keeps the last good cartridge.`);
      return false;
    }
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(`${out}.tmp`, JSON.stringify({ canonical: parts[1], sha256: parts[2] }));
    renameSync(`${out}.tmp`, out); // Metro never reads half a file
    console.log(
      `Preview updated: ${parts[2].slice(0, 12)} in ${Math.round(performance.now() - started)} ms`,
    );
    return true;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

const ok = build();
if (flag !== '--watch') process.exit(ok ? 0 : 1);
let timer: ReturnType<typeof setTimeout> | undefined;
watch(source, { recursive: true }, () => {
  clearTimeout(timer);
  // one build for an editor's burst of writes; a thrown build must not end the watch
  timer = setTimeout(() => {
    try {
      build();
    } catch (e) {
      console.error(`Not updated: ${(e as Error).message}`);
    }
  }, 100);
});
console.log(`Watching ${dir}`);
