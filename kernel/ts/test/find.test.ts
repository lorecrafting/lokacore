// The author panel's find (docs/system/cartridge.md#author-preview), over a controlled source tree.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { find } from '../play/find.ts';

const ref = (kind: string, key: string) => ({
  cartridge_id: 'c',
  cartridge_version: '1',
  kind,
  key,
});
const tree = (t: { after: (f: () => void) => void }) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-find-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, 'source/quests'), { recursive: true });
  mkdirSync(join(dir, 'source/actions'), { recursive: true });
  writeFileSync(join(dir, 'source/text.json'), '{\n  "a": "Old Maud waits"\n}\n');
  writeFileSync(join(dir, 'source/quests/q.json'), '{\n  "giver": "npc/maud"\n}\n');
  writeFileSync(join(dir, 'source/actions/k.json'), '{\n  "npc": "rook"\n}\n');
  const artifact = join(dir, 'artifact.json');
  writeFileSync(
    artifact,
    JSON.stringify({
      canonical: JSON.stringify({
        text: { a: ref('npc', 'maud') }, // words and the bill of materials refer to nothing
        lock: ref('npc', 'maud'),
        manifest: { x: ref('npc', 'maud') },
        quests: { 'c@1:quest/q': { giver: ref('npc', 'maud'), other: [ref('npc', 'bram')] } },
        dialogues: { 'c@1:dialogue/d': { npc: ref('npc', 'bram') } },
        scripted_actions: { 'c@1:action/k': { npc: ref('npc', 'rook') } },
        world: { start: ref('npc', 'maud') },
      }),
    }),
  );
  return { source: join(dir, 'source'), artifact };
};

// Breaks: a case-sensitive search; a wrong line number; a file left out.
test('words find every line, whatever their case', (t) => {
  const { source, artifact } = tree(t);
  assert.deepEqual(find(source, artifact, 'MAUD').hits, [
    { at: 'text.json:2', text: '"a": "Old Maud waits"' },
    { at: 'quests/q.json:2', text: '"giver": "npc/maud"' },
  ]);
});

// Breaks: a definition holding another key listed; a section with no per-definition keys lost; text,
// lock or manifest listed; the file named for a definition not located.
test('a key lists the definitions whose refs name it, located when a file is named for them', (t) => {
  const { source, artifact } = tree(t);
  assert.deepEqual(find(source, artifact, 'maud').refs, [
    { kind: 'npc', by: 'quests/q', at: 'quests/q.json:2' },
    { kind: 'npc', by: 'world' },
  ]);
});

// Break: a key typed in capitals finds the words but none of the definitions that use it.
test('a key in any case lists its referrers, located', (t) => {
  const { source, artifact } = tree(t);
  assert.deepEqual(find(source, artifact, 'MAUD').refs, [
    { kind: 'npc', by: 'quests/q', at: 'quests/q.json:2' },
    { kind: 'npc', by: 'world' },
  ]);
});

// Breaks: a scripted action, authored under actions/, listed with no file:line.
test('a scripted action is located in actions/', (t) => {
  const { source, artifact } = tree(t);
  assert.deepEqual(find(source, artifact, 'rook').refs, [
    { kind: 'npc', by: 'scripted_actions/k', at: 'actions/k.json:2' },
  ]);
});

// Break: a referrer whose file never spells the key (a copy from `extends`) points at line 1.
test('a referrer with no line for the key is not located', (t) => {
  const { source, artifact } = tree(t);
  writeFileSync(join(source, 'actions/k.json'), '{}\n');
  assert.deepEqual(find(source, artifact, 'rook').refs, [
    { kind: 'npc', by: 'scripted_actions/k' },
  ]);
});

// Breaks: a search matching everything floods the panel; an empty search lists every line; no
// artifact yet fails the words too.
test('the list is capped with its total, empty asks nothing, no artifact still finds words', (t) => {
  const { source, artifact } = tree(t);
  writeFileSync(join(source, 'long.json'), 'word\n'.repeat(101));
  const many = find(source, artifact, 'word');
  assert.equal(many.total, 101);
  assert.equal(many.hits.length, 100);
  assert.deepEqual(find(source, artifact, ''), { hits: [], total: 0, refs: [] });
  assert.deepEqual(find(source, join(source, 'none.json'), 'maud').refs, []);
  assert.equal(find(source, join(source, 'none.json'), 'maud').total, 2);
});
