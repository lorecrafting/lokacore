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
  .split('\n// loka-hcnlh.19.2 warm-up')[0];
assert.ok(!upstream.includes('warmed'));
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
type File = { size: number; capacity: number; data: Uint8Array };
const syncHandle = (f: File) => ({
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

// A fresh browser with that save, and a pool module evaluated under its user agent.
async function opened(userAgent: string) {
  spinning = false;
  const files: File[] = [];
  const file = (f: File) => (
    files.push(f),
    { kind: 'file', createSyncAccessHandle: async () => syncHandle(f) }
  );
  const saved = file({ size: 8192, capacity: 8192, data: header.slice() });
  const dir = {
    getDirectoryHandle: async () => dir,
    getFileHandle: async () => file({ size: 0, capacity: 0, data: new Uint8Array(0) }),
    async *[Symbol.asyncIterator]() {
      yield ['saved', saved];
    },
  };
  const storage = { getDirectory: async () => dir };
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent, storage },
    configurable: true,
  });
  const url = `${pathToFileURL(pool).href}?ua=${encodeURIComponent(userAgent)}`;
  const { AccessHandlePoolVFS } = await import(url);
  const vfs = await AccessHandlePoolVFS.create('/loka', {});
  await vfs.addCapacity(1); // a free pool file for the journal, beside the save
  return { vfs, files };
}
const SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1';
const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
const flags = new DataView(new ArrayBuffer(4));

// Breaks (loka-hcnlh.19.2): Safari's pool takes no headroom at open, so the first save write that
// grows a file stalls the page and times out; or the headroom stays in the save, not truncated.
test('on Safari the save and a new journal grow by sync writes, and the save keeps its size', async () => {
  const { vfs } = await opened(SAFARI);
  spinning = true;
  assert.equal(vfs.jOpen('/loka.db', 1, 0x100 | 0x2, flags), 0);
  const size = new DataView(new ArrayBuffer(8));
  vfs.jFileSize(1, size);
  assert.equal(size.getBigInt64(0, true), 4096n); // one page: no headroom left in the save
  // A write ending near 31 MB: the whole headroom, not a sliver of it, is granted at open.
  assert.equal(vfs.jWrite(1, new Uint8Array(4096), 31 * 1024 * 1024), 0);
  assert.equal(vfs.jOpen('/loka.db-journal', 2, 0x800 | 0x4 | 0x2, flags), 0);
  assert.equal(vfs.jWrite(2, new Uint8Array(64 * 1024), 0), 0);
});

// Breaks: Chromium, which grants growth inside the worker, pays a 32 MB write per pool file per open.
test('on Chromium the pool writes no headroom', async () => {
  const { files } = await opened(CHROME);
  assert.ok(files.every((f) => f.capacity < 1024 * 1024));
});
