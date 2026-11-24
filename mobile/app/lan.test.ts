// `bin/author.sh --lan` over https (mobile/app/lan.cjs, in-game builder §6.8, loka-xetp3): the CA the
// phone installs, the leaf it vouches for, and the listeners the preview opens.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createPrivateKey, X509Certificate } from 'node:crypto';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer, request, type IncomingHttpHeaders, type Server } from 'node:http';
import { request as secure } from 'node:https';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { networkInterfaces, tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { lanAddresses, lanCert, serve } = require('./lan.cjs');
const { IDLE_MS } = require('./pairing.cjs');
const OPENSSL = '/usr/bin/openssl';
const TOKEN = '0123456789abcdef0123456789abcdef';
const CA_TOKEN = 'fedcba9876543210fedcba9876543210';
const scratch = (t: { after: (f: () => void) => void }) => {
  const root = mkdtempSync(join(tmpdir(), 'loka-lan-ca-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return join(root, 'lan-ca'); // not there yet, as on a first run
};

test('--lan serves private IPv4 addresses only', () => {
  // Breaks: a public, carrier-grade NAT (a VPN's 100.64/10), IPv6 or loopback address gets a SAN (one
  // outside the CA's ranges fails the whole chain) or a listener; a private range is dropped; an address
  // on two interfaces gets two listeners (the second: EADDRINUSE).
  const a = (address: string, family = 'IPv4', internal = false) => ({ address, family, internal });
  const nets = {
    lo0: [a('127.0.0.1', 'IPv4', true)],
    en0: [a('fe80::1', 'IPv6'), a('192.168.0.68')],
    en1: [
      a('10.2.3.4'),
      a('192.168.0.68'),
      a('172.15.0.1'),
      a('172.16.0.1'),
      a('172.31.255.1'),
      a('172.32.0.1'),
    ],
    utun3: [a('100.100.1.1'), a('8.8.8.8')],
  };
  assert.deepEqual(lanAddresses(nets), ['192.168.0.68', '10.2.3.4', '172.16.0.1', '172.31.255.1']);
});

test('the CA is made once, name-constrained, its key readable by the owner alone; the leaf chains to it', (t) => {
  // Breaks: the CA is not a CA or its constraints are missing or not critical (a leaked key signs a
  // public IP or name the phone then trusts); the folder or key is readable by others; a later run
  // makes a new CA (the phone must reinstall); the leaf lacks a LAN IP, serverAuth or its own key,
  // outlives Apple's 397 days, or is not signed by the CA.
  const dir = scratch(t);
  const caPem = join(dir, 'ca.pem');
  const leaf = lanCert(dir, ['192.168.1.20', '10.0.0.7']);
  assert.equal(statSync(dir).mode & 0o777, 0o700);
  assert.equal(statSync(join(dir, 'ca.key')).mode & 0o777, 0o600);
  const ca = new X509Certificate(readFileSync(caPem));
  assert.equal(ca.ca, true);
  const text = execFileSync(OPENSSL, ['x509', '-noout', '-text', '-in', caPem], {
    encoding: 'utf8',
  });
  assert.match(text, /Basic Constraints: critical\s+CA:TRUE/);
  assert.match(text, /Name Constraints: critical/);

  const cert = new X509Certificate(leaf.cert);
  assert.equal(cert.subjectAltName, 'IP Address:192.168.1.20, IP Address:10.0.0.7');
  assert.deepEqual(cert.keyUsage, ['1.3.6.1.5.5.7.3.1']);
  assert.ok(Date.parse(cert.validTo) - Date.parse(cert.validFrom) <= 397 * 86_400_000);
  assert.ok(cert.checkIssued(ca) && cert.verify(ca.publicKey));
  assert.ok(cert.checkPrivateKey(createPrivateKey(leaf.key)));

  // The constraints, as a verifier applies them: a LAN IP or a .local name passes, a public one fails.
  const verify = (pem: string | Buffer) =>
    spawnSync(OPENSSL, ['verify', '-CAfile', caPem], { input: pem }).status;
  const signed = (san: string) => {
    writeFileSync(join(dir, 'san.cnf'), `subjectAltName = ${san}\n`);
    const csr = execFileSync(OPENSSL, [
      'req',
      '-new',
      '-key',
      join(dir, 'ca.key'),
      '-subj',
      '/CN=a b',
      '-config',
      join(dir, 'ca.cnf'),
    ]);
    return execFileSync(
      OPENSSL,
      [
        'x509',
        '-req',
        '-CA',
        caPem,
        '-CAkey',
        join(dir, 'ca.key'),
        '-set_serial',
        '2',
        '-days',
        '1',
        '-extfile',
        join(dir, 'san.cnf'),
      ],
      { input: csr, stdio: 'pipe' },
    );
  };
  assert.equal(verify(leaf.cert), 0);
  assert.equal(verify(signed('DNS:mac.local')), 0);
  assert.notEqual(verify(signed('DNS:example.com')), 0);
  assert.notEqual(verify(lanCert(dir, ['8.8.8.8']).cert), 0);

  assert.equal(new X509Certificate(readFileSync(caPem)).fingerprint256, ca.fingerprint256);
});

test('--lan: loopback stays plain http; the LAN gets the paired https preview and the CA, never its key', async (t) => {
  // Breaks: the loopback preview turns https or guarded (the Mac's own Book breaks); a LAN request
  // without the cookie reaches Metro; the LAN preview is not https under a chain the CA vouches for;
  // the CA download answers without its own token (the pairing token must not travel in clear text),
  // serves the key, or any other file, or outlives the pairing's idle expiry.
  const [ip] = lanAddresses(networkInterfaces());
  assert.ok(ip, 'this test needs a private IPv4 address to listen on');
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() });
  const metro = createServer((_req, res) => res.end('metro'));
  metro.listen(0, '127.0.0.1');
  await once(metro, 'listening');
  const dir = scratch(t);
  const servers: Server[] = serve({
    previewPort: 0,
    caPort: 0,
    metroPort: (metro.address() as AddressInfo).port,
    authorPort: 1,
    token: TOKEN,
    caToken: CA_TOKEN,
    ips: [ip],
    dir,
  });
  t.after(() => [metro, ...servers].forEach((s) => s.close()));
  await Promise.all(servers.map((s) => s.listening || once(s, 'listening')));
  const [loopback, preview, caDownload] = servers.map((s) => (s.address() as AddressInfo).port);
  const ca = readFileSync(join(dir, 'ca.pem'), 'utf8');
  const get = (url: string, headers = {}) =>
    new Promise<[number, string, IncomingHttpHeaders]>((done, fail) =>
      (url.startsWith('https:') ? secure : request)(url, { agent: false, ca, headers }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res
          .on('data', (c) => (body += c))
          .on('end', () => done([res.statusCode!, body, res.headers]));
      })
        .on('error', fail)
        .end(),
    );

  assert.deepEqual((await get(`http://127.0.0.1:${loopback}/`)).slice(0, 2), [200, 'metro']);
  const lan = `https://${ip}:${preview}`;
  assert.deepEqual((await get(`${lan}/`)).slice(0, 2), [403, '']);
  const [paired, , headers] = await get(`${lan}/?pair=${TOKEN}`);
  assert.equal(paired, 200);
  const cookie = headers['set-cookie']![0].split(';')[0];
  assert.deepEqual((await get(`${lan}/`, { cookie })).slice(0, 2), [200, 'metro']);

  const download = `http://${ip}:${caDownload}`;
  assert.deepEqual((await get(`${download}/loka-ca.pem?ca=${CA_TOKEN}`)).slice(0, 2), [200, ca]);
  for (const [path, status] of [
    ['/loka-ca.pem', 403],
    [`/loka-ca.pem?ca=${TOKEN}`, 403],
    [`/loka-ca.pem?pair=${CA_TOKEN}`, 403],
    [`/ca.key?ca=${CA_TOKEN}`, 404],
    [`/../ca.key?ca=${CA_TOKEN}`, 404],
  ] as const) {
    const [answered, body] = await get(`${download}${path}`);
    assert.equal(answered, status, path);
    assert.doesNotMatch(body, /PRIVATE KEY/);
  }

  t.mock.timers.tick(IDLE_MS + 1); // --lan turns off: the CA download ends with the pairing
  assert.equal((await get(`${download}/loka-ca.pem?ca=${CA_TOKEN}`))[0], 403);
});
