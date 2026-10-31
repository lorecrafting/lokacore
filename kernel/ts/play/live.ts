// Fast loop (docs/system/cartridge.md#author-preview): `bin/loka dev --watch` keeps one loopback
// server-sent-events stream to the open author page. A text-only change travels as an overlay of
// text values over the artifact the page already runs; nothing here writes a file, so the overlay
// can never be bundled.
import { createServer, type ServerResponse } from 'node:http';

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

/** Serves `GET /events`; each client gets the current message on connect and every push after. */
export function serve(port: number) {
  const clients = new Set<ServerResponse>();
  let last: Message = { text: {}, said: [] };
  const send = (client: ServerResponse) => client.write(`data: ${JSON.stringify(last)}\n\n`);
  createServer((request, response) => {
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
  };
}
