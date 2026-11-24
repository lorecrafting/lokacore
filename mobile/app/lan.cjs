// `bin/author.sh --lan` (in-game builder §6.8, loka-xetp3): the phone's browser opens the save only in
// a secure context, so the LAN preview is https under a local CA the phone installs once. The CA is
// name-constrained to private addresses and `.local`, so its key cannot vouch for a public site.
const { execFileSync } = require('node:child_process');
const { generateKeyPairSync, randomBytes } = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { pairing, same } = require('./pairing.cjs');
const { proxy } = require('./proxy.cjs');

const OPENSSL = '/usr/bin/openssl'; // LibreSSL on the Mac; config files only (no -addext) for both
const PRIVATE = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
const CA_CONFIG = `[req]
distinguished_name = dn
[dn]
[ca]
basicConstraints = critical, CA:TRUE
keyUsage = critical, keyCertSign, cRLSign
subjectKeyIdentifier = hash
nameConstraints = critical, permitted;IP:10.0.0.0/255.0.0.0, permitted;IP:172.16.0.0/255.240.0.0, permitted;IP:192.168.0.0/255.255.0.0, permitted;DNS:.local
`;
const QUIET = { stdio: 'pipe' }; // LibreSSL's progress lines off the terminal; errors keep stderr
const newKey = () =>
  generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({
    type: 'pkcs8',
    format: 'pem',
  });

/** The addresses `--lan` serves: private IPv4 only (one SAN outside the CA's ranges fails the chain). */
const lanAddresses = (nets) =>
  Object.values(nets)
    .flat()
    .filter((a) => PRIVATE.test(a.address))
    .map((a) => a.address)
    .filter((ip, i, all) => all.indexOf(ip) === i); // an address on two interfaces is one listener

/** `{ key, cert }` for `ips`, issued each start (the key stays in memory) by the CA in `dir`, made on
 * the first run (dir 700, key 600) and reused, so the phone installs it once. */
function lanCert(dir, ips) {
  fs.mkdirSync(dir, { recursive: true });
  fs.chmodSync(dir, 0o700);
  const caKey = path.join(dir, 'ca.key');
  const caCert = path.join(dir, 'ca.pem');
  const config = path.join(dir, 'ca.cnf');
  fs.writeFileSync(config, CA_CONFIG); // the CA's and each leaf's request read it
  if (!fs.existsSync(caCert)) {
    fs.writeFileSync(caKey, newKey()); // in the 700 folder; the chmod below sets 600
    execFileSync(
      OPENSSL,
      [
        'req',
        '-new',
        '-x509',
        '-sha256',
        '-key',
        caKey,
        '-subj',
        '/CN=Loka LAN CA',
        '-days',
        '3650',
        '-config',
        config,
        '-extensions',
        'ca',
        '-out',
        caCert,
      ],
      QUIET,
    );
  }
  fs.chmodSync(caKey, 0o600);
  const key = newKey();
  const leaf = path.join(dir, 'leaf.cnf');
  fs.writeFileSync(
    leaf,
    'basicConstraints = critical, CA:FALSE\nkeyUsage = critical, digitalSignature\nextendedKeyUsage = serverAuth\n' +
      `subjectAltName = ${ips.map((ip) => `IP:${ip}`).join(', ')}\n`,
  );
  // The CN has a space: OpenSSL would check a hostname-like CN against the DNS constraint.
  const csr = execFileSync(
    OPENSSL,
    ['req', '-new', '-key', '/dev/stdin', '-subj', '/CN=Loka LAN preview', '-config', config],
    { input: key, ...QUIET },
  );
  const cert = execFileSync(
    OPENSSL,
    [
      'x509',
      '-req',
      '-sha256',
      '-CA',
      caCert,
      '-CAkey',
      caKey,
      '-set_serial',
      `0x${randomBytes(16).toString('hex')}`,
      '-days',
      '365',
      '-extfile',
      leaf,
    ],
    { input: csr, encoding: 'utf8', ...QUIET },
  );
  return { key, cert };
}

/** The CA certificate, never its key, on plain http for the phone to install: `/loka-ca.pem?ca=<caToken>`.
 * Its own token: one sent in clear text must not be the pairing token, and it ends with the pairing. */
function caServer(caToken, pair, dir) {
  const ca = fs.readFileSync(path.join(dir, 'ca.pem'));
  return http.createServer((request, response) => {
    const url = URL.parse(request.url, 'http://x');
    if (url?.pathname !== '/loka-ca.pem') return response.writeHead(404).end();
    if (pair.idle() || !same(url.searchParams.get('ca'), caToken))
      return response.writeHead(403).end();
    response.writeHead(200, { 'content-type': 'application/x-x509-ca-cert' }).end(ca);
  });
}

/** The preview's listeners: plain http on loopback, unguarded as ever; with `token` (`--lan`), on each
 * of `ips` the paired https preview and the CA download. */
function serve({ previewPort, caPort, metroPort, authorPort, token, caToken, ips, dir }) {
  const servers = [proxy({ metroPort, authorPort }).listen(previewPort, '127.0.0.1')];
  if (!token) return servers;
  const pair = pairing(token);
  const tls = lanCert(dir, ips);
  for (const ip of ips)
    servers.push(
      proxy({ pair, metroPort, authorPort, tls }).listen(previewPort, ip),
      caServer(caToken, pair, dir).listen(caPort, ip),
    );
  setInterval(pair.idle, 60_000).unref();
  return servers;
}

module.exports = { lanAddresses, lanCert, serve };
