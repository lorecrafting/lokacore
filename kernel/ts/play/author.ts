// `bin/loka dev <cartridge dir> [--watch]` (docs/BUILDERS-GUIDE.md#preview-an-edit): compiles the
// cartridge, checks that the kernel loads it, then replaces the author preview's artifact
// (mobile/app/metro.config.js), which Metro reloads. A failed compile or load says why and leaves the last
// good artifact in place. LOKA_DEV_CARTRIDGE (set by tests; `npm run author` sets it for Metro
// inline, never export it) moves the artifact. With --watch, a change that only alters text
// values (a `text.json` save at once, any other save after its compile) goes to the open page as
// an overlay over the written artifact (play/live.ts): no reload, no replay.
import { spawn, type ChildProcess } from 'node:child_process';
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
import { createInterface } from 'node:readline';
import { dirname, join, resolve } from 'node:path';
import { INSTALLED, loadCartridge } from '../src/index.ts';
import { lintLines, serve, textOnly, type Canonical, type Timings } from './live.ts';

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
const port = Number(process.env.LOKA_AUTHOR_PORT || 19008); // mutate-skip: dev port default
const live =
  flag === '--watch'
    ? serve(port, source, out, () => {
        if (!parked) return;
        write(...parked);
        if (failed) notCompiled(failed); // the source on disk is the failed save's, not the parked
      })
    : undefined;
// While the editor holds (POST /hold), a structural compile waits here, and every compile after
// it (the newest replaces it), so Metro does not reload the frame mid-edit.
let parked: [canonicalText: string, sha256: string, said: string[]] | undefined;
let pending = 0; // mutate-skip: the startup write resets it before any Hold can start
// the canonical the page runs (the written artifact), the base of every overlay
let written: Canonical | undefined = existsSync(out)
  ? JSON.parse(JSON.parse(readFileSync(out, 'utf8')).canonical)
  : undefined;

const keeps = 'the preview keeps the last good cartridge.';
// A `text.json` save shows before its compile: the written words, overlaid with the file's.
function quick() {
  if (!written || parked) return;
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
const timed = (started: number, compiled: number, kind: Timings['kind'], sha256?: string) => ({
  at: Date.now(),
  compile: Math.round(compiled - started),
  publish: Math.round(performance.now() - compiled),
  kind,
  ...(sha256 && { sha256 }),
});
function publish(
  canonicalText: string,
  sha256: string,
  said: string[],
  started: number,
  compiled: number,
) {
  failed = undefined;
  const ms = () => `in ${Math.round(performance.now() - started)} ms`;
  const canonical: Canonical = JSON.parse(canonicalText);
  const overlay = live && written ? textOnly(written, canonical) : undefined;
  if (live?.held() && (parked || !overlay)) {
    parked = [canonicalText, sha256, said];
    live.push({ said, compiled: true, pending: ++pending });
    console.log(`Held: ${pending} changes wait ${ms()}`);
    return true;
  }
  if (overlay) {
    live!.push({ text: overlay, said, compiled: true, timings: timed(started, compiled, 'prose') });
    const n = Object.keys(overlay).length;
    console.log(n ? `Text updated in place: ${n} keys ${ms()}` : `Preview unchanged ${ms()}`);
    return true;
  }
  write(canonicalText, sha256, said, timed(started, compiled, 'structural', sha256));
  console.log(`Preview updated: ${sha256.slice(0, 12)} ${ms()}`); // mutate-skip: console notice
  return true;
}
function write(canonicalText: string, sha256: string, said: string[], timings?: Timings) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(`${out}.tmp`, JSON.stringify({ canonical: canonicalText, sha256 }));
  renameSync(`${out}.tmp`, out); // Metro never reads half a file
  written = JSON.parse(canonicalText);
  parked = undefined;
  pending = 0;
  live?.push({ text: {}, said, compiled: true, pending, ...(timings && { timings }) });
}
// The preview allows `~` placeholders; a release compile refuses them (mix loka.compile). Not
// spawnSync: the watcher answers /source, /events and writes while it runs.
const args = (artifact: string) => [
  source,
  artifact,
  '--allow-placeholders',
  '--json',
  diagnostics(artifact),
  '--placeholders',
  placeholders(artifact),
];
type Run = { status: number | null; stderr: string; error?: Error };
const oneShot = (artifact: string) =>
  new Promise<Run>((done) => {
    let stderr = '';
    const run = spawn('mise', ['exec', '--', 'mix', 'loka.compile', ...args(artifact)], {
      cwd: root,
      stdio: ['ignore', 'ignore', 'pipe'], // a launcher may have closed stdin (EBADF otherwise)
    });
    let error: Error | undefined;
    run.stderr.on('data', (chunk) => (stderr += chunk));
    run.on('error', (e) => (error = e)); // `close` follows
    run.on('close', (status) => done({ status, stderr, error }));
  });
// With --watch, a resident `mix loka.compile --serve` takes each compile (no BEAM boot per save):
// one request at a time (the queue), so its one reply line is the request's. When it dies, wedges
// or halts (it does when lib/ changed since its start), or is not up yet (the first build), that
// compile runs one-shot and a new one starts.
const WEDGED_MS = 60_000; // mutate-skip: far past a cold showcase compile on a loaded machine
let resident: ChildProcess | undefined;
let answer: ((line?: string) => void) | undefined;
function start() {
  const run = spawn('mise', ['exec', '--', 'mix', 'loka.compile', '--serve'], {
    cwd: root,
    stdio: ['pipe', 'pipe', 'ignore'],
  });
  createInterface({ input: run.stdout }).on('line', (line) => {
    if (line.startsWith('loka.compile ')) answer?.(line.slice(13));
  });
  run.stdin.on('error', () => {}); // a dead one: `close` answers
  run.on('error', () => {});
  run.on('close', () => {
    if (resident !== run) return;
    resident = undefined;
    answer?.();
  });
  resident = run;
}
const served = (artifact: string) =>
  new Promise<string | undefined>((done) => {
    const run = resident;
    if (!run) return done(undefined);
    const wedged = setTimeout(() => answer?.(), WEDGED_MS);
    answer = (line) => {
      clearTimeout(wedged);
      answer = undefined;
      if (line === undefined && resident === run) {
        resident = undefined; // never reused: a late reply would answer the next compile
        run.kill('SIGKILL');
      }
      done(line);
    };
    run.stdin!.write(`${args(artifact).join('\t')}\n`);
  });
async function compile(artifact: string): Promise<Run> {
  const line = await served(artifact);
  if (line !== undefined) return JSON.parse(line);
  const run = await oneShot(artifact);
  if (live) start();
  return run;
}
const diagnostics = (artifact: string) => join(dirname(artifact), 'diagnostics.json');
const placeholders = (artifact: string) => join(dirname(artifact), 'placeholders.json');
const parsed = (file: string, none: unknown) =>
  existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : none;
// The last lint read older source, so it goes with the failed compile.
let failed: string[] | undefined; // the last compile's lines, when it failed
const notCompiled = (said: string[], timings?: Timings) => {
  failed = said;
  live?.push({ said, compiled: false, lint: undefined, ...(timings && { timings }) });
};

async function build(): Promise<boolean> {
  const started = performance.now();
  const tmp = mkdtempSync(join(tmpdir(), 'loka-dev-'));
  try {
    const artifact = join(tmp, 'artifact.json');
    const read = saves;
    const run = await compile(artifact);
    const compiled = performance.now();
    // a save since (even inside the debounce) compiles next: these older words would undo its push
    if (saves !== read) return false;
    // none written (mix crashed before it): the last build's cards must not stay up
    live?.push({
      diagnostics: parsed(diagnostics(artifact), []),
      placeholders: parsed(placeholders(artifact), {}),
    });
    const said = run.stderr.split('\n').filter((l) => /^(error|warning|info): /.test(l));
    for (const line of said) console.error(line);
    if (run.status !== 0) {
      if (!said.length) said.push(run.error?.message ?? run.stderr);
      said.push(`Not compiled; ${keeps}`);
      console.error(said.at(-1));
      notCompiled(said, timed(started, compiled, 'refusal'));
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
      notCompiled(said, timed(started, compiled, 'refusal'));
      return false;
    }
    return publish(parts[1], parts[2], said, started, compiled);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// The lint under the compile: not waited for, so a save's words and compile never wait on it; only
// the newest run reports, and a save that follows (whether its compile passes or not) retires the
// one in flight, so the last good source's findings never show after a failed compile.
let lints = 0;
function lint() {
  const mine = ++lints;
  let stderr = '';
  const run = spawn('mise', ['exec', '--', 'mix', 'loka.lint', source], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  run.stderr.on('data', (chunk) => (stderr += chunk));
  run.on('error', () => {}); // `close` follows with the failure's code
  run.on('close', (code) => {
    if (mine === lints) live!.push({ lint: lintLines(code, stderr) });
  });
}

// One compile at a time, in save order; a save while one waits is in the waiting one's source.
let queue: Promise<unknown> = Promise.resolve();
let waiting = false;
let saves = 0;
function enqueue() {
  if (waiting) return;
  waiting = true;
  queue = queue
    .then(() => {
      waiting = false;
      return build();
    })
    .then((ok) => ok && lint())
    .catch((e) => console.error(`Not updated: ${(e as Error).message}`)); // a thrown build must not end the watch
}
let timer: ReturnType<typeof setTimeout> | undefined;
// before the first compile: a save the moment its artifact lands is not lost while FSEvents starts
if (flag === '--watch')
  watch(source, { recursive: true }, (_, file) => {
    if (file?.startsWith('checkpoints/')) return; // the page's own save, not content
    saves++;
    clearTimeout(timer);
    // one build for an editor's burst of writes
    timer = setTimeout(() => {
      live!.seen(); // what changed outside the editor, before its compile
      lints++;
      quick();
      enqueue();
    }, 100);
  });
const first = build();
queue = first.catch(() => {}); // a save during the first compile compiles after it
const ok = await first;
if (flag !== '--watch') process.exit(ok ? 0 : 1);
if (ok) lint();
console.log(`Watching ${dir}, author API on port ${await live!.port}`);
