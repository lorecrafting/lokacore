// POST /set and the Scene card's lines (kernel/ts/play/scene_card.ts): a `.scene` value line
// changed in place to a real key, everything else refused; the file's other bytes kept.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { INSTALLED, loadCartridge } from '../src/index.ts';
import type { Obj } from '../src/content/cartridge_refs.ts';
import { artifactBytes, compiled } from '../play/compiled.ts';
import { serve } from '../play/live.ts';
import type { Refused } from '../play/guard.ts';
import { ids, set } from '../play/scene_card.ts';
import { sceneLines, scened } from '../play/scene_lines.ts';
import type { Change } from '../play/write.ts';

const SAMPLER = resolve(import.meta.dirname, '../../../cartridges/identity_sampler');
const SCENE = 'scenes/stranger_talk.scene';

/** `root` compiled and loaded, as the served /set loads its last artifact (write.ts). */
function loaded(root: string) {
  const out = compiled(root);
  assert.equal(typeof out, 'object', String(out));
  return (
    loadCartridge(artifactBytes(out as { canonical: string; sha256: string }), INSTALLED) as {
      cartridge: Obj;
    }
  ).cartridge;
}

/** A copy of identity_sampler (two NPCs, one .scene), its sibling `src-evil/` with a scene, and
 * (unless only the sampler) an abstract NPC and a second scene; /set's keys its first compile's. */
function sampler(t: { after: (f: () => void) => void }, only = false) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loka-set-')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const root = join(dir, 'src');
  cpSync(SAMPLER, root, { recursive: true });
  cpSync(join(SAMPLER, 'scenes'), join(dir, 'src-evil/scenes'), { recursive: true });
  if (!only) {
    writeFileSync(join(root, 'npcs/kind.json'), '{ "abstract": true }\n');
    writeFileSync(join(root, 'scenes/aside.scene'), 'npc: guard\n\n* Hm.\n- Go\n  * Off.\n');
  }
  let c: Obj | undefined;
  const write = (sent: object) =>
    set(
      root,
      sent,
      () => ids((c ??= loaded(root))),
      (_what, c: Change) => {
        writeFileSync(join(root, c.file), c.after!);
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
  rmSync(join(root, 'scenes/s.json')); // not a scene the compiler takes
  const outside = at({ file: '../src-evil/' + SCENE, value: 'guard' });
  assert.match(String(outside[1]), /^outside the source tree/);
  for (const value of ['guard\nnpc: x', 'a/b', 'Guard', '', 7])
    assert.deepEqual(at({ value }), [400, 'was: the line; value: [a-z0-9_]+'], String(value));
  assert.deepEqual(at({ line: 99, value: 'guard' }), [400, 'no such line']);
  assert.deepEqual(at({ line: 0, value: 'guard' }), [400, 'no such line']);
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

// Break: the served /set takes its keys from no compile (write.ts), or writes no journal; a
// `.scene`'s /source carries none of its last compile's words (the push has only changed ones).
test('POST /set is served, refusing an abstract NPC and undone by /undo', async (t) => {
  const { root, read } = sampler(t);
  const original = read();
  const artifact = join(root, '../dev.json');
  const live = serve(0, root, artifact);
  t.after(() => live.close());
  const url = `http://localhost:${await live.port}`;
  const words = async () =>
    ((await (await fetch(`${url}/source?file=${SCENE}`)).json()) as { text: object }).text;
  assert.deepEqual(await words(), {}); // no compile yet: no words, not a fault
  writeFileSync(artifact, JSON.stringify(compiled(join(SAMPLER))));
  assert.deepEqual(Object.keys(await words()).sort(), [
    'dialogue.stranger_talk.choices.ask_their_name.label',
    'dialogue.stranger_talk.choices.ask_their_name.narration',
    'dialogue.stranger_talk.prompt',
  ]);
  const post = async (path: string, sent: object) => {
    const res = await fetch(url + path, { method: 'POST', body: JSON.stringify(sent) });
    return [res.status, await res.json()] as [number, any];
  };
  const sent = { file: SCENE, line: 1, was: 'npc: stranger' };
  assert.deepEqual(await post('/set', { ...sent, value: 'kind' }), [400, 'npc: no such key kind']);
  const [status, done] = await post('/set', { ...sent, value: 'guard' });
  assert.equal(status, 200);
  assert.match(read(), /^npc: guard\n/);
  assert.equal((await post('/undo', { id: done.id }))[0], 200);
  assert.equal(read(), original);
});

// Break: /set's keys are not the compile's (the card's): a nested set's dialogue or a bundle's NPC
// refused, a keyword, quest or riddle dialogue a then cannot enter (dialogue_links.ex:387-394)
// offered, an NPC on then:; a file's last line, with no newline after it, cannot be set.
test('a then: takes a compiled dialogue a then enters, or end; a with: an NPC key', (t) => {
  const { root, write, read } = sampler(t);
  const nested = '\n* Hm.\n- Ask\n  * Well.\n  - Thank them\n    * Fine.\n- Go\n  * Off.\n';
  writeFileSync(join(root, SCENE), `npc: stranger\nwith: guard\n${nested}  then: end`);
  const at = (line: number, was: string, value: string) =>
    refusal(() => write({ file: SCENE, line, was, value }));
  assert.deepEqual(at(11, '  then: end', 'guard'), [400, 'then: no such key guard']);
  assert.deepEqual(at(2, 'with: guard', 'aside'), [400, 'with: no such key aside']);
  assert.equal(at(11, '  then: end', 'stranger_talk_ask'), 'written'); // the nested set
  assert.equal(at(2, 'with: guard', 'stranger'), 'written');
  assert.equal(read(), `npc: stranger\nwith: stranger\n${nested}  then: stranger_talk_ask`);
  // speech_sampler: NPCs only in an area bundle; its one dialogue a keyword one
  const speech = ids(loaded(resolve(SAMPLER, '../speech_sampler')));
  assert.deepEqual(speech.npc, ['elder', 'miller', 'smith', 'watchman']);
  assert.deepEqual(speech.then, ['end']); // not elder_ward
});

// Break: the card shows a `* ` line without the text key the Book edits, or a key line or a
// `<role>: ` line (POST /edit refuses both, prose.ts) with one.
test("the card's lines: each value line its verb, each words line its text key", () => {
  const bytes =
    'npc: stranger\n\n* The stranger waits.\n- Ask\n  sets: knows\n  stranger: Tamsin.\n';
  const text = {
    'dialogue.stranger_talk_old.prompt': 'The stranger waits.', // a sibling file, listed first
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
      [6, null], // a role line: its words, but no Edit in Book
      [7, null],
    ],
  );
  assert.equal(lines[0].value, 'stranger');
  const placeholder = sceneLines(SCENE, '* ~\n', 'dialogue', {}, { 'dialogue.x.p': `${SCENE}:1` });
  assert.equal(placeholder[0].key, 'dialogue.x.p'); // a `~` line by the compile's map
  const opens = ['scenes/a.scene', 'areas/n/dialogues/b.scene', 'rooms/a.scene', 'scenes/a.cut'];
  assert.deepEqual(opens.map(scened), [true, true, false, false]); // the card's files
});

// Break: the modal scene card's treatment picker offers a value the compiler refuses, or the one it
// offers (the schema's enum, `reverie`) does not reach the artifact.
test("the modal scene card's treatment compiles; one outside the schema's does not", (t) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loka-treat-')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(resolve(SAMPLER, '../toolbox_showcase'), dir, { recursive: true });
  const ash = join(dir, 'scenes/letter_ash.json');
  const with_ = (treatment: string) => {
    const doc = JSON.parse(readFileSync(ash, 'utf8'));
    writeFileSync(ash, JSON.stringify({ ...doc, treatment }, null, 2) + '\n');
    return compiled(dir);
  };
  const out = with_('reverie');
  assert.equal(typeof out, 'object', String(out));
  assert.match((out as { canonical: string }).canonical, /"treatment":"reverie"/);
  assert.match(String(with_('spirit')), /treatment/);
});
