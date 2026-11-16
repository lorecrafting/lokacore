// The compile step (kernel/ts/play/author.ts uses it): one `mix loka.compile`, either as a resident
// `--serve` process with --watch, or one-shot. Kept apart from the watcher's own logic so each file
// stays about one job.
import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const MIX = ['exec', '--', 'mix', 'loka.compile'];
/** The grep-able name of an error that has not run: `lint` and the editor pass it on. */
export type Run = { status: number | null; stderr: string; error?: Error };
export const args = (source: string, artifact: string) => [
  source,
  artifact,
  '--allow-placeholders',
  '--json',
  join(dirname(artifact), 'diagnostics.json'),
  '--placeholders',
  join(dirname(artifact), 'placeholders.json'),
];

function oneShot(source: string, artifact: string): Promise<Run> {
  return new Promise<Run>((done) => {
    let stderr = '';
    const run = spawn('mise', [...MIX, ...args(source, artifact)], {
      cwd: root,
      stdio: ['ignore', 'ignore', 'pipe'], // a launcher may have closed stdin (EBADF otherwise)
    });
    let error: Error | undefined;
    run.stderr.on('data', (chunk) => (stderr += chunk));
    run.on('error', (e) => (error = e)); // `close` follows
    run.on('close', (status) => done({ status, stderr, error }));
  });
}

// A resident `--serve` takes each compile one at a time (the caller's queue serialises them).
// Dead, wedged, halted (lib/ changed) or not up yet: that compile runs one-shot, a new one starts.
const WEDGED_MS = 60_000; // mutate-skip: far past a cold showcase compile on a loaded machine

/** The resident child, or undefined after it dies (never reused: a late reply would answer the
 * next compile). `ask` resolves to the reply line, or undefined when the child could not answer. */
function resident(source: string) {
  let run: ChildProcess | undefined, answer: ((line?: string) => void) | undefined;
  const start = () => {
    const child = spawn('mise', [...MIX, '--serve'], {
      cwd: root,
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    createInterface({ input: child.stdout }).on('line', (line) => {
      if (line.startsWith('loka.compile ')) answer?.(line.slice(13));
    });
    child.on('error', () => {}).stdin.on('error', () => {}); // a dead one: `close` answers
    child.on('close', () => {
      if (run !== child) return;
      run = undefined;
      answer?.();
    });
    run = child;
  };
  const ask = (artifact: string) =>
    new Promise<string | undefined>((done) => {
      const child = run;
      if (!child) return done(undefined);
      const wedged = setTimeout(() => answer?.(), WEDGED_MS);
      answer = (line) => {
        clearTimeout(wedged);
        answer = undefined;
        if (line === undefined) {
          run = undefined;
          child.kill('SIGKILL');
        }
        done(line);
      };
      child.stdin!.write(`${args(source, artifact).join('\t')}\n`);
    });
  return { start, ask };
}

/** One compile of `source`, answering the failure's `Run` words or the served reply line. */
export function compiler(source: string, live: boolean) {
  const serve = resident(source);
  return async (artifact: string): Promise<Run> => {
    const line = await serve.ask(artifact);
    if (line !== undefined) return JSON.parse(line);
    const run = await oneShot(source, artifact);
    if (live) serve.start();
    return run;
  };
}
