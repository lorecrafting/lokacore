// The dev watcher's events (loka-hcnlh.92), on a controlled tree written as the author server writes.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { watchDirs } from '../play/watchdirs.ts';

// Breaks: a file's second atomic write unseen (a watch on the replaced inode, as Node's recursive
// watch on Linux keeps), or a write in a nested or newly made directory unseen.
test('each atomic write is seen, the second to a file and one in a new directory too', async (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'loka-watch-')));
  mkdirSync(join(root, 'areas/a'), { recursive: true });
  writeFileSync(join(root, 'areas/a/f.json'), '0');
  const seen: string[] = [];
  const w = watchDirs(root, (file) => seen.push(file));
  t.after(() => (w.close(), rmSync(root, { recursive: true })));
  const sleep = () => new Promise((r) => setTimeout(r, 20));
  const seenIn = async (rel: string, write: () => void) => {
    for (let i = 0; i < 100 && !seen.includes(rel); i++) {
      if (i % 10 === 0) write(); // again every 200 ms
      await sleep();
    }
    assert.ok(seen.includes(rel), `${rel} seen: ${seen}`);
  };
  // until a directory's watch is live (FSEvents starts late; a write before it is never told)
  const live = (dir: string) =>
    seenIn(`${dir}/ready`, () => writeFileSync(join(root, dir, 'ready'), ''));
  const put = async (rel: string, bytes: string) => {
    seen.length = 0;
    writeFileSync(join(root, `${rel}.tmp`), bytes); // write.ts `put`
    renameSync(join(root, `${rel}.tmp`), join(root, rel));
    await seenIn(rel, () => {});
  };
  await live('areas/a');
  await put('areas/a/f.json', '1');
  await put('areas/a/f.json', '2');
  mkdirSync(join(root, 'areas/b'));
  await live('areas/b'); // armed by its parent's event
  await put('areas/b/g.json', '1');
});

// Breaks: a directory left unwatched in silence (ENOTDIR here; ENOSPC on Linux), or a warning for
// one removed before it was watched.
test('a directory it cannot watch is warned of, one already gone is not', (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'loka-watch-')));
  writeFileSync(join(root, 'file'), '');
  const warn = t.mock.method(console, 'warn', () => {});
  t.after(() => rmSync(root, { recursive: true }));
  watchDirs(join(root, 'gone'), () => {}).close();
  assert.equal(warn.mock.callCount(), 0);
  watchDirs(join(root, 'file'), () => {}).close();
  assert.match(String(warn.mock.calls[0]?.arguments[0]), /not watched: .*file: .*ENOTDIR/);
});
