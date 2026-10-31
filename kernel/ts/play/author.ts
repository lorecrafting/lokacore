// `bin/loka dev <cartridge dir> [--watch]` (docs/BUILDERS-GUIDE.md#preview-an-edit): compiles the
// cartridge, checks that the kernel loads it, then replaces the author preview's artifact
// (mobile/app/metro.config.js), which Metro reloads. A failed compile or load says why and leaves the last
// good artifact in place. LOKA_DEV_CARTRIDGE (set by tests; `npm run author` sets it for Metro
// inline, never export it) moves the artifact. With --watch, a change that only alters text
// values (a `text.json` save at once, any other save after its compile) goes to the open page as
// an overlay over the written artifact (play/live.ts): no reload, no replay.
import { spawnSync } from 'node:child_process';
import {
  existsSync,
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
import { serve, textOnly, type Canonical } from './live.ts';

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
const live =
  flag === '--watch'
    ? serve(Number(process.env.LOKA_AUTHOR_PORT || 19008), source, out)
    : undefined;
// the canonical the page runs (the written artifact), the base of every overlay
let written: Canonical | undefined = existsSync(out)
  ? JSON.parse(JSON.parse(readFileSync(out, 'utf8')).canonical)
  : undefined;

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

const keeps = 'the preview keeps the last good cartridge.';
// A `text.json` save shows before its compile: the written words, overlaid with the file's.
function quick() {
  if (!written) return;
  try {
    const text = {
      ...written.text,
      ...JSON.parse(readFileSync(join(source, 'text.json'), 'utf8')),
    };
    const overlay = textOnly(written, { ...written, text })!;
    if (Object.keys(overlay).length) live!.push({ text: overlay });
  } catch {
    // not valid JSON yet, or no text.json: the compile says so
  }
}
// A text-only change (against the artifact the page runs) is pushed in place; any other is written.
function publish(canonicalText: string, sha256: string, said: string[], started: number) {
  const ms = () => `in ${Math.round(performance.now() - started)} ms`;
  const canonical: Canonical = JSON.parse(canonicalText);
  const overlay = live && written ? textOnly(written, canonical) : undefined;
  if (overlay) {
    live!.push({ text: overlay, said });
    const n = Object.keys(overlay).length;
    console.log(n ? `Text updated in place: ${n} keys ${ms()}` : `Preview unchanged ${ms()}`);
    return true;
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(`${out}.tmp`, JSON.stringify({ canonical: canonicalText, sha256 }));
  renameSync(`${out}.tmp`, out); // Metro never reads half a file
  written = canonical;
  live?.push({ text: {}, said });
  console.log(`Preview updated: ${sha256.slice(0, 12)} ${ms()}`);
  return true;
}
function build(): boolean {
  const started = performance.now();
  const tmp = mkdtempSync(join(tmpdir(), 'loka-dev-'));
  try {
    const artifact = join(tmp, 'artifact.json');
    const run = spawnSync('mise', ['exec', '--', 'mix', 'loka.compile', source, artifact], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'], // a launcher may have closed stdin (EBADF otherwise)
    });
    const said = `${run.stderr ?? ''}`
      .split('\n')
      .filter((l) => l.startsWith('{'))
      .map(plain);
    for (const line of said) console.error(line);
    if (run.status !== 0) {
      if (!said.length) said.push(run.error?.message ?? run.stderr);
      said.push(`Not compiled; ${keeps}`);
      console.error(said.at(-1));
      live?.push({ said });
      return false;
    }
    const bytes = readFileSync(artifact);
    const loaded = loadCartridge(bytes, INSTALLED);
    const parts = /^\{"cartridge":(.*),"content_hash":"([0-9a-f]{64})"\}$/s.exec(bytes.toString());
    if (!loaded.ok || !parts) {
      // the app rebuilds exactly these bytes from {canonical, sha256} (session.ts cartridgeOf)
      const why = loaded.ok ? 'not in canonical artifact form' : JSON.stringify(loaded);
      said.push(`The kernel refuses the compiled cartridge: ${why}`, keeps);
      console.error(said.slice(-2).join('\n'));
      live?.push({ said });
      return false;
    }
    return publish(parts[1], parts[2], said, started);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

const ok = build();
if (flag !== '--watch') process.exit(ok ? 0 : 1);
let timer: ReturnType<typeof setTimeout> | undefined;
watch(source, { recursive: true }, (_, file) => {
  if (file?.startsWith('checkpoints/')) return; // the page's own save, not content
  clearTimeout(timer);
  // one build for an editor's burst of writes; a thrown build must not end the watch
  timer = setTimeout(() => {
    quick();
    // the page gets the quick words before the compile blocks this process (spawnSync)
    setImmediate(() => {
      try {
        build();
      } catch (e) {
        console.error(`Not updated: ${(e as Error).message}`);
      }
    });
  }, 100);
});
console.log(`Watching ${dir}`);
