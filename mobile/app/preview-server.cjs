// Local-only header proxy: Expo's root HTML does not set the isolation headers
// required by expo-sqlite's synchronous browser worker. Both ports stay on localhost, except the
// proxy's with LOKA_PAIR set (`bin/author.sh --lan`): then it listens on the LAN behind pairing.cjs.
const http = require('node:http');
const net = require('node:net');
const { execFileSync, spawn } = require('node:child_process');
const path = require('node:path');
const readline = require('node:readline');
const { networkInterfaces } = require('node:os');
const { pairing } = require('./pairing.cjs');
const { quiet } = require('./quiet-metro.cjs');

const previewPort = Number(process.env.LOKA_PREVIEW_PORT || 19006);
// LOKA_METRO_PORT=0 (the e2e configs): ask the OS for a free port, so concurrent runs never share one.
// ponytail: the port is free when probed, not reserved; if Expo ever loses it to another run, pass
// Expo's real port to the proxy instead.
const metroPort =
  Number(process.env.LOKA_METRO_PORT || 19007) ||
  Number(
    execFileSync(process.execPath, [
      '-e',
      "const s = require('node:net').createServer().listen(0, 'localhost', () => { process.stdout.write(String(s.address().port)); s.close(); });",
    ]),
  );
const expo = spawn(
  process.execPath,
  [
    path.join(__dirname, 'node_modules/expo/bin/cli'),
    'start',
    '--web',
    '--localhost',
    '--port',
    String(metroPort),
  ],
  { cwd: __dirname, stdio: ['inherit', 'pipe', 'pipe'], env: { ...process.env, EXPO_NO_TELEMETRY: '1' } },
);
for (const [from, to] of [[expo.stdout, process.stdout], [expo.stderr, process.stderr]]) {
  const keep = quiet();
  // Expo names its own port, which has no isolation headers (the save fails there): name the proxy's.
  const own = (line) => line.replaceAll(`localhost:${metroPort}`, `localhost:${previewPort}`);
  readline.createInterface({ input: from }).on('line', (line) => keep(line) && to.write(`${own(line)}\n`));
}

// `/__author/*` goes to `bin/loka dev --watch`'s live stream (kernel/ts/play/live.ts).
const authorPort = Number(process.env.LOKA_AUTHOR_PORT || 19008);
const token = process.env.LOKA_PAIR;
const pair = token ? pairing(token) : undefined;
const server = http.createServer((request, response) => {
  const refused = pair?.check(request);
  if (refused) return response.writeHead(...refused).end();
  const author = request.url.startsWith('/__author/');
  const port = author ? authorPort : metroPort;
  const upstream = http.request(
    {
      hostname: 'localhost',
      port,
      path: author ? request.url.slice('/__author'.length) : request.url,
      method: request.method,
      // the author server checks the page's own Host (a rebinding name's is foreign)
      headers: {
        ...request.headers,
        host: author ? request.headers.host : `localhost:${port}`,
        ...(author && pair?.forwarded(request)),
      },
    },
    (result) => {
      response.writeHead(result.statusCode, {
        ...result.headers,
        'cross-origin-opener-policy': 'same-origin',
        'cross-origin-embedder-policy': 'require-corp',
        'cross-origin-resource-policy': 'same-site', // the author panel page (another port) frames it
      });
      result.pipe(response);
    },
  );
  upstream.on('error', () => {
    if (response.headersSent) response.destroy();
    else {
      response.writeHead(502);
      response.end(author ? 'bin/loka dev --watch is not running' : 'Metro is starting');
    }
  });
  request.pipe(upstream);
});

server.on('upgrade', (request, socket, head) => {
  if (pair?.check(request)) return socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
  const upstream = net.connect(metroPort, 'localhost', () => {
    upstream.write(`${request.method} ${request.url} HTTP/1.1\r\n`);
    for (const [key, value] of Object.entries(request.headers))
      upstream.write(`${key}: ${key === 'host' ? `localhost:${metroPort}` : value}\r\n`);
    upstream.write('\r\n');
    if (head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
});

server.listen(previewPort, token ? '0.0.0.0' : '127.0.0.1', () => {
  console.log(`Book preview: http://localhost:${previewPort}`);
  if (!token) return; // one line per address: the first may be a VPN's, not the Wi-Fi's
  for (const a of Object.values(networkInterfaces()).flat())
    if (a.family === 'IPv4' && !a.internal)
      console.log(`On the LAN (open once to pair): http://${a.address}:${previewPort}/?dev=1&pair=${token}`);
});
if (pair) setInterval(pair.idle, 60_000).unref();
server.on('error', (error) => {
  expo.kill();
  throw error;
});
const stop = () => {
  server.close();
  expo.kill();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
expo.on('exit', (code) => {
  server.close();
  process.exitCode = code || 0;
});
