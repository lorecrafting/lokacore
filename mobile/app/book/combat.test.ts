// Combat page layout over controlled Book boundary inputs (the harness: __tests__/combat-book.test.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Intent } from '../../packages/game-view/session.ts';
import { BookView, color, game, nodes, view, words } from './__tests__/combat-book.test.ts';
import { group, type Page } from './model.ts';
import { presenter } from './presenter.ts';
import { lineWords } from './words.ts';

const { Combat } = await import('./Combat.tsx'); // after the harness's .tsx hooks

const SAY: Record<string, string> = {
  'npc.raider': 'the raider',
  'npc.hound': 'a fen hound',
  'band.hurt': 'hurt',
  'band.ready': 'ready',
  hungry: 'hungry',
  bleeding: 'Bleeding',
  goblin: 'goblin',
  Grub: 'Grub',
};
const combatLines = (combat: object, extra = {}, ended = false) => {
  const current = view({ combat, ...extra });
  const live = presenter({ ...game(current), text: (k) => SAY[k] ?? k }).screen();
  const screen = ended
    ? { ...live, view: { ...live.view, combat: undefined }, ended: live.view.combat }
    : live;
  const page = Combat({ screen, g: group([]), press: () => {}, world: () => {} });
  return nodes(page)
    .filter((n) => n.type === 'Text')
    .map(words);
};

// Breaks: the Combat block keeps your own hunger or bleeding (read as the raider's), drops the
// opponent's band, or shows an hp number (book-ui.md Live combat response, pass-1 C2b).
test('a one-foe fight draws only the opponent line with its band word', () => {
  const lines = combatLines(
    { encounter_id: 'fight', opponent_id: 'raider', name: 'npc.raider', band: 'hurt' },
    {
      conditions: [{ label: 'hungry' }],
      bleeding: { label: 'bleeding', ends_at: 300, hp_loss: 1, tick_every: 100 },
    },
  );
  assert.deepEqual(
    lines.filter((l) => /raider|hungry|Bleeding|HP|\d+ \/ \d+/.test(l)),
    ['the raider — hurt'],
  );
});

// Breaks: a pack repeats the primary, gives every member the primary's band, shows a band for a
// member the player cannot see, loses the target mark or puts it after the band (book-ui.md).
test('a pack draws each member once with its own band and none for a hidden member', () => {
  const lines = combatLines({
    encounter_id: 'fight',
    opponent_id: 'a',
    name: 'npc.hound',
    band: 'hurt',
    active_opponents: [
      { id: 'a', name: 'npc.hound', band: 'hurt' },
      { id: 'b', name: 'npc.hound', band: 'ready' },
      { id: 'c', name: 'npc.hound' },
    ],
  });
  assert.deepEqual(
    lines.filter((l) => l.includes('hound')),
    ['a fen hound (your target) — hurt', 'a fen hound — ready', 'a fen hound'],
  );
});

// Breaks (loka-6qi): a foe with name words keeps its indefinite short ("a goblin"), a proper name
// gets "the", a one-foe fight drops its words, or two same-name foes merge into one line.
test('a foe with name words reads definite, one line per foe', () => {
  const goblin = { bare: 'goblin', article: 'a' };
  const one = { encounter_id: 'fight', opponent_id: 'a', name: 'npc.goblin', band: 'hurt' };
  assert.deepEqual(
    combatLines({ ...one, words: goblin }).filter((l) => l.includes('goblin')),
    ['the goblin — hurt'],
  );
  const lines = combatLines({
    ...one,
    active_opponents: [
      { id: 'a', name: 'npc.goblin', band: 'hurt', words: goblin },
      { id: 'b', name: 'npc.goblin', band: 'ready', words: goblin },
      { id: 'c', name: 'npc.grub', band: 'ready', words: { bare: 'Grub' } },
      { id: 'd', name: 'npc.hound', band: 'ready' },
    ],
  });
  assert.deepEqual(
    lines.filter((l) => / — /.test(l)),
    [
      'the goblin (your target) — hurt',
      'the goblin — ready',
      'Grub — ready',
      'a fen hound — ready',
    ],
  );
});

// Breaks: a closed encounter keeps the band of its last live view (a dead foe "hurt") or the
// target mark: its opponent block is names only, so no line carries " — " (book-ui.md, Closure).
test('a closed encounter draws its opponents by name only', () => {
  const pack = {
    encounter_id: 'fight',
    opponent_id: 'a',
    name: 'npc.hound',
    band: 'hurt',
    active_opponents: [
      { id: 'a', name: 'npc.hound', band: 'hurt' },
      { id: 'b', name: 'npc.hound', band: 'ready' },
    ],
  };
  const lines = combatLines(pack, {}, true);
  assert.deepEqual(
    lines.filter((l) => l.includes('hound')),
    ['a fen hound', 'a fen hound'],
  );
  assert.ok(!lines.some((l) => l.includes(' — ')), JSON.stringify(lines));
});

// Break: a menu/detail hides escape, Flee invents directions, or controls sit outside the narrative scroll.
test('combat page lists offered controls vertically below history in one scroll', () => {
  const sent: Intent[] = [];
  const p = presenter({
    ...game(
      view({
        actions: [
          ...view().actions,
          { ...view().actions[0], action_key: 'look', label: 'action.look' },
        ],
      }),
    ),
    lastNarration: () =>
      ({ command_id: 'before', lines: [{ key: 'combat.result' }], combat_lines: [0] }) as never,
    invoke: (intent) => (sent.push(intent), { kind: 'stale_view' }),
  });
  const screen = p.screen();
  assert.deepEqual(group(screen.buttons).door('north'), []);
  for (const stack of [[], [{ kind: 'contents' }], [{ kind: 'thing', id: 'rat' }]] as Page[][]) {
    const drawn = nodes(
      BookView({
        palette: color.light,
        screen,
        stack,
        flip: { turn: 0, dir: 1 },
        go: () => {},
        press: (b) => p.press(b),
        refused: () => {},
        startOver: () => {},
        shell: { confirm: (f) => f(), learned: { get: () => true } as never },
      }),
    );
    assert.ok(drawn.some((n) => n.props?.accessibilityRole === 'header' && words(n) === 'Combat'));
    const controls = drawn.filter((n) =>
      ['Stand', 'Look', 'Flee', 'Flee north', 'Flee west'].includes(n.props?.accessibilityLabel),
    );
    assert.deepEqual(
      controls.map((n) => n.props.accessibilityLabel),
      ['Stand', 'Look', 'Flee'],
    );
    const scroll = drawn.find((n) => n.type === 'ScrollView')!;
    const inside = nodes(scroll);
    const narrative = inside.findIndex(
      (n) => n.type === 'Text' && words(n) === 'The marsh rat falls.',
    );
    assert.ok(narrative >= 0);
    for (const control of controls) {
      assert.ok(
        inside.findIndex((n) => n.props?.accessibilityLabel === control.props.accessibilityLabel) >
          narrative,
      );
      control.props.onPress();
    }
    assert.notEqual(scroll.props.contentContainerStyle.flexDirection, 'row');
  }
  assert.deepEqual(
    sent,
    Array.from({ length: 3 }, () => [
      { action_key: 'stand', target_ids: [], input: {}, view_freshness_token: 'view:drawn' },
      { action_key: 'look', target_ids: [], input: {}, view_freshness_token: 'view:drawn' },
      {
        action_key: 'flee',
        target_ids: [],
        input: {},
        view_freshness_token: 'view:drawn',
      },
    ]).flat(),
  );
  assert.deepEqual(
    group(presenter(game(view({ combat: undefined, actions: [] }))).screen().buttons).flee,
    [],
  );
});

// Breaks: Combat drops the running head (Page's doc comment), or a Journal page left on the
// stack under the fight hides it.
test('combat shows the running head, even over a Journal page', () => {
  const head = 'Find the lantern.';
  const current = view({ journal: [{ state: 'active', journal: 'quest.head' }] });
  const screen = presenter({
    ...game(current),
    text: (key) => (key === 'quest.head' ? head : game(current).text(key)),
  }).screen();
  for (const stack of [[], [{ kind: 'journal' }]] as Page[][]) {
    const drawn = nodes(
      BookView({
        palette: color.light,
        screen,
        stack,
        flip: { turn: 0, dir: 1 },
        go: () => {},
        press: () => {},
        refused: () => {},
        startOver: () => {},
        shell: { confirm: (f) => f(), learned: { get: () => true } as never },
      }),
    );
    const lines = drawn.filter((n) => n.type === 'Text').map(words);
    assert.ok(lines.includes('Combat'));
    assert.equal(lines.filter((line) => line === head).length, 1);
  }
});

// Breaks (loka-x6t.30): a skipped blow shows its engine key, names the player as an NPC (or an NPC
// as "You"), drops the status word, leaves the name lower case, or an authored line is reworded.
test('a status-skipped blow reads "<Name> is too <status> to do anything."', () => {
  const skip = (participants?: object) => ({
    key: 'combat.skipped',
    bindings: { status: 'condition.stunned' },
    ...(participants && { participants }),
  });
  const lines = [skip({ actor: 'rat' }), skip(), skip({ actor: 'gone' }), { key: 'combat.result' }];
  const p = presenter({
    ...game(view()),
    text: (k) => ({ 'npc.rat': 'a marsh rat', 'condition.stunned': 'stunned' })[k] ?? k,
    lastNarration: () => ({ command_id: 'before', lines, combat_lines: [0, 1, 2, 3] }) as never,
  });
  const page = Combat({ screen: p.screen(), g: group([]), press: () => {}, world: () => {} });
  const said = nodes(page)
    .filter((n) => n.type === 'Text')
    .map(words);
  for (const line of [
    'A marsh rat is too stunned to do anything.',
    'You are too stunned to do anything.',
    'They are too stunned to do anything.',
    'combat.result',
  ])
    assert.ok(said.includes(line), `${line} in ${JSON.stringify(said)}`);
});

// Breaks: a flight shows its engine key combat.fled (or drops the way) instead of one plain line.
test('a flight reads "You flee <direction>."', () => {
  const line = lineWords({ key: 'combat.fled', bindings: { direction: 'west' } }, (k) => k, view());
  assert.equal(line, 'You flee west.');
});

// Breaks: an engine item line worded only in the first person (an NPC's take reads "You pick
// up"), or the viewer's own take named as a third person (the shared table, loka-kgd.185).
test('item.taken reads "You take" for the viewer and "<Name> takes" for a named NPC', () => {
  const rope = { key: 'item.taken', bindings: { item: 'the rope' } };
  const said = (actor: string) => lineWords({ ...rope, participants: { actor } }, (k) => k, view());
  assert.equal(said('body'), 'You take the rope.');
  assert.equal(said('rat'), 'npc.rat takes the rope.');
});
