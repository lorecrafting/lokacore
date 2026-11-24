// `bin/author.sh --lan`'s guard on the preview port (docs/rnd/in-game-builder-mode-2026-11-19.md §6.8):
// a non-loopback peer needs the pairing cookie on every request; `?pair=<token>` sets it.
const { timingSafeEqual } = require('node:crypto');

const IDLE_MS = 8 * 60 * 60 * 1000; // --lan turns off after 8 hours with no paired LAN request
const LOOPBACK = /^(::ffff:)?127\.|^::1$/;
// Byte lengths: a 32-character guess with a non-ASCII character is longer in bytes and would throw.
const same = (a, b) =>
  typeof a === 'string' &&
  Buffer.byteLength(a) === Buffer.byteLength(b) &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** `check(request)` answers undefined (forward it) or the `[status, headers]` to refuse or redirect
 * with; `forwarded(request)` is the header the author server requires of a LAN request. */
function pairing(token, now = Date.now, say = console.log) {
  let last = now();
  let off = false;
  const idle = () => {
    if (!off && now() - last > IDLE_MS) {
      off = true;
      say(
        '--lan is off after 8 idle hours: LAN requests now get 403. Restart bin/author.sh --lan to pair again.',
      );
    }
    return off;
  };
  const lan = (request) => !LOOPBACK.test(request.socket.remoteAddress ?? '');
  function check(request) {
    const url = URL.parse(request.url, 'http://x');
    if (!url) return [400];
    const pair = url.searchParams.get('pair');
    if (lan(request) && idle()) return [403];
    if (pair !== null && request.method === 'GET' && lan(request)) {
      if (!same(pair, token)) return [403];
      url.searchParams.delete('pair');
      last = now();
      const location = url.pathname + url.search;
      return [
        302,
        { location, 'set-cookie': `loka_pair=${token}; HttpOnly; SameSite=Strict; Path=/` },
      ];
    }
    if (!lan(request)) return undefined;
    const cookie = /(?:^|;\s*)loka_pair=([^;]*)/.exec(request.headers.cookie ?? '')?.[1];
    if (!same(cookie, token)) return [403];
    last = now();
    return undefined;
  }
  const forwarded = (request) => (lan(request) ? { 'x-loka-pair': token } : {});
  return { check, forwarded, idle };
}

module.exports = { pairing, IDLE_MS };
