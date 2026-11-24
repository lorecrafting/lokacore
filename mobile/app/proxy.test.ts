// The preview's proxy (mobile/app/proxy.cjs) under `bin/author.sh --lan` (in-game builder §6.8): it
// asks the pairing guard before every request and upgrade, and passes its header to the author server.
import assert from 'node:assert/strict';
import { createServer, request, type IncomingHttpHeaders, type Server } from 'node:http';
import { connect, type AddressInfo, type Socket } from 'node:net';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const { proxy, bindHost } = createRequire(import.meta.url)('./proxy.cjs');
const listen = (server: Server) =>
  new Promise<number>((done) =>
    server.listen(0, '127.0.0.1', () => done((server.address() as AddressInfo).port)),
  );

test('the proxy answers with the guard, forwards its header to the author server, and hands it each socket', async (t) => {
  // Breaks: the request or the upgrade skips the guard's refusal (a LAN stranger reaches Metro or
  // the author server); the pairing page's body is dropped; the author server never gets the token
  // header (the paired phone gets 403) or Metro gets it; expiry is never told of a socket.
  const seen: Record<string, IncomingHttpHeaders & { path?: string }> = {};
  const upstream = (name: string) =>
    createServer((req, res) => {
      seen[name] = { ...req.headers, path: req.url };
      res.end(name);
    });
  const metro = upstream('metro');
  let upgraded = 0;
  metro.on('upgrade', (_req, socket: Socket) => {
    upgraded++;
    socket.end('HTTP/1.1 101 Switching Protocols\r\n\r\n');
  });
  const author = upstream('author');
  const watched: Socket[] = [];
  const pair = {
    check: (req: { url: string }) =>
      req.url.includes('/no')
        ? [403]
        : req.url.startsWith('/?pair')
          ? [200, {}, 'page']
          : undefined,
    forwarded: () => ({ 'x-loka-pair': 'T' }),
    watch: (socket: Socket) => watched.push(socket),
  };
  const server = proxy({ pair, metroPort: await listen(metro), authorPort: await listen(author) });
  const port = await listen(server);
  t.after(() => [server, metro, author].forEach((s) => s.close()));
  const get = (path: string) =>
    new Promise<[number, string]>((done, fail) =>
      request({ port, path, agent: false }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c)).on('end', () => done([res.statusCode!, body]));
      })
        .on('error', fail)
        .end(),
    );
  const upgrade = (path: string) =>
    new Promise<string>((done) => {
      const socket = connect(port, '127.0.0.1', () =>
        socket.write(
          `GET ${path} HTTP/1.1\r\nHost: x\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n`,
        ),
      );
      let text = '';
      socket.on('data', (c) => (text += c)).on('close', () => done(text));
    });

  assert.deepEqual(await get('/no/index.bundle'), [403, '']);
  assert.deepEqual(await get('/__author/no'), [403, '']);
  assert.deepEqual(await get('/?pair=x'), [200, 'page']);
  assert.equal(seen.metro, undefined);
  assert.equal(seen.author, undefined);
  assert.deepEqual(await get('/__author/source'), [200, 'author']);
  assert.equal(seen.author['x-loka-pair'], 'T');
  assert.equal(seen.author.path, '/source');
  assert.deepEqual(await get('/index.bundle'), [200, 'metro']);
  assert.equal(seen.metro['x-loka-pair'], undefined);
  assert.match(await upgrade('/no/hot'), /^HTTP\/1\.1 403/);
  assert.equal(upgraded, 0);
  assert.match(await upgrade('/hot'), /^HTTP\/1\.1 101/);
  assert.equal(upgraded, 1);
  assert.equal(watched.length, 7); // one per connection: five requests (no keep-alive agent), two upgrades
});

test('the preview binds the LAN only under --lan', () => {
  // Break: the proxy listens on every interface without a pairing token (no guard), or never under --lan.
  assert.equal(bindHost(undefined), '127.0.0.1');
  assert.equal(bindHost('0123456789abcdef0123456789abcdef'), '0.0.0.0');
});
