// K1b (docs/design/story-tooling.md §2b K1 row 2): a condition is a Story-map node, and its reader
// edges are drawn from the source because the compile substitutes `named` away — the artifact never
// carries a condition. Counts here are hand-counted from the planted source, not read back.
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, test } from 'node:test';
import { conditionGraph } from '../play/conditions.ts';

const root = resolve(import.meta.dirname, '../../..');
const dir = mkdtempSync(join(tmpdir(), 'loka-conditions-'));
after(() => rmSync(dir, { recursive: true, force: true }));

/** A sampler copy with `conditions/` and a room per name whose `details` read them. */
const planted = (
  name: string,
  conditions: Record<string, unknown>,
  rooms: Record<string, unknown>,
) => {
  const src = join(dir, name);
  cpSync(join(root, 'cartridges/scene_sampler'), src, { recursive: true });
  mkdirSync(join(src, 'conditions'));
  for (const [key, value] of Object.entries(conditions))
    writeFileSync(join(src, 'conditions', `${key}.json`), JSON.stringify(value));
  for (const [key, value] of Object.entries(rooms))
    writeFileSync(join(src, 'rooms', `${key}.json`), JSON.stringify({ key, ...(value as object) }));
  return src;
};

const S = 'scene_sampler@0.0.1:';
const trusts = { fact: { key: 'trusts_boatman' } };
const refs = new Map([
  ['rooms/ferry_landing', `${S}room/ferry_landing`],
  ['rooms/village_green', `${S}room/village_green`],
]);

test('a condition read by two definitions is one node with two reader edges', () => {
  // Break: one node per use site (so the map shows the condition twice), or no edge at all (so the
  // map cannot answer "who reads this").
  const src = planted(
    'two',
    { trusts },
    {
      ferry_landing: { details: { gate: { if: { op: 'named', key: 'trusts' } } } },
      village_green: { details: { gate: { if: { op: 'named', key: 'trusts' } } } },
    },
  );
  const { nodes, edges } = conditionGraph(src, 'scene_sampler@0.0.1', refs, {});
  assert.deepEqual(nodes, [{ ref: `${S}condition/trusts`, kind: 'condition' }]);
  assert.deepEqual(edges.map((e) => [e.from, e.to]).sort(), [
    [`${S}room/ferry_landing`, `${S}condition/trusts`],
    [`${S}room/village_green`, `${S}condition/trusts`],
  ]);
});

test('a condition naming another is itself a reader, so the chain shows', () => {
  // Break: walking only the definition folders (not `conditions/`), so `both` reads `trusts` and the
  // map shows `trusts` with one reader instead of two.
  const src = planted(
    'chain',
    { trusts, both: { all: [{ op: 'named', key: 'trusts' }, { fact: { key: 'has_lantern' } }] } },
    { ferry_landing: { details: { gate: { if: { op: 'named', key: 'both' } } } } },
  );
  const { nodes, edges } = conditionGraph(src, 'scene_sampler@0.0.1', refs, {});
  assert.deepEqual(nodes.map((n) => n.ref).sort(), [`${S}condition/both`, `${S}condition/trusts`]);
  assert.deepEqual(edges.map((e) => [e.from, e.to]).sort(), [
    [`${S}condition/both`, `${S}condition/trusts`],
    [`${S}room/ferry_landing`, `${S}condition/both`],
  ]);
});

test('a cartridge with no conditions folder reports no condition node', () => {
  // Break: a node per condition file, so a cartridge that never had conditions still grows one per
  // `named` leaf and the map shows a condition nothing can open. (scene_sampler has no `named` leaf,
  // so the mutant is emitting a node for every file in `conditions/` — absent here.)
  const src = join(dir, 'none');
  cpSync(join(root, 'cartridges/scene_sampler'), src, { recursive: true });
  assert.deepEqual(conditionGraph(src, 'scene_sampler@0.0.1', refs, {}), { nodes: [], edges: [] });
});

test('a condition inside an area bundle is a node, and the area reads it', () => {
  // Break: accepting only `conditions/<key>.json`, so a condition the compiler accepts inside an area
  // gets no node while the edge to it is still drawn — a dangling edge to a condition nothing opens.
  const src = planted('area', {}, {});
  const area = join(src, 'areas', 'harbour', 'conditions');
  mkdirSync(area, { recursive: true });
  mkdirSync(join(src, 'areas', 'harbour', 'rooms'), { recursive: true });
  writeFileSync(join(area, 'tide.json'), JSON.stringify({ fact: { key: 'has_lantern' } }));
  writeFileSync(
    join(src, 'areas', 'harbour', 'rooms', 'quay.json'),
    JSON.stringify({ key: 'quay', details: { wharf: { if: { op: 'named', key: 'tide' } } } }),
  );
  const { nodes } = conditionGraph(src, 'scene_sampler@0.0.1', refs, {});
  assert.deepEqual(nodes, [{ ref: `${S}condition/tide`, kind: 'condition' }]);
});

test('a condition key at the root and in an area folder is one node, not two', () => {
  // Break: pushing a node per matching file, so the same key found twice gives the map two nodes at
  // one ref and the reader edge lands on only one of them.
  const src = planted('dup', { tide: { fact: { key: 'has_lantern' } } }, {});
  const area = join(src, 'areas', 'harbour', 'conditions');
  mkdirSync(area, { recursive: true });
  writeFileSync(join(area, 'tide.json'), JSON.stringify({ fact: { key: 'has_lantern' } }));
  const { nodes } = conditionGraph(src, 'scene_sampler@0.0.1', refs, {});
  assert.deepEqual(nodes, [{ ref: `${S}condition/tide`, kind: 'condition' }]);
});

test('a bundle member naming a condition is a reader, through the bundled refs', () => {
  // Break: resolving a site's owner with `placed()` alone, which has no owner for an area bundle's
  // `areas/<a>.json`, so the member's `named` leaves produce no reader edge and the condition reads
  // as unreferenced.
  const src = planted('bundle', { trusts }, {});
  const area = join(src, 'areas', 'harbour');
  mkdirSync(area, { recursive: true });
  writeFileSync(
    join(area, 'harbour.json'),
    JSON.stringify({
      key: 'harbour',
      rooms: {
        quay: {
          name: { prose: 'Quay' },
          description: { prose: 'The wharf.' },
          exits: {},
          details: { wharf: { if: { op: 'named', key: 'trusts' } } },
        },
      },
    }),
  );
  // shortRefs keys every node, a bundle member included, as `<dir>/<key>`
  const withBundle = new Map(refs).set('rooms/quay', `${S}room/quay`);
  const { edges } = conditionGraph(src, 'scene_sampler@0.0.1', withBundle, {
    'rooms/quay': 'areas/harbour/harbour.json',
  });
  assert.deepEqual(
    edges.map((e) => [e.from, e.to]),
    [[`${S}room/quay`, `${S}condition/trusts`]],
  );
});
