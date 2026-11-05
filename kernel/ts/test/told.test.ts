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
