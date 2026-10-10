// Toolbox row 31 on the compiled sky sampler: 100 units an hour, 10 hours a day (day n is clock
// (n-1)*1000 to n*1000-1), weather clear 1 / rain 1 (wet), season spring 0 / autumn 2000 of 4000,
// tide low 0 / high 250 of 500; the yard is `exposed` with a rain variant, the shed east is not.
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
import { holds } from '../src/mechanics/policy.ts';
import { encode } from '../src/foundation/canonical.ts';
import type { Obj } from '../src/content/cartridge_refs.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-sky-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/sky_sampler', file], {
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

// Oracle, independent of the kernel: for d in 1..6, the first 4 bytes of
// `printf 'weather:<CONTEXT>:<d>' | shasum -a 256`, mod 2 (0 clear, 1 rain): days 1 to 5 rain, day 6 clear.
const CONTEXT = '5b7d9f1a-3c5e-4a7b-9d1f-4a6c8e0b2d4f';
let n = 0;
const id = () => `aaaaaaaa-3131-4031-8031-${String(++n).padStart(12, '0')}` as never;
function act(w: World, p: object) {
  const r = step(
    w,
    { id: id(), world_context_id: w.context, payload: { actor_id: w.character, ...p } } as never,
    n,
  );
  const d = r.decision as { kind: string; outcome?: string; error?: { code: string } };
  return { w: r.world, out: d.kind === 'accepted' ? d.outcome : (d.error?.code ?? d.kind) };
}
const torch = (w: World) => w.entityIds['sky_sampler@0.0.1:item/torch'];
const offered = (w: World) =>
  gameView(w)
    .inventory.find((e) => e.id === torch(w))!
    .actions.some((a) => a.action_key === 'ignite');

// Breaks: weather hashed from the clock, not the day (0 and 999 or 5000 and 5999 differ), or from
// the authority RNG; the rain variant or status ignoring weather; the exposed check missing (the
// torch lights in the rain), applied to every room (the shed refuses) or ignoring the wet flag
// (the yard still refuses on clear day 6); GameView offering an Ignite the rule refuses.
test('rain on a seeded day changes the yard and the status, and stops a torch in the open', () => {
  const seen: unknown[] = [];
  const look = (w: World) => {
    const v = gameView(w);
    seen.push([v.calendar_status?.weather, v.place.description.key, offered(w)]);
  };
  let w = newWorld(content, CONTEXT as never, [1, 2, 3, 4]);
  const outs: unknown[] = [];
  const run = (p: object) => {
    const r = act(w, p);
    w = r.w;
    outs.push(r.out);
  };
  run({ type: 'take', item_id: torch(w) });
  look(w);
  run({ type: 'ignite', item_id: torch(w) });
  run({ type: 'wait', until: 999 });
  look(w);
  run({ type: 'move', direction: 'east' });
  run({ type: 'ignite', item_id: torch(w) });
  run({ type: 'douse', item_id: torch(w) });
  run({ type: 'move', direction: 'west' });
  run({ type: 'wait', until: 5000 });
  look(w);
  run({ type: 'wait', until: 5999 });
  look(w);
  run({ type: 'ignite', item_id: torch(w) });
  assert.deepEqual(outs, [
    'taken',
    'invalid_state',
    'waited',
    'moved',
    'ignited',
    'doused',
    'moved',
    'waited',
    'waited',
    'ignited',
  ]);
  assert.deepEqual(seen, [
    ['rain', 'room.yard.rain', false],
    ['rain', 'room.yard.rain', false],
    ['clear', 'room.yard.description', true],
    ['clear', 'room.yard.description', true],
  ]);
  // Same world id and day, another authority seed: the same weather (no RNG draw).
  assert.equal(
    gameView(newWorld(content, CONTEXT as never, [9, 9, 9, 9])).calendar_status?.weather,
    'rain',
  );
});

// Breaks: a sky field read from the wrong table, a cycle ignoring its period or cut boundary, or
// the leaf matching any field (season spring at 2000).
test('season and tide follow their cycles in the status and the sky leaf', () => {
  const at = (clock: number) => {
    const w = newWorld(content, CONTEXT as never, [1, 2, 3, 4]);
    return { ...w, state: { ...w.state, clock } } as World;
  };
  const rows: [number, string, string][] = [
    [0, 'spring', 'low'],
    [249, 'spring', 'low'],
    [250, 'spring', 'high'],
    [1999, 'spring', 'high'],
    [2000, 'autumn', 'low'],
    [4250, 'spring', 'high'],
  ];
  for (const [clock, season, tide] of rows) {
    const w = at(clock);
    const s = gameView(w).calendar_status!;
    assert.deepEqual([clock, s.season, s.tide], [clock, season, tide]);
    const leaf = (f: string, v: string) => holds(w, w.character, { op: 'sky', [f]: v } as never);
    assert.deepEqual(
      [clock, leaf('season', season), leaf('tide', tide), leaf('season', 'winter')],
      [clock, true, true, false],
    );
  }
});

// Breaks: the loader accepts a sky phase its table does not author, a repeated weather phase, a
// season cycle not starting at 0, or the row 31 tables below kernel_api 1.45 (no sky leaf).
test('the loader refuses unauthored sky phases, repeated weather and an API below 1.45', () => {
  const yard = '.cartridge.rooms["sky_sampler@0.0.1:room/yard"]';
  const root = (c: Obj) => c.rooms['sky_sampler@0.0.1:room/yard'].variants[0].when.root;
  const rows: [(c: Obj) => void, string, string][] = [
    [
      (c) => (root(c).weather = 'snow'),
      'SCHEMA_VIOLATION',
      `${yard}.variants[0].when.root.weather`,
    ],
    [
      (c) => (c.calendar.weather[1].phase = 'clear'),
      'SCHEMA_VIOLATION',
      '.cartridge.calendar.weather[1]',
    ],
    [
      (c) => (c.calendar.season.phases[0].at = 1),
      'SCHEMA_VIOLATION',
      '.cartridge.calendar.season.phases',
    ],
    [
      (c) => (
        (c.manifest.requires.kernel_api.at_least = '1.44'),
        delete c.rooms['sky_sampler@0.0.1:room/yard'].variants
      ),
      'KERNEL_API_RANGE_INVALID',
      '.cartridge.manifest.requires.kernel_api.at_least',
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
