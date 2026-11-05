// E5 on the stream (docs/design/prose-in-the-book-rulings.md): an /edit's words show before the
// compile, a refused compile marks them unconfirmed, and the page's pagehide beacon ends its Hold.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { serve } from '../play/live.ts';

/** A source tree with one text.json line, served; `ask` posts, `events` is what a new page gets. */
async function served(t: TestContext, release = () => {}) {
  const src = realpathSync(mkdtempSync(join(tmpdir(), 'loka-told-')));
  writeFileSync(join(src, 'text.json'), '{\n  "room.a": "old words"\n}\n');
  const live = serve(0, src, join(src, 'none.json'), { release });
  const port = await live.port;
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
  const { live, ask, events } = await served(t);
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
  const { live, ask, call } = await served(t, () => released++);
  assert.equal(await ask('/hold', { on: true }), 200);
  const beacon = { origin: 'http://localhost:19009', 'content-type': 'text/plain;charset=UTF-8' };
  assert.equal((await call('/hold', '{"on":false}', beacon)).status, 200);
  assert.deepEqual([live.held(), released], [false, 1]);
});

test('/line answers the source line a Book line writes, its words unbound, or why it has none', async (t) => {
  // Breaks: the field opening on the bound or escaped words (a save writes them into the source);
  // a scene line's `* ` kept in the field; a choice label opening a field.
  const { call, src } = await served(t);
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
  // Break: two scenes' `* ~` lines both answer the first, so a save writes into the wrong scene;
  // with no map, the one `* ~` there is may be another key's (409: wait for the compile).
  writeFileSync(join(src, 'scenes/t.scene'), 'dialogue t\n  * ~\n');
  assert.equal((await line('dialogue.t.prompt', '~'))[0], 409);
  writeFileSync(join(src, 'scenes/u.scene'), 'dialogue u\n  * ~\n');
  assert.equal((await line('dialogue.u.prompt', '~'))[0], 400);
});

test("/line finds a `~` key's own line by the compile's map, among many `~` lines", async (t) => {
  // Breaks: every `~` line (each scene's, a cut's, a room's, text.json's) is a candidate, so with
  // two the field is refused (400) or opens another key's line; a one-line `{"prose": "~"}`
  // refused as not words.
  const { live, call, src } = await served(t);
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

test('an outside save that moves a `~` line before the compile: /line waits for the compile', async (t) => {
  // Break: /line trusts the map's line, or guesses the one `* ~` left, which names no key, so it
  // opens a line that may be another key's and /edit overwrites it.
  const { live, call, src } = await served(t);
  mkdirSync(join(src, 'scenes'));
  const scene = join(src, 'scenes/s.scene');
  writeFileSync(scene, 'npc: bram\n* ~\nbram: Asked.\n');
  live.push({ placeholders: { 'dialogue.s.choices.yes.prompt': 'scenes/s.scene:2' } });
  writeFileSync(scene, 'npc: bram\n* Hello.\n* ~\nbram: Asked.\n'); // no compile yet
  assert.equal((await call('/line?key=dialogue.s.choices.yes.prompt&words=~')).status, 409);
});

test("an outside save that adds or drops a `~` line: /line stops trusting the map; the Book's own fill keeps it", async (t) => {
  // Break: /line trusts any `~` at the map's line, so a `* ~` pasted (or the key's own line cut)
  // there from outside opens another line in the key's field and /edit writes it; or the Book's own
  // fill of one `~` makes the map distrusted, so the next `~` in the run is refused before the compile.
  const { live, call, ask, src } = await served(t);
  mkdirSync(join(src, 'scenes'));
  const scene = join(src, 'scenes/s.scene');
  writeFileSync(scene, 'npc: bram\n* ~\n* ~\n* ~\n');
  live.push({
    placeholders: {
      'dialogue.s.a': 'scenes/s.scene:2',
      'dialogue.s.b': 'scenes/s.scene:3',
      'dialogue.s.c': 'scenes/s.scene:4',
    },
  });
  const line = async (key: string) => {
    const { status, text } = await call(`/line?key=${key}&words=~`);
    return [status, JSON.parse(text)];
  };
  const filled = { file: 'scenes/s.scene', line: 2, was: '* ~', words: 'Aye.' };
  assert.equal(await ask('/edit', { ...filled, key: 'dialogue.s.a' }), 200);
  assert.deepEqual(await line('dialogue.s.b'), [
    200,
    { file: 'scenes/s.scene', line: 3, was: '* ~', words: '~' },
  ]);
  const refused = [400, "more than one source line holds dialogue.s.b's words"];
  writeFileSync(scene, 'npc: bram\n* Aye.\n* ~\n* ~\n* ~\n'); // an outside save, no compile yet
  assert.deepEqual(await line('dialogue.s.b'), refused);
  writeFileSync(scene, 'npc: bram\n* ~\n* ~\n'); // b's line cut: c's `~` now sits at line 3
  assert.deepEqual(await line('dialogue.s.b'), refused);
  writeFileSync(scene, 'npc: bram\n* ~\n'); // a's and b's cut: the one `~` left is c's
  assert.equal((await line('dialogue.s.a'))[0], 409);
});

test('/line never trusts a place in a file it cannot read', async (t) => {
  // Break: a vanished placed file counts the same (unreadable) at the map and at /line, so the map
  // stays trusted and /line fails on the read instead of answering by the words.
  const { live, call } = await served(t);
  live.push({ placeholders: { 'dialogue.g.a': 'scenes/gone.scene:2' } });
  const { status, text } = await call('/line?key=dialogue.g.a&words=~');
  assert.deepEqual([status, JSON.parse(text)], [404, 'no source line for dialogue.g.a']);
});

test('a 200 /undo shows the old words it sent at once, before the compile', async (t) => {
  // Break: the Book keeps the undone words until the next compile (seconds when cold).
  const { call, ask, events } = await served(t);
  const was = '  "room.a": "old words"';
  const sent = { file: 'text.json', line: 2, key: 'room.a', was, words: 'new words' };
  const { id } = JSON.parse((await call('/edit', JSON.stringify(sent))).text);
  const back = { id, file: 'text.json', line: 2, key: 'room.a', words: 'old words' };
  assert.equal(await ask('/undo', { ...back, id: id + 1 }), 404); // a refused one shows nothing
  assert.equal((await events()).text['room.a'], 'new words');
  assert.equal(await ask('/undo', back), 200);
  assert.equal((await events()).text['room.a'], 'old words');
});
