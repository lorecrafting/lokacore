// Loka picker queue on Storybook's own dev server (design input section 3; docs/web-preview.md,
// Polish queue). `storybook dev` only (main.ts), loopback only: a foreign Host or Origin gets 403.
//   POST /polish/picks   one pick (or {type:'close'|'keep-going'}) -> a line in .polish/picks.jsonl
//   GET  /polish/status  {session, picks, status} from the two files
//   GET  /polish/shots/<id>-<i>.png
// The files live in the served worktree (LOKA_POLISH_DIR overrides, for tests).
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { ROUTE, type Pick, type Picked } from './events.ts';

const root = fileURLToPath(new URL('../../../../', import.meta.url)); // the served worktree
const dir = process.env.LOKA_POLISH_DIR ?? `${root}.polish`;
const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])$/;
const host = (value: string | undefined) => value?.replace(/:\d+$/, '');
const loopback = (req: IncomingMessage) => {
  const origin = req.headers.origin;
  return (
    LOOPBACK.test(host(req.headers.host) ?? '') &&
    (!origin || LOOPBACK.test(host(new URL(origin).host) ?? ''))
  );
};

const lines = (file: string): unknown[] =>
  existsSync(file)
    ? readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .flatMap((l) => {
          try {
            return [JSON.parse(l)];
          } catch {
            return []; // a torn line while an agent appends
          }
        })
    : [];
const append = (file: string, line: object) => {
  mkdirSync(dir, { recursive: true });
  appendFileSync(file, `${JSON.stringify(line)}\n`);
};
const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};
const body = (req: IncomingMessage) =>
  new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > 32e6)
        reject(new Error('too large')); // four full-page crops at most
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });

// Each element's crop goes to a file; the pick line keeps its path (relative to the worktree).
const store = (id: string, elements: Picked[] = []) =>
  elements.map(({ png, ...el }, i) => {
    if (!png) return { ...el, shot: null };
    mkdirSync(`${dir}/shots`, { recursive: true });
    writeFileSync(`${dir}/shots/${id}-${i}.png`, Buffer.from(png.split(',')[1] ?? '', 'base64'));
    return { ...el, shot: `.polish/shots/${id}-${i}.png` };
  });

export const polishQueue = (): Plugin => ({
  name: 'loka-polish-queue',
  configureServer(server) {
    // The session pill: a polish session branch (bin/polish_session.sh) served from this worktree.
    const branch = execFileSync('git', ['branch', '--show-current'], { cwd: root })
      .toString()
      .trim();
    const session = branch.startsWith('polish/session-') ? branch : null;
    server.middlewares.use(ROUTE, async (req, res, next) => {
      if (!loopback(req)) return json(res, 403, { error: 'loopback only' });
      const url = req.url ?? '';
      if (req.method === 'GET' && url === '/status')
        return json(res, 200, {
          session,
          picks: lines(`${dir}/picks.jsonl`),
          status: lines(`${dir}/status.jsonl`),
        });
      if (req.method === 'GET' && /^\/shots\/[\w-]+\.png$/.test(url)) {
        const file = `${dir}${url}`;
        if (!existsSync(file)) return json(res, 404, { error: 'no shot' });
        res.writeHead(200, { 'content-type': 'image/png' });
        return res.end(readFileSync(file));
      }
      if (req.method === 'POST' && url === '/picks') {
        let pick: Pick;
        try {
          pick = JSON.parse(await body(req));
        } catch (e) {
          return json(res, 400, { error: (e as Error).message });
        }
        const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        const line = { ...pick, id, time: Date.now(), elements: store(id, pick.elements) };
        if (pick.type) delete (line as { elements?: unknown }).elements;
        append(`${dir}/picks.jsonl`, line);
        return json(res, 200, { id });
      }
      next();
    });
  },
});
