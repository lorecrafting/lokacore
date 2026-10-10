// Toolbox row G1 on the compiled tags sampler: the has_tag leaf reads the tags the compiler kept on
// barrier, item and room definitions, and the loader refuses a has_tag that names no definition.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld } from '../src/index.ts';
import { holds } from '../src/mechanics/policy.ts';
import type { Cartridge } from '../src/runtime/decision.ts';
import type { Policy } from '../src/contracts.gen.ts';
import { encode } from '../src/foundation/canonical.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-tags-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/tags_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const loaded = loadCartridge(artifact, INSTALLED);
assert.ok(loaded.ok, JSON.stringify(loaded));
const content = loaded.cartridge as Cartridge;
const world = newWorld(content, '2e5f9b6d-4a2c-4d3b-8f8e-7c6b5d4e3f21' as never, [4, 3, 2, 1]);
const ref = (kind: string, key: string) =>
  ({ cartridge_id: 'tags_sampler', cartridge_version: '0.0.1', kind, key }) as never;
const check = (p: object, target?: string) =>
  holds(world, world.character, p as Policy, { target: target as never, steps: { n: 0 } });
const item = (key: string) => world.entityIds[`tags_sampler@0.0.1:item/${key}`]!;

// Breaks: has_tag ignores its tag or subject, or reads tags from the wrong definition, so the
// burnable check passes on the iron door (or fails on the wooden one).
test('a burnable check passes only on the wooden door, stick and the wooden hall', () => {
  const rows: [object, string | undefined, boolean][] = [
    [{ barrier: ref('barrier', 'wooden_door'), tag: 'burnable' }, undefined, true],
    [{ barrier: ref('barrier', 'iron_door'), tag: 'burnable' }, undefined, false],
    [{ item: ref('item', 'stick'), tag: 'burnable' }, undefined, true],
    [{ item: ref('item', 'rod'), tag: 'burnable' }, undefined, false],
    [{ room: ref('room', 'hall'), tag: 'wooden' }, undefined, true],
    [{ room: ref('room', 'north_room'), tag: 'wooden' }, undefined, false],
    [{ subject: 'room', tag: 'wooden' }, undefined, true],
    [{ subject: 'room', tag: 'metal' }, undefined, false],
    [{ subject: 'target', tag: 'burnable' }, item('stick'), true],
    [{ subject: 'target', tag: 'burnable' }, item('rod'), false],
    [{ subject: 'target', tag: 'burnable' }, undefined, false],
  ];
  for (const [p, target, expected] of rows)
    assert.equal(check({ op: 'has_tag', ...p }, target), expected, JSON.stringify(p));
});

// Breaks: the loader skips has_tag's reference fields, so a policy naming no barrier loads.
test('the loader refuses a has_tag naming no definition of its kind', () => {
  const c = structuredClone(content) as unknown as {
    rooms: Record<string, { details: Record<string, { variants: { when: { root: Policy } }[] }> }>;
  };
  const at = 'tags_sampler@0.0.1:room/hall';
  c.rooms[at]!.details.iron_door!.variants[0]!.when.root = {
    op: 'has_tag',
    barrier: ref('barrier', 'oak_door'),
    tag: 'burnable',
  };
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  const r = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
  assert.deepEqual(r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path], [
    'UNRESOLVED_REFERENCE',
    `.cartridge.rooms["${at}"].details.iron_door.variants[0].when.root.barrier`,
  ]);
});
