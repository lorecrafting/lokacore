// The author server's HTTP side of the editor (docs/system/cartridge.md#author-preview): who may
// ask at all (Host, Origin), the write routes (write.ts) and the Hold the watcher parks under.
import { realpathSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, join } from 'node:path';
import { type Answer, type Changed, writer, writes } from './write.ts';

export const json = (response: ServerResponse, status: number, body: unknown) =>
  response.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
export async function body(request: IncomingMessage) {
  let text = '';
  for await (const chunk of request) text += chunk;
  return text;
}

const HOST = /^(localhost|127\.0\.0\.1)(:\d+)?$/; // the Metro proxy forwards `localhost:<port>`
const ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
/** Answers 403 (and is true) for a request not from the author's own page: a rebinding DNS name's
 * Host, or a cross-site page's Origin on anything but a GET (its simple POST would run). */
export function foreign(request: IncomingMessage, response: ServerResponse) {
  const { host, origin } = request.headers;
  if (!HOST.test(host ?? '')) json(response, 403, `not the author host: ${host}`);
  else if (request.method !== 'GET' && origin && !ORIGIN.test(origin))
    json(response, 403, `not from the author page: ${origin}`);
  else return false;
  return true;
}

type Push = (message: { held?: boolean; changed?: Changed[] }) => void;
type Said = {
  push: Push;
  tell: (key: string, words: string, at: string) => void;
  places?: () => Record<string, string>; // the last compile's `~` key => file:line (GET /line)
};
/** `push` keeps the message for later clients and `tell` shows an /edit's words by the text key
 * the page names, before the compile (told.ts); `once` sends `changed` without keeping it.
 * `on.release` runs when the Hold ends, to write what the watcher parked; `on.leave` once a POST
 * /world's answer is sent or its client is gone, with the world's folder (author.ts restarts on
 * it: a fresh guard root, journal and Hold). */
export type Hooks = { release?: () => void; leave?: (world: string) => void };
export function editing(source: string, said: Said, once: Push, on: Hooks) {
  const { push, tell, places } = said;
  const editor = writer(source, (changed) => once({ changed }), places);
  let held = false;
  const hold = (sent: { on?: unknown }): Answer => {
    if (typeof sent?.on !== 'boolean') return [400, 'on: true or false'];
    held = sent.on;
    push({ held });
    if (!held) on.release?.();
    return [200, { held }];
  };
  /** Answers a write route and is true, or is false for a request that is not one. */
  async function route(request: IncomingMessage, response: ServerResponse) {
    const url = request.url ?? '';
    if (request.method === 'GET') {
      const read = await editor.get(url);
      if (read) json(response, ...read);
      return read !== undefined;
    }
    if (request.method !== 'POST' || !(writes(url) || url === '/hold')) return false;
    let sent;
    try {
      sent = JSON.parse(await body(request));
    } catch {
      json(response, 400, 'a JSON body');
      return true;
    }
    const answer = url === '/hold' ? hold(sent) : await editor.post(url, sent);
    const { key, words } = sent ?? {}; // an /undo's are the old words, shown at once like an /edit's
    if (/^\/(edit|undo)$/.test(url) && answer[0] === 200 && typeof key === 'string')
      if (typeof words === 'string') tell(key, words, `${sent.file}:${sent.line}`);
    json(response, ...answer);
    if (url === '/world' && answer[0] === 200)
      response.on('close', () => on.leave?.(join(dirname(realpathSync(source)), sent.name))); // as write.ts's root
    return true;
  }
  return { route, held: () => held, seen: editor.seen, busy: editor.busy };
}
