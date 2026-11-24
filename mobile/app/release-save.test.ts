// Breaks: the hidden page keeps the save (the reloaded preview waits on its lock: "save not confirmed",
// loka-hcnlh.19.1), a page Safari restores from its cache plays on the closed save, or a fresh page
// reloads itself forever.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { releaseOnHide } from './release-save.ts';

test('the hidden page lets go of the save; only a page restored from the cache reloads', () => {
  const page = new EventTarget();
  const done: string[] = [];
  releaseOnHide(
    page,
    () => done.push('close'),
    () => done.push('reload'),
  );
  page.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: false })); // a fresh load
  assert.deepEqual(done, []);
  page.dispatchEvent(new Event('pagehide'));
  assert.deepEqual(done, ['close']);
  page.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true })); // back from the cache
  assert.deepEqual(done, ['close', 'reload']);
});
