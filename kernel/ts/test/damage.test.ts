// Toolbox row G2 on the compiled damage sampler: the player's attack (chance 100, damage 5,
// physical, crit 10 x2) against a wight (hp 20; physical 50, fire 75, silver -50) with an iron
// sword (metal, sharp), a silver sword (metal, sharp, silver) or no weapon (mechanics.md damage).
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
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { DEFS } from '../src/contracts.gen.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-damage-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/damage_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const source = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
const WIGHT = 'damage_sampler@0.0.1:npc/wight';

function load(change: (c: any) => void = () => {}) {
  const c = structuredClone(source);
  change(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
}

let n = 0;
const id = () => `eeeeeeee-8888-4888-8888-${String(++n).padStart(12, '0')}` as never;
function accepted(r: ReturnType<typeof step>) {
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
/** Take and wield the sword (if any), attack the wight and run `rounds` combat rounds; returns
 * the wight's HP after each round. */
function fight(content: Cartridge, seed: number[], sword: string | null, rounds = 1) {
  n = 0;
  let w: World = newWorld(content, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, seed);
  const play = (payload: object) =>
    accepted(
      step(
        w,
        {
          id: id(),
          world_context_id: w.context,
          payload: { actor_id: w.character, ...payload },
        } as never,
        n,
      ),
    );
  if (sword) {
    const item_id = w.entityIds[`damage_sampler@0.0.1:item/${sword}`];
    w = play({ type: 'take', item_id });
    w = play({ type: 'wear', item_id });
  }
  w = play({ type: 'move', direction: 'east' });
  const wight = w.entityIds[WIGHT];
  w = play({ type: 'attack', target_id: wight });
  const hp: (number | undefined)[] = [];
  for (let round = 0; round < rounds; round++) {
    const run_id = `aaaaaaaa-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    const [from, until] = [w.state.clock, w.state.clock + 150];
    const payload = { type: 'elapsed', actor_id: w.character, run_id, from, until };
    const command = { id: elapsedCommandId(run_id, w.context, from, until), payload };
    w = accepted(stepElapsed(w, { ...command, world_context_id: w.context } as never, n));
    hp.push(level(w, wight, resourceRef(w, 'hp')));
  }
  return hp;
}

const sampler = (change?: (c: any) => void) => {
  const r = load(change);
  assert.ok(r.ok, JSON.stringify(r));
  return r.cartridge as Cartridge;
};
// Hand-computed first hit rolls (independent xoshiro128**, uniform in [0, 100)).
const ROLL_60 = [1, 1, 1, 1];
const ROLL_0 = [9, 10, 11, 12];
const ROLL_9 = [3545878650, 2267147512, 3674184203, 2010695017];
const ROLL_10 = [1049889716, 147947537, 4147507174, 3789830071];

// Breaks: no crit, an extra crit draw (the round's rolls shift), crit at roll <= chance, the
// multiplier after resistances, the wielded item's tags or the attack's kind ignored, resistances
// rounded instead of floored, the sum not clamped to -100..100, or resistances never applied.
test('a seeded round leaves the wight the hand-fixed HP', () => {
  const plain = sampler();
  const fire = sampler((c) => (c.world.combat.player_attack.kind = 'fire'));
  const resist = (r: object) =>
    sampler((c) => (c.npcs[WIGHT].resistances = { ...c.npcs[WIGHT].resistances, ...r }));
  const rows: [string, Cartridge, number[], string | null, number][] = [
    ['unarmed: physical 50, 5 -> 2', plain, ROLL_60, null, 18],
    ['iron: physical 50, 5 -> 2', plain, ROLL_60, 'iron_sword', 18],
    ['silver: 50 - 50 = 0, 5 -> 5', plain, ROLL_60, 'silver_sword', 15],
    ['iron crit: 10 then 50 -> 5', plain, ROLL_0, 'iron_sword', 15],
    ['silver crit at roll 9', plain, ROLL_9, 'silver_sword', 10],
    ['silver at roll 10: no crit', plain, ROLL_10, 'silver_sword', 15],
    ['iron fire: 75, 5 -> 1.25 -> 1', fire, ROLL_60, 'iron_sword', 19],
    ['silver fire: 75 - 50 = 25, 5 -> 3.75 -> 3', fire, ROLL_60, 'silver_sword', 17],
    [
      'iron: 100 + sharp 50 clamps to 100',
      resist({ physical: 100, sharp: 50 }),
      ROLL_60,
      'iron_sword',
      20,
    ],
    [
      'silver: -100 - 50 clamps to -100, x2',
      resist({ physical: -100 }),
      ROLL_60,
      'silver_sword',
      10,
    ],
  ];
  for (const [name, content, seed, sword, hp] of rows)
    assert.deepEqual(fight(content, seed, sword), [hp], name);
});

// Breaks: the crit is an extra draw (the wight's roll and later rounds shift) or never fires.
// Turns alternate (player first in odd rounds): rolls 49 player, 64 wight | 27 wight, 6 player
// (crit) | 90 player: silver deals 5, 10, then 5.
test('a seeded silver fight has exactly one doubled hit', () => {
  const seed = [2229621088, 1003500358, 2750031949, 1263371380];
  assert.deepEqual(fight(sampler(), seed, 'silver_sword', 3), [15, 5, 0]);
});

// Breaks: the loader skips the 1.44 floor for one site, so an older-API artifact with damage
// kinds, crits or resistances loads on a kernel that would ignore them.
test('the loader refuses G2 fields below kernel_api 1.44', () => {
  const api = '.cartridge.manifest.requires.kernel_api.at_least';
  const old = (c: any) => (c.manifest.requires.kernel_api.at_least = '1.43');
  const bare = (c: any) => {
    delete c.world.combat.player_attack.kind;
    delete c.world.combat.player_attack.crit;
    delete c.npcs[WIGHT].resistances;
  };
  const rows: [string, (c: any) => void][] = [
    ['player kind', (c) => delete c.world.combat.player_attack.crit],
    ['player crit', (c) => delete c.world.combat.player_attack.kind],
    [
      'npc resistances',
      (c) => {
        delete c.world.combat.player_attack.kind;
        delete c.world.combat.player_attack.crit;
      },
    ],
    [
      'npc attack kind',
      (c) => {
        bare(c);
        c.npcs[WIGHT].attack.kind = 'cold';
      },
    ],
  ];
  for (const [name, change] of rows) {
    const r = load((c) => (change(c), old(c)));
    assert.deepEqual(
      r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path],
      ['KERNEL_API_RANGE_INVALID', api],
      name,
    );
  }
  const none = load((c) => (bare(c), old(c)));
  assert.ok(none.ok, 'without G2 fields 1.43 still loads');
});

// Breaks: a later row adds a DamageKind or Tag without its Resistances member, so no NPC can
// resist the new kind or material (mechanics.md damage model: the members are exactly both sets).
test('Resistances names exactly the damage kinds and tags', () => {
  const defs = DEFS as Record<string, any>;
  const names = [...defs.DamageKind.enum, ...defs.Tag.enum].sort();
  assert.deepEqual(Object.keys(defs.Resistances.properties).sort(), names);
});
