// POST /restructure on a `.cut` (kernel/ts/play/scene_structure.ts, scene_card.ts restructure;
// docs/design/scene-structure-rulings.md §3, §4, §6 S1): each page op changes only its lines, one
// /undo reverts it, and what the card refuses is what the compiler refuses as `cut_end`.
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test, type TestContext } from 'node:test';
import { compiled } from '../play/compiled.ts';
import { sha256 } from '../play/guard.ts';
import { serve } from '../play/live.ts';
import { cut, type Op } from '../play/scene_structure.ts';

const CUT = 'scenes/x.cut';

/** A served source tree with `scenes/x.cut` and a room, and a JSON POST to it. */
async function served(t: TestContext) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loka-restructure-')));
  const src = join(dir, 'src');
  mkdirSync(join(src, 'scenes'), { recursive: true });
  mkdirSync(join(src, 'rooms'));
  writeFileSync(join(src, 'rooms/a.json'), '{}\n');
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
  const read = (rel = CUT) => readFileSync(join(src, rel), 'utf8');
  const plant = (bytes: string, rel = CUT) => writeFileSync(join(src, rel), bytes);
  return { ask, read, plant };
}

// Every fixture cut: a one-line and a two-line page, a double blank, a whitespace-only blank,
// `---` right under the last page, no trailing newline. The after-bytes are written by hand.
const ROWS: [cut: string, op: Op, after: string][] = [
  ...(
    [
      [{ add: { after: 3, kind: 'page' } }, 'One.\n\nTwo\nlines.\n\n~\n\n\nThree.\n---\n'],
      [{ remove: 1 }, 'Two\nlines.\n\n\nThree.\n---\n'],
      [{ remove: 4 }, 'One.\n\n\nThree.\n---\n'],
      [{ move: 1, by: 1 }, 'Two\nlines.\n\nOne.\n\n\nThree.\n---\n'],
      [{ move: 7, by: -1 }, 'One.\n\nThree.\n\n\nTwo\nlines.\n---\n'],
      [{ split: 4 }, 'One.\n\nTwo\n\nlines.\n\n\nThree.\n---\n'],
      [{ join: 1 }, 'One.\nTwo\nlines.\n\n\nThree.\n---\n'],
      [{ join: 3 }, 'One.\n\nTwo\nlines.\nThree.\n---\n'],
    ] as const
  ).map(([op, after]) => ['One.\n\nTwo\nlines.\n\n\nThree.\n---\n', op, after] as (typeof ROWS)[0]),
  ...(
    [
      [{ add: { after: 1, kind: 'page' } }, 'A.\n\n~\n  \nB.\n---'],
      [{ add: { after: 3, kind: 'page' } }, 'A.\n  \nB.\n\n~\n---'],
      [{ remove: 1 }, 'B.\n---'],
      [{ remove: 3 }, 'A.\n---'],
      [{ move: 3, by: -1 }, 'B.\n  \nA.\n---'],
      [{ join: 1 }, 'A.\nB.\n---'],
    ] as const
  ).map(([op, after]) => ['A.\n  \nB.\n---', op, after] as (typeof ROWS)[0]),
];

// Break: an op that reflows, reorders or drops a byte it does not own (the trailing newline, a
// whitespace-only blank, the double blank), or writes more than one journal entry, so one Undo
// does not restore the cut byte for byte.
test('/restructure: each page op over every fixture cut changes only its lines; one /undo restores', async (t) => {
  const { ask, read, plant } = await served(t);
  assert.ok(ROWS.length > 0 && new Set(ROWS.map((r) => r[0])).size === 2);
  for (const [bytes, op, after] of ROWS) {
    plant(bytes);
    const done = await ask('/restructure', { file: CUT, was: sha256(bytes), op, carry: [] });
    assert.equal(done.status, 200, JSON.stringify([op, done.body]));
    assert.deepEqual(cut(bytes, op), { after }); // the card's preview is the route's answer
    assert.equal(read(), after, JSON.stringify(op));
    assert.equal((await ask('/undo', { id: (done.body as { id: string }).id })).status, 200);
    assert.equal(read(), bytes, JSON.stringify(op)); // byte for byte
  }
});

// Break: a write over bytes changed since the card read them (a stale `was`, or a `carry` file the
// card showed that another op since changed), a twin with `steps` whose pages are not the cut's,
// a page op on a file that is not a cut, or an op that is not one op (a 500, or the wrong op run).
test('/restructure refuses a stale card and writes nothing', async (t) => {
  const { ask, read, plant } = await served(t);
  const bytes = 'A.\n\nB.\n---\n';
  plant(bytes);
  const sent = { file: CUT, was: sha256(bytes), op: { join: 1 }, carry: [] };
  const gone = await ask('/restructure', { ...sent, was: sha256('A.\n---\n') });
  assert.deepEqual(gone, { status: 409, body: { bytes, sha256: sha256(bytes) } });
  const moved = await ask('/restructure', { ...sent, carry: [{ file: 'rooms/a.json', was: '' }] });
  assert.deepEqual(moved, { status: 409, body: { bytes: '{}\n', sha256: sha256('{}\n') } });
  plant('{ "steps": [] }\n', 'scenes/x.json');
  assert.equal((await ask('/restructure', sent)).status, 400);
  plant('{ "control": "modal" }\n', 'scenes/x.json');
  plant('* A.\n', 'scenes/y.scene');
  const scene = { ...sent, file: 'scenes/y.scene', was: sha256('* A.\n') };
  assert.equal((await ask('/restructure', scene)).status, 400);
  for (const op of ['join', { remove: null, join: 1 }])
    assert.equal((await ask('/restructure', { ...sent, op })).status, 400, JSON.stringify(op));
  assert.equal(read(), bytes);
  // the control: the same op, fresh, its carry fresh
  const room = [{ file: 'rooms/a.json', was: sha256('{}\n') }];
  assert.equal((await ask('/restructure', { ...sent, carry: room })).status, 200);
});

// Break: the card offers a remove that leaves no page, or a move that lifts `---` off the end, which
// the compiler then refuses as `cut_end` (cut_files.ex:70-79); or the card refuses a cut the
// compiler takes.
test('an empty cut and a moved `---` are refused by the card and by the compiler as cut_end', (t) => {
  const page = 'Only.\n---\n';
  assert.deepEqual(cut(page, { remove: 1 }), { refused: 'a cut needs a page' });
  assert.ok('refused' in cut(page, { move: 2, by: -1 }));
  assert.ok('refused' in cut(page, { move: 1, by: 1 }));
  assert.ok('refused' in cut('A.\n\nB.\n---\n', { join: 3 })); // B. into `---`
  // the bytes those ops would write, planted as two modal scenes' cuts
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'loka-cut-end-')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(resolve(import.meta.dirname, '../../../cartridges/scene_sampler'), dir, {
    recursive: true,
  });
  const twin = (key: string, bytes: string) => {
    const json = join(dir, `scenes/${key}.json`);
    const { steps: _, ...rest } = JSON.parse(readFileSync(json, 'utf8'));
    writeFileSync(json, JSON.stringify(rest));
    writeFileSync(join(dir, `scenes/${key}.cut`), bytes);
  };
  twin('bell_rung', page);
  twin('rope_reverie', page);
  assert.equal(typeof compiled(dir), 'object'); // the control: the cut the card starts from compiles
  twin('bell_rung', '---\n');
  twin('rope_reverie', '---\nOnly.\n');
  const said = String(compiled(dir));
  const END = 'a cutscene is paragraphs, then one `---` as its last line'; // explain.ex cut_end
  for (const at of [
    'scenes/bell_rung.cut:1 ',
    'scenes/rope_reverie.cut:1 ',
    'scenes/rope_reverie.cut:2 ',
  ])
    assert.ok(
      said.split('\n').some((l) => l.includes(at) && l.includes(END)),
      `${at}\n${said}`,
    );
});
