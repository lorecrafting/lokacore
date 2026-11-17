// POST /edit's 409 body (play/guard.ts stale, play/prose.ts stillWords): the line it found, so a
// field that cannot re-ask for it (a scene's line has no key) can still offer Keep mine/Take theirs.
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Refused, sha256 } from '../play/guard.ts';
import { edit } from '../play/prose.ts';
import type { Answer } from '../play/write.ts';

// Break: a 409 leaves the field with only "changed on disk", so Keep mine / Take theirs never
// renders (it re-asks /line by the *old* words, which a reworded line no longer answers).
test('a 409 names the reworded line to take, and stays bare when it is not words', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'loka-edit-')));
  const write = (name: string, text: string) => writeFileSync(join(root, name), text);
  const stale = (file: string, sent: Record<string, unknown>) => {
    try {
      edit(root, { file, ...sent, words: 'mine' }, () => [200, {}] as Answer);
    } catch (e) {
      assert.ok(e instanceof Refused, String(e));
      return e.body as Record<string, unknown>;
    }
    assert.fail('the line moved on: a 409');
  };
  write('text.json', '{\n  "room.a": "first words"\n}\n');
  // the line is still words: the field may take theirs, or keep its own draft
  const {
    bytes,
    sha256: digest,
    ...at
  } = stale('text.json', { line: 2, was: '  "room.a": "old"' });
  assert.deepEqual(at, {
    file: 'text.json',
    line: 2,
    was: '  "room.a": "first words"',
    words: 'first words',
  });
  assert.match(String(bytes), /first words/);
  assert.equal(String(digest).length, 64);
  // a `---` page break has no words to take: bare, as before
  write('scene.cut', '~ start\n---\n* A key line here\n');
  assert.deepEqual(stale('scene.cut', { line: 2, was: '~ the page I saw' }), {
    bytes: '~ start\n---\n* A key line here\n',
    sha256: sha256('~ start\n---\n* A key line here\n'),
  });
  rmSync(root, { recursive: true, force: true });
});
