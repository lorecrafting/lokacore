// `bin/author.sh --lan`'s guard on the preview port (mobile/app/pairing.cjs, in-game builder §6.8):
// a LAN peer without the pairing cookie reads or writes nothing; loopback is as before.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const { pairing } = createRequire(import.meta.url)('./pairing.cjs');
const TOKEN = '0123456789abcdef0123456789abcdef';
const PHONE = '192.168.1.20';
const ask = (url: string, remoteAddress: string, cookie?: string, method = 'GET') => ({
  url,
  method,
  headers: cookie ? { cookie } : {},
  socket: { remoteAddress },
});
const quiet = () => {};

test('the pairing link sets the cookie and drops pair from the URL; a wrong token gets 403 and no cookie', () => {
  // Breaks: any token pairs; a short guess throws (timingSafeEqual on unequal lengths); the
  // redirect keeps the token in the address bar or loses the other query.
  const { check } = pairing(TOKEN, () => 0, quiet);
  assert.deepEqual(check(ask(`/?dev=1&pair=${TOKEN}`, PHONE)), [
    302,
    { location: '/?dev=1', 'set-cookie': `loka_pair=${TOKEN}; HttpOnly; SameSite=Strict; Path=/` },
  ]);
  assert.deepEqual(check(ask('/?dev=1&pair=0123456789abcdef0123456789abcdee', PHONE)), [403]);
  assert.deepEqual(check(ask('/?pair=0123', PHONE)), [403]);
});

test('a LAN peer needs the cookie on every path; loopback does not', () => {
  // Breaks: the guard covers the bundle but not /__author/* (GET /source reads files, POST /edit
  // writes them), takes any cookie, or refuses the Mac's own Book.
  const { check, forwarded } = pairing(TOKEN, () => 0, quiet);
  for (const [url, method] of [
    ['/__author/source?file=rooms/a.json', 'GET'],
    ['/__author/edit', 'POST'],
    ['/index.bundle', 'GET'],
  ]) {
    assert.deepEqual(check(ask(url, PHONE, undefined, method)), [403], url);
    assert.deepEqual(
      check(ask(url, PHONE, 'loka_pair=0123456789abcdef0123456789abcdee', method)),
      [403],
      url,
    );
    assert.equal(check(ask(url, PHONE, `theme=x; loka_pair=${TOKEN}`, method)), undefined, url);
    assert.equal(check(ask(url, '127.0.0.1', undefined, method)), undefined, url);
    assert.equal(check(ask(url, '::1', undefined, method)), undefined, url);
  }
  // Break: the author server's header leaks the token to loopback, or is missing on a LAN request.
  assert.deepEqual(forwarded(ask('/__author/edit', PHONE)), { 'x-loka-pair': TOKEN });
  assert.deepEqual(forwarded(ask('/__author/edit', '127.0.0.1')), {});
});

test('--lan turns off after 8 idle hours, and a refused request does not keep it on', () => {
  // Breaks: no expiry; a stranger's 403s reset the idle clock; expiry also locks out loopback.
  const HOUR = 3_600_000;
  let clock = 0;
  const said: string[] = [];
  const { check } = pairing(
    TOKEN,
    () => clock,
    (line: string) => said.push(line),
  );
  const paired = `loka_pair=${TOKEN}`;
  clock = 8 * HOUR;
  assert.equal(check(ask('/', PHONE, paired)), undefined); // exactly 8 h idle: still on
  clock = 16 * HOUR - 1;
  assert.deepEqual(check(ask('/', PHONE)), [403]); // a stranger, refused: not activity
  clock = 16 * HOUR + 1;
  assert.deepEqual(check(ask('/', PHONE, paired)), [403]);
  assert.deepEqual(check(ask(`/?pair=${TOKEN}`, PHONE)), [403]); // nor can it pair again
  assert.equal(check(ask('/', '127.0.0.1')), undefined);
  assert.equal(said.length, 1);
});
