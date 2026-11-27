// The editor shell's model (tools/author-panel/src/shell.ts): expected values from the chrome
// ruling (docs/design/editor-chrome-rulings.md) and the E2 brief, not from the code.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  // Breaks: the World row (no node) opens no card, or any nodeless selection opens its file.
  assert.equal(shell.fileOf(shell.WORLD), 'cartridge.json');
  assert.equal(shell.fileOf({ ...shell.WORLD, kind: 'room' }), undefined);
  assert.equal(shell.fileOf(fromTree!, HUT, { [HUT]: 'rooms/hut.json' }), 'rooms/hut.json');
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
    slot: 240,
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
  store.set(shell.STORE, JSON.stringify({ left: 9999, right: 'wide', slot: 40 }));
  const { left, right, slot } = shell.load(storage);
  assert.deepEqual([left, right, slot], [480, 360, 160]);
  store.set(shell.STORE, '{not json');
  assert.equal(shell.load(storage).left, 280);
});

// Breaks: arrows move a divider the wrong way or by the wrong step, past its range (the slot's
// most is measured: the column less its tab strip); the slot takes Left/Right; Cmd-\ and
// Cmd-/ fold the wrong column, or another key folds one.
test('dividers move 16 px, 64 with Shift, inside their range; Cmd-\\ and Cmd-/ fold a side', () => {
  assert.equal(shell.nudge('left', 280, 'ArrowRight', false), 296);
  assert.equal(shell.nudge('left', 280, 'ArrowLeft', true), 220);
  assert.equal(shell.nudge('right', 360, 'ArrowLeft', false), 376);
  assert.equal(shell.nudge('right', 550, 'ArrowLeft', true), 560);
  assert.equal(shell.nudge('right', 360, 'Enter', false), 360);
  assert.equal(shell.nudge('left', 300, 'ArrowRight', true), 364);
  assert.equal(shell.nudge('slot', 240, 'ArrowUp', false, 600), 256);
  assert.equal(shell.nudge('slot', 240, 'ArrowDown', true, 600), 176);
  assert.equal(shell.nudge('slot', 590, 'ArrowUp', true, 600), 600);
  assert.equal(shell.nudge('slot', 240, 'ArrowRight', false, 600), 240);
  assert.equal(shell.reset('slot'), 240);
  assert.deepEqual([shell.reset('left'), shell.reset('right')], [280, 360]);
  assert.deepEqual([shell.LAYOUT.left, shell.LAYOUT.right, shell.LAYOUT.slot], [280, 360, 240]);
  const l = shell.LAYOUT;
  assert.deepEqual([shell.fold(l, '\\').leftOpen, shell.fold(l, '\\').rightOpen], [false, true]);
  assert.deepEqual([shell.fold(l, '/').leftOpen, shell.fold(l, '/').rightOpen], [true, false]);
  assert.equal(shell.fold(l, 'k'), l);
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

// Breaks: a starter added to play/new.json never reaches the Hierarchy's + list, or a kind header's
// + makes the wrong starter (`room` making an area; `scene` or `status` making nothing).
test('the Hierarchy + lists every starter once, and a kind header`s + makes its own starter', () => {
  const starters = JSON.parse(readFileSync(new URL('../play/new.json', import.meta.url), 'utf8'));
  assert.deepEqual(shell.GROUPS.flatMap(([, kinds]) => kinds).sort(), [...starters].sort());
  assert.deepEqual(
    [
      shell.STARTER.room,
      shell.STARTER.scene,
      shell.STARTER.status,
      shell.STARTER.npc,
      shell.STARTER.action,
    ],
    ['rooms', 'cutscene', 'statuses', 'npcs', undefined],
  );
});

// Breaks: the npc header's + with a room selected makes an unplaced NPC (new-npcs) instead of New NPC here.
test('with a room selected, the npc and item headers` + place the new one in that room', () => {
  const room = { kind: 'room', key: 'smithy' } as const;
  assert.deepEqual(
    [shell.newCommand('npcs', room), shell.newCommand('items', room), shell.newCommand('npcs')],
    ['map-npc', 'map-item', 'new-npcs'],
  );
});
