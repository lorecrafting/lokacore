// E5 on the stream (docs/design/prose-in-the-book-rulings.md): an /edit's words show before the
// compile, a refused compile marks them unconfirmed, and the page's pagehide beacon ends its Hold.
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
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
  return { live, call, ask, events };
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
  live.push({ compiled: false });
  const refused = await events();
  assert.deepEqual(
    [refused.text, refused.unconfirmed],
    [{ 'room.a': 'new words', 'room.b': 'b' }, [{ key: 'room.a', at: 'text.json:2' }]],
  );
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
