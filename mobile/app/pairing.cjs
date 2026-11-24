// `bin/author.sh --lan`'s guard on the preview port (docs/rnd/in-game-builder-mode-2026-11-19.md §6.8):
// a non-loopback peer (on https, lan.cjs) needs the pairing cookie on every request; `?pair=<token>` sets it.
const { timingSafeEqual } = require('node:crypto');

const IDLE_MS = 8 * 60 * 60 * 1000; // --lan turns off after 8 hours with no paired LAN request
const LOOPBACK = /^(::ffff:)?127\.|^::1$/;
// Byte lengths: a 32-character guess with a non-ASCII character is longer in bytes and would throw.
const same = (a, b) =>
  typeof a === 'string' &&
  Buffer.byteLength(a) === Buffer.byteLength(b) &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** `check(request)` answers undefined (forward it) or the `[status, headers, body]` to answer with;
 * `forwarded(request)` is the header the author server requires of a LAN request; `watch(socket)`
 * (each new connection) lets expiry cut a LAN socket already open: SSE, websocket, keep-alive. */
function pairing(token, now = Date.now, say = console.log) {
  let last = now();
  let off = false;
  const open = new Set();
  const lan = (request) => !LOOPBACK.test(request.socket.remoteAddress ?? '');
  const watch = (socket) => {
    if (!lan({ socket })) return;
    open.add(socket);
    socket.on('close', () => open.delete(socket));
  };
  const idle = () => {
    if (!off && now() - last > IDLE_MS) {
      off = true;
      for (const socket of open) socket.destroy();
      say(
        '--lan is off after 8 idle hours: LAN requests now get 403. Restart bin/author.sh --lan to pair again.',
      );
    }
    return off;
  };
  function check(request) {
    const url = URL.parse(request.url, 'http://x');
    if (!url) return [400];
    const pair = url.searchParams.get('pair');
    if (lan(request) && idle()) return [403];
    if (pair !== null && request.method === 'GET' && lan(request)) {
      if (!same(pair, token)) return [403];
      url.searchParams.delete('pair');
      last = now();
      // A 200 page, not a 302: a link from another app or site is a cross-site navigation, so a
      // redirect's load goes without the Strict cookie (403); this same-origin replace sends it.
      // URL encodes `<` in the path and query, so the target cannot close the script tag.
      const to = JSON.stringify(url.pathname + url.search);
      return [
        200,
        {
          'content-type': 'text/html',
          'cache-control': 'no-store',
          'set-cookie': `loka_pair=${token}; HttpOnly; Secure; SameSite=Strict; Path=/`,
        },
        `<!doctype html><script>location.replace(${to})</script>`,
      ];
    }
    if (!lan(request)) return undefined;
    const cookie = /(?:^|;\s*)loka_pair=([^;]*)/.exec(request.headers.cookie ?? '')?.[1];
    if (!same(cookie, token)) return [403];
    last = now();
    return undefined;
  }
  const forwarded = (request) => (lan(request) ? { 'x-loka-pair': token } : {});
  return { check, forwarded, idle, watch };
}

module.exports = { pairing, same, IDLE_MS };
