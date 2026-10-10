// Toolbox rows 18 and 42 on the compiled buffs sampler: a potion's drank reaction and a song's
// action_completed reactions apply pure-modifier statuses (row 2c) to the drinker, the player and
// (step `npc`, row 42) each listener present; str and dex start at 10.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { encode } from '../src/foundation/canonical.ts';
import { npcValue, value } from '../src/mechanics/attributes/shared.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-buffs-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/buffs_sampler', file], {
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
const P = 'buffs_sampler@0.0.1';
const ref = (k: string) =>
  ({
    cartridge_id: 'buffs_sampler',
    cartridge_version: '0.0.1',
    kind: 'attribute',
    key: k,
  }) as never;
const id = (w: World, kind: string, k: string) => w.entityIds[`${P}:${kind}/${k}`]!;
const mine = (w: World, k: string) => value(w, w.character, ref(k));
const theirs = (w: World, npc: string, k: string) => npcValue(w, id(w, 'npc', npc), ref(k));

let n = 0;
const act = (w: World, p: object) =>
  step(
    w,
    {
      id: `bbbbbbbb-4242-4242-8242-${String(++n).padStart(12, '0')}` as never,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...p } as never,
    },
    n,
  );
function play(w: World, p: object): World {
  const r = act(w, p);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
function wait(w: World, seconds: number): World {
  const run_id = 'aaaaaaaa-0000-4000-8000-000000000042';
  const until = w.state.clock + seconds;
  const r = stepElapsed(
    w,
    {
      id: elapsedCommandId(run_id, w.context, w.state.clock, until) as never,
      world_context_id: w.context,
      payload: { type: 'elapsed', actor_id: w.character, run_id, from: w.state.clock, until },
    } as never,
    ++n,
  );
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
const fresh = () =>
  newWorld(content, '2e5f9b6d-4a2c-4d3b-8f8e-7c6b5d4e3f2a' as never, [1, 2, 3, 4]);

// Breaks (row 18): the potion reaction misses the drink (kind filter, subject), the second dose
// stacks (16) or leaves the first end in place (10 at +3601), or the might outlives its refresh.
test('a potion gives str +3 for an hour; a second dose refreshes it, never stacks', () => {
  let w = play(fresh(), { type: 'take', item_id: id(fresh(), 'item', 'vial') });
  const drink = (x: World) => play(x, { type: 'drink', vessel_id: id(x, 'item', 'vial') });
  w = drink(w);
  const t0 = w.state.clock;
  assert.deepEqual([mine(w, 'str'), mine(w, 'dex')], [13, 10]);
  w = drink(wait(w, 1800)); // ends at t0 + 1800 + 3600
  assert.equal(mine(w, 'str'), 13);
  w = wait(w, t0 + 3601 - w.state.clock);
  assert.equal(mine(w, 'str'), 13);
  w = wait(w, t0 + 5399 - w.state.clock);
  assert.equal(mine(w, 'str'), 13);
  w = wait(w, 1);
  assert.equal(mine(w, 'str'), 10);
});

// Breaks (row 42): the song plays without the lute, the step's `npc` is ignored (the listener
// stays 10) or skips presence (the traveller in the yard reads 12), the song moves str, or its
// reaction's applied line comes before the song's own line.
test('a song with the lute gives dex +2 to the player and the listener present only', () => {
  let w = fresh();
  assert.equal(act(w, { type: 'perform', action: 'play_song' }).decision.kind, 'rejected');
  const song = act(play(w, { type: 'take', item_id: id(w, 'item', 'lute') }), {
    type: 'perform',
    action: 'play_song',
  });
  // mechanics.md, reaction@1: the command's own line first, then its reactions' lines (loka-kgd.13).
  assert.deepEqual(
    (song.decision as { narration?: { key: string }[] }).narration?.map((l) => l.key),
    ['narration.play_song.actor', 'narration.inspired.applied'],
  );
  w = song.world;
  const dex = (x: World) => [
    mine(x, 'dex'),
    theirs(x, 'listener', 'dex'),
    theirs(x, 'traveller', 'dex'),
  ];
  assert.deepEqual(dex(w), [12, 12, 10]);
  assert.deepEqual([mine(w, 'str'), theirs(w, 'listener', 'str')], [10, 10]);
  w = wait(w, 1799);
  assert.deepEqual(dex(w), [12, 12, 10]);
  assert.deepEqual(dex(wait(w, 1)), [10, 10, 10]);
});

// Breaks (row 42): the loader drops a check on the step's `npc`, so an unknown NPC, a spawn
// template, a step naming an item too, or an `npc` step under kernel_api 1.46 loads.
test('the loader refuses each unsound status.apply npc', () => {
  const source = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  const rule = `${P}:reaction/song_listener`;
  const at = `.cartridge.reactions[${JSON.stringify(rule)}].apply[0].npc`;
  const listener = `${P}:npc/listener`;
  const rows: [(c: any) => void, string, string][] = [
    [(c) => (c.reactions[rule].apply[0].npc.key = 'ghost'), 'UNRESOLVED_REFERENCE', at],
    [(c) => (c.npcs[listener].spawn_template = true), 'SCHEMA_VIOLATION', at],
    [
      (c) =>
        (c.reactions[rule].apply[0].item = {
          ...c.reactions[rule].apply[0].npc,
          kind: 'item',
          key: 'lute',
        }),
      'SCHEMA_VIOLATION',
      at,
    ],
    [
      (c) => {
        // Leave the npc step as the only 1.46 field: no modifies, no npc_present.
        for (const s of Object.values(c.statuses) as any[]) {
          delete s.modifies;
          s.per_tick = 1;
        }
        for (const r of Object.values(c.reactions) as any[]) delete r.when;
        c.manifest.requires.kernel_api.at_least = '1.45';
      },
      'KERNEL_API_RANGE_INVALID',
      '.cartridge.manifest.requires.kernel_api.at_least',
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
