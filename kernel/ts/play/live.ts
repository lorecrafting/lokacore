// Fast loop (docs/system/cartridge.md#author-preview): `bin/loka dev --watch` keeps one loopback
// server-sent-events stream to the open author page. A text-only change travels as an overlay of
// text values over the artifact the page already runs; nothing here writes a file, so the overlay
// can never be bundled. Checkpoints (named recorded paths) are the one thing the page writes, as
// plain files under the source tree's `checkpoints/`, which the compiler skips. The author column
// asks here for a Book line's source (`POST /open`) and the rule explainer (`POST /why`), the
// Story map for its model (`GET /story`, story.ts).
import { execFile, spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INSTALLED, loadCartridge, type Cartridge } from '../src/index.ts';
import { artifactBytes } from './compiled.ts';
import type { FightsReport, LevelRows, Numbers, PoolsReport, Section } from './numbers.ts';
import { replayRecords } from './replay.ts';
import { todo } from './todo.ts';
import { find } from './find.ts';
import { why } from './why.ts';
import { storyRoute } from './story.ts';
import { body, editing, foreign, type Hooks, json } from './editing.ts';
import { openAt } from './prose.ts';
import type { Changed } from './write.ts';
import { sentences } from './why_words.ts';
import { told } from './told.ts';

export type Canonical = { text: Record<string, string> } & Record<string, unknown>;
export type Message = {
  text: Record<string, string>;
  said: string[];
  compiled: boolean;
  lint?: string[];
  diagnostics?: unknown[]; // `mix loka.compile --json`'s, for the cards
  pending?: number; // compiles parked while the editor holds (POST /hold)
  held?: boolean;
  changed?: Changed[]; // sent once with its write or burst, never kept for a later message
  // the lines /edit pushed that the last compile refused (file:line); a good compile clears them
  unconfirmed?: { key: string; at: string }[];
  placeholders?: Record<string, string>; // each `~` key's file:line, from the compile (/line)
  timings?: Timings; // the last compile's, kept like the rest: the editor tells them apart by `at`
};
/** One compile's milliseconds: the compile, then its push or write (a refusal: its notice). */
export type Timings = {
  at: number;
  compile: number;
  publish: number;
  kind: 'prose' | 'structural' | 'refusal';
  sha256?: string; // a structural edit's artifact: the Book's `ready` names it when loaded
};

/** `mix loka.lint`'s findings (`rel: words` for a .json, .scene or .cut source, or `rel details.key: words`, on stderr; a compiler's `warning: ...` is not one) from its exit and stderr; a lint that did not run says so. */
export function lintLines(code: number | null, stderr: string) {
  if (code === 0) return [];
  const found = stderr
    .split('\n')
    .filter((l) => /^([\w./-]+\.(json|scene|cut)|areas\/\w+)[ :]/.test(l));
  return code === 1 && found.length ? found : [`lint failed (exit ${code})`];
}

/** The text values `next` changes against `written` when nothing else differs; else undefined. */
export function textOnly(written: Canonical, next: Canonical): Record<string, string> | undefined {
  const { text: was, ...restWas } = written;
  const { text: now, ...restNow } = next;
  if (JSON.stringify(restWas) !== JSON.stringify(restNow)) return undefined;
  const overlay: Record<string, string> = {};
  // a removed key keeps its old words until the next structural edit; a key still referenced
  // is a compile error the author sees
  for (const [key, value] of Object.entries(now)) if (was[key] !== value) overlay[key] = value;
  return overlay;
}

const NAME = /^\/checkpoints\/([a-z0-9][a-z0-9_-]{0,63})$/; // a file name, never a path

/** `GET /checkpoints` lists names; `GET|PUT /checkpoints/<name>` reads or writes `{steps}`. */
async function checkpoints(
  request: IncomingMessage,
  response: ServerResponse,
  source: string,
  busy: () => boolean,
) {
  const dir = join(source, 'checkpoints');
  if (request.url === '/checkpoints' && request.method === 'GET') {
    const names = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
    return json(response, 200, names.map((f) => f.slice(0, -5)).sort());
  }
  const name = NAME.exec(request.url ?? '')?.[1];
  if (!name) return response.writeHead(404).end();
  const file = join(dir, `${name}.json`);
  if (request.method === 'GET')
    return existsSync(file)
      ? json(response, 200, JSON.parse(readFileSync(file, 'utf8')))
      : response.writeHead(404).end();
  if (request.method !== 'PUT') return response.writeHead(405).end();
  // a checkpoint saved mid /new would land in its snapshot diff, as a write would (write.ts)
  if (busy()) return json(response, 409, 'a /new is running');
  let steps: unknown;
  try {
    steps = (JSON.parse(await body(request)) as { steps?: unknown }).steps;
  } catch {}
  if (!Array.isArray(steps)) return json(response, 400, 'a checkpoint is {"steps": [...]}');
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, `${JSON.stringify({ steps }, null, 2)}\n`);
  return response.writeHead(204).end();
}

/** The rows of the last run in a trace table dump (a start over begins a new run; the explainer
 * takes one run). */
export function lastRun(rows: string[]) {
  for (let i = rows.length - 1; i >= 0; i--)
    if (rows[i].includes('"event":"trace.run"')) return rows.slice(i);
  return []; // rows without a header are not a run
}

type Asked = { action?: string; dialogue?: string };
// The explainer's report for the last step of `rows`' run, on the artifact the page runs.
function explain(artifact: string, rows: string[], on: Asked) {
  const run = lastRun(rows);
  if (!run.length) throw new Error('no run in the trace');
  const dev = JSON.parse(readFileSync(artifact, 'utf8'));
  const { sha256 } = dev;
  const loaded = loadCartridge(artifactBytes(dev), INSTALLED);
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.diagnostic));
  const tmp = mkdtempSync(join(tmpdir(), 'loka-why-')); // replayRecords reads a file
  try {
    const path = join(tmp, 'trace.jsonl');
    writeFileSync(path, `${run.join('\n')}\n`);
    const trace = replayRecords(path, sha256);
    if (!trace.entries.length) throw new Error('Take a step in the Book first.');
    const report = why(loaded.cartridge as Cartridge, trace, trace.entries.length, {
      ...on,
      now: true,
    });
    const told = on.action !== undefined ? report.action : report.dialogue;
    return { ...report, lines: sentences(told) };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

type Sent = Asked & { key?: string; words?: string; trace?: string[] };
/** `POST /open {key, words}` opens the line's source in `LOKA_EDITOR` (default `code --goto`; a
 * command and its flags split on spaces, no shell) and answers `rel:line`; `POST /why {trace,
 * action?, dialogue?}` answers the explainer's report. Only the author's own page may post: a
 * cross-site page's simple POST would carry its Origin and run the editor. */
async function post(
  request: IncomingMessage,
  response: ServerResponse,
  source: string,
  artifact: string,
) {
  let sent: Sent;
  try {
    sent = JSON.parse(await body(request));
  } catch {
    return json(response, 400, 'a JSON body');
  }
  if (request.url === '/open') {
    const at = openAt(source, sent);
    if (!at) return json(response, 404, `no source line for ${sent.key ?? sent.words}`);
    const [editor, ...flags] = (process.env.LOKA_EDITOR ?? 'code --goto').split(' ');
    spawn(editor, [...flags, join(source, at)], { stdio: 'ignore', detached: true })
      .on('error', () => {}) // a missing editor is not the page's problem; the line is answered
      .unref();
    return json(response, 200, at);
  }
  try {
    return json(
      response,
      200,
      explain(artifact, sent.trace ?? [], { action: sent.action, dialogue: sent.dialogue }),
    );
  } catch (e) {
    return json(response, 400, (e as Error).message);
  }
}

const SECONDS = 90; // the panel waits this long per report: fight.ts --seeds 8 took 46 s on the showcase (M1, loka-wfrgk.79); mutate-skip: a measured limit
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

async function numbers(artifact: string): Promise<Numbers> {
  const dev = JSON.parse(readFileSync(artifact, 'utf8'));
  const tmp = mkdtempSync(join(tmpdir(), 'loka-numbers-')); // the reports read a compiled artifact
  try {
    const file = join(tmp, 'artifact.json');
    writeFileSync(file, artifactBytes(dev));
    const play = (name: string) => join(import.meta.dirname, name);
    const [pacing, fought] = await Promise.all([
      limited<{ pools: PoolsReport; levels: LevelRows }>(
        [play('sim.ts'), '--artifact', file, '--seeds', '4'],
        SECONDS,
      ),
      limited<FightsReport>([play('fight.ts'), file, '--seeds', '8'], SECONDS),
    ]);
    return { hash: dev.sha256, pacing, fights: fought };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

const asked = (url: string) => new URL(url, 'http://x').searchParams.get('q') ?? '';

const reply = (response: ServerResponse, artifact: string) =>
  numbers(artifact).then((n) => json(response, 200, n));

/** The column's routes, or false for a request that is not one. */
function column(
  request: IncomingMessage,
  response: ServerResponse,
  source: string,
  artifact: string,
  busy: () => boolean,
) {
  if (request.url?.startsWith('/checkpoints')) return checkpoints(request, response, source, busy);
  if (request.url === '/todo') return json(response, 200, todo(source));
  if (request.url === '/numbers') return reply(response, artifact);
  if (request.url?.startsWith('/find?'))
    return json(response, 200, find(source, artifact, asked(request.url)));
  if (request.method === 'POST' && (request.url === '/open' || request.url === '/why'))
    return post(request, response, source, artifact);
  return false;
}

/** A watcher's close, and the port it bound: a test passes 0 for a free one (random ones collided). */
const bound = (server: Server) => ({
  close: () => server.close(),
  port: new Promise<number>((done) =>
    server.once('listening', () => done((server.address() as AddressInfo).port)),
  ),
});

/** Serves `GET /events` (each client gets the current message on connect and every push after),
 * the checkpoint routes over `source`, `GET /todo` (todo.ts), `GET /find?q=` (find.ts), `GET /numbers`, the column's `POST /open` and
 * `POST /why`, `GET /story` (story.ts), and the editor's routes (editing.ts) after its Host and Origin checks. */
export function serve(port: number, source: string, artifact: string, on: Hooks = {}) {
  const clients = new Set<ServerResponse>();
  let last: Message = { text: {}, said: [], compiled: true };
  const send = (client: ServerResponse, once = {}) =>
    client.write(`data: ${JSON.stringify({ ...last, ...once })}\n\n`);
  const map = storyRoute(source, artifact);
  const said = told((message) => {
    last = { ...last, ...message };
    // §7: a Hold serves the last whole model; a compile's pushes, or the release, make a new one.
    if (last.held) map.keep(last.diagnostics ?? []);
    else if ('compiled' in message || 'diagnostics' in message || 'held' in message) map.stale();
    for (const client of clients) send(client);
  }, source);
  const editor = editing(source, said, (o) => clients.forEach((c) => send(c, o)), on, artifact);
  const route = async (request: IncomingMessage, response: ServerResponse) => {
    if (foreign(request, response) || (await editor.route(request, response))) return;
    if (request.url === '/story') return map.answer(request, response, last.diagnostics ?? []);
    const answered = column(request, response, source, artifact, editor.busy);
    if (answered !== false) return answered;
    if (request.url !== '/events') return response.writeHead(404).end();
    response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    send(response);
    clients.add(response);
    request.on('close', () => clients.delete(response));
  };
  // A bad file is the author's to fix, not the watcher's to die of; a throw after an answer: logged.
  const server = createServer((request, response) =>
    Promise.resolve()
      .then(() => route(request, response))
      .catch((e) =>
        response.headersSent ? console.error(e) : response.writeHead(500).end(`${e}`),
      ),
  )
    .on('error', (e: NodeJS.ErrnoException) => {
      console.error(`author stream: port ${port} ${e.code}; set LOKA_AUTHOR_PORT to a free port`);
      process.exit(1);
    })
    .listen(port, '127.0.0.1');
  return { push: said.push, held: editor.held, seen: editor.seen, ...bound(server) };
}
