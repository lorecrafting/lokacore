// A `.scene` line op (kernel/ts/play/scene_structure.ts scene, docs/design/scene-structure-rulings.md
// §1, §2, §4, §6 S2): add, remove and move keep every other byte, a cross-depth move and a `~` key
// shift under a referrer are refused, and one Undo restores the file.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { sha256 } from '../play/guard.ts';
import { serve } from '../play/live.ts';
import { landed } from '../play/scene_focus.ts';
import { choiceKey, choiceLabel, rewordedChoice } from '../play/scene_choice.ts';
import { rows, scene, type Op } from '../play/scene_structure.ts';

const SCENE = 'scenes/guard.scene';

// A fixture scene with a `~` choice on line 8, a nested set, and sub-lines. Hand-written from
// lib/loka/content/scene_files.ex's grammar; the after-bytes are written by hand, not computed.
const SRC = [
  'npc: guard',
  'with: guard',
  '',
  '- Take the bowl',
  '  needs: has_bowl',
  '  * You take it.',
  '',
  '- ~',
  '  * Words.',
  '',
  '- Leave',
  '',
].join('\n');

async function served(t: TestContext) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loka-scene-op-')));
  const src = join(dir, 'src');
  mkdirSync(join(src, 'scenes'), { recursive: true });
  mkdirSync(join(src, 'rooms'));
  const live = serve(0, src, join(dir, 'none.json'));
  const port = await live.port;
  t.after(() => {
    live.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const ask = async (path: string, sent: unknown) => {
    const res = await fetch(`http://localhost:${port}${path}`, {
      method: 'POST',
      body: JSON.stringify(sent),
    });
    return { status: res.status, body: await res.json() };
  };
  const read = (rel = SCENE) => readFileSync(join(src, rel), 'utf8');
  const plant = (bytes: string, rel = SCENE) => writeFileSync(join(src, rel), bytes);
  return { ask, read, plant };
}

// Break: an op that reflows, reorders or drops a byte it does not own, indents an added line at the
// wrong depth, or writes more than one journal entry. Expected after-bytes are literal.
const ROWS: [op: Op, after: string][] = [
  // a choice goes after the line's whole block, at its own depth
  [
    { add: { after: 4, kind: 'choice' } },
    // keyed at once (rulings §2): the next free choice_<n>, not the line's number
    SRC.replace('  * You take it.\n', '  * You take it.\n- ~ #choice_1\n'),
  ],
  // anything else right after the line, two spaces deeper than a `- ` line
  [
    { add: { after: 4, kind: 'words' } },
    SRC.replace('  needs: has_bowl', '  * ~\n  needs: has_bowl'),
  ],
  [
    { add: { after: 4, kind: 'needs', value: 'seen_guard' } },
    SRC.replace('  needs: has_bowl', '  needs: seen_guard\n  needs: has_bowl'),
  ],
  [
    { add: { after: 4, kind: 'needs', value: 'x' } },
    SRC.replace('  needs: has_bowl', '  needs: x\n  needs: has_bowl'),
  ],
  // a speaker line names a role the scene already lists
  [
    { add: { after: 6, kind: 'speaker', value: 'guard' } },
    SRC.replace('  * You take it.\n', '  * You take it.\n  guard: ~\n'),
  ],
  // remove a choice takes its whole block; the blank run that separated it stays
  [{ remove: 4 }, 'npc: guard\nwith: guard\n\n\n- ~\n  * Words.\n\n- Leave\n'],
  // remove a sub-line keeps its siblings
  [{ remove: 5 }, SRC.replace('  needs: has_bowl\n', '')],
  // reword a choice: its words change, its key does not (rulings §2). A slug-keyed choice pins the
  // key it already had, so the referrer that names `take_the_bowl` still names it
  [
    { reword: { line: 4, words: 'Take it' } },
    SRC.replace('- Take the bowl', '- Take it #take_the_bowl'),
  ],
  // an already-explicit key keeps its suffix and only its words change
  [
    { reword: { line: 8, words: 'Words' } },
    SRC.replace('\n- ~\n  * Words.', '\n- Words #todo__8\n  * Words.'),
  ],
  // move a choice with its block past a sibling, indentation and all
  [
    { move: 8, by: 1 },
    'npc: guard\nwith: guard\n\n- Take the bowl\n  needs: has_bowl\n  * You take it.\n\n- Leave\n\n- ~\n  * Words.\n',
  ],
];

// Break: the card's key disagrees with the compiler's `choice_key` on a ` #<key>` line, so the card
// checks referrers against a key the compile never made (rulings docs/design/scene-structure-rulings.md
// §2). The expected values are hand-written from the ruling, not taken from scene_lines.ex.
test("a choice's key: an explicit ` #<key>`, else its slug, else its line", () => {
  assert.equal(choiceKey('Carry it #carry', 7), 'carry');
  assert.equal(choiceKey('Carry it', 7), 'carry_it');
  assert.equal(choiceKey('~', 7), 'todo__7');
  // the suffix is not part of the words, so it never reaches the slug
  assert.equal(choiceKey('Ask #why now', 7), 'ask_why_now');
  assert.equal(choiceKey('Take #2 pencils', 7), 'take_2_pencils');
  // rows() reads a whole file, so the card and the compiler see the same keys at the same lines
  const rs = rows(['npc: maud', '- Carry it #carry', '  maud: Done.', '- Leave it']);
  assert.deepEqual(
    rs.map((r) => r.key),
    [undefined, 'carry', undefined, 'leave_it'],
  );
});

test('/restructure on a .scene: each op changes only its lines; one /undo restores', async (t) => {
  const { ask, read, plant } = await served(t);
  for (const [op, after] of ROWS) {
    plant(SRC);
    const done = await ask('/restructure', { file: SCENE, was: sha256(SRC), op, carry: [] });
    assert.equal(done.status, 200, JSON.stringify([op, done.body]));
    // the reword's words reached the file, not just the preview
    if ('reword' in op) assert.match(read(), new RegExp(`- ${op.reword.words} #`));
    assert.deepEqual(scene(SRC, op), { after }); // the card's preview is the route's answer
    assert.equal(read(), after, JSON.stringify(op));
    assert.equal((await ask('/undo', { id: (done.body as { id: string }).id })).status, 200);
    assert.equal(read(), SRC, JSON.stringify(op)); // byte for byte
  }
});

// Break: an add that offers a sub-line the block already holds (a second `then:` cannot lower), a
// speaker line with no role, a remove of a key line, or a move that crosses a depth or a block edge.
// Break: focus after an op lands on the wrong line, or on a `~` field the card does not render, so
// the ruling's "focus stays on the moved or added row" is silently false. landed() is the only place
// that answers, so a wrong line number here is a wrong jump. Literal expectations, read off SRC.
test('an op names the line to focus after it: the destination, the gap, or the added line', () => {
  const bytes = SRC.split('\n');
  // 1 npc | 2 with | 3 blank | 4 "- Take the bowl" | 5 needs | 6 * You take it. | 7 blank
  // 8 "- ~" | 9 * Words. | 10 blank | 11 "- Leave" | 12 blank
  // a choice moves with its block, swapping with "- ~" and its words while the blanks 7 and 10 stay
  // put, so the bowl choice now starts at 7. Focus follows the moved choice's own text.
  assert.deepEqual(landed(bytes, { move: 4, by: 1 }), { n: 7 });
  // "- ~" moves up past the bowl block, so its own line now sits at 4
  assert.deepEqual(landed(bytes, { move: 8, by: -1 }), { n: 4 });
  // removing the choice at 4 leaves a blank at 4, so focus takes the next line with text
  assert.deepEqual(landed(bytes, { remove: 4 }), { n: 5 });
  // a key line has no Remove (rulings §4), so this focuses nothing rather than jumping to line 1
  assert.equal(landed(bytes, { remove: 1 }), undefined);
  // an add focuses the line it inserted
  assert.deepEqual(landed(bytes, { add: { after: 4, kind: 'needs', value: 'x' } }), { n: 5 });
  // a choice goes after the whole block (its last line is 6), so it lands at 7
  assert.deepEqual(landed(bytes, { add: { after: 4, kind: 'choice' } }), { n: 7 });
  // an op the route refuses focuses nothing, so a refusal never moves the caret
  assert.equal(landed(bytes, { move: 4, by: -1 }), undefined);
});

test('a .scene op refuses what the grammar cannot hold, and writes nothing', () => {
  const given = (op: Op, src = SRC) => {
    const r = scene(src, op);
    return 'refused' in r ? r.refused : r.after;
  };
  const withThen = SRC.replace('  needs: has_bowl\n', '  then: leave\n');
  assert.match(String(given({ add: { after: 4, kind: 'then' } }, withThen)), /already has/);
  // the control: `needs:` repeats, one per fact, so a second one is added
  assert.ok('after' in scene(SRC, { add: { after: 4, kind: 'needs', value: 'x' } }));
  assert.match(String(given({ add: { after: 4, kind: 'speaker' } })), /names a role/);
  assert.match(String(given({ remove: 1 })), /key line has no Remove/);
  assert.match(String(given({ move: 5, by: -1 })), /no line above/); // needs: is the block's first
  assert.match(String(given({ move: 4, by: -1 })), /no choice above/); // the first sibling
  assert.match(String(given({ move: 6, by: 1 })), /no line below/); // the block's last line
  // a reword is a choice line's words: not a `* ` narration line, not a value line, never empty and
  // never two lines. A `~` DOES reword: it pins todo__<n>, so its referrer keeps naming it
  assert.match(String(given({ reword: { line: 8, words: 'Words' } })), /#todo__8/);
  assert.match(String(given({ reword: { line: 6, words: 'Words' } })), /only a choice line/);
  assert.match(String(given({ reword: { line: 1, words: 'Words' } })), /only a choice line/);
  assert.match(String(given({ reword: { line: 4, words: '   ' } })), /no words/);
  assert.match(String(given({ reword: { line: 4, words: 'Take\nit' } })), /one line/);
});

// Break: a `~` choice keys by its line (scene_lines.ex:84-85), so an insert above one that a twin
// entry, a riddle, a quest outcome or a reaction names would orphan the referrer. The route must say
// so before it writes; the card must say the same thing from the same function.
test('a shifted `~` key under a referrer is refused at the card and at the route', async (t) => {
  const refers = (k: string) => k === 'todo__8';
  const r = scene(SRC, { add: { after: 4, kind: 'choice' } }, refers);
  assert.deepEqual(r, { refused: 'give choice 8 its words first' });
  // the control: the same op with no referrer goes through, and the key does shift
  assert.ok('after' in scene(SRC, { add: { after: 4, kind: 'choice' } }));
  // a move that leaves the key's line number alone is fine even with a referrer
  assert.ok('after' in scene(SRC, { add: { after: 11, kind: 'choice' } }, refers));

  const { ask, read, plant } = await served(t);
  plant(SRC);
  plant(JSON.stringify({ choices: { todo__8: { label: '~' } } }), 'scenes/guard.json');
  const done = await ask('/restructure', {
    file: SCENE,
    was: sha256(SRC),
    op: { add: { after: 4, kind: 'choice' } },
    carry: [],
  });
  assert.deepEqual(done, { status: 400, body: 'give choice 8 its words first' });
  assert.equal(read(), SRC); // nothing written
});

// Break: the route takes an op for a file that is not a `.scene` or a `.cut`, or one op that is not
// one op; the twin's `steps` means the twin owns the pages.
test('/restructure refuses a non-scene file and a cut whose twin carries steps', async (t) => {
  const { ask, read, plant } = await served(t);
  plant('{ "key": "x" }\n', 'rooms/a.json');
  const room = await ask('/restructure', {
    file: 'rooms/a.json',
    was: sha256('{ "key": "x" }\n'),
    op: { remove: 1 },
    carry: [],
  });
  assert.equal(room.status, 400);
  plant('A.\n---\n', 'scenes/x.cut');
  plant('{ "steps": [] }\n', 'scenes/x.json');
  const cut = await ask('/restructure', {
    file: 'scenes/x.cut',
    was: sha256('A.\n---\n'),
    op: { add: { after: 1, kind: 'page' } },
    carry: [],
  });
  assert.equal(cut.status, 400);
  assert.equal(read('scenes/x.cut'), 'A.\n---\n');
});

// Breaks: a ` #<key>` suffix does not key the line (its key is the slug of the words WITH the
// suffix), so rewording still moves every referrer (rulings docs/design/scene-structure-rulings.md §2).
test('an explicit ` #<key>` suffix keys the choice and is not part of its words', () => {
  // the suffix keys it; the words are the line without the suffix
  assert.equal(choiceKey('Carry it #carry', 7), 'carry');
  assert.equal(choiceLabel('Carry it #carry'), 'Carry it');
  // the control: no suffix, the slug of the words, as every scene before S3 did
  assert.equal(choiceKey('Carry it', 7), 'carry_it');
  assert.equal(choiceLabel('Carry it'), 'Carry it');
  // a `~` placeholder with no suffix still keys on its line
  assert.equal(choiceKey('~', 7), 'todo__7');
  // only a trailing ` #<key>` keys: a `#` inside the words is words
  assert.equal(choiceKey('Take #2 pencils', 7), 'take_2_pencils');
});

// Breaks: the card rewrites a choice's words by its words rather than pinning the key, so every
// referrer of that choice moves the moment the owner edits it (rulings §2).
test('rewording a choice pins the key it already had', () => {
  // keyed by its words: the new words carry the old key, so no referrer moves
  assert.equal(rewordedChoice('- Carry it', 'Take it', 3), '- Take it #carry_it');
  // already explicit: only the words change
  assert.equal(rewordedChoice('- Carry it #carry', 'Take it', 3), '- Take it #carry');
  // its indent is the line's, not the card's
  assert.equal(rewordedChoice('    - Carry it', 'Take it', 3), '    - Take it #carry_it');
  // a `~` placeholder keeps the key its line gives it
  assert.equal(rewordedChoice('- ~', 'Carry it', 4), '- Carry it #todo__4');
  // emptying the field restores the placeholder and still pins
  assert.equal(rewordedChoice('- Carry it #carry', '   ', 3), '- ~ #carry');
});

// Breaks: Add choice writes a bare `- ~`, so the new choice's key is its line number and any page
// inserted above it moves it out from under whatever already refers to it (rulings §2).
test('Add choice keys the new choice at once', () => {
  // after the existing choice (line 3), at that choice's own depth
  const out = scene(
    ['npc: maud', 'maud: A bowl.', '- Carry it #carry', '  maud: Done.', ''].join('\n'),
    { add: { after: 3, kind: 'choice' } },
  );
  // the next free choice_<n>: choice_1, since nothing claims it
  assert.deepEqual(out, {
    // after the choice's whole block, at that choice's own depth (scene_structure.ts:229-231)
    after: [
      'npc: maud',
      'maud: A bowl.',
      '- Carry it #carry',
      '  maud: Done.',
      '- ~ #choice_1',
      '',
    ].join('\n'),
  });
  // and it never reuses a key the file already claims
  const second = scene(
    [
      'npc: maud',
      'maud: A bowl.',
      '- One #choice_1',
      '  maud: A.',
      '- Two #choice_2',
      '  maud: B.',
    ].join('\n'),
    { add: { after: 3, kind: 'choice' } },
  );
  assert.match(JSON.stringify(second), /- ~ #choice_3/);
});
