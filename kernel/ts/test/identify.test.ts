// Toolbox row 27 on the compiled identify sampler: a worn unidentified ring already moves PER, but
// the GameView worn note and the true name wait until the sage identifies it.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step } from '../src/index.ts';
import { encode } from '../src/foundation/canonical.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { gameView } from '../src/view/view.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-identify-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/identify_sampler', file], {
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

let n = 0;
function play(w: World, payload: object) {
  const r = step(
    w,
    {
      id: `eeeeeeee-2727-4727-8727-${String(++n).padStart(12, '0')}`,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...payload },
    } as never,
    n,
  );
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
const fresh = () =>
  newWorld(content, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e27' as never, [2, 7, 2, 7]);
const ring = (w: World) => w.entityIds['identify_sampler@0.0.1:item/ring']!;
const sage = (w: World) => w.entityIds['identify_sampler@0.0.1:npc/sage']!;
const per = (w: World) => {
  const { value, worn } = gameView(w).attributes!.find((a) => a.attribute.key === 'per')!;
  return worn === undefined ? { value } : { value, worn };
};
const worn = (w: World) => gameView(w).equipment!.find((s) => s.item?.id === ring(w))?.item;
const carried = (w: World) => gameView(w).inventory.find((e) => e.id === ring(w));
const texts = (e: { name: unknown; description?: unknown } | undefined) => [
  e?.name,
  e?.description,
];
const identify = (w: World) => {
  const talked = play(w, { type: 'talk', target_id: sage(w) });
  const { continuation_id } = gameView(talked).choice!;
  return play(talked, { type: 'choose', continuation_id, choice_id: 'ask' });
};

// Breaks: the view sums every worn affect (a worn note before identification), attributes@1 drops
// unidentified affects (PER 10 while worn), a missing fact row reads as identified, the variant
// names the wrong text, or a removed identified ring still counts.
test('a worn dull ring adds PER at once; the sage reveals its name and its worn note', () => {
  let w = fresh();
  w = play(w, { type: 'take', item_id: ring(w) });
  w = play(w, { type: 'wear', item_id: ring(w) });
  assert.deepEqual(per(w), { value: 12 });
  assert.deepEqual(texts(worn(w)), ['item.ring.short', 'item.ring.description']);

  w = identify(w);
  assert.deepEqual(per(w), { value: 12, worn: 2 });
  assert.deepEqual(texts(worn(w)), ['item.ring.short_known', 'item.ring.description_known']);

  w = play(w, { type: 'remove', item_id: ring(w) });
  assert.deepEqual(per(w), { value: 10 });
  assert.deepEqual(texts(carried(w)), ['item.ring.short_known', 'item.ring.description_known']);
});

// Breaks: the loader drops an identified check, so a dangling or non-bool fact, identified on an
// item without affects, an old API floor or a per_subject fact loads and misreads in play.
test('the loader refuses each unsound identified item', () => {
  const source = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  const item = 'identify_sampler@0.0.1:item/ring';
  const at = `.cartridge.items["${item}"].identified`;
  const fact = (c: any, spec: object) => {
    c.facts['identify_sampler@0.0.1:fact/other'] = {
      key: 'other',
      version: 1,
      scopes: ['player'],
      meaning: 'Another fact.',
      ...spec,
    };
    c.items[item].identified.key = 'other';
  };
  const rows: [(c: any) => void, string, string][] = [
    [(c) => (c.items[item].identified.key = 'nope'), 'UNRESOLVED_REFERENCE', at],
    [(c) => fact(c, { value_type: { type: 'int', default: 0 } }), 'FACT_TYPE_MISMATCH', at],
    [(c) => delete c.items[item].affects, 'SCHEMA_VIOLATION', at],
    [
      (c) => (c.manifest.requires.kernel_api.at_least = '1.67'),
      'KERNEL_API_RANGE_INVALID',
      '.cartridge.manifest.requires.kernel_api.at_least',
    ],
    [
      (c) => fact(c, { value_type: { type: 'bool', default: false }, per_subject: true }),
      'FACT_SCOPE_UNSUPPORTED',
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
