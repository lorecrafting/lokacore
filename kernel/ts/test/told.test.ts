// E5 on the stream (docs/design/prose-in-the-book-rulings.md): an /edit's words show before the
// compile, a refused compile marks them unconfirmed, and the page's pagehide beacon ends its Hold.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { serve } from '../play/live.ts';

/** A source tree with one text.json line, served; `ask` posts, `events` is what a new page gets. */
function served(t: TestContext, release = () => {}) {
  const src = realpathSync(mkdtempSync(join(tmpdir(), 'loka-told-')));
  writeFileSync(join(src, 'text.json'), '{\n  "room.a": "old words"\n}\n');
  const port = 20000 + Math.floor(Math.random() * 20000);
  const live = serve(port, src, join(src, 'none.json'), release);
  t.after(() => (live.close(), rmSync(src, { recursive: true, force: true })));
  const call = (path: string, sent?: string, headers: Record<string, string> = {}) =>
    new Promise<{ status: number; text: string }>((done, fail) => {
      const method = sent === undefined ? 'GET' : 'POST';
      const req = request({
        port,
        path,
        method,
        headers: { host: `localhost:${port}`, ...headers },
      });
      req.on('error', fail).on('response', (res) =>
        res.once('data', (chunk) => {
          done({ status: res.statusCode!, text: String(chunk) });
          req.destroy(); // /events never ends
        }),
      );
      req.end(sent);
    });
  const ask = async (path: string, sent: unknown) =>
    (await call(path, JSON.stringify(sent))).status;
  const events = async () => JSON.parse((await call('/events')).text.replace(/^data: /, ''));
  return { live, call, ask, events, src };
}

test('/edit shows its words before the compile, marks them on a refused one, clears on a good one', async (t) => {
  // Breaks: words that wait for the compile (the Book lags the save); a refused save shown; an
  // overlay push that drops them; a refused compile with no unconfirmed line; a good compile
  // that keeps the marks.
  const { live, ask, events } = served(t);
  const was = '  "room.a": "old words"';
  const edit = { file: 'text.json', line: 2, key: 'room.a' };
  assert.equal(await ask('/edit', { ...edit, was: '  "room.a": "x"', words: 'no' }), 409);
  assert.equal((await events()).text['room.a'], undefined);
  assert.equal(await ask('/edit', { ...edit, was, words: 'new words' }), 200);
  assert.equal((await events()).text['room.a'], 'new words');
  live.push({ text: { 'room.b': 'b' } }); // the next save's overlay keeps them
  assert.equal((await events()).unconfirmed, undefined); // marked only by a refused compile
  live.push({ compiled: false });
  const refused = await events();
  assert.deepEqual(
    [refused.text, refused.unconfirmed],
    [{ 'room.a': 'new words', 'room.b': 'b' }, [{ key: 'room.a', at: 'text.json:2' }]],
  );
  // Break: a compile parked by the Hold (written later) clears the words while held.
  live.push({ compiled: true, pending: 1 });
  live.push({ text: {} }); // the overlay is rebuilt from the words still held
  assert.equal((await events()).text['room.a'], 'new words');
  live.push({ compiled: true, text: {} });
  const good = await events();
  assert.deepEqual([good.text, good.unconfirmed], [{}, []]);
});

test('a pagehide beacon (text/plain, the page origin) releases the Hold', async (t) => {
  // Break: a /hold that needs application/json or refuses the page origin: sendBeacon sends a
  // text/plain string, so a Hold the page set would outlive the page.
  let released = 0;
  const { live, ask, call } = served(t, () => released++);
  assert.equal(await ask('/hold', { on: true }), 200);
  const beacon = { origin: 'http://localhost:19009', 'content-type': 'text/plain;charset=UTF-8' };
  assert.equal((await call('/hold', '{"on":false}', beacon)).status, 200);
  assert.deepEqual([live.held(), released], [false, 1]);
});

test('/line answers the source line a Book line writes, its words unbound, or why it has none', async (t) => {
  // Breaks: the field opening on the bound or escaped words (a save writes them into the source);
  // a scene line's `* ` kept in the field; a choice label opening a field.
  const { call, src } = served(t);
  writeFileSync(join(src, 'more.json'), '{\n  "room.q": "say \\"hi\\" ~",\n  "n": 1\n}\n');
  mkdirSync(join(src, 'scenes'));
  writeFileSync(join(src, 'scenes/s.scene'), 'dialogue s\n  * Rain ~\n  - Take it\n');
  const line = async (key: string, words: string) => {
    const { status, text } = await call(`/line?key=${key}&words=${encodeURIComponent(words)}`);
    return [status, JSON.parse(text)];
  };
  assert.deepEqual(await line('room.q', 'say "hi" ~'), [
    200,
    { file: 'more.json', line: 2, was: '  "room.q": "say \\"hi\\" ~",', words: 'say "hi" ~' },
  ]);
  assert.deepEqual(await line('dialogue.s.prompt', 'Rain ~'), [
    200,
    { file: 'scenes/s.scene', line: 2, was: '  * Rain ~', words: 'Rain ~' },
  ]);
  assert.deepEqual(await line('dialogue.s.label', 'Take it'), [
    400,
    'a choice label: its key is its words',
  ]);
  assert.equal((await line('room.none', 'nowhere'))[0], 404);
  // Break: two scenes' `* ~` lines both answer the first, so a save writes into the wrong scene.
  writeFileSync(join(src, 'scenes/t.scene'), 'dialogue t\n  * ~\n');
  assert.equal((await line('dialogue.t.prompt', '~'))[0], 200);
  writeFileSync(join(src, 'scenes/u.scene'), 'dialogue u\n  * ~\n');
  assert.equal((await line('dialogue.u.prompt', '~'))[0], 400);
});

test("/line finds a `~` key's own line by the compile's map, among many `~` lines", async (t) => {
  // Breaks: every `~` line (each scene's, a cut's, a room's, text.json's) is a candidate, so with
  // two the field is refused (400) or opens another key's line; a one-line `{"prose": "~"}`
  // refused as not words.
  const { live, call, src } = served(t);
  writeFileSync(join(src, 'text.json'), '{\n  "room.a": "~",\n  "room.b": "~"\n}\n');
  mkdirSync(join(src, 'scenes'));
  mkdirSync(join(src, 'rooms'));
  writeFileSync(join(src, 'scenes/s.scene'), 'npc: bram\n* ~\nbram: Asked.\n- Yes\n  * ~\n');
  writeFileSync(join(src, 'scenes/bell.cut'), 'Written.\n\n~\n---\n');
  writeFileSync(
    join(src, 'rooms/green.json'),
    '{\n  "description": {"prose": "~"},\n  "x": 1\n}\n',
  );
  live.push({
    placeholders: {
      'dialogue.s.choices.yes.prompt': 'scenes/s.scene:5',
      'scene.bell.steps.1.text': 'scenes/bell.cut:3',
      'room.green.description': 'rooms/green.json:2',
    },
  });
  const line = async (key: string) => {
    const { status, text } = await call(`/line?key=${key}&words=~`);
    return [status, JSON.parse(text)];
  };
  assert.deepEqual(await line('dialogue.s.choices.yes.prompt'), [
    200,
    { file: 'scenes/s.scene', line: 5, was: '  * ~', words: '~' },
  ]);
  assert.deepEqual(await line('scene.bell.steps.1.text'), [
    200,
    { file: 'scenes/bell.cut', line: 3, was: '~', words: '~' },
  ]);
  assert.deepEqual(await line('room.green.description'), [
    200,
    { file: 'rooms/green.json', line: 2, was: '  "description": {"prose": "~"},', words: '~' },
  ]);
  assert.deepEqual((await line('room.b'))[1].line, 3); // a defined key: its own `"key":` line
});

test('a 200 /undo shows the old words it sent at once, before the compile', async (t) => {
  // Break: the Book keeps the undone words until the next compile (seconds when cold).
  const { call, ask, events } = served(t);
  const was = '  "room.a": "old words"';
  const sent = { file: 'text.json', line: 2, key: 'room.a', was, words: 'new words' };
  const { id } = JSON.parse((await call('/edit', JSON.stringify(sent))).text);
  const back = { id, file: 'text.json', line: 2, key: 'room.a', words: 'old words' };
  assert.equal(await ask('/undo', { ...back, id: id + 1 }), 404); // a refused one shows nothing
  assert.equal((await events()).text['room.a'], 'new words');
  assert.equal(await ask('/undo', back), 200);
  assert.equal((await events()).text['room.a'], 'old words');
});
