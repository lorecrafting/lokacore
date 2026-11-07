// The Story map's model (docs/rnd/story-map-design-2026-11-05.md section 11 S1) over a planted copy
// of scene_sampler: two dialogues joined by `then` (one in an area folder), a choice_resolved
// reaction, a room no exit reaches and an outline.json.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { get as httpGet } from 'node:http';
import { basename, dirname, join, resolve } from 'node:path';
import { after, test } from 'node:test';
import { serve } from '../play/live.ts';
import { story } from '../play/story.ts';
import { wordsByNode } from '../play/story_counts.ts';

const root = resolve(import.meta.dirname, '../../..');
const dir = mkdtempSync(join(tmpdir(), 'loka-story-'));
after(() => rmSync(dir, { recursive: true, force: true }));
const src = join(dir, 'src');
cpSync(join(root, 'cartridges/scene_sampler'), src, { recursive: true });
const put = (rel: string, value: unknown) => writeFileSync(join(src, rel), JSON.stringify(value));
const prose = (words: string) => ({ prose: words });
const roles = { bram: { role: 'npc', npc: 'bram' } };
const choice = (then?: string) => ({ label: prose('Go'), narration: prose('Gone'), then });
put('dialogues/greet.json', {
  npc: 'bram',
  prompt: prose('Well?'),
  roles,
  choices: { ask: choice('hub'), bye: choice('end') },
});
for (const d of ['dialogues', 'rooms']) mkdirSync(join(src, 'areas/town', d), { recursive: true });
const hub = 'areas/town/dialogues/hub.json';
put(hub, {
  npc: 'bram',
  prompt: prose('Here.'),
  roles,
  choices: { bye: choice() },
});
put('areas/town/rooms/attic.json', {
  name: prose('Attic'),
  description: prose('Dust.'),
  exits: {},
});
put('areas/yard.json', {
  rooms: {
    shed: {
      name: prose('Shed'),
      description: prose('Tools.'),
      exits: { up: { to: 'attic', hidden_until: { fact: 'bell_heard', equals: true } } },
    },
  },
});
const cart = JSON.parse(readFileSync(join(src, 'cartridge.json'), 'utf8'));
cart.requires.capabilities.knowledge = 1; // layout.json's
put('cartridge.json', cart);
const cells = { village_green: [2, -1], ferry_landing: [2, 0], attic: [0, 0], shed: [1, 0] };
put(
  'layout.json',
  Object.entries(cells).map(([room, [x, y]]) => ({ room, x, y, z: 0 })),
);
put('reactions/asked.json', {
  on: { event: 'choice_resolved', choice: 'ask' },
  steps: [{ op: 'fact.assign', fact: 'bell_heard', value: true }],
});
const outline = {
  parts: [
    {
      title: 'One',
      beats: [
        { n: 1, nodes: ['dialogues/greet/ask'], seeds: ['lantern', 'debt'] },
        {
          n: 2,
          nodes: [
            'rooms/village_green',
            'items/nowhere',
            'dialogues/greet/nope',
            'rooms/village_green/door',
          ],
          seeds: ['coin'],
          pays: ['coin'], // a beat cannot pay its own seed
        },
      ],
    },
    {
      beats: [
        { n: 3, nodes: ['rooms/village_green'], pays: ['lantern', 'oath'], seeds: ['ring'] },
        { n: 4, nodes: ['rooms/attic'], pays: ['ring'] }, // paid in the very next beat
        { n: 5 }, // planned, no node yet
        { n: 6, nodes: ['rooms/attic', 'rooms/village_green'] }, // one node reached
      ],
    },
  ],
};
put('outline.json', outline);
const artifact = join(dir, 'artifact.json');
execFileSync('mix', ['loka.compile', src, artifact, '--allow-placeholders'], {
  cwd: root,
  stdio: 'ignore',
});
const [, canonical, sha256] = /^\{"cartridge":(.*),"content_hash":"([0-9a-f]{64})"\}$/s.exec(
  readFileSync(artifact, 'utf8'),
)!;
const dev = { canonical: canonical!, sha256: sha256! };
const ref = (kind: string, key: string) => `scene_sampler@0.0.1:${kind}/${key}`;
const green = ref('room', 'village_green');

// Break: the seeds-and-payoffs check counts a beat's own seed as paid, misses a payoff in the
// very next beat, or ignores the order across parts.
test('a seed with no later payoff and a payoff with no earlier seed are listed', () => {
  const { outline } = story(src, dev, []) as { outline: { unpaid: unknown; unseeded: unknown } };
  assert.deepEqual(outline.unpaid, [
    { seed: 'debt', n: 1 },
    { seed: 'coin', n: 2 },
  ]);
  assert.deepEqual(outline.unseeded, [
    { pays: 'coin', n: 2 },
    { pays: 'oath', n: 3 },
  ]);
});

type Beats = { outline: { beats: { n: number; status: string; missing?: string[] }[] } };
// Break: a ref the artifact lacks (an unknown key, a choice the dialogue does not have, a choice
// path on a room) reads as built; a beat no exit reaches reads as built.
// Break: a `~` in text.json under a key the node names, or in an area folder's file, does not
// mark its node, or marks it once the words are in; a beat with no node yet not missing, or
// one with any reached node unreached (§5c: unreached only when every node is).
test('a beat is missing with the refs not in the artifact, `~` while its node has one', () => {
  const beats = () => (story(src, dev, []) as Beats).outline.beats;
  assert.deepEqual(
    beats().map(({ n, status, missing }) => [n, status, missing]),
    [
      [1, 'built', undefined],
      [2, 'missing', ['items/nowhere', 'dialogues/greet/nope', 'rooms/village_green/door']],
      [3, 'built', undefined],
      [4, 'unreached', undefined],
      [5, 'missing', undefined],
      [6, 'built', undefined],
    ],
  );
  // Break: Bind (mapedit.ts) is told a ref resolve() refuses is known, or a choice ref is not.
  const { shorts } = story(src, dev, []) as { shorts: string[] };
  assert.deepEqual(
    [
      'dialogues/greet/ask',
      'rooms/village_green',
      'items/nowhere',
      'dialogues/greet/nope',
      'rooms/village_green/door',
    ].map((r) => shorts.includes(r)),
    [true, true, false, false, false],
  );
  const text = readFileSync(join(src, 'text.json'), 'utf8');
  const spoken = readFileSync(join(src, hub), 'utf8');
  put('text.json', { ...JSON.parse(text), 'room.village_green.description': '~' });
  put(hub, { ...JSON.parse(spoken), prompt: prose('~') });
  try {
    assert.equal(beats()[2]!.status, '~');
    const { todo } = story(src, dev, []);
    assert.deepEqual(
      todo[green]!.map((t) => [t.file, t.placeholders]),
      [['text.json', ['room.village_green.description']]],
    );
    assert.deepEqual(
      todo[ref('dialogue', 'hub')]!.map((t) => t.file),
      [hub],
    );
  } finally {
    writeFileSync(join(src, 'text.json'), text);
    writeFileSync(join(src, hub), spoken);
  }
});

// Break: the List (S2) puts a beat's nodes under the wrong beat: a choice ref not folded into its
// dialogue, a ref the artifact lacks kept, a node bound twice listed twice; a part's title shifted
// to another part or an untitled part given one.
test('a beat lists its bound nodes once each, parts their titles', () => {
  const { outline } = story(src, dev, []) as {
    outline: { parts: unknown[]; beats: { n: number; nodes: string[] }[] };
  };
  assert.deepEqual(outline.parts, ['One', null]);
  assert.deepEqual(
    outline.beats.map(({ n, nodes }) => [n, nodes]),
    [
      [1, [ref('dialogue', 'greet')]],
      [2, [green]],
      [3, [green]],
      [4, [ref('room', 'attic')]],
      [5, []],
      [6, [ref('room', 'attic'), green]],
    ],
  );
});

// Break: Trace (S2) reads a fact's writer as a reader or its reader as a writer: the `set` flag
// missing on a step that assigns the fact, or put on a condition that reads it.
test('an edge that assigns a fact is set, one that reads it is not', () => {
  const { graph } = story(src, dev, []);
  const bell = (graph.edges as { to: string; from: string; set?: true }[]).filter(
    (e) => e.to === ref('fact', 'bell_heard'),
  );
  assert.deepEqual(bell.map((e) => [e.from, e.set]).sort(), [
    [ref('reaction', 'asked'), true],
    [ref('reaction', 'bell_after'), true], // scene_sampler's own fact.assign
    [ref('room', 'shed'), undefined],
  ]);
});

// Break: Pacing counts a key's words twice, a `~` as a word, misses scene or inline prose, or
// Knowledge counts a dialogue's choices wrong (it tells "every choice" from "one of several").
test('words by node from the text keys it names; choices by dialogue', () => {
  const { words, choices } = story(src, dev, []);
  assert.equal(words[ref('dialogue', 'greet')], 5); // Well? + Go Gone twice
  assert.equal(words[ref('room', 'attic')], 2);
  assert.equal(choices[ref('dialogue', 'greet')], 2);
  assert.equal(choices[ref('dialogue', 'hub')], 1);
});

// Break: a key one definition names twice counted twice, or a `~` line counted as a word.
test('words by node count each named key once and skip a ~ line', () => {
  const defs = new Map([['rooms/a', { name: 'k1', description: 'k1', note: 'k2' }]]);
  assert.deepEqual(wordsByNode(defs, { k1: 'one two', k2: 'three\n~' }), { 'rooms/a': 3 });
});

// Break: `then: end` drawn as an edge to a dialogue named end, a `then` dropped, or a
// choice_resolved reaction linked from a dialogue without that choice.
test('then and choice_resolved edges: then: end draws none, then: hub one', () => {
  const { graph } = story(src, dev, []);
  const ops = new Set(['then', 'then_failed', 'choice_resolved']);
  assert.deepEqual(
    graph.edges.filter((e) => ops.has((e as { op?: string }).op ?? '')),
    [
      {
        from: ref('dialogue', 'greet'),
        to: ref('dialogue', 'hub'),
        path: '.choices.ask.then',
        op: 'then',
      },
      {
        from: ref('dialogue', 'greet'),
        to: ref('reaction', 'asked'),
        path: '.on.choice',
        op: 'choice_resolved',
      },
    ],
  );
});

// Break: a room's area taken from its file name, not its folder or bundle; a root room given one;
// a hidden exit or a layout cell dropped or misplaced; exits named by ref, not key.
test("the map's rooms: file, area by folder or bundle, exits and layout cell", () => {
  const { map } = story(src, dev, []);
  const by = (key: string) => map.find((r) => r.key === key);
  assert.deepEqual(by('shed'), {
    ref: ref('room', 'shed'),
    key: 'shed',
    file: 'areas/yard.json',
    area: 'yard',
    title: 'Shed',
    exits: [{ dir: 'up', to: 'attic', hidden: true }],
    at: { x: 1, y: 0, z: 0 },
  });
  assert.deepEqual(
    [by('attic')?.file, by('attic')?.area, by('village_green')?.area, by('village_green')?.at],
    ['areas/town/rooms/attic.json', 'town', null, { x: 2, y: -1, z: 0 }],
  );
  assert.deepEqual(by('village_green')?.exits, [{ dir: 'south', to: 'ferry_landing' }]);
  // Break: a half-typed bundle on disk (the model rebuilds after a failed compile) throws the map away.
  const yard = readFileSync(join(src, 'areas/yard.json'), 'utf8');
  writeFileSync(join(src, 'areas/yard.json'), '{"rooms": {');
  try {
    const shed = story(src, dev, []).map.find((r) => r.key === 'shed');
    assert.deepEqual([shed?.file, shed?.area], [undefined, null]);
  } finally {
    writeFileSync(join(src, 'areas/yard.json'), yard);
  }
});

// Break: rows keyed by the wrong node (an area folder's, a `.scene` as other than its dialogue),
// or a row of a file with no node (text.json) given one.
test("the compile's diagnostics by node", () => {
  const [near, far, scene] = ['rooms/village_green.json', hub, 'scenes/greet.scene'].map((rel) => ({
    rel,
  }));
  const model = story(src, dev, [near!, far!, scene!, { rel: 'text.json' }]);
  assert.deepEqual(model.diagnostics, {
    [green]: [near],
    [ref('dialogue', 'hub')]: [far],
    [ref('dialogue', 'greet')]: [scene],
  });
});

// Break: a node given the wrong file (an area folder's path dropped, a dialogue's `.scene` over
// its `.json`, a lone `.scene` dropped) or a file with no node (text.json) given one; the card
// would edit the wrong file.
test('each node names its own source file, a .json over its .scene', () => {
  const scene = join(src, 'scenes/greet.scene');
  writeFileSync(scene, '');
  const { files, bundled } = story(src, dev, []);
  const json = join(src, 'dialogues/greet.json');
  const twin = readFileSync(json);
  rmSync(json);
  const lone = story(src, dev, []).files[ref('dialogue', 'greet')];
  writeFileSync(json, twin);
  rmSync(scene);
  assert.equal(files[green], 'rooms/village_green.json');
  assert.equal(files[ref('dialogue', 'hub')], hub);
  assert.equal(files[ref('dialogue', 'greet')], 'dialogues/greet.json');
  assert.equal(lone, 'scenes/greet.scene');
  assert.ok(!Object.values(files).includes('text.json'));
  // Break: a bundle's room has no area for the pickers (reachable), or a card file of its own.
  assert.deepEqual(bundled, { [ref('room', 'shed')]: 'areas/yard.json' });
  assert.ok(!Object.values(files).includes('areas/yard.json'));
  // Break: a bundle saved as `null` throws past the parse guard: a 500 for the whole story.
  writeFileSync(join(src, 'areas/void.json'), 'null');
  try {
    assert.deepEqual(story(src, dev, []).bundled, bundled);
  } finally {
    rmSync(join(src, 'areas/void.json'));
  }
});

// Break: a bad outline.json throws (a 500 for the whole map) instead of a refusal in the model
// that names the cause, or a cartridge with no outline.json reads as refused, or two beats of one n
// pass (duplicate row ids in the Story list).
test('a bad outline.json is a refusal in the model, the graph still built', () => {
  const bads: [string, RegExp][] = [
    ['{"parts": [', /JSON/],
    ['{"parts": [{"beats": [{"n": "one"}]}]}', /not the shape/],
    ['{"parts": [{"beats": [{"n": 1, "nodes": "rooms/attic"}]}]}', /not the shape/],
    [
      '{"parts": [{"beats": [{"n": 1}]}, {"beats": [{"n": 2}, {"n": 1}]}]}',
      /beat 1 is numbered twice/,
    ],
  ];
  for (const [bad, why] of bads) {
    writeFileSync(join(src, 'outline.json'), bad);
    const model = story(src, dev, []);
    assert.match(String((model.outline as { refused: string }).refused), why);
    assert.ok(model.graph.nodes.length > 0);
  }
  rmSync(join(src, 'outline.json'));
  assert.equal(story(src, dev, []).outline, null); // no outline is no beats, not a refusal
  put('outline.json', outline);
});

// Break: an artifact the kernel refuses yields some other crash, not the kernel's refusal.
test('an artifact the kernel refuses is an error naming the refusal', () => {
  assert.throws(
    () => story(src, { canonical: '{}', sha256: '0'.repeat(64) }, []),
    /refuses the artifact/,
  );
});

// Break: the model rebuilt on every request (no 304), kept across a publish (a hold's release
// pushes no diagnostics), or served to a foreign Host.
test('GET /story: an ETag, 304 until the next compile pushes, and refused to a foreign Host', async (t) => {
  writeFileSync(join(dir, 'dev.json'), JSON.stringify(dev));
  const server = serve(0, src, join(dir, 'dev.json'));
  const port = await server.port;
  t.after(() => server.close());
  const get = (headers: Record<string, string> = {}) =>
    fetch(`http://127.0.0.1:${port}/story`, { headers });
  const first = await get();
  const etag = first.headers.get('etag')!;
  assert.equal(((await first.json()) as { hash: string }).hash, sha256);
  put('outline.json', { parts: [] });
  try {
    assert.equal((await get({ 'if-none-match': etag })).status, 304); // no compile yet
    server.push({ text: {}, compiled: true }); // what a hold's release pushes
    const next = await get({ 'if-none-match': etag });
    assert.equal(next.status, 200);
    assert.deepEqual(((await next.json()) as { outline: unknown }).outline, {
      parts: [],
      beats: [],
      unpaid: [],
      unseeded: [],
    });
  } finally {
    put('outline.json', outline);
  }
  const rebound = await new Promise((done) =>
    httpGet({ port, path: '/story', headers: { host: 'evil.example' } }, (r) =>
      done(r.resume().statusCode),
    ),
  );
  assert.equal(rebound, 403); // a DNS-rebound page: E1's Host check
  assert.equal((await fetch(`http://127.0.0.1:${port}/story`, { method: 'POST' })).status, 405);
});

// Break: GET /story drops the watcher's diagnostics (S2's badges), or a Hold serves a mix (a
// file written mid-Hold, or a later push's diagnostics) instead of the model from its start (§7).
test('GET /story carries the diagnostics, and a Hold keeps the last whole model', async (t) => {
  writeFileSync(join(dir, 'dev.json'), JSON.stringify(dev));
  const server = serve(0, src, join(dir, 'dev.json'));
  const port = await server.port;
  t.after(() => server.close());
  type Model = { diagnostics: object; outline: { beats: unknown[] } };
  const body = async () => (await (await fetch(`http://127.0.0.1:${port}/story`)).json()) as Model;
  const row = { rel: 'rooms/village_green.json' };
  server.push({ diagnostics: [row] });
  server.push({ held: true }); // no GET yet: the model is the one at the Hold's start
  put('outline.json', { parts: [] });
  try {
    server.push({ diagnostics: [], compiled: true });
    const held = await body();
    assert.deepEqual(held.diagnostics, { [green]: [row] });
    assert.equal(held.outline.beats.length, 6);
    server.push({ held: false });
    const released = await body();
    assert.deepEqual(released.diagnostics, {});
    assert.deepEqual(released.outline.beats, []);
    server.push({ diagnostics: [row] }); // out of a Hold, a GET's model takes the latest ones
    assert.deepEqual((await body()).diagnostics, { [green]: [row] });
  } finally {
    put('outline.json', outline);
  }
});

// Break: the CLI's hash is not the artifact's (another build, or the source's hash), or a
// usage error or a failed compile exits 0, or a relative path is read from the kernel's dir.
test('bin/loka story prints the model with the compiled artifact hash', () => {
  // mise is stubbed as CI has none (as check.test.ts); mix comes from PATH.
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'mise'), '#!/bin/sh\nshift 2\nexec "$@"\n');
  chmodSync(join(bin, 'mise'), 0o755);
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}` };
  const out = execFileSync(join(root, 'bin/loka'), ['story', src], { encoding: 'utf8', env });
  assert.equal(JSON.parse(out).hash, sha256);
  const story = (...args: string[]) =>
    spawnSync(join(root, 'bin/loka'), ['story', ...args], { env }).status;
  assert.equal(story(), 2); // usage
  assert.equal(story(src, 'extra'), 2);
  assert.equal(story(join(dir, 'nowhere')), 1); // the compile failed
  const near = execFileSync(join(root, 'bin/loka'), ['story', basename(src)], {
    cwd: dirname(src),
    encoding: 'utf8',
    env,
  });
  assert.equal(JSON.parse(near).hash, sha256); // a path relative to the cwd, not the kernel's
});
