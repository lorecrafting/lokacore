// Local-only header proxy: Expo's root HTML does not set the isolation headers
// required by expo-sqlite's synchronous browser worker. Both ports stay on localhost.
const http = require('node:http');
const net = require('node:net');
const { execFileSync, spawn } = require('node:child_process');
const path = require('node:path');

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
  { cwd: __dirname, stdio: 'inherit', env: { ...process.env, EXPO_NO_TELEMETRY: '1' } },
);

// `/__author/*` goes to `bin/loka dev --watch`'s live stream (kernel/ts/play/live.ts).
const authorPort = Number(process.env.LOKA_AUTHOR_PORT || 19008);
const server = http.createServer((request, response) => {
  const author = request.url.startsWith('/__author/');
  const port = author ? authorPort : metroPort;
  const upstream = http.request(
    {
      hostname: 'localhost',
      port,
      path: author ? request.url.slice('/__author'.length) : request.url,
      method: request.method,
      headers: { ...request.headers, host: `localhost:${port}` },
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

server.listen(previewPort, '127.0.0.1', () =>
  console.log(`Book preview: http://localhost:${previewPort}`),
);
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
