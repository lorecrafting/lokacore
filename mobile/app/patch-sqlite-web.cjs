// expo-sqlite 57.0.3's web worker writes only the low byte of a sync JSON length.
// Keep this exact guard until the installed SDK fixes it upstream.
const fs = require('node:fs');
const path = require('node:path');

const moduleRoot = path.dirname(require.resolve('expo-sqlite/package.json'));
const version = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'package.json'), 'utf8')).version;
if (version !== '57.0.3') throw new Error(`Review the SQLite web patch for version ${version}`);
const file = path.join(moduleRoot, 'web/WorkerChannel.ts');
const source = fs.readFileSync(file, 'utf8');
const broken = 'resultArray.set(new Uint32Array([length]), 0);';
if (source.split(broken).length !== 2)
  throw new Error('Review the SQLite web length write upstream');
fs.writeFileSync(
  file,
  source.replace(broken, 'resultArray.set(new Uint8Array(new Uint32Array([length]).buffer), 0);'),
);
