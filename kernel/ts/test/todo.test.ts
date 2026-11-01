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

test('a scene placeholder is listed in every form the release compile refuses', () => {
  // Break: todo says "Nothing left to write" over a scene the release compile refuses (scene files
  // skipped), a `~` joined under a written line missed, or a scene's keys counted as prose.
  const dir = mkdtempSync(join(tmpdir(), 'loka-todo-'));
  mkdirSync(join(dir, 'scenes'));
  writeFileSync(
    join(dir, 'scenes/a.scene'),
    'npc: elder\nwhen: met\nelder: Written line.\nelder:  ~\n- Take it\nelder: ~\ngives: bowl\n',
  );
  // Break: narration, a second speaker or a cutscene paragraph is not read; a verb is counted, or
  // a `~` in a verb's key (`sets: tally ~`, which the compile refuses) is not listed.
  writeFileSync(
    join(dir, 'scenes/b.scene'),
    'npc: elder\nwith: bram\n* ~\nbram:  ~\n- Go\n  sets: tally ~\n  quest: accept ~\n  sets: lit\n  * one\n',
  );
  writeFileSync(join(dir, 'scenes/c.cut'), 'one\n~\n\n~\n---\n');
  writeFileSync(join(dir, 'scenes/done.scene'), 'npc: elder\nelder: All ~ written.\n');
  writeFileSync(join(dir, 'text.json'), '{"a": "one\\n ~"}');
  assert.deepEqual(todo(dir), [
    { file: 'scenes/a.scene', words: 4, placeholders: ['line 4', 'line 6'] },
    { file: 'scenes/b.scene', words: 2, placeholders: ['line 3', 'line 4', 'line 6', 'line 7'] },
    { file: 'scenes/c.cut', words: 1, placeholders: ['line 2', 'line 4'] },
    { file: 'text.json', words: 1, placeholders: ['a'] },
  ]);
});
