import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { pathToFileURL } from 'node:url';

// The patch run on upstream's pool (the install is already patched, so the warm-up is taken out first).
const fixture = mkdtempSync(join(tmpdir(), 'loka-sqlite-pool-'));
after(() => rmSync(fixture, { recursive: true, force: true }));
const installed = dirname(createRequire(import.meta.url).resolve('expo-sqlite/package.json'));
const moduleRoot = join(fixture, 'node_modules/expo-sqlite');
mkdirSync(join(moduleRoot, 'web/wa-sqlite'), { recursive: true });
cpSync(join(installed, 'package.json'), join(moduleRoot, 'package.json'));
cpSync(join(installed, 'web/WorkerChannel.ts'), join(moduleRoot, 'web/WorkerChannel.ts'));
for (const name of ['FacadeVFS', 'VFS', 'sqlite-constants']) {
  cpSync(
    join(installed, 'web/wa-sqlite', `${name}.js`),
    join(moduleRoot, 'web/wa-sqlite', `${name}.js`),
  );
}
const open = 'await handle.createSyncAccessHandle()';
const pool = join(moduleRoot, 'web/wa-sqlite/AccessHandlePoolVFS.js');
const upstream = readFileSync(join(installed, 'web/wa-sqlite/AccessHandlePoolVFS.js'), 'utf8')
  .replaceAll(`warmed(${open})`, open)
  .split('\n// ponytail: 32 MB')[0];
writeFileSync(pool, upstream);
cpSync(join(import.meta.dirname, 'patch-sqlite-web.cjs'), join(fixture, 'patch.cjs'));
execFileSync(process.execPath, [join(fixture, 'patch.cjs')]);
writeFileSync(
  join(moduleRoot, 'package.json'),
  JSON.stringify({ type: 'module', version: '57.0.3' }),
);

// WebKit's sync handle: a write past its granted capacity needs the page's main thread, free only
// while the open is async; once the sync bridge spins, such a write never returns.
let spinning = false;
const files: { size: number; capacity: number; data: Uint8Array }[] = [];
const syncHandle = (f: (typeof files)[number]) => ({
  getSize: () => f.size,
  read: (into: Uint8Array, { at }: { at: number }) => {
    const bytes = new Uint8Array(into.buffer, into.byteOffset, into.byteLength);
    bytes.set(f.data.subarray(at, at + bytes.length));
    return bytes.length;
  },
  write(from: Uint8Array, { at }: { at: number }) {
    const end = at + from.byteLength;
    if (end > f.capacity) {
      if (spinning) throw new Error('write waits on the main thread');
      f.capacity = end;
    }
    if (end > f.data.length) {
      const data = new Uint8Array(end);
      data.set(f.data);
      f.data = data;
    }
    f.data.set(new Uint8Array(from.buffer, from.byteOffset, from.byteLength), at);
    f.size = Math.max(f.size, end);
    return from.byteLength;
  },
  truncate: (n: number) => void (f.size = n),
  flush() {},
  close() {},
});
const file = (f: (typeof files)[number]) => (
  files.push(f),
  { kind: 'file', createSyncAccessHandle: async () => syncHandle(f) }
);
// An existing save: a pool file whose header names the main database (upstream's on-disk format:
// path, flags SQLITE_OPEN_MAIN_DB, then its digest), with one 4 KB page after the header.
const header = new Uint8Array(8192);
new TextEncoder().encodeInto('/loka.db', header);
new DataView(header.buffer).setUint32(512, 0x100);
let [h1, h2] = [0xdeadbeef, 0x41c6ce57];
for (const value of header.subarray(0, 516)) {
  h1 = Math.imul(h1 ^ value, 2654435761);
  h2 = Math.imul(h2 ^ value, 1597334677);
}
h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
header.set(new Uint8Array(new Uint32Array([h1 >>> 0, h2 >>> 0]).buffer), 516);
const saved = file({ size: 8192, capacity: 8192, data: header });
const dir = {
  getDirectoryHandle: async () => dir,
  getFileHandle: async () => file({ size: 0, capacity: 0, data: new Uint8Array(0) }),
  async *[Symbol.asyncIterator]() {
    yield ['saved', saved];
  },
};
Object.defineProperty(globalThis, 'navigator', {
  value: { storage: { getDirectory: async () => dir } },
});

// Breaks (loka-hcnlh.19.2): the pool takes no headroom at open, so Safari's first save write that
// grows a file stalls the page and times out; or the headroom is left in the file, not truncated.
test('each pool file opens with headroom for the sync writes after it, at its own size', async () => {
  const { AccessHandlePoolVFS } = await import(pathToFileURL(pool).href);
  const vfs = await AccessHandlePoolVFS.create('/loka', {});
  await vfs.addCapacity(1); // a new pool file as well as the existing one
  assert.equal(files.length, 2);
  assert.equal(files[0].size, 8192); // the headroom byte is truncated away, not kept in the save
  spinning = true;
  for (const f of files) {
    syncHandle(f).write(new Uint8Array(1024 * 1024), { at: f.size });
  }
});
