// Toolbox row 3 on the compiled affects sampler: finger slots hold two rings, and a worn item's
// affects move the wearer's attributes and what reads them (stat_compare, derived carry and hp).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { encode } from '../src/foundation/canonical.ts';
import { validate } from '../src/foundation/validate.ts';
import { gameView } from '../src/view/view.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-affects-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/affects_sampler', file], {
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
const id = (w: World, k: string) => w.entityIds[`affects_sampler@0.0.1:item/${k}`];
let n = 0;
function act(w: World, p: object) {
  n += 1;
  return step(
    w,
    {
      id: `eeeeeeee-6666-4333-8444-${String(n).padStart(12, '0')}` as never,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...p } as never,
    },
    n,
  );
}
function play(w: World, p: object): World {
  const r = act(w, p);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
const fresh = () =>
  newWorld(content, '2e5f9b6d-4a2c-4d3b-8f8e-7c6b5d4e3f20' as never, [4, 3, 2, 1]);
const taken = (w: World, ...keys: string[]) =>
  keys.reduce((x, k) => play(x, { type: 'take', item_id: id(x, k) }), w);
const stat = (w: World, k: string) => {
  const a = gameView(w).attributes!.find((x) => x.attribute.key === k)!;
  return [a.value, a.worn ?? 0];
};
const room = (w: World) => gameView(w).place!.description.key;
const fingers = (w: World) =>
  gameView(w)
    .equipment!.filter((e) => e.slot === 'finger')
    .map((e) => e.item?.id ?? 'empty')
    .sort();

// Breaks: finger capacity 1 (the second ring is refused), occupancy that ignores capacity (the
// third is worn), affects not read (PER stays 10), stat_compare reading the base value (the hall
// keeps its plain text at 14), a removed ring still counting, or the GameView listing one finger
// (the second ring has no Remove).
test('a +2 PER ring counts on either finger, two stack, a third is refused and removal restores', () => {
  let w = taken(fresh(), 'ring_left', 'ring_right', 'ring_spare');
  assert.deepEqual(stat(w, 'per'), [10, 0]);
  assert.deepEqual(fingers(w), ['empty', 'empty']);
  w = play(w, { type: 'wear', item_id: id(w, 'ring_left') });
  assert.deepEqual(stat(w, 'per'), [12, 2]);
  assert.equal(room(w), 'room.hall.description');
  w = play(w, { type: 'wear', item_id: id(w, 'ring_right') });
  assert.deepEqual(stat(w, 'per'), [14, 4]);
  assert.equal(room(w), 'room.hall.sharp');
  assert.deepEqual(fingers(w), [id(w, 'ring_left'), id(w, 'ring_right')].sort());
  assert.deepEqual(act(w, { type: 'wear', item_id: id(w, 'ring_spare') }).decision, {
    kind: 'rejected',
    error: { code: 'invalid_state' },
  });
  w = play(w, { type: 'remove', item_id: id(w, 'ring_left') });
  assert.deepEqual(stat(w, 'per'), [12, 2]);
  assert.equal(room(w), 'room.hall.description');
  w = play(w, { type: 'wear', item_id: id(w, 'ring_spare') });
  assert.deepEqual(stat(w, 'per'), [14, 4]);
});

// Breaks: derived tables read the base attribute (STR 10 cannot lift the 2500 g stone; the hp
// maximum stays 10), or removing the belt leaves its bonus in place.
test('a belt of +2 STR and +4 CON lifts the stone and raises the hp maximum until removed', () => {
  let w = taken(fresh(), 'belt');
  assert.deepEqual(act(w, { type: 'take', item_id: id(w, 'stone') }).decision, {
    kind: 'rejected',
    error: { code: 'too_heavy' },
  });
  w = play(w, { type: 'wear', item_id: id(w, 'belt') });
  const hp = () => gameView(w).resources!.find((r) => r.resource.key === 'hp')!;
  assert.deepEqual([hp().current, hp().maximum], [10, 14]);
  w = play(w, { type: 'take', item_id: id(w, 'stone') });
  w = play(w, { type: 'remove', item_id: id(w, 'belt') });
  assert.deepEqual([hp().current, hp().maximum], [10, 10]);
  assert.deepEqual(stat(w, 'str'), [10, 0]);
});

// Breaks: the loader drops an affects check, so an affect on an unworn item, a dangling
// attribute, a missing attributes@1 or an old API floor (also for finger rings without affects)
// loads and misbehaves in play.
test('the loader refuses each unsound item affect', () => {
  const source = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  const belt = 'affects_sampler@0.0.1:item/belt';
  const at = `.cartridge.items["${belt}"].affects`;
  const rows: [(c: any) => void, string, string][] = [
    [
      (c) => (c.manifest.requires.kernel_api.at_least = '1.40'),
      'KERNEL_API_RANGE_INVALID',
      '.cartridge.manifest.requires.kernel_api.at_least',
    ],
    [(c) => delete c.items[belt].slot, 'SCHEMA_VIOLATION', at],
    [
      (c) => {
        c.manifest.requires.kernel_api.at_least = '1.40';
        for (const i of Object.values(c.items) as any[]) delete i.affects;
      },
      'KERNEL_API_RANGE_INVALID',
      '.cartridge.manifest.requires.kernel_api.at_least',
    ],
    [
      (c) => (c.items[belt].affects[1].attribute.key = 'luck'),
      'UNRESOLVED_REFERENCE',
      `${at}[1].attribute`,
    ],
    [
      (c) => {
        delete c.manifest.requires.capabilities.attributes;
        delete c.lock.capabilities.attributes;
        delete c.attributes;
        delete c.world.derived;
        delete c.rooms['affects_sampler@0.0.1:room/hall'].variants;
      },
      'UNDECLARED_CAPABILITY',
      at,
    ],
  ];
  for (const [change, code, path] of rows) {
    const c = structuredClone(source);
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

// Breaks: an affect without its attribute or amount, with an extra field, or an empty or
// oversized affects list validates; finger leaves the slot keys.
test('an item affect requires its attribute and amount', () => {
  const affect = {
    attribute: { cartridge_id: 'c', cartridge_version: '1.0.0', kind: 'attribute', key: 'per' },
    modifier: 2,
  };
  assert.deepEqual(validate('ItemAffect', affect), []);
  assert.deepEqual(validate('SlotKey', 'finger'), []);
  const rows: [string, unknown, string, string][] = [
    ['ItemAffect', { modifier: 2 }, '/attribute', 'missing_property'],
    ['ItemAffect', { attribute: affect.attribute }, '/modifier', 'missing_property'],
    ['ItemAffect', { ...affect, extra: 1 }, '/extra', 'unknown_property'],
  ];
  for (const [contract, value, path, code] of rows)
    assert.deepEqual(validate(contract, value), [{ path, code }], path);
  const item = content.items!['affects_sampler@0.0.1:item/belt'];
  for (const [affects, code] of [
    [[], 'too_few_items'],
    [Array(17).fill(affect), 'too_many_items'],
  ] as const)
    assert.deepEqual(validate('ItemDefinition', { ...item, affects }), [
      { path: '/affects', code },
    ]);
});
