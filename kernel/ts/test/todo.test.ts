// Still to write: the `~` placeholders of a source, by file, with the words already written
// (docs/system/cartridge.md#still-to-write).
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { serve } from '../play/live.ts';
import { todo } from '../play/todo.ts';

test('placeholders by file with the words written; checkpoints and done files are not rows', async (t) => {
  // Break: inline prose markers missed (only text.json read), a `~` inside longer prose or a
  // written line counted as a placeholder, a checkpoint's `~` listed, a file with nothing left
  // listed, or the watcher not serving the list.
  const dir = mkdtempSync(join(tmpdir(), 'loka-todo-'));
  mkdirSync(join(dir, 'dialogues'));
  mkdirSync(join(dir, 'checkpoints'));
  writeFileSync(join(dir, 'text.json'), '{"a.t": "~", "a.d": "line one ~ here", "n": 1}');
  writeFileSync(
    join(dir, 'dialogues/x.json'),
    JSON.stringify({
      key: 'x',
      lines: [{ say: { prose: '~' } }, { say: { prose: 'one two three' } }],
      name: 'x',
    }),
  );
  writeFileSync(join(dir, 'rooms.json'), '{"name": {"prose": "two words"}}');
  writeFileSync(join(dir, 'checkpoints/c.json'), '{"steps": [{"prose": "~"}]}');
  writeFileSync(join(dir, 'broken.json'), '{');
  const rows = [
    { file: 'dialogues/x.json', words: 3, placeholders: ['lines.0.say'] },
    { file: 'text.json', words: 4, placeholders: ['a.t'] },
  ];
  assert.deepEqual(todo(dir), rows);
  const port = 20000 + Math.floor(Math.random() * 20000);
  const server = serve(port, dir, join(dir, 'none.json'));
  t.after(() => server.close());
  const got = await fetch(`http://127.0.0.1:${port}/todo`);
  assert.equal(got.status, 200);
  assert.deepEqual(await got.json(), rows);
});
