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
  const { nodes, edges } = conditionGraph(src, 'scene_sampler@0.0.1', refs);
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
  const { nodes, edges } = conditionGraph(src, 'scene_sampler@0.0.1', refs);
  assert.deepEqual(nodes.map((n) => n.ref).sort(), [`${S}condition/both`, `${S}condition/trusts`]);
  assert.deepEqual(edges.map((e) => [e.from, e.to]).sort(), [
    [`${S}condition/both`, `${S}condition/trusts`],
    [`${S}room/ferry_landing`, `${S}condition/both`],
  ]);
});

test('a cartridge with no conditions folder reports no condition node', () => {
  // Break: synthesising a node for every `named` leaf, so a cartridge that never had conditions
  // still grows a phantom node and the map shows a condition nothing can open.
  const src = join(dir, 'none');
  cpSync(join(root, 'cartridges/scene_sampler'), src, { recursive: true });
  assert.deepEqual(conditionGraph(src, 'scene_sampler@0.0.1', refs), { nodes: [], edges: [] });
});
