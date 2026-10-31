// Fast loop (docs/system/cartridge.md#author-preview): `bin/loka dev --watch` keeps one loopback
// server-sent-events stream to the open author page. A text-only change travels as an overlay of
// text values over the artifact the page already runs; nothing here writes a file, so the overlay
// can never be bundled. Checkpoints (named recorded paths) are the one thing the page writes, as
// plain files under the source tree's `checkpoints/`, which the compiler skips.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { join } from 'node:path';

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
  let body = '';
  for await (const chunk of request) body += chunk;
  let steps: unknown;
  try {
    steps = (JSON.parse(body) as { steps?: unknown }).steps;
  } catch {}
  if (!Array.isArray(steps)) return json(response, 400, 'a checkpoint is {"steps": [...]}');
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, `${JSON.stringify({ steps }, null, 2)}\n`);
  return response.writeHead(204).end();
}

/** Serves `GET /events` (each client gets the current message on connect and every push after)
 * and the checkpoint routes over `source`. */
export function serve(port: number, source: string) {
  const clients = new Set<ServerResponse>();
  let last: Message = { text: {}, said: [] };
  const send = (client: ServerResponse) => client.write(`data: ${JSON.stringify(last)}\n\n`);
  const server = createServer((request, response) => {
    if (request.url?.startsWith('/checkpoints')) return void checkpoints(request, response, source);
    if (request.url !== '/events') return response.writeHead(404).end();
    response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    send(response);
    clients.add(response);
    request.on('close', () => clients.delete(response));
  }).listen(port, '127.0.0.1');
  return {
    push(message: Partial<Message>) {
      last = { ...last, ...message };
      for (const client of clients) send(client);
    },
    close: () => server.close(),
  };
}
