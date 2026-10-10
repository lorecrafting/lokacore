// Toolbox row W7 on the compiled variety sampler: walking the hall narrates narration.walk, which
// has two alternates; the garden north has a one-line variant from the tenth visit
// (visited_count at_least 10).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { gameView, INSTALLED, loadCartridge, newWorld, step } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { encode } from '../src/foundation/canonical.ts';
import type { Obj } from '../src/content/cartridge_refs.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-variety-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/variety_sampler', file], {
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

const ids = Array.from(
  { length: 12 },
  (_, i) => `aaaaaaaa-0707-4007-8007-${String(i + 1).padStart(12, '0')}`,
);
const fresh = (c: Cartridge) =>
  newWorld(c, '6c8e0a2b-4d6f-4b8c-8e0a-5b7d9f1a3c5e' as never, [1, 2, 3, 4]);
function run(w: World, id: string, payload: object) {
  const r = step(
    w,
    { id, world_context_id: w.context, payload: { actor_id: w.character, ...payload } } as never,
    0,
  );
  const d = r.decision as { kind: string; narration?: { key: string }[] };
  assert.equal(d.kind, 'accepted', JSON.stringify(d));
  return { world: r.world, keys: (d.narration ?? []).map((l) => l.key) };
}
// Walks the hall once per id from a fresh world; the narration keys and the final world.
function walks(c: Cartridge) {
  let w = fresh(c);
  const keys: string[] = [];
  for (const id of ids) {
    const r = run(w, id, { type: 'perform', action: 'walk' });
    w = r.world;
    keys.push(...r.keys);
  }
  return { keys, world: w };
}

// Breaks: the line picked by the authority RNG (it advances, or replays differ from the oracle),
// by a counter or the clock (not the command id), always the base key, the hash over the key
// alone, or an off-by-one leaving one alternate unreachable.
test('three equal walk lines rotate by command id and replay the same', () => {
  const lines = ['narration.walk', 'narration.walk_b', 'narration.walk_c'];
  // Independent oracle (mechanics.md narration variety): SHA-256 of "<command id>:<key>", its first
  // four bytes big-endian, modulo the three lines.
  const expected = ids.map(
    (id) => lines[createHash('sha256').update(`${id}:narration.walk`).digest().readUInt32BE(0) % 3],
  );
  const once = walks(content);
  assert.deepEqual(once.keys, expected);
  assert.deepEqual(new Set(once.keys), new Set(lines), 'all three lines show over twelve walks');
  assert.deepEqual(walks(content).keys, once.keys, 'the same command ids replay the same lines');
  const plain = walks({ ...content, alternates: undefined } as Cartridge);
  assert.deepEqual(plain.keys, Array(ids.length).fill('narration.walk'));
  assert.equal(encode(once.world.state as never), encode(plain.world.state as never));
});

// Breaks: the count not written after the first entry, written on a refused or non-entry
// command, compared strictly, or read from another room; the leaf true before any entry.
test('the garden shows its long description until the tenth visit, then one line', () => {
  let w = fresh(content);
  const garden: string[] = [];
  for (let i = 1; i <= 10; i++) {
    w = run(w, `aaaaaaaa-0707-4007-8107-${String(2 * i).padStart(12, '0')}`, {
      type: 'move',
      direction: 'north',
    }).world;
    garden.push(gameView(w).place.description.key);
    w = run(w, `aaaaaaaa-0707-4007-8107-${String(2 * i + 1).padStart(12, '0')}`, {
      type: 'move',
      direction: 'south',
    }).world;
  }
  assert.deepEqual(garden, [...Array(9).fill('room.garden.description'), 'room.garden.familiar']);
});

// Breaks (loader twin of the compiler checks): an alternate missing from the catalog accepted,
// alternates without variety@1 accepted, alternates or visited_count below kernel_api 1.45, or an
// empty alternates list, a key or an alternate not shaped as a TextKey accepted.
test('the loader refuses unknown alternates, an unlocked owner and an old kernel_api', () => {
  const doc = JSON.parse(new TextDecoder().decode(artifact)) as Obj;
  const load = (change: (c: Obj) => void) => {
    const c = structuredClone(doc.cartridge);
    change(c);
    const canonical = encode(c);
    const sha256 = createHash('sha256').update(canonical).digest('hex');
    const bytes = new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`);
    const r = loadCartridge(bytes, INSTALLED);
    return r.ok ? 'ok' : `${r.diagnostic.code} ${r.diagnostic.path}`;
  };
  const old = (c: Obj) => (c.manifest.requires.kernel_api.at_least = '1.44');
  const floor = 'KERNEL_API_RANGE_INVALID .cartridge.manifest.requires.kernel_api.at_least';
  const garden = 'variety_sampler@0.0.1:room/garden';
  assert.equal(
    load((c) => (c.alternates['narration.walk'][1] = 'narration.walk_d')),
    'UNRESOLVED_REFERENCE .cartridge.alternates["narration.walk"][1]',
  );
  assert.equal(
    load((c) => {
      delete c.lock.capabilities.variety;
      delete c.manifest.requires.capabilities.variety;
      delete c.rooms[garden].variants;
    }),
    'UNDECLARED_CAPABILITY .cartridge.alternates',
  );
  assert.equal(load(old), floor);
  assert.match(
    load((c) => (c.alternates['narration.walk'] = [])),
    /^SCHEMA_VIOLATION /,
  );
  assert.match(
    load((c) => (c.alternates.Walk = ['narration.walk_b'])),
    /^SCHEMA_VIOLATION /,
  );
  assert.match(
    load((c) => (c.alternates['narration.walk'] = ['Walk'])),
    /^SCHEMA_VIOLATION /,
  );
  assert.equal(
    load((c) => {
      old(c);
      delete c.alternates;
    }),
    floor,
  );
  assert.equal(
    load((c) => {
      old(c);
      delete c.rooms[garden].variants;
    }),
    floor,
  );
});
