// expo-sqlite 57.0.3's web worker truncates sync lengths and loses Error messages.
// Keep these exact guards until the installed SDK fixes them upstream.
const fs = require('node:fs');
const path = require('node:path');

const moduleRoot = path.dirname(require.resolve('expo-sqlite/package.json'));
const version = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'package.json'), 'utf8')).version;
if (version !== '57.0.3') throw new Error(`Review the SQLite web patch for version ${version}`);
const file = path.join(moduleRoot, 'web/WorkerChannel.ts');
const source = fs.readFileSync(file, 'utf8');
let patched = source;
for (const [before, after] of [
  [
    'resultArray.set(new Uint32Array([length]), 0);',
    'resultArray.set(new Uint8Array(new Uint32Array([length]).buffer), 0);',
  ],
  ['serialize({ error })', 'serialize({ error: error.message })'],
  ['self.postMessage({ id, error });', 'self.postMessage({ id, error: error?.message });'],
]) {
  const oldCount = patched.split(before).length - 1;
  const newCount = patched.split(after).length - 1;
  if (oldCount + newCount !== 1) throw new Error('Review the SQLite web worker upstream');
  if (oldCount) patched = patched.replace(before, after);
}
if (patched !== source) fs.writeFileSync(file, patched);
