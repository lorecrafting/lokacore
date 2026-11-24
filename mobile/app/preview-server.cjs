// Local-only header proxy: Expo's root HTML does not set the isolation headers
// required by expo-sqlite's synchronous browser worker. Both ports stay on localhost; with LOKA_PAIR
// set (`bin/author.sh --lan`) the proxy also serves https on the LAN behind pairing.cjs (lan.cjs).
const { execFileSync, spawn } = require('node:child_process');
const { X509Certificate } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { homedir, networkInterfaces } = require('node:os');
const { lanAddresses, serve } = require('./lan.cjs');
const { quiet } = require('./quiet-metro.cjs');

const previewPort = Number(process.env.LOKA_PREVIEW_PORT || 19006);
const caPort = 19005;
const token = process.env.LOKA_PAIR;
const ips = token ? lanAddresses(networkInterfaces()) : [];
if (token && !ips.length)
  throw new Error('--lan: no private IPv4 address (10/8, 172.16/12, 192.168/16) to serve');
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
// `/__author/*` goes to `bin/loka dev --watch`'s live stream (kernel/ts/play/live.ts).
const authorPort = Number(process.env.LOKA_AUTHOR_PORT || 19008);
const dir = path.join(homedir(), '.loka/lan-ca');
// Before Expo starts: a failed CA setup throws with no Metro left behind.
const servers = serve({ previewPort, caPort, metroPort, authorPort, token, ips, dir });
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
  {
    cwd: __dirname,
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env, EXPO_NO_TELEMETRY: '1' },
  },
);
for (const [from, to] of [
  [expo.stdout, process.stdout],
  [expo.stderr, process.stderr],
]) {
  const keep = quiet();
  // Expo names its own port, which has no isolation headers (the save fails there): name the proxy's.
  const own = (line) => line.replaceAll(`localhost:${metroPort}`, `localhost:${previewPort}`);
  readline
    .createInterface({ input: from })
    .on('line', (line) => keep(line) && to.write(`${own(line)}\n`));
}

console.log(`Book preview: http://localhost:${previewPort}`);
if (token) {
  const sha = new X509Certificate(readFileSync(path.join(dir, 'ca.pem'))).fingerprint256;
  console.log(
    `On the phone, once: install the Loka CA (SHA-256 ${sha}), then pair (docs/guides/writing-the-game.md).`,
  );
  for (const ip of ips)
    // one pair per address: the first may be a VPN's, not the Wi-Fi's
    console.log(
      `  CA: http://${ip}:${caPort}/loka-ca.pem?pair=${token}\n  Pair: https://${ip}:${previewPort}/?dev=1&pair=${token}`,
    );
}
for (const server of servers)
  server.on('error', (error) => {
    expo.kill();
    throw error;
  });
const stop = () => {
  for (const server of servers) server.close();
  expo.kill();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
expo.on('exit', (code) => {
  for (const server of servers) server.close();
  process.exitCode = code || 0;
});
