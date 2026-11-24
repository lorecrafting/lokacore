// The preview's proxy (preview-server.cjs): adds the isolation headers, sends `/__author/*` to the
// author server and the rest to Metro, both on localhost. With `pair` (pairing.cjs, `--lan`), every
// request and upgrade passes its check first and the author server gets its header; `tls` (lan.cjs)
// makes it https.
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');

function proxy({ pair, metroPort, authorPort, tls }) {
  const handle = (request, response) => {
    const answer = pair?.check(request);
    if (answer) return response.writeHead(answer[0], answer[1]).end(answer[2]);
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
  };
  const server = tls ? https.createServer(tls, handle) : http.createServer(handle);

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
  if (pair) server.on('connection', pair.watch);
  return server;
}

module.exports = { proxy };
