// POST /set and the Scene card's lines (kernel/ts/play/scene_card.ts): a `.scene` value line
// changed in place to a real key, everything else refused; the file's other bytes kept.
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { compiled } from '../play/compiled.ts';
import { serve } from '../play/live.ts';
import type { Refused } from '../play/guard.ts';
import { ids, set } from '../play/scene_card.ts';
import { sceneLines, scened } from '../play/scene_lines.ts';
import type { Change } from '../play/write.ts';

const SAMPLER = resolve(import.meta.dirname, '../../../cartridges/identity_sampler');
const SCENE = 'scenes/stranger_talk.scene';

/** A copy of identity_sampler (two NPCs, one .scene), its sibling `src-evil/` with a scene, and
 * (unless only the sampler) an abstract NPC and a JSON dialogue. */
function sampler(t: { after: (f: () => void) => void }, only = false) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loka-set-')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const root = join(dir, 'src');
  cpSync(SAMPLER, root, { recursive: true });
  cpSync(join(SAMPLER, 'scenes'), join(dir, 'src-evil/scenes'), { recursive: true });
  if (!only) {
    writeFileSync(join(root, 'npcs/kind.json'), '{ "abstract": true }\n');
    mkdirSync(join(root, 'dialogues'));
    writeFileSync(join(root, 'dialogues/aside.json'), '{}\n');
  }
  const write = (sent: object) =>
    set(
      root,
      sent,
      () => ids(root, ['kind']),
      (_what, c: Change) => {
        writeFileSync(join(root, c.file), c.after);
        return [200, c.file];
      },
    );
  return { root, write, read: () => readFileSync(join(root, SCENE), 'utf8') };
}
const refusal = (f: () => unknown) => {
  try {
    f();
  } catch (e) {
    return [(e as Refused).status, (e as Refused).body];
  }
  return 'written';
};

// Break: a write that reflows, reorders or drops the trailing newline; a value the compiler refuses.
test('/set changes one value and keeps every other byte; the result compiles', (t) => {
  const { root, write, read } = sampler(t, true);
  const original = read();
  assert.deepEqual(write({ file: SCENE, line: 1, was: 'npc: stranger', value: 'guard' }), [
    200,
    SCENE,
  ]);
  assert.equal(read(), original.replace('npc: stranger\n', 'npc: guard\n'));
  const out = compiled(root);
  assert.equal(typeof out, 'object', String(out)); // the compiler took the picked speaker
  write({ file: SCENE, line: 1, was: 'npc: guard', value: 'stranger' });
  assert.equal(read(), original); // byte for byte
});

// Break: a value line accepts a key the compiler would refuse, or a line that is not one.
test('/set refuses each thing that is not a real key on a value line', (t) => {
  const { root, write, read } = sampler(t);
  const original = read();
  writeFileSync(join(root, 'scenes/s.json'), '{}\n');
  const at = (sent: object) =>
    refusal(() => write({ file: SCENE, line: 1, was: 'npc: stranger', ...sent }));
  assert.deepEqual(at({ file: 'scenes/s.json', value: 'guard' }), [
    400,
    'a value line is a .scene file’s',
  ]);
  const outside = at({ file: '../src-evil/' + SCENE, value: 'guard' });
  assert.match(String(outside[1]), /^outside the source tree/);
  for (const value of ['guard\nnpc: x', 'a/b', 'Guard', '', 7])
    assert.deepEqual(at({ value }), [400, 'was: the line; value: [a-z0-9_]+'], String(value));
  assert.deepEqual(at({ line: 99, value: 'guard' }), [400, 'no such line']);
  assert.equal(at({ was: 'npc: guard', value: 'guard' })[0], 409);
  assert.deepEqual(at({ value: 'nobody' }), [400, 'npc: no such key nobody']);
  assert.deepEqual(at({ value: 'kind' }), [400, 'npc: no such key kind']); // abstract
  assert.deepEqual(at({ value: 'aside' }), [400, 'npc: no such key aside']); // a dialogue
  const line = (n: number, was: string, value = 'end') =>
    refusal(() => write({ file: SCENE, line: n, was, value }));
  assert.deepEqual(line(3, '* The stranger waits.'), [400, 'not an npc:, with: or then: line']);
  assert.deepEqual(line(4, '- Ask their name'), [400, 'not an npc:, with: or then: line']);
  assert.deepEqual(line(5, '  sets: knows_name'), [400, 'not an npc:, with: or then: line']);
  assert.equal(read(), original); // nothing written by any refusal
});

// Break: the served /set reads no abstract NPC out (write.ts templates), or writes no journal.
test('POST /set is served, refusing an abstract NPC and undone by /undo', async (t) => {
  const { root, read } = sampler(t);
  const original = read();
  const live = serve(0, root, join(root, '../none.json'));
  t.after(() => live.close());
  const url = `http://localhost:${await live.port}`;
  const post = async (path: string, sent: object) => {
    const res = await fetch(url + path, { method: 'POST', body: JSON.stringify(sent) });
    return [res.status, await res.json()];
  };
  const sent = { file: SCENE, line: 1, was: 'npc: stranger' };
  assert.deepEqual(await post('/set', { ...sent, value: 'kind' }), [400, 'npc: no such key kind']);
  const [status, done] = await post('/set', { ...sent, value: 'guard' });
  assert.equal(status, 200);
  assert.match(read(), /^npc: guard\n/);
  assert.equal((await post('/undo', { id: done.id }))[0], 200);
  assert.equal(read(), original);
});

// Break: `then:` offers or takes a key that is not a dialogue (dialogue_links.ex), or not `end`.
test('a then: takes a dialogue key or end, a with: an NPC key', (t) => {
  const { root, write, read } = sampler(t);
  writeFileSync(join(root, SCENE), 'npc: stranger\nwith: guard\n- Go\n  then: end\n');
  assert.deepEqual(ids(root, ['kind']), {
    npc: ['guard', 'stranger'],
    with: ['guard', 'stranger'],
    then: ['aside', 'stranger_talk', 'end'],
  });
  const at = (line: number, was: string, value: string) =>
    refusal(() => write({ file: SCENE, line, was, value }));
  assert.deepEqual(at(4, '  then: end', 'guard'), [400, 'then: no such key guard']);
  assert.deepEqual(at(2, 'with: guard', 'aside'), [400, 'with: no such key aside']);
  assert.equal(at(4, '  then: end', 'aside'), 'written');
  assert.equal(at(2, 'with: guard', 'stranger'), 'written');
  assert.equal(read(), 'npc: stranger\nwith: stranger\n- Go\n  then: aside\n');
});

// Break: the card shows a words line without the text key the Book edits, or a key line as words.
test("the card's lines: each value line its verb, each words line its text key", () => {
  const bytes =
    'npc: stranger\n\n* The stranger waits.\n- Ask\n  sets: knows\n  stranger: Tamsin.\n';
  const text = {
    'dialogue.stranger_talk.prompt': 'The stranger waits.',
    'dialogue.stranger_talk.choices.ask.reply': 'Tamsin.',
    'dialogue.other.prompt': 'Tamsin.',
  };
  const lines = sceneLines(SCENE, bytes, 'dialogue', text, {});
  assert.deepEqual(
    lines.map((l) => [l.n, l.verb ?? l.key ?? null]),
    [
      [1, 'npc'],
      [2, null],
      [3, 'dialogue.stranger_talk.prompt'],
      [4, null],
      [5, null],
      [6, 'dialogue.stranger_talk.choices.ask.reply'],
      [7, null],
    ],
  );
  assert.equal(lines[0].value, 'stranger');
  const placeholder = sceneLines(SCENE, '* ~\n', 'dialogue', {}, { 'dialogue.x.p': `${SCENE}:1` });
  assert.equal(placeholder[0].key, 'dialogue.x.p'); // a `~` line by the compile's map
  const opens = ['scenes/a.scene', 'areas/n/dialogues/b.scene', 'rooms/a.scene', 'scenes/a.cut'];
  assert.deepEqual(opens.map(scened), [true, true, false, false]); // the card's files
});
