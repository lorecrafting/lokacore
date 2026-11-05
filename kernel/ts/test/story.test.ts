// The Story map's model (docs/rnd/story-map-design-2026-11-05.md section 11 S1) over a planted copy
// of scene_sampler: two dialogues joined by `then` (one in an area folder), a choice_resolved
// reaction, a room no exit reaches and an outline.json.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { get as httpGet } from 'node:http';
import { join, resolve } from 'node:path';
import { after, test } from 'node:test';
import { serve } from '../play/live.ts';
import { story } from '../play/story.ts';

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
        { n: 3, nodes: ['rooms/village_green'], pays: ['lantern', 'oath'] },
        { n: 4, nodes: ['rooms/attic'] },
      ],
    },
  ],
};
put('outline.json', outline);
const artifact = join(dir, 'artifact.json');
execFileSync('mise', ['exec', '--', 'mix', 'loka.compile', src, artifact, '--allow-placeholders'], {
  cwd: root,
  stdio: 'ignore',
});
const [, canonical, sha256] = /^\{"cartridge":(.*),"content_hash":"([0-9a-f]{64})"\}$/s.exec(
  readFileSync(artifact, 'utf8'),
)!;
const dev = { canonical: canonical!, sha256: sha256! };
const ref = (kind: string, key: string) => `scene_sampler@0.0.1:${kind}/${key}`;
const green = ref('room', 'village_green');

// Break: the seeds-and-payoffs check counts a beat's own seed as paid, or ignores the
// order across parts.
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
// mark its node, or marks it once the words are in.
test('a beat is missing with the refs not in the artifact, `~` while its node has one', () => {
  const beats = () => (story(src, dev, []) as Beats).outline.beats;
  assert.deepEqual(
    beats().map(({ n, status, missing }) => [n, status, missing]),
    [
      [1, 'built', undefined],
      [2, 'missing', ['items/nowhere', 'dialogues/greet/nope', 'rooms/village_green/door']],
      [3, 'built', undefined],
      [4, 'unreached', undefined],
    ],
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

// Break: a bad outline.json throws (a 500 for the whole map) instead of a refusal in the model.
test('a bad outline.json is a refusal in the model, the graph still built', () => {
  for (const bad of ['{"parts": [', '{"parts": [{"beats": [{"n": "one"}]}]}']) {
    writeFileSync(join(src, 'outline.json'), bad);
    const model = story(src, dev, []);
    assert.match(String((model.outline as { refused: string }).refused), /^outline\.json: /);
    assert.ok(model.graph.nodes.length > 0);
  }
  put('outline.json', outline);
});

// Break: the model rebuilt on every request (no 304), kept across a publish (a hold's release
// pushes no diagnostics), or served to a foreign Host.
test('GET /story: an ETag, 304 until the next compile pushes, and refused to a foreign Host', async (t) => {
  writeFileSync(join(dir, 'dev.json'), JSON.stringify(dev));
  const port = 20000 + Math.floor(Math.random() * 20000);
  const server = serve(port, src, join(dir, 'dev.json'));
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
});

// Break: the CLI's hash is not the artifact's (another build, or the source's hash).
test('bin/loka story prints the model with the compiled artifact hash', () => {
  const out = execFileSync(join(root, 'bin/loka'), ['story', src], { encoding: 'utf8' });
  assert.equal(JSON.parse(out).hash, sha256);
});
