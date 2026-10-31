// Fast loop (docs/system/cartridge.md#author-preview): `bin/loka dev --watch` keeps one loopback
// server-sent-events stream to the open author page. A text-only change travels as an overlay of
// text values over the artifact the page already runs; nothing here writes a file, so the overlay
// can never be bundled. Checkpoints (named recorded paths) are the one thing the page writes, as
// plain files under the source tree's `checkpoints/`, which the compiler skips. The author column
// asks here for a Book line's source (`POST /open`) and the rule explainer (`POST /why`).
import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INSTALLED, loadCartridge, type Cartridge } from '../src/index.ts';
import { replayRecords } from './replay.ts';
import { why } from './why.ts';

export type Canonical = { text: Record<string, string> } & Record<string, unknown>;
export type Message = { text: Record<string, string>; said: string[] };

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
const json = (response: ServerResponse, status: number, body: unknown) =>
  response.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
async function body(request: IncomingMessage) {
  let text = '';
  for await (const chunk of request) text += chunk;
  return text;
}

/** `GET /checkpoints` lists names; `GET|PUT /checkpoints/<name>` reads or writes `{steps}`. */
async function checkpoints(request: IncomingMessage, response: ServerResponse, source: string) {
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
  let steps: unknown;
  try {
    steps = (JSON.parse(await body(request)) as { steps?: unknown }).steps;
  } catch {}
  if (!Array.isArray(steps)) return json(response, 400, 'a checkpoint is {"steps": [...]}');
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, `${JSON.stringify({ steps }, null, 2)}\n`);
  return response.writeHead(204).end();
}

// The source tree's regular files, relative, text.json first (a key's definition beats a mention).
const files = (dir: string, under = ''): string[] =>
  readdirSync(join(dir, under), { withFileTypes: true })
    .flatMap((f) => (f.isDirectory() ? files(dir, join(under, f.name)) : join(under, f.name)))
    .filter((rel) => !rel.startsWith('checkpoints/'))
    .sort() // readdir order differs by platform
    .sort((a, b) => Number(b === 'text.json') - Number(a === 'text.json'));

/** `rel:line` of the first line defining `key` (`"key":`), else of the first holding `words` as a
 * JSON string (inline prose has no key in the source); undefined when neither is in `source`. */
export function sourceOf(source: string, key: string, words?: string) {
  const all = files(source);
  const find = (needle: string) => {
    for (const rel of all) {
      const i = readFileSync(join(source, rel), 'utf8')
        .split('\n')
        .findIndex((l) => l.includes(needle));
      if (i >= 0) return `${rel}:${i + 1}`;
    }
  };
  return find(`"${key}":`) ?? (words === undefined ? undefined : find(JSON.stringify(words)));
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
  const { canonical, sha256 } = JSON.parse(readFileSync(artifact, 'utf8'));
  // the app rebuilds exactly these bytes from {canonical, sha256} (session.ts cartridgeOf)
  const bytes = Buffer.from(`{"cartridge":${canonical},"content_hash":"${sha256}"}`);
  const loaded = loadCartridge(bytes, INSTALLED);
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.diagnostic));
  const tmp = mkdtempSync(join(tmpdir(), 'loka-why-')); // replayRecords reads a file
  try {
    const path = join(tmp, 'trace.jsonl');
    writeFileSync(path, `${run.join('\n')}\n`);
    const trace = replayRecords(path, sha256);
    return why(loaded.cartridge as Cartridge, trace, trace.entries.length, on);
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
  const origin = request.headers.origin;
  if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
    return json(response, 403, `not from the author page: ${origin}`);
  let sent: Sent;
  try {
    sent = JSON.parse(await body(request));
  } catch {
    return json(response, 400, 'a JSON body');
  }
  if (request.url === '/open') {
    const at = sourceOf(source, String(sent.key), sent.words);
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

/** Serves `GET /events` (each client gets the current message on connect and every push after),
 * the checkpoint routes over `source`, and the column's `POST /open` and `POST /why`. */
export function serve(port: number, source: string, artifact: string) {
  const clients = new Set<ServerResponse>();
  let last: Message = { text: {}, said: [] };
  const send = (client: ServerResponse) => client.write(`data: ${JSON.stringify(last)}\n\n`);
  const server = createServer((request, response) => {
    if (request.url?.startsWith('/checkpoints')) return void checkpoints(request, response, source);
    if (request.method === 'POST' && (request.url === '/open' || request.url === '/why'))
      return void post(request, response, source, artifact);
    if (request.url !== '/events') return response.writeHead(404).end();
    response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    send(response);
    clients.add(response);
    request.on('close', () => clients.delete(response));
  })
    .on('error', (e: NodeJS.ErrnoException) => {
      console.error(`author stream: port ${port} ${e.code}; set LOKA_AUTHOR_PORT to a free port`);
      process.exit(1);
    })
    .listen(port, '127.0.0.1');
  return {
    push(message: Partial<Message>) {
      last = { ...last, ...message };
      for (const client of clients) send(client);
    },
    close: () => server.close(),
  };
}
