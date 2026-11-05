// The editor shell's model (tools/author-panel/src/shell.ts): expected values from the chrome
// ruling (docs/design/editor-chrome-rulings.md) and the E2 brief, not from the code.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as shell from '../../../tools/author-panel/src/shell.ts';

const HUT = 'demo@1:room/hut';
const NODES = [HUT, 'demo@1:room/barn', 'demo@1:npc/hut_keeper'].map((ref) => ({
  ref,
  kind: ref.split(/[:/]/)[1],
}));

// Breaks: a click in the Book or the hierarchy selects a different definition in one of the four
// places (a prefix match picks hut_keeper; a text key's field leaks into the key).
test('one selection, from the hierarchy or a Book line, is the same in all four places', () => {
  const fromBook = shell.fromTextKey('room.hut.title');
  const fromTree = shell.fromRef(HUT);
  assert.deepEqual(fromBook, { kind: 'room', key: 'hut' });
  assert.deepEqual(fromTree, fromBook);
  assert.deepEqual(shell.places(fromBook, NODES), {
    hierarchy: HUT,
    book: { op: 'select', kind: 'room', key: 'hut' },
    map: HUT,
    inspector: { ref: HUT, kind: 'room' },
  });
  assert.equal(shell.places({ kind: 'npc', key: 'hut' }, NODES).hierarchy, undefined);
  assert.equal(shell.fromTextKey('title'), undefined);
});

// Breaks: a reload forgets the widths, the folded column, the tab or the selection; a stored
// width outside the ruling's range, or garbage, lays the columns out unusable.
test('the layout comes back from storage, kept inside the ruling`s ranges', () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
  assert.deepEqual(shell.load(storage), {
    left: 280,
    right: 360,
    leftOpen: true,
    rightOpen: true,
    tablet: false,
    tab: 'hierarchy',
    map: 'map',
  });
  const mine = {
    ...shell.load(storage),
    left: 300,
    rightOpen: false,
    tab: 'project' as const,
    selection: { kind: 'room', key: 'hut' },
  };
  shell.save(storage, mine);
  assert.deepEqual(shell.load(storage), mine);
  store.set(shell.STORE, JSON.stringify({ left: 9999, right: 'wide' }));
  assert.deepEqual([shell.load(storage).left, shell.load(storage).right], [480, 360]);
  store.set(shell.STORE, '{not json');
  assert.equal(shell.load(storage).left, 280);
});

// Breaks: arrows move a divider the wrong way or by the wrong step, past its range; Cmd-\ and
// Cmd-/ fold the wrong column, or another key folds one.
test('dividers move 16 px, 64 with Shift, inside their range; Cmd-\\ and Cmd-/ fold a side', () => {
  assert.equal(shell.nudge('left', 280, 'ArrowRight', false), 296);
  assert.equal(shell.nudge('left', 280, 'ArrowLeft', true), 220);
  assert.equal(shell.nudge('right', 360, 'ArrowLeft', false), 376);
  assert.equal(shell.nudge('right', 550, 'ArrowLeft', true), 560);
  assert.equal(shell.nudge('right', 360, 'Enter', false), 360);
  assert.equal(shell.nudge('left', 300, 'ArrowRight', true), 364);
  assert.deepEqual([shell.reset('left'), shell.reset('right')], [280, 360]);
  assert.deepEqual([shell.LAYOUT.left, shell.LAYOUT.right], [280, 360]);
  const l = shell.LAYOUT;
  assert.deepEqual([shell.fold(l, '\\').leftOpen, shell.fold(l, '\\').rightOpen], [false, true]);
  assert.deepEqual([shell.fold(l, '/').leftOpen, shell.fold(l, '/').rightOpen], [true, false]);
  assert.equal(shell.fold(l, 'k'), l);
});

// Breaks: Cmd-K misses a definition key, a text key /find returns or a `~`, takes a definition
// file's line for a text key, ranks a mere detail match over a name, lists a `~` twice (once as
// text), `~` does not narrow to the unwritten, or the three tiers lose their order.
test('Cmd-K finds a key, a text key`s words and a `~`, and lists the commands', () => {
  const text = shell.words([
    { at: 'text.json:2', text: '"room.hut.title": "A hut.",' },
    { at: 'text.json:3', text: '"room.barn.title": "~"' },
    { at: 'rooms/hut.json:2', text: '"name": "room.hut.title",' },
    { at: 'text.json:1', text: '{' },
  ]);
  assert.deepEqual(text, { 'room.hut.title': 'A hut.', 'room.barn.title': '~' });
  const all = shell.items(NODES, text, { 'room.barn.title': 'a.loka:3' });
  assert.deepEqual(
    shell.rank('hut', all).map((i) => [i.kind, i.id]),
    [
      ['key', HUT],
      ['key', 'demo@1:npc/hut_keeper'],
      ['text', 'room.hut.title'],
    ],
  );
  assert.deepEqual(
    shell.rank('barn', all).map((i) => [i.kind, i.id]),
    [
      ['key', 'demo@1:room/barn'],
      ['todo', 'room.barn.title'],
    ],
  );
  assert.deepEqual(
    shell.rank('~', all).map((i) => [i.kind, i.id, i.detail]),
    [['todo', 'room.barn.title', 'a.loka:3']],
  );
  assert.deepEqual(
    shell.rank('go to', all).map((i) => [i.kind, i.id]),
    [['command', 'go']],
  );
  const row = (label: string, detail: string) => ({
    kind: 'key' as const,
    label,
    detail,
    id: label,
  });
  const tiers = [row('a', 'hut.loka'), row('the hut', ''), row('hut', ''), row('b', '')];
  assert.deepEqual(
    shell.rank('hut', tiers).map((i) => i.id),
    ['hut', 'the hut', 'a'],
    'a name starting with it, then one holding it, then a detail; input order is the reverse',
  );
});

// Breaks: an edit over its budget shows as within (or the reverse); a structural edit's Book load
// is left out of its total.
test('timings are judged against the brief`s budgets', () => {
  const at = 1;
  assert.equal(shell.within({ at, compile: 200, publish: 100, kind: 'prose' }), true);
  assert.equal(shell.within({ at, compile: 200, publish: 101, kind: 'prose' }), false);
  assert.equal(shell.within({ at, compile: 900, publish: 100, kind: 'structural' }, 500), true);
  assert.equal(shell.within({ at, compile: 900, publish: 100, kind: 'structural' }, 501), false);
  assert.equal(shell.within({ at, compile: 999, publish: 2, kind: 'refusal' }), false);
  const edit = { at: 1000, compile: 900, publish: 100, kind: 'structural', sha256: 'a' } as const;
  assert.equal(shell.loadOf(edit, { sha256: 'a', at: 1400 }), 400);
  assert.equal(
    shell.loadOf(edit, { sha256: 'b', at: 1400 }),
    0,
    'another artifact is not this load',
  );
  assert.equal(
    shell.loadOf(edit, { sha256: 'a', at: 999 }),
    0,
    'a load before the publish is the old Book',
  );
  assert.equal(shell.loadOf({ ...edit, kind: 'prose' }, { sha256: 'a', at: 1400 }), 0);
});

// Breaks: the panel stays light under a dark OS setting, or does not follow a change, or keeps
// listening after it is gone.
test('.dark and color-scheme follow a forced OS scheme and its changes', () => {
  const heard = new Set<() => void>();
  const scheme = {
    matches: true,
    addEventListener: (_: string, f: () => void) => void heard.add(f),
    removeEventListener: (_: string, f: () => void) => void heard.delete(f),
  };
  const classes = new Set<string>();
  const root = {
    classList: {
      toggle: (c: string, on: boolean) => void (on ? classes.add(c) : classes.delete(c)),
    },
    style: { colorScheme: '' },
  };
  const unfollow = shell.follow(scheme, root);
  assert.deepEqual([classes.has('dark'), root.style.colorScheme], [true, 'dark']);
  scheme.matches = false;
  for (const f of heard) f();
  assert.deepEqual([classes.has('dark'), root.style.colorScheme], [false, 'light']);
  unfollow();
  assert.equal(heard.size, 0);
});
