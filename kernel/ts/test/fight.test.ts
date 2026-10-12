// Fight matrix and encounter rating (cartridge.md "Fight matrix and encounter rating (balance tool
// 7)"; kernel/ts/play/fight.ts) on the compiled encounter sampler and a test-local clone. Expected
// values are hand-read from cartridges/encounter_sampler and the clone below; the player strikes
// first in odd rounds, the foe in even rounds.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import { fights, pct } from '../play/fight.ts';
import { decode, encode, type Json } from '../src/foundation/canonical.ts';
import { INSTALLED, loadCartridge, type Cartridge } from '../src/index.ts';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CLI = fileURLToPath(new URL('../play/fight.ts', import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), 'loka-fight-'));
after(() => rmSync(scratch, { recursive: true, force: true }));
const compile = (source: string, name: string) => {
  const file = join(scratch, name);
  execFileSync('mix', ['loka.compile', source, file], { cwd: ROOT, stdio: 'pipe' });
  const loaded = loadCartridge(readFileSync(file), INSTALLED);
  assert.ok(loaded.ok, JSON.stringify(loaded));
  return [file, loaded.cartridge as Cartridge] as const;
};
const [sampler, encounters] = compile('cartridges/encounter_sampler', 'encounters.json');

// The clone: player hp 3 without regen, two levels one point apart, one attribute `might` (start 0)
// adding 1 damage per point. In the road: X (hp 2, a sure 1), Y (hp 4, a sure 2) and the listed
// ally Al (hp 5, a sure 1).
const source = join(scratch, 'clone');
cpSync(join(ROOT, 'cartridges/encounter_sampler'), source, { recursive: true });
const edit = (file: string, change: (j: Record<string, any>) => void) => {
  const path = join(source, file);
  const j = JSON.parse(readFileSync(path, 'utf8'));
  change(j);
  writeFileSync(path, JSON.stringify(j));
};
const KILLS = [{ npc: 'al', experience: 1 }]; // the schema wants one; Al is never asserted
edit('cartridge.json', (c) => {
  Object.assign(c.requires.capabilities, { attributes: 1, fact: 1, policy: 1 });
  c.world.levelling = { thresholds: [10], points_per_level: 1, kills: KILLS, level_up: 'level_up' };
  c.world.derived = { damage: { terms: [{ attribute: 'might', per_point: 1, pivot: 0 }] } };
  c.world.combat.allies = ['al'];
  Object.assign(c.world.combat.narration, {
    ally_hit: 'combat.player_hit',
    ally_miss: 'combat.player_miss',
  });
  c.world.death.restore.hp = 3;
});
edit('resources.json', (r) => {
  r.resources.hp = { minimum: 0, maximum: 3, start: 3 };
});
edit('text.json', (t) => {
  t.level_up = 'You grow stronger.';
});
writeFileSync(
  join(source, 'attributes.json'),
  JSON.stringify({ attributes: { might: { start: 0 } } }),
);
const bandit = JSON.parse(readFileSync(join(source, 'npcs/bandit.json'), 'utf8'));
for (const [name, hp, damage] of [
  ['x', 2, 1],
  ['y', 4, 2],
  ['al', 5, 1],
] as const) {
  const { spawn_template: _, ...npc } = bandit;
  const attack = { chance: 100, damage_min: damage, damage_max: damage };
  const pool = { minimum: 0, maximum: hp, start: hp, gain: 0 };
  writeFileSync(
    join(source, `npcs/${name}.json`),
    JSON.stringify({ ...npc, keywords: [name], hp: pool, attack }),
  );
}
const [, clone] = compile(source, 'clone.json');

type Report = ReturnType<typeof fights>;
const of = (r: Report, key: string) =>
  r.targets.find((t) => t.target === `encounter_sampler@0.0.1:${key}`)!;
const at = (r: Report, key: string, level: number, build = 'none') =>
  of(r, key).cells.find((c) => c.level === level && c.build === build) as Record<string, unknown>;
const MIGHT = 'encounter_sampler@0.0.1:attribute/might';

// Breaks: an encounter plan not elapsed to a birth (unborn 32, wins 0), the plan's rating fields
// read from the wrong place, or the round count off by one. The bandit (hp 3, 50% for 1) falls to
// the player's sure 1 in round 3 and can strike only in rounds 1 and 2, so hp_left is 8 to 10.
test('the encounter sampler: a level 1 player beats the bandit in 3 rounds every seed', () => {
  const r = fights(encounters);
  assert.deepEqual(
    r.targets.map((t) => t.target),
    ['encounter_sampler@0.0.1:population/bandits'],
  );
  const { cells, rating } = of(r, 'population/bandits');
  assert.equal(cells.length, 1);
  const cell = cells[0]!;
  assert.ok('hp_left' in cell && cell.hp_left, JSON.stringify(cell));
  const { hp_left, ...rest } = cell;
  assert.deepEqual(rest, {
    level: 1,
    build: 'none',
    n: 32,
    wins: 32,
    deaths: 0,
    timeouts: 0,
    fleds: 0,
    unborn: 0,
    win_pct: '100.00',
    death_pct: '0.00',
    fled_pct: '0.00',
    rounds: { min: 3, median: 3, max: 3 },
  });
  assert.ok(hp_left.min >= 8 && hp_left.max <= 10, JSON.stringify(hp_left));
  assert.deepEqual(rating, {
    first_win_level: 1,
    first_win_build: 'none',
    death_pct_level_1: '0.00',
    chance: 25,
    opportunities_per_day: '24.00',
  });
});

// Breaks: the level row not overridden (level 2 plays as 1), the build's points on no attribute
// or the wrong one, a player death read as a timeout, or the listed ally kept (Al's sure 1 with
// the player's kills X in round 1 at level 1). X: R1 X 1, player 2; R2 X first, player 1, X 0.
// Level 2 might strikes for 2: X dies in R1. Y: R1 Y 3 (2 with might), player 1; R2 Y first,
// player 0. Every seed agrees, as every attack is sure.
test('the clone: level, build, death and the removed ally, each hand-derived', () => {
  const r = fights(clone, { seeds: 4 });
  const won = (rounds: number, hp: number) => ({
    n: 4,
    wins: 4,
    deaths: 0,
    timeouts: 0,
    fleds: 0,
    win_pct: '100.00',
    death_pct: '0.00',
    fled_pct: '0.00',
    rounds: { min: rounds, median: rounds, max: rounds },
    hp_left: { min: hp, median: hp, max: hp },
  });
  const dead = {
    ...{ n: 4, wins: 0, deaths: 4, timeouts: 0, fleds: 0 },
    ...{ win_pct: '0.00', death_pct: '100.00', fled_pct: '0.00' },
  };
  assert.deepEqual(at(r, 'npc/x', 1), { level: 1, build: 'none', ...won(2, 1) });
  assert.deepEqual(at(r, 'npc/x', 2), { level: 2, build: 'none', ...won(2, 1) });
  assert.deepEqual(at(r, 'npc/x', 2, MIGHT), { level: 2, build: MIGHT, ...won(1, 3) });
  assert.deepEqual(at(r, 'npc/y', 1), { level: 1, build: 'none', ...dead });
  assert.deepEqual(at(r, 'npc/y', 2, MIGHT), { level: 2, build: MIGHT, ...dead });
  const rating = (level: number | null, build: string | null, death: string) => ({
    first_win_level: level,
    first_win_build: build,
    death_pct_level_1: death,
  });
  assert.deepEqual(of(r, 'npc/x').rating, rating(1, 'none', '0.00'));
  assert.deepEqual(of(r, 'npc/y').rating, rating(null, null, '100.00'));
});

// The player's attack at `chance` in a copy of `c`.
const hitting = (c: Cartridge, chance: number, more: object = {}) => {
  const combat = c.world!.combat!;
  const player_attack = { ...combat.player_attack, chance };
  return {
    ...c,
    world: { ...c.world, ...more, combat: { ...combat, player_attack } },
  } as Cartridge;
};

// Breaks: first_win_level read from the `none` build alone, a winning build not named, or the
// 50.00 boundary taken as above 50. The clone at a 50% player hit: X (hp 2) is beaten with two
// hits in the player's first three rolls; might at level 2 kills with any one. Seeds 1 to 5 at
// level 1 (either build, no point to spend) win seeds 2 and 3 only: 2 of 4 is exactly 50.00, 2 of
// 5 below, where level 2 might, winning 4 of 5, names the rating.
test('the rating: the first level and build at a win_pct of at least 50.00', () => {
  const r = fights(hitting(clone, 50), { seeds: 4 });
  assert.equal(at(r, 'npc/x', 1).win_pct, '50.00');
  assert.equal(at(r, 'npc/x', 2, MIGHT).win_pct, '75.00');
  assert.deepEqual(of(r, 'npc/x').rating, {
    first_win_level: 1,
    first_win_build: 'none',
    death_pct_level_1: '50.00',
  });
  assert.deepEqual(of(fights(hitting(clone, 50), { seeds: 5 }), 'npc/x').rating, {
    first_win_level: 2,
    first_win_build: MIGHT,
    death_pct_level_1: '60.00',
  });
});

// Breaks: a target that flees played to the round cap and counted as a timeout (finding 3 of the
// review). The showcase goblins (hp 6, flight below 25%) against a sure player hit of 1: the
// target flees at hp 1 in round 5, out of the player's room, while the player (hp 10, the goblin
// a sure 1) stands; the levelling is dropped so the copy has one level.
test('the showcase goblins with a sure player hit: the target flees every seed', () => {
  const [, showcase] = compile('cartridges/toolbox_showcase', 'showcase.json');
  const r = fights(hitting(showcase, 100, { levelling: undefined }), { seeds: 2 });
  const goblins = r.targets.find((t) => t.target === 'toolbox_showcase@0.0.1:population/goblins')!;
  assert.deepEqual(goblins.cells[0], {
    level: 1,
    build: 'none',
    n: 2,
    wins: 0,
    deaths: 0,
    timeouts: 0,
    fleds: 2,
    unborn: 0,
    win_pct: '0.00',
    death_pct: '0.00',
    fled_pct: '100.00',
  });
});

// Breaks: the round cap ignored, or a fight still going at the cap counted as a win or a death.
test('a fight still going at the round cap is a timeout', () => {
  const r = fights(clone, { seeds: 2, rounds: 1 });
  assert.deepEqual(at(r, 'npc/x', 1), {
    level: 1,
    build: 'none',
    n: 2,
    wins: 0,
    deaths: 0,
    timeouts: 2,
    fleds: 0,
    win_pct: '0.00',
    death_pct: '0.00',
    fled_pct: '0.00',
  });
});

// Breaks: an integer percent, a fraction instead of a percent, or rounding other than two places.
test('pct is k of n as a percent with two decimal places', () => {
  assert.equal(pct(3, 8), '37.50');
  assert.equal(pct(1, 3), '33.33');
  assert.equal(pct(0, 5), '0.00');
});

// Breaks: a missing artifact not refused with the usage line, a refused artifact played anyway or
// without its diagnostic, or the report not one canonical JSON line.
test('the CLI: usage, a refused artifact and one canonical report line', () => {
  const usage = spawnSync('node', [CLI], { encoding: 'utf8' });
  assert.equal(usage.status, 2);
  assert.match(usage.stderr, /^usage: node kernel\/ts\/play\/fight\.ts <artifact>/);
  const forged = join(scratch, 'forged.json');
  const artifact = JSON.parse(readFileSync(sampler, 'utf8'));
  writeFileSync(forged, JSON.stringify({ ...artifact, content_hash: '0'.repeat(64) }));
  const refused = spawnSync('node', [CLI, forged], { encoding: 'utf8' });
  assert.equal(refused.status, 1);
  assert.equal(JSON.parse(refused.stderr).code, 'CONTENT_HASH_MISMATCH');
  const ok = spawnSync('node', [CLI, sampler, '--seeds', '2'], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  const [line, ...more] = ok.stdout.split('\n');
  assert.deepEqual(more, ['']);
  assert.equal(encode(decode(line!) as Json), line);
});
