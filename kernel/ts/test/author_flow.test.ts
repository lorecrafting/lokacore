// The Flow graph (tools/author-panel/src/flow.ts, flowread.ts): expected values worked by hand from
// the S3 table (docs/design/editor-map-and-story-rulings.md) on planted models, and the showcase.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import {
  burst,
  cmp,
  F,
  inColumn,
  layers,
  layout,
  type Flow,
} from '../../../tools/author-panel/src/flow.ts';
import * as read from '../../../tools/author-panel/src/flowread.ts';
import { LAYOUT } from '../../../tools/author-panel/src/shell.ts';
import type { Story } from '../../../tools/author-panel/src/storylist.ts';
import { story as build } from '../play/story.ts';
import {
  col,
  d1,
  d2,
  d3,
  edges,
  f,
  line,
  model,
  OPEN,
  outline,
  planted,
  q,
  r1,
  ref,
  thera,
  V,
  xy,
} from './author_flow_fixture.ts';

// Breaks: the cap is off by one, the stub counts the kept chips, or opening the cell keeps the cap.
test('20 reactions with no inbound edge: 12 chips and +8; opened, 20 and the lane grows', () => {
  const many = Array.from({ length: 20 }, (_, i) =>
    ref('reaction', `r${String(i).padStart(2, '0')}`),
  );
  const s = model(many, []);
  const shut = layout(s, OPEN);
  assert.equal(shut.chips.length, 12);
  assert.deepEqual(
    shut.stubs.map((x) => [x.kind, x.n]),
    [['more', 8]],
  );
  const open = layout(s, { fold: [], open: [shut.stubs[0]!.id.slice(5)] });
  assert.equal(open.chips.length, 20);
  assert.deepEqual(open.stubs, []);
  assert.ok(open.lanes[0]!.h > shut.lanes[0]!.h);
  // no outline: the note and no part row
  assert.equal(shut.note, 'No outline.json; columns are dependency layers.');
  assert.deepEqual(shut.parts, []);
});

// Breaks: beats drift from 160 apart, `check` draws solid, `then` dashed, or a back edge is drawn
// as a forward bezier or left out of the footer's loops.
test('two beats 160 apart; check dashed, then solid; two thens back draw above the lanes as 2 loops', () => {
  const fl = layout(planted, OPEN);
  assert.equal(fl.columns[1]!.x - fl.columns[0]!.x, 160);
  assert.equal(line(fl, d1, d3).solid, false);
  assert.equal(line(fl, d1, d2).solid, true);
  for (const back of [line(fl, d2, d1), line(fl, d3, d1)]) {
    assert.ok(back.loop);
    const ys = [...back.d.matchAll(/-?[\d.]+,(-?[\d.]+)/g)].map((m) => Number(m[1]));
    assert.ok(Math.min(...ys) < fl.lanes[0]!.y, `${back.d} rises above the top lane`);
  }
  assert.match(read.footer(fl), / · 2 loops · /);
  assert.equal(
    fl.lanes.find((l) => l.lane === 'story'),
    undefined,
  ); // no story lane without its kinds
});

// Breaks: focus inks two hops, misses the `then` target, or the dim is not 0.3.
test('focus a dialogue: its then target at full ink, an unrelated chip at 0.3; no focus, all at 1', () => {
  const fl = layout(planted, OPEN);
  const ink = read.focusInk(planted, d1, 1);
  assert.ok(read.inked(fl, ink, d2));
  assert.equal(read.inked(fl, ink, thera), false);
  assert.equal(F.dim, 0.3);
  assert.ok([thera, q, r1].every((r) => read.inked(fl, undefined, r)));
});

// Breaks: following inks the fact's whole neighbourhood (d1's solid then), or the palette's follow
// row does not keep the fact in Layout.flow.
test('follow a read_only fact: its readers inked and no solid line; the palette row keeps it', () => {
  const fl = layout(planted, OPEN);
  const ink = read.followed(planted, f);
  assert.deepEqual([...ink].sort(), [d1, f, r1].sort());
  const lit = fl.lines.filter((l) => read.inked(fl, ink, l.from) && read.inked(fl, ink, l.to));
  assert.equal(lit.length, 2);
  assert.ok(lit.every((l) => !l.solid));
  const l = read.flowGo(planted, { ...LAYOUT, leftOpen: false, map: 'story' }, `follow:${f}`)!;
  assert.equal(l.map, 'flow');
  assert.equal(l.flow?.follow, f);
});

// Breaks: search misses keys or inks everything; a lane filter keeps its chips or the footer
// does not count them.
test('search thera inks only its match; filtering reaction removes those chips and counts them', () => {
  const fl = layout(planted, OPEN);
  const hits = read.search(planted, 'thera')!;
  assert.equal(read.inked(fl, hits, thera), true);
  assert.equal(read.inked(fl, hits, d1), false);
  const off = layout(planted, { fold: [], filters: ['reaction'] });
  assert.deepEqual(
    off.chips.filter((c) => c.lane === 'reaction'),
    [],
  );
  assert.equal(off.hidden, 2);
  assert.match(read.footer(off), / · 2 hidden$/);
});

// Breaks: Tab enters elsewhere than the first chip, Right skips a column, Shift-Enter does not
// take the first outbound edge.
test('keyboard: Tab in, Right twice, Shift-Enter', () => {
  // a dialogue d4 in beat 3 reading f: q (beat 1) -> d2 (beat 2) -> d4 (beat 3), each its cell's top
  const d4 = ref('dialogue', 'd4');
  const s = model(
    [...planted.graph.nodes.map((n) => n.ref), d4],
    [...edges, { from: d4, to: f, path: '/when', op: 'fact_compare' }],
    {
      ...outline!,
      beats: [...outline!.beats, { part: 0, n: 3, title: 'Ford', status: 'built', nodes: [d4] }],
    },
  );
  const fl = layout(s, OPEN);
  const start = read.entry(fl)!;
  assert.equal(start, q);
  const one = read.step(s, fl, start, 'ArrowRight')!;
  assert.equal(one, d2);
  const two = read.step(s, fl, one, 'ArrowRight')!;
  assert.equal(two, d4);
  // f sits in the collapsed unplaced part, so its count chip stands in for it
  assert.equal(read.step(s, fl, two, 'Enter', true), 'count:unplaced|fact');
  assert.equal(read.step(s, fl, two, 'Enter'), undefined); // plain Enter selects, it does not move
});

// Breaks: Home or End aims at an empty first or last column and goes nowhere.
test('Home and End skip empty beats at either end', () => {
  const empty = (n: number) => ({ part: 0, n, title: 'Empty', status: 'built', nodes: [] });
  const s = model([d1, d2], [], {
    ...outline!,
    beats: [
      empty(1),
      { ...outline!.beats[0]!, n: 2, nodes: [d1] },
      { ...outline!.beats[1]!, n: 3, nodes: [d2] },
      empty(4),
    ],
  });
  const fl = layout(s, OPEN);
  assert.equal(read.step(s, fl, d2, 'Home'), d1);
  assert.equal(read.step(s, fl, d1, 'End'), d2);
});

// Breaks: a chip's name drops or swaps its edge counts.
test("a chip's name ends with its edge counts", () => {
  const fl = layout(planted, OPEN);
  assert.equal(
    fl.chips.find((c) => c.id === d1)!.name,
    'd1, dialogue, beat 1, 3 outbound, 2 inbound',
  );
  assert.ok(fl.chips.every((c) => /, \d+ outbound, \d+ inbound$/.test(c.name)));
});

// Breaks: a new node in one cell shifts a chip in another.
test('adding an unrelated node to a cell that is not its lane tallest moves nothing else', () => {
  const extra = ref('dialogue', 'zz');
  const more = model([...planted.graph.nodes.map((n) => n.ref), extra], edges, {
    ...outline!,
    beats: [{ ...outline!.beats[0]!, nodes: [q, d1, extra] }, outline!.beats[1]!],
  });
  const before = layout(planted, OPEN);
  const after = layout(more, OPEN);
  const at = (fl: Flow) => new Map(fl.chips.map((c) => [c.id, [c.x, c.y]]));
  for (const [id, xy] of at(before)) assert.deepEqual(at(after).get(id), xy, id);
});

// Breaks: the layout reads a clock or unordered state, a loop is misfiled, or it is slow.
test('the showcase: layout under 20 ms, equal across runs, loops exactly the backward lines', () => {
  const root = resolve(import.meta.dirname, '../../..');
  const src = join(root, 'cartridges/toolbox_showcase');
  const dir = mkdtempSync(join(tmpdir(), 'flow-'));
  const artifact = join(dir, 'artifact.json');
  try {
    execFileSync('mix', ['loka.compile', src, artifact, '--allow-placeholders'], {
      cwd: root,
      stdio: 'ignore',
    });
    const [, canonical, sha256] = /^\{"cartridge":(.*),"content_hash":"([0-9a-f]{64})"\}$/s.exec(
      readFileSync(artifact, 'utf8'),
    )!;
    const s = build(src, { canonical: canonical!, sha256: sha256! }, []) as unknown as Story;
    const first = layout(s, OPEN);
    const t = performance.now();
    const second = layout(s, OPEN);
    const ms = performance.now() - t;
    assert.ok(ms < 20, `${ms.toFixed(1)} ms`);
    assert.deepEqual(second, first);
    assert.ok(first.chips.length > 20, `${first.chips.length} chips`);
    const back = first.lines.filter((l) => col(first, l.from) > col(first, l.to)).map((l) => l.id);
    assert.deepEqual([...first.loops].sort(), back.sort());
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Breaks: a layer starts at 1 or steps by 2, a back edge or self edge raises its target, or an
// edge to a ref outside the set adds it.
test('layers: longest path, the back edge and the self edge ignored, outside refs dropped', () => {
  const e = (from: string, to: string) => ({ from, to, path: '' });
  const got = layers(
    ['a', 'b', 'c'],
    [e('a', 'b'), e('b', 'c'), e('a', 'c'), e('c', 'c'), e('c', 'a'), e('b', 'x')],
  );
  assert.deepEqual(
    [...got],
    [
      ['a', 0],
      ['b', 1],
      ['c', 2],
    ],
  );
  assert.deepEqual([cmp('a', 'a'), cmp('a', 'b'), cmp('b', 'a')], [0, -1, 1]);
});

// Breaks: a part, column, lane or chip moves off the S3 grid (beats 160 apart, chips centred,
// lanes 32 a row plus 12, a shut part one column of count stubs).
test('the planted grid: parts, columns, lanes, chips and count stubs at their worked places', () => {
  const fl = layout(planted, OPEN);
  assert.deepEqual(
    fl.parts.map((p) => [p.id, p.label, p.open, p.x, p.w]),
    [
      ['part:0', 'Part 1  Arrival', true, 0, 320],
      ['unplaced', 'Unplaced (3)', false, 320, 160],
    ],
  );
  assert.deepEqual(
    fl.columns.map((c) => [c.id, c.x]),
    [
      ['beat:1', 0],
      ['beat:2', 160],
      ['unplaced', 320],
    ],
  );
  assert.deepEqual(
    fl.lanes.map((l) => [l.lane, l.y, l.h]),
    [
      ['quest', 32, 44],
      ['dialogue', 76, 76],
      ['reaction', 152, 44],
      ['fact', 196, 44],
    ],
  );
  assert.equal(fl.h, 240);
  assert.equal(fl.w, 480);
  assert.deepEqual(xy(fl), [
    [d1, 8, 76, 0],
    [d2, 168, 76, 1],
    [d3, 168, 108, 1],
    [q, 8, 32, 0],
    ['count:unplaced|fact', 328, 196, 2],
    ['count:unplaced|reaction', 328, 152, 2],
  ]);
  assert.deepEqual(
    fl.stubs.map((x) => [x.kind, x.icon, x.n]),
    [
      ['count', 'fact', 1],
      ['count', 'reaction', 2],
    ],
  );
  const shut = layout(planted, { fold: ['part:0'] });
  assert.deepEqual(
    shut.columns.map((c) => c.id),
    ['part:0', 'unplaced'],
  );
  assert.deepEqual(
    shut.stubs.map((x) => [x.id, x.n]),
    [
      ['count:part:0|dialogue', 3],
      ['count:unplaced|fact', 1],
      ['count:part:0|quest', 1],
      ['count:unplaced|reaction', 2],
    ],
  );
  assert.equal(shut.lanes.find((l) => l.lane === 'dialogue')!.h, 44);
});

// Breaks: Unplaced's dependency layers do not become columns, or the path of a forward, a
// same-column or a back line changes shape.
test('V with Unplaced open: two layer columns and the three path shapes', () => {
  const fl = layout(V, { fold: ['unplaced'] });
  assert.deepEqual(fl.columns.map((c) => [c.id, c.x]).slice(2), [
    ['layer:0', 320],
    ['layer:1', 480],
  ]);
  assert.deepEqual(
    xy(fl).filter(([id]) => [r1, thera, f].includes(id as string)),
    [
      [f, 328, 196, 2],
      [r1, 328, 152, 2],
      [thera, 488, 152, 3],
    ],
  );
  assert.equal(line(fl, d1, d3).d, 'M152,90 C160,90 160,122 168,122');
  assert.equal(line(fl, d2, d3).d, 'M312,90 C324,90 324,122 312,122');
  assert.equal(line(fl, d2, d3).loop, false);
  assert.equal(line(fl, d2, d1).d, 'M312,90 C324,8 -4,8 8,90');
  assert.equal(line(fl, r1, thera).d, 'M472,166 C480,166 480,166 488,166');
  assert.equal(read.footer(fl, f), 'following f · 7 nodes · 9 edges · 2 loops · 0 hidden');
  assert.equal(
    fl.chips.find((c) => c.id === d1)!.name,
    'd1, dialogue, beat 1, 5 outbound, 3 inbound',
  );
});

// Breaks: a self edge, an edge inside one stub or an edge to an anchor draws a line, or the
// footer counts lines instead of edges.
test('V shut: no self line and no line inside a stub; the footer counts edges', () => {
  const fl = layout(V, OPEN);
  assert.deepEqual(
    fl.lines.map((l) => l.id).sort(),
    [
      `${d1}>${d2}>s`,
      `${d1}>${d3}>d`,
      `${d1}>count:unplaced|fact>d`,
      `${d2}>${d1}>s`,
      `${d2}>${d3}>s`,
      `${d3}>${d1}>s`,
      'count:unplaced|reaction>count:unplaced|fact>d',
    ].sort(),
  );
  assert.equal(fl.edges, 8);
  assert.equal(read.footer(fl), '7 nodes · 8 edges · 2 loops · 0 hidden');
});

// Breaks: the cap is off by one at 12 and 13 (a 13th row or a second layer column at 12), the stub's icon is not the first hidden kind, or
// revealing a hidden ref keeps the cap, or any reveal opens every cell.
test('12 reactions: no stub; 13: 12 and a +1 of the next kind, the lane 13 rows; reveal opens', () => {
  const twelve = Array.from({ length: 12 }, (_, i) =>
    ref('reaction', `r${String(i).padStart(2, '0')}`),
  );
  const fl12 = layout(model(twelve, []), OPEN);
  assert.deepEqual([fl12.stubs, fl12.lanes[0]!.h, fl12.columns.length], [[], 12 * 32 + 12, 1]);
  const s = model([...twelve, ref('action', 'zz')], []);
  const fl = layout(s, OPEN);
  assert.deepEqual(
    fl.stubs.map((x) => [x.id, x.kind, x.icon, x.n, x.y]),
    [['more:layer:0|reaction', 'more', 'action', 1, 416]],
  );
  assert.equal(fl.lanes[0]!.h, 13 * 32 + 12);
  assert.equal(layout(s, { fold: [], reveal: ref('action', 'zz') }).chips.length, 13);
  assert.equal(layout(s, { fold: [], reveal: ref('action', 'elsewhere') }).chips.length, 12);
  assert.deepEqual([F.cap, F.rows, F.hoverDelay], [12, 6, 300]);
});

// Break: a column draws its stubs after every lane's chips, so a reaction lane's +1 follows the
// fact lane's chip below it in the DOM and the tab order.
test("a column lists a lane's stub before the next lane's chips", () => {
  const twelve = Array.from({ length: 12 }, (_, i) =>
    ref('reaction', `r${String(i).padStart(2, '0')}`),
  );
  const fl = layout(model([...twelve, ref('action', 'zz'), ref('fact', 'f9')], []), OPEN);
  assert.deepEqual(
    inColumn(fl, 0)
      .slice(-2)
      .map((x) => x.id),
    ['more:layer:0|reaction', ref('fact', 'f9')],
  );
});

// Break: the first story dots every change since page load, not the last burst; or a later one
// dots a change it already showed.
test('burst: the first story takes the last burst, a later one only what is newer', () => {
  const c = (file: string, seen: number) =>
    ({ file, by: 'author', seen }) as Parameters<typeof burst>[0][number];
  const changes = [c('b.json', 20), c('c.json', 20), c('a.json', 10)];
  assert.deepEqual(
    burst(changes).map((x) => x.file),
    ['b.json', 'c.json'],
  );
  assert.deepEqual(
    burst(changes, 10).map((x) => x.file),
    ['b.json', 'c.json'],
  );
  assert.deepEqual(burst(changes, 20), []);
  assert.deepEqual(burst([]), []);
});

// Breaks: a filter keeps a node without words to write (or drops one with a single `~`) or without a problem, or a name drops
// its `~` count, refusals or `unreached`.
test('filters: needs words keeps the node with placeholders; potential problems keeps the three', () => {
  const words = {
    ...planted,
    todo: { [d2]: [{ file: 'd2.json', words: 0, placeholders: ['a'] }] },
  };
  const fl = layout(words, { fold: [], filters: ['needs words'] });
  assert.deepEqual(
    fl.chips.map((c) => c.name),
    ['d2, dialogue, beat 2, 1 ~, 1 outbound, 1 inbound'],
  );
  assert.equal(read.footer(fl), '1 node · 0 edges · 0 loops · 6 hidden');
  const bad = {
    ...planted,
    diagnostics: { [d3]: [{ code: 'x' }] },
    report: { ...planted.report, unreachable: { quest: [r1] } },
  };
  const pp = layout(bad, { fold: ['unplaced'], filters: ['potential problems'] });
  assert.deepEqual([...pp.at.keys()].sort(), [d3, f, r1].sort());
  assert.deepEqual(
    pp.chips.map((c) => c.name).filter((n) => !n.startsWith('f,')),
    [
      'd3, dialogue, beat 2, 1 refusal, 1 outbound, 1 inbound',
      'r1, reaction, unreached, 1 outbound, 0 inbound',
    ],
  );
});
