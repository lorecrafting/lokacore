// Local-only header proxy: Expo's root HTML does not set the isolation headers
// required by expo-sqlite's synchronous browser worker. Both ports stay on localhost.
const http = require('node:http');
const net = require('node:net');
const { spawn } = require('node:child_process');
const path = require('node:path');

const previewPort = 19006;
const metroPort = 19007;
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

const server = http.createServer((request, response) => {
  const upstream = http.request(
    {
      hostname: 'localhost',
      port: metroPort,
      path: request.url,
      method: request.method,
      headers: { ...request.headers, host: `localhost:${metroPort}` },
    },
    (result) => {
      response.writeHead(result.statusCode, {
        ...result.headers,
        'cross-origin-opener-policy': 'same-origin',
        'cross-origin-embedder-policy': 'require-corp',
      });
      result.pipe(response);
    },
  );
  upstream.on('error', () => {
    if (response.headersSent) response.destroy();
    else {
      response.writeHead(502);
      response.end('Metro is starting');
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
