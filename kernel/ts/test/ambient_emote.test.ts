// Ambient emotes (emote@1; docs/system/mechanics.md#ambient-emotes) on the compiled ambient sampler: the
// cave (entry) drips every 600, its lantern gutters every 900 at chance 50, its goblin glances every 300
// while afraid and scratches every 1200 otherwise; an empty passage lies south. Expected lines come from
// SHA-256 over the literal refs here, never from the module.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { newWorld, step, stepElapsed } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { cartridgeOf, cmd, ctx, reload } from './harness.ts';
import type { CommandId, Text } from '../src/contracts.gen.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-ambient-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync(
    'mix',
    ['loka.compile', 'cartridges/ambient_emote_sampler', file, '--allow-placeholders'],
    { cwd: fileURLToPath(new URL('../../../', import.meta.url)), stdio: 'pipe' },
  );
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const base = cartridgeOf(artifact);
const load = (edit?: (c: any) => void) => {
  const loaded = reload(base, edit);
  assert.ok(loaded.ok, JSON.stringify(loaded));
  return loaded.cartridge as Cartridge;
};
const content = load();

const CAVE = 'ambient_emote_sampler@0.0.1:room/cave';
const LANTERN = 'ambient_emote_sampler@0.0.1:item/lantern';
const GOBLIN = 'ambient_emote_sampler@0.0.1:npc/goblin';
const hash = (ref: string, set: number, n: number) =>
  createHash('sha256').update(`${ref}:${set}:${n}`).digest();
/** The in-test roll: does `ref`'s set fire at boundary n under `chance`. */
const fires = (ref: string, set: number, n: number, chance: number) =>
  hash(ref, set, n).readUInt32BE(4) % 100 < chance;
const drip = { key: 'room.cave.drip' } as Text;
const AMBIENT = new Set(['room.cave.drip', 'item.lantern.gutter', 'emote.performed']);

let n = 0;
const id = () => `aaaaaaaa-8888-4888-8888-${String(++n).padStart(12, '0')}` as CommandId;
const start = (c = content) =>
  newWorld(c, ctx('8e1d2c3b-4a59-4687-9a0b-1c2d3e4f5a6b'), [1, 2, 3, 4]);
/** One accepted command and its ambient lines (an emote line as its emote's key). */
function play(w: World, payload: object, cid = id()) {
  const r = step(
    w,
    cmd({ id: cid, world_context_id: w.context, payload: { actor_id: w.character, ...payload } }),
    n,
  );
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  const lines = r.decision.kind === 'accepted' ? (r.decision.narration ?? []) : [];
  return { w: r.world, lines: lines.filter((l) => AMBIENT.has(l.key)).map(word) };
}
const word = (l: Text): string =>
  l.key === 'emote.performed' ? (l.bindings?.emote as string) : l.key;
const wait = (w: World, by: number) => play(w, { type: 'wait', until: w.state.clock + by });

// Breaks: the line is drawn from the authority RNG or seeded by the command id (reload and replay
// from the same state under another id would tell another line), or the room's set never fires.
test('wait 600 in the cave: one drip, the same under replay with other command ids', () => {
  const w = start();
  assert.equal(w.state.clock, 0);
  const a = wait(w, 600);
  assert.deepEqual(a.lines, ['room.cave.drip']);
  const b = play(
    w,
    { type: 'wait', until: 600 },
    'aaaaaaaa-8888-4888-8888-ffffffffffff' as CommandId,
  );
  assert.deepEqual(b.lines, a.lines);
});

// Breaks: every crossed boundary tells a line (no one-per-entity cap), the active set falls through
// to a later set, or the chance roll reads the wrong bytes.
test('wait 60000: exactly one line per present entity, as the in-test rolls say', () => {
  const r = wait(start(), 60000);
  const want = [
    'room.cave.drip',
    ...(fires(LANTERN, 0, 66, 50) ? ['item.lantern.gutter'] : []),
    'scratch',
  ];
  assert.deepEqual([...r.lines].sort(), [...want].sort());
});

// Breaks: entities in another room tell ambient lines to the reader.
test('in the passage, wait 6000 tells no ambient line', () => {
  const south = play(start(), { type: 'move', direction: 'south' }).w;
  assert.deepEqual(wait(south, 6000).lines, []);
});

// Breaks: the set's when reads with no target or the reader as target (the goblin's fear would never
// select set 0), or the active set is cached past the status's expiry.
test('after begone the goblin glances; once afraid expires it scratches', () => {
  const afraid = play(start(), { type: 'shout', word: 'begone' }).w;
  const t = afraid.state.clock;
  const glance = wait(afraid, 300 - (t % 300));
  assert.deepEqual(
    glance.lines.filter((l) => l !== 'room.cave.drip'),
    ['glance'],
  );
  const later = wait(glance.w, 1200 - (glance.w.state.clock % 1200) + 1200);
  assert.ok(!later.lines.includes('glance'), JSON.stringify(later.lines));
  assert.ok(later.lines.includes('scratch'), JSON.stringify(later.lines));
});

// Breaks: chance is ignored, inverted or read off by one.
test('chance 100 fires on all of 20 boundaries; chance 1 only where the in-test roll is < 1', () => {
  let w = start();
  const drips: number[] = [];
  for (let i = 0; i < 20; i++) {
    const r = wait(w, 600);
    drips.push(r.lines.filter((l) => l === 'room.cave.drip').length);
    w = r.w;
  }
  assert.deepEqual(drips, Array(20).fill(1));
  const rare = load((c) => {
    c.rooms[CAVE].ambient[0].chance = 1;
  });
  w = start(rare);
  const got: boolean[] = [];
  const want: boolean[] = [];
  for (let k = 1; k <= 200; k++) {
    const r = wait(w, 600);
    got.push(r.lines.includes('room.cave.drip'));
    want.push(fires(CAVE, 0, k, 1));
    w = r.w;
  }
  assert.ok(want.includes(true) && want.includes(false), 'both outcomes occur');
  assert.deepEqual(got, want);
});

// Breaks: the line or emote is picked from other bytes than 0-3 or not modulo the count (a one-line
// set cannot tell); here the cave's set has two lines and the goblin's later set two emotes.
test('two-entry sets tell list[u32(bytes 0-3) % 2] at each boundary', () => {
  const pick = (ref: string, set: number, k: number, list: string[]) =>
    list[hash(ref, set, k).readUInt32BE(0) % list.length]!;
  const lines = ['room.cave.drip', 'item.lantern.gutter'];
  const two = load((c) => {
    c.rooms[CAVE].ambient[0].lines = lines;
    delete c.items[LANTERN].ambient;
    c.npcs[GOBLIN].ambient[1].emotes.unshift(c.npcs[GOBLIN].ambient[0].emotes[0]);
  });
  let w = start(two);
  const got: string[][] = [];
  const want: string[][] = [];
  for (let k = 1; k <= 12; k++) {
    const r = wait(w, 1200);
    got.push([...r.lines].sort());
    want.push([pick(CAVE, 0, 2 * k, lines), pick(GOBLIN, 1, k, ['glance', 'scratch'])].sort());
    w = r.w;
  }
  assert.ok(new Set(want.flat()).size === 4, 'every entry is picked somewhere');
  assert.deepEqual(got, want);
});

// Breaks: an elapsed advance (the reopened app) tells one line per crossed boundary.
test('an elapsed advance across 50 boundaries tells one drip', () => {
  // The sampler has no time_policy; an elapsed advance needs real_elapsed, set here alone.
  const w = start(load((c) => (c.manifest.time_policy = { profile: 'real_elapsed', rate: 50 })));
  const run_id = 'bbbbbbbb-8888-4888-8888-000000000001';
  const r = stepElapsed(
    w,
    {
      id: elapsedCommandId(run_id, w.context, 0, 30000) as never,
      world_context_id: w.context,
      payload: {
        type: 'elapsed',
        actor_id: w.character,
        run_id: run_id as never,
        from: 0,
        until: 30000,
      },
    },
    1,
  );
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  const lines = r.decision.kind === 'accepted' ? (r.decision.narration ?? []) : [];
  assert.deepEqual(
    lines.filter((l) => l.key === drip.key),
    [drip],
  );
});
