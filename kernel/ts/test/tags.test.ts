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
import { LEAF_REFS } from '../src/content/cartridge_leaf_refs.ts';
import type { Obj } from '../src/content/cartridge_refs.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), 'loka-tags-sampler-'));
let artifact: Uint8Array;
let leafRefsEx: unknown;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/tags_sampler', file], {
    cwd: root,
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
  const refs = join(scratch, 'leaf_refs.json');
  const write = `File.write!(${JSON.stringify(refs)}, JSON.encode!(Loka.Content.LeafRefs.all()))`;
  execFileSync('mix', ['run', '--no-start', '-e', write], { cwd: root, stdio: 'pipe' });
  leafRefsEx = JSON.parse(readFileSync(refs, 'utf8'));
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
  // Breaks: subject room reads a fixed room (the entry hall), not the actor's current room.
  const north = world.roomIds['tags_sampler@0.0.1:room/north_room']!;
  const away = {
    ...world,
    state: { ...world.state, containers: { ...world.state.containers, [world.body]: north } },
  };
  const wooden = { op: 'has_tag', subject: 'room', tag: 'wooden' } as Policy;
  assert.equal(holds(away, world.character, wooden, { steps: { n: 0 } }), false);
});

// Breaks: the loader skips one of has_tag's reference fields, so a policy naming no definition
// loads, or loads tags without tags@1.
test('the loader refuses a has_tag naming no definition and tags without tags@1', () => {
  const hall = 'tags_sampler@0.0.1:room/hall';
  const variant = `.cartridge.rooms["${hall}"].details.iron_door.variants[0].when.root`;
  const leaf = (subject: object) => (c: Obj) => {
    c.rooms[hall].details.iron_door.variants[0].when.root = {
      op: 'has_tag',
      tag: 'metal',
      ...subject,
    };
  };
  const rows: [(c: Obj) => void, string, string][] = [
    [leaf({ barrier: ref('barrier', 'oak_door') }), 'UNRESOLVED_REFERENCE', `${variant}.barrier`],
    [leaf({ item: ref('item', 'plank') }), 'UNRESOLVED_REFERENCE', `${variant}.item`],
    [leaf({ room: ref('room', 'attic') }), 'UNRESOLVED_REFERENCE', `${variant}.room`],
    [
      (c) => {
        // Only the stick's tags remain, so the one owner diagnostic is at its tags.
        delete c.manifest.requires.capabilities.tags;
        delete c.lock.capabilities.tags;
        for (const b of Object.values(c.barriers as Obj)) delete b.tags;
        delete c.items['tags_sampler@0.0.1:item/rod'].tags;
        delete c.rooms[hall].tags;
        delete c.rooms[hall].variants;
        for (const d of Object.values(c.rooms[hall].details as Obj)) delete d.variants;
      },
      'UNDECLARED_CAPABILITY',
      '.cartridge.items["tags_sampler@0.0.1:item/stick"].tags',
    ],
  ];
  for (const [change, code, path] of rows) {
    const c = structuredClone(content) as unknown as Obj;
    change(c);
    const canonical = encode(c);
    const sha256 = createHash('sha256').update(canonical).digest('hex');
    const r = loadCartridge(
      new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
      INSTALLED,
    );
    assert.deepEqual(r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path], [code, path]);
  }
});

// Breaks: a leaf's reference field is missing from (or extra in) one kernel's table, so that
// kernel skips expanding or resolving it. The schema gives only the fields (each DefinitionRef
// property); the kind a field maps to is checked TS against Elixir, since it may differ from the
// field name (mechanics.md leaf naming).
test('LEAF_REFS, Loka.Content.LeafRefs and policy.schema.json name the same reference fields', () => {
  const schema = JSON.parse(readFileSync(join(root, 'protocol/policy.schema.json'), 'utf8'));
  const fromSchema: Record<string, string[]> = {};
  for (const branch of schema.$defs.Policy.oneOf) {
    const fields = Object.entries(branch.properties as Record<string, { $ref?: string }>)
      .filter(([, v]) => v.$ref?.endsWith('#/$defs/DefinitionRef'))
      .map(([k]) => k);
    if (fields.length) fromSchema[branch.properties.op.const] = fields.sort();
  }
  const fieldsOf = (t: object) =>
    Object.fromEntries(Object.entries(t).map(([op, m]) => [op, Object.keys(m).sort()]));
  assert.deepEqual(leafRefsEx, LEAF_REFS);
  assert.deepEqual(fieldsOf(LEAF_REFS), fromSchema);
});
