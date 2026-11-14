// The Story list and Trace (tools/author-panel/src/storylist.ts): expected rows worked by hand from
// the S2 table (docs/design/editor-map-and-story-rulings.md) on a planted model, not from the code.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Story } from '../../../tools/author-panel/src/storylist.ts';
import { rank } from '../../../tools/author-panel/src/shell.ts';
import * as list from '../../../tools/author-panel/src/storylist.ts';
import { knowledge, pacing } from '../../../tools/author-panel/src/storyknow.ts';
import { choicesOf, consequenceRows } from '../../../tools/author-panel/src/storyconseq.ts';
import { contentGraph } from '../play/reach.ts';

const ref = (kind: string, key: string) => `demo@1:${kind}/${key}`;
const [q1, d1, f1, f2, sp] = [
  ref('quest', 'q1'),
  ref('dialogue', 'd1'),
  ref('fact', 'f1'),
  ref('fact', 'f2'),
  ref('story_point', 'sp'),
];
const nodes = [q1, d1, f1, f2, sp, ref('room', 'hall')].map((r) => ({
  ref: r,
  kind: r.split(':')[1]!.split('/')[0]!,
}));

// Beat 1 is built on q1 and d1, beat 2 refers to a quest nobody wrote, beat 3 reuses d1 in Part 2.
const story = (outline: Story['outline']): Story => ({
  hash: 'h',
  graph: {
    nodes,
    edges: [
      { from: ref('reaction', 'ring'), to: f1, path: '/steps/0', op: 'fact.assign', set: true },
      { from: ref('reaction', 'ring'), to: f1, path: '/steps/2', op: 'fact.assign', set: true },
      { from: ref('reaction', 'toll'), to: f1, path: '/steps/0', op: 'fact.assign', set: true },
      { from: d1, to: f1, path: '/when', op: 'fact_compare' },
      { from: ref('reaction', 'wait'), to: f1, path: '/when', op: 'time_since' },
      { from: d1, to: q1, path: '/steps/1', op: 'quest.start' },
      { from: q1, to: f1, path: '/deadline/fact', set: true },
      { from: q1, to: f1, path: '/policy/when' },
      { from: ref('topic', 'lore'), to: f1, path: '/fact', set: true }, // set, and read by the codex
    ],
  },
  report: {
    unreachable: { [ref('scene', 'x')]: [d1] },
    behind_lock: { rooms: [] },
    orphan_facts: { unused: [], write_only: [], read_only: [f2] },
  },
  outline,
  todo: { [q1]: [{ file: 'quests/q1.json', words: 4, placeholders: ['~a', '~b', '~c'] }] },
  diagnostics: {
    [d1]: [
      { code: 'unknown_ref', path: '/a' },
      { code: 'shape', path: '/b' },
    ],
  },
  map: [],
  words: {},
  names: {},
  choices: {},
  hidden: [],
  unlinkable: {},
  files: {},
  bundled: {},
  shorts: [],
  triggers: { points: {}, actions: {}, taken: {}, named: {} },
});
const planted = story({
  parts: ['Arrival', null],
  beats: [
    { part: 0, n: 1, title: 'Gate', status: 'built', nodes: [q1, d1] },
    { part: 0, n: 2, status: 'missing', missing: ['quest/q9'], nodes: [] },
    { part: 1, n: 3, title: 'Mill', status: '~', nodes: [d1] },
  ],
  unpaid: [{ seed: 'bell', n: 2 }],
  unseeded: [],
});
const ids = (s: Story, st: list.ListState) => list.rows(s, st).map((r) => r.id);

// Break: with no outline.json the list is empty, or a room joins the story nodes.
test('with no outline every story node is Unplaced, open, and the note says why', () => {
  const bare = story(null);
  const rows = list.rows(bare, list.LIST);
  assert.deepEqual(
    rows.map((r) => r.label),
    ['Unplaced (5)', 'q1', 'd1', 'f1', 'f2', 'sp'],
  );
  assert.deepEqual(
    rows.map((r) => r.level),
    [1, 2, 2, 2, 2, 2],
  );
  assert.equal(list.note(bare), 'No outline.json; every node is unplaced.');
});

// Break: beats start open, a leaf beat claims an arrow, the Seeds part is lost, or a fold is not kept.
test('the outline lists parts, shut beats, Seeds and a shut Unplaced; a folded part hides its beats', () => {
  assert.deepEqual(ids(planted, list.LIST), [
    'part:0',
    'beat:1',
    'beat:2',
    'part:1',
    'beat:3',
    'seeds',
    'seeds/bell',
    'unplaced',
  ]);
  const rows = list.rows(planted, list.LIST);
  assert.deepEqual(
    rows.map((r) => [r.label, r.open]),
    [
      ['Part 1  Arrival', true],
      ['Gate', false],
      ['', undefined],
      ['Part 2', true],
      ['Mill', false],
      ['Seeds', true],
      ['seed bell · no payoff · beat 2', undefined],
      ['Unplaced (3)', false],
    ],
  );
  assert.deepEqual(
    rows.map((r) => r.level),
    [1, 2, 2, 1, 2, 1, 2, 1],
  );
  const folded = list.toggle(list.LIST, 'part:0');
  assert.deepEqual(folded.fold, ['part:0']);
  assert.deepEqual(ids(planted, folded).slice(0, 3), ['part:0', 'part:1', 'beat:3']);
});

// Break: a built beat shows a status word, a missing beat hides what is missing, or a node's
// refusals, `~` or reach drop out of its name.
test('a beat names its status and what is missing; a bound node its refusals, ~ and reach', () => {
  const st = list.toggle(list.LIST, 'beat:1');
  const by = Object.fromEntries(list.rows(planted, st).map((r) => [r.id, r]));
  assert.equal(by['beat:1']!.name, 'beat 1, Gate');
  assert.equal(by['beat:2']!.name, 'beat 2, missing quest/q9');
  assert.equal(by['beat:2']!.title, 'missing quest/q9');
  assert.equal(by['beat:3']!.name, 'beat 3, Mill, ~');
  assert.equal(by[`beat:1/${q1}`]!.name, 'q1, quest, 3 ~');
  assert.equal(by[`beat:1/${d1}`]!.name, 'd1, dialogue, 2 refusals, unreached');
  assert.equal(by[`beat:1/${d1}`]!.title, 'unknown_ref /a\nshape /b');
});

// Break: a selection on the map or in the Book leaves its row shut inside a folded part and beat,
// or a click on a node's second beat jumps the focus to its first or leaves that beat shut.
test('a selection opens the folded part and beat that hold it and focuses its row', () => {
  const shut = list.toggle(list.LIST, 'part:0');
  const st = list.reveal(planted, shut, d1);
  assert.equal(st.focus, `beat:1/${d1}`);
  assert.ok(ids(planted, st).includes(`beat:1/${d1}`));
  const loose = list.reveal(planted, list.LIST, f1);
  assert.ok(ids(planted, loose).includes(`unplaced/${f1}`));
  assert.equal(list.reveal(planted, shut, ref('room', 'hall')), shut);
  const clicked = list.reveal(planted, { ...list.LIST, focus: `beat:3/${d1}` }, d1);
  assert.equal(clicked.focus, `beat:3/${d1}`);
  assert.ok(ids(planted, clicked).includes(`beat:3/${d1}`));
});

// Break: Trace mixes writers with readers, loses the reader's beat or the clock read's dash, lists
// a node once per step that sets the fact, drops a node that both sets and reads it, or says
// nothing of a fact no one sets.
test('Trace follows a fact from where it is set to where it is read, with each beat', () => {
  assert.deepEqual(list.trace(planted, f1), [
    { label: 'set at', ref: ref('reaction', 'ring'), key: 'ring', beat: undefined },
    { label: 'set at', ref: ref('reaction', 'toll'), key: 'toll', beat: undefined },
    { label: 'set at', ref: q1, key: 'q1', beat: 1 },
    { label: 'set at', ref: ref('topic', 'lore'), key: 'lore', beat: undefined },
    { label: 'read at', ref: d1, key: 'd1', beat: 1 },
    { label: 'read at', ref: ref('reaction', 'wait'), key: 'wait', beat: undefined, dashed: true },
    { label: 'read at', ref: q1, key: 'q1', beat: 1 },
    { label: 'read at', ref: ref('topic', 'lore'), key: 'lore', beat: undefined },
  ]);
  assert.deepEqual(list.trace(planted, f2), [{ label: 'never set' }]);
  assert.deepEqual(
    list.trace(planted, q1).map((r) => [r.label, r.key, r.beat]),
    [['quest.start', 'd1', 1]],
  );
});

// Break: a palette row lands on a shut beat or part, or `trace` does not open Trace.
test('the palette goes to a beat or a node, and traces a fact', () => {
  const [top] = rank('beat 3', list.storyItems(planted));
  assert.equal(top!.id, 'beat:3');
  const st = list.go(planted, list.toggle(list.LIST, 'part:1'), top!.id);
  assert.equal(st.focus, 'beat:3');
  assert.ok(ids(planted, st).includes('beat:3'));
  const traced = list.go(planted, list.LIST, `trace:${f1}`);
  assert.deepEqual([traced.lower, traced.focus], [{ panel: 'trace', at: f1 }, `unplaced/${f1}`]);
  assert.deepEqual(
    list
      .storyItems(planted)
      .filter((i) => i.label.startsWith('trace'))
      .map((i) => i.label),
    ['trace q1', 'trace f1', 'trace f2', 'trace sp'],
  );
});

// Break: an arrow moves past the list's ends, Right on a shut row skips opening it, or Left on a
// child does not climb to its parent.
test('the arrows walk the tree: down, open, into, back to the parent, shut', () => {
  let st = list.LIST;
  const at = (id: string, key: string) => list.move(list.rows(planted, st), id, key);
  assert.deepEqual(at('part:0', 'ArrowUp'), { focus: undefined });
  assert.deepEqual(at('part:0', 'ArrowDown'), { focus: 'beat:1' });
  assert.deepEqual(at('beat:1', 'ArrowRight'), { toggle: 'beat:1' });
  st = list.toggle(st, 'beat:1');
  assert.deepEqual(at('beat:1', 'ArrowRight'), { focus: `beat:1/${q1}` });
  assert.equal(list.rows(planted, st)[2]?.level, 3);
  assert.deepEqual(at('beat:1', 'ArrowUp'), { focus: 'part:0' });
  assert.deepEqual(at('gone', 'ArrowDown'), {});
  assert.deepEqual(at('beat:1', 'Home'), {});
  assert.deepEqual(at(`beat:1/${q1}`, 'ArrowLeft'), { focus: 'beat:1' });
  assert.deepEqual(at('beat:1', 'ArrowLeft'), { toggle: 'beat:1' });
  assert.deepEqual(at('beat:2', 'ArrowRight'), {});
});

// Break: Knowledge counts one choice of two as known, misses an on_end or a topic grant, lets a
// later beat's set leak in (or out of `not yet`), or keeps a known fact under `may know`.
test('knowledge at a beat: knows, may know (one choice of two), not yet', () => {
  const [d2, s1, r1] = [ref('dialogue', 'd2'), ref('scene', 's1'), ref('reaction', 'r1')];
  const [fa, fb, fc, fd, t] = [
    ...['fa', 'fb', 'fc', 'fd'].map((k) => ref('fact', k)),
    ref('topic', 't'),
  ];
  const set = (from: string, to: string, path: string) => ({
    from,
    to,
    path,
    op: 'fact.assign',
    set: true as const,
  });
  const s: Story = {
    ...planted,
    graph: {
      nodes,
      edges: [
        set(d2, fa, '.choices["Yes"].steps[0].fact'), // one choice of two, a key outside [a-z0-9_]
        set(d2, fb, '.choices.yes.steps[0].fact'),
        set(d2, fb, '.choices.no.steps[1].fact'), // every choice
        set(d2, fc, '.on_end.assign[0].fact'), // no choice scopes it
        { from: s1, to: t, path: '.on_end.steps[0].topic', op: 'topic.grant' },
        set(r1, fd, '.steps[0].fact'), // only in beat 2
        set(r1, fa, '.steps[1].fact'),
        { from: d2, to: fd, path: '.choices.no.when.fact', op: 'fact_compare' }, // a read, not a set
      ],
    },
    choices: { [d2]: 2 },
    outline: {
      parts: [null],
      beats: [
        { part: 0, n: 1, status: 'built', nodes: [d2, s1] },
        { part: 0, n: 2, status: 'built', nodes: [r1] },
      ],
      unpaid: [],
      unseeded: [],
    },
  };
  assert.deepEqual(knowledge(s, 1), { knows: [fb, fc, t], may: [fa], not: [fd] });
  assert.deepEqual(knowledge(s, 2), { knows: [fa, fb, fc, fd, t], may: [], not: [] });
  assert.deepEqual(knowledge(s, 9), { knows: [], may: [], not: [] }); // a beat gone from the outline
});

// Re-review S1: plate_rearms sets plate_sprung false, so a beat after both the spring and the reset
// may know it (either value can hold), and a beat with only the false assign does not know it.
test('knowledge: a fact assigned false is not known; set true and false up to n, may know', () => {
  const fact = (key: string) => ({ cartridge_id: 'demo', cartridge_version: 1, kind: 'fact', key });
  const assign = (id: string, value: unknown) => ({
    steps: [{ op: 'fact.assign', fact: fact(id), value }],
  });
  const [springs, rearms, sets0] = ['springs', 'rearms', 'zero'].map((k) => ref('reaction', k));
  const graph = contentGraph({
    reactions: {
      [springs]: assign('sprung', true),
      [rearms]: assign('sprung', false),
      [sets0]: assign('count', 0),
    },
  });
  const beats = (...bs: string[][]) =>
    bs.map((nodes, i) => ({ part: 0, n: i + 1, status: 'built' as const, nodes }));
  const s = (b: Story['outline']): Story => ({ ...planted, graph, outline: b });
  const outline = (...bs: string[][]) => ({
    parts: [null],
    beats: beats(...bs),
    unpaid: [],
    unseeded: [],
  });
  const [sprung, count] = [ref('fact', 'sprung'), ref('fact', 'count')];
  const both = s(outline([springs], [rearms, sets0]));
  assert.deepEqual(knowledge(both, 1), { knows: [sprung], may: [], not: [count] });
  assert.deepEqual(knowledge(both, 2), { knows: [count], may: [sprung], not: [] }); // a 0 is not a false
  assert.deepEqual(knowledge(s(outline([rearms], [springs])), 1), {
    knows: [],
    may: [],
    not: [sprung],
  });
});

// Break: Pacing counts a node bound twice in a part twice, marks a part at half the median thin,
// takes the lower middle of an even count as the median, misses the thin part, does not list it first,
// or counts a bound node with no words as a word.
test('pacing: words per part over its bound nodes, the thin part first', () => {
  const [x, y, z, w] = ['x', 'y', 'z', 'w'].map((k) => ref('room', k));
  const beat = (part: number, n: number, nodes: string[]) => ({ part, n, status: 'built', nodes });
  const s: Story = {
    ...planted,
    words: { [x]: 100, [y]: 10, [z]: 90, [w]: 45 },
    outline: {
      parts: ['A', 'B', 'C', 'D'],
      beats: [
        beat(0, 1, [x]),
        beat(0, 2, [x, ref('room', 'bare')]),
        beat(1, 3, [y]),
        beat(2, 4, [z]),
        beat(3, 5, [w]),
      ],
      unpaid: [],
      unseeded: [],
    },
  };
  assert.deepEqual(
    pacing(s).map((p) => [p.title, p.words, p.thin]),
    [
      ['B', 10, true],
      ['A', 100, false],
      ['C', 90, false],
      ['D', 45, false], // half the median (90) is not below it
    ],
  );
  // the median is the upper middle part of an even count: 90 here, not 40
  const fewer = pacing({ ...s, words: { ...s.words, [w]: 40 } });
  assert.deepEqual(
    fewer.filter((p) => p.thin).map((p) => p.title),
    ['B', 'D'],
  );
});

// Break: the Consequences panel lists a dialogue's choices as rows without their own writes, walks a
// bare node where a choice row should walk that choice, or drops the never-read row.
test('Consequences: a dialogue lists each choice with what it writes; a choice row walks its two hops', () => {
  const leaf = {
    op: 'fact_compare',
    fact: { cartridge_id: 'demo', cartridge_version: '1', kind: 'fact', key: 'f1' },
    equals: true,
  };
  const s: Story = {
    ...planted,
    // d1's choice `yes` sets f1; the reaction `ring` reads it behind f1 == true and sets f2
    graph: {
      nodes,
      edges: [
        {
          from: d1,
          to: f1,
          path: '.choices.yes.steps[0].fact',
          op: 'fact.assign',
          value: true,
          set: true,
        },
        {
          from: d1,
          to: f2,
          path: '.choices.no.steps[0].fact',
          op: 'fact.assign',
          value: true,
          set: true,
        },
        { from: ref('reaction', 'ring'), to: f1, path: '.when', op: 'fact_compare', leaf },
      ],
    },
    report: { ...planted.report, orphan_facts: { unused: [], write_only: [f2], read_only: [] } },
  };
  assert.deepEqual(choicesOf(s, d1), ['yes', 'no']);
  // the dialogue's own panel: each choice heads a group, its writes sit under it
  assert.deepEqual(
    consequenceRows(s, d1).map((r) => [r.label, r.at ?? r.key, r.depth]),
    [
      ['choice', `${d1}#yes`, 0],
      ['sets', 'f1 = true', 1],
      ['choice', `${d1}#no`, 0],
      ['sets', 'f2 = true', 1],
    ],
  );
  // a choice row walks that choice: its write, the reader with the gate the write settles, and the
  // write nothing reads is the `no` choice's, not this one's
  assert.deepEqual(
    consequenceRows(s, `${d1}#yes`).map((r) => [r.label, r.ok ?? r.key]),
    [
      ['sets', 'f1 = true'],
      ['read via f1', 'ring'],
      ['fact f1 on the target needs true', true],
    ],
  );
  assert.deepEqual(
    consequenceRows(s, `${d1}#no`).map((r) => [r.label, r.key]),
    [
      ['sets', 'f2 = true'],
      ['never read', 'f2'],
    ],
  );
});

// Break: the palette offers Consequences on a node that writes nothing, or `consequences` opens
// Trace (or nothing) instead of the panel keyed to that ref.
test('the palette offers Consequences on the nodes that write and opens it on them', () => {
  const st = list.go(planted, list.LIST, `consequences:${d1}`);
  assert.deepEqual([st.lower, st.focus], [{ panel: 'consequences', at: d1 }, `beat:1/${d1}`]);
  assert.deepEqual(
    list
      .storyItems(planted)
      .filter((i) => i.label.startsWith('consequences'))
      .map((i) => i.label),
    ['consequences d1', 'consequences sp'],
  );
});

// R2 (docs/design/story-tooling.md `### R2`): the chip's names and the `uncovered` filter.
// Break: a node with no coverage and a node whose coverage is unknown both read as uncovered, the
// filter keeps a covered node, or the beat holding it is not kept.
test('a node names its checkpoints; the uncovered filter keeps the beats holding uncovered nodes', () => {
  const at = { [q1]: ['gate', 'mill'], [d1]: ['gate'] };
  const shut = list.toggle(list.LIST, 'beat:1');
  const by = Object.fromEntries(list.rows(planted, shut, at).map((r) => [r.id, r]));
  assert.deepEqual(by[`beat:1/${q1}`]!.covered, ['gate', 'mill']);
  assert.equal(by[`beat:1/${q1}`]!.name, 'q1, quest, 3 ~, covered by gate, mill');
  assert.equal(by[`beat:1/${q1}`]!.title, 'covered: gate, mill'); // no refusals, so the names alone
  assert.equal(by[`beat:1/${d1}`]!.uncovered, undefined);
  // q1 and d1 are reached, so beat 1 and part 0 go; beat 2 binds no node and goes with them. The
  // unbound nodes stay, and f2's read-only status does not make it covered.
  const only = list.rows(planted, { ...list.LIST, only: 'uncovered' }, at);
  assert.deepEqual(
    only.map((r) => r.id),
    ['unplaced', `unplaced/${f1}`, `unplaced/${f2}`, `unplaced/${sp}`],
  );
  assert.deepEqual(only[1]!.covered, undefined);
  assert.equal(only[1]!.uncovered, true);
});

// Break: before the watcher's first coverage push, every node reads unreached and the list hides
// behind the filter.
test('with no coverage pushed yet nothing claims a node is uncovered', () => {
  const rows = list.rows(planted, { ...list.LIST, only: 'uncovered' });
  assert.deepEqual(
    rows.map((r) => r.id),
    ids(planted, list.LIST), // the whole list, as if the filter were off
  );
  const open = list.toggle(list.LIST, 'unplaced'); // Unplaced starts shut, so its nodes are not rows
  const by = Object.fromEntries(list.rows(planted, open).map((r) => [r.id, r]));
  assert.equal(by[`unplaced/${f1}`]!.uncovered, undefined);
  assert.equal(by[`unplaced/${f1}`]!.covered, undefined);
});
