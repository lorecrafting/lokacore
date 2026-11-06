// The Flow graph (tools/author-panel/src/flow.ts, flowread.ts): expected values worked by hand from
// the S3 table (docs/design/editor-map-and-story-rulings.md) on planted models, and the showcase.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { F, layout, type Flow } from '../../../tools/author-panel/src/flow.ts';
import * as read from '../../../tools/author-panel/src/flowread.ts';
import type { Edge, Story } from '../../../tools/author-panel/src/storylist.ts';
import { story as build } from '../play/story.ts';

const ref = (kind: string, key: string) => `demo@1:${kind}/${key}`;
const [q, d1, d2, d3, r1, thera, f] = [
  ref('quest', 'q'),
  ref('dialogue', 'd1'),
  ref('dialogue', 'd2'),
  ref('dialogue', 'd3'),
  ref('reaction', 'r1'),
  ref('reaction', 'thera_greets'),
  ref('fact', 'f'),
];
const model = (refs: string[], edges: Edge[], outline: Story['outline'] = null): Story => ({
  hash: 'h',
  graph: { nodes: refs.map((r) => ({ ref: r, kind: r.split(':')[1]!.split('/')[0]! })), edges },
  report: {
    unreachable: {},
    behind_lock: { rooms: [] },
    orphan_facts: { unused: [], write_only: [], read_only: [f] },
  },
  outline,
  todo: {},
  diagnostics: {},
  map: [],
  words: {},
  choices: {},
  files: {},
});
// Beat 1 holds q and d1, beat 2 d2 and d3; d1 `then` d2, forks to d3 by `check` and reads f, as r1
// does; d2 and d3 `then` back to d1 (two loops). f is a read_only fact; thera_greets is unrelated.
const edges: Edge[] = [
  { from: d1, to: d2, path: '/then' },
  { from: d1, to: d3, path: '/check/fail' },
  { from: d1, to: f, path: '/when', op: 'fact_compare' },
  { from: d2, to: d1, path: '/then' },
  { from: d3, to: d1, path: '/then' },
  { from: r1, to: f, path: '/when', op: 'fact_compare' },
];
const outline: Story['outline'] = {
  parts: ['Arrival'],
  beats: [
    { part: 0, n: 1, title: 'Gate', status: 'built', nodes: [q, d1] },
    { part: 0, n: 2, title: 'Mill', status: 'built', nodes: [d2, d3] },
  ],
  unpaid: [],
  unseeded: [],
};
const planted = model([q, d1, d2, d3, r1, thera, f], edges, outline);
const OPEN = { fold: [] };
const line = (fl: Flow, a: string, b: string) => fl.lines.find((l) => l.from === a && l.to === b)!;
const col = (fl: Flow, id: string) => [...fl.chips, ...fl.stubs].find((c) => c.id === id)!.col;

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
  const l = read.flowGo(planted, { leftOpen: false, map: 'story' } as never, `follow:${f}`)!;
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
