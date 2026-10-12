// Toolbox row 17 on the compiled ranged sampler (mechanics.md "Ranged first strike"): a bow (skill
// archery, a sure hit for 4, ranged {ammo: arrows}) shoots in round 1 and the foe's round-1 turn
// is skipped; later rounds strike unarmed (a sure hit for 1). The wolf and both goblins have 6 HP
// and a sure hit for 1; the player starts with 10 HP and 2 arrows.
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
import { value } from '../src/mechanics/fact.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-ranged-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/ranged_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const S = 'ranged_sampler@0.0.1';
const BOW = `${S}:item/bow`;

function reload(edit: (c: any) => void = () => {}) {
  const c = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  edit(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
}
function sampler(edit?: (c: any) => void) {
  const r = reload(edit);
  assert.ok(r.ok, JSON.stringify(r));
  return r.cartridge as Cartridge;
}

let n = 0;
const id = () => `eeeeeeee-1717-4717-8717-${String(++n).padStart(12, '0')}` as never;
function ok<T extends { decision: { kind: string } }>(r: T) {
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r;
}
function play(w: World, payload: object) {
  const command = { id: id(), world_context_id: w.context, payload };
  return ok(step(w, { ...command, payload: { actor_id: w.character, ...payload } } as never, n))
    .world;
}
/** As `ancestry`, take and wield the bow, go `direction` and attack the lowest-id NPC there. */
function engage(content: Cartridge, direction: string, ancestry = 'archer') {
  n = 0;
  let w = newWorld(content, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]);
  w = play(w, { type: 'choose_ancestry', ancestry });
  w = play(w, { type: 'take', item_id: w.entityIds[BOW] });
  w = play(w, { type: 'wear', item_id: w.entityIds[BOW] });
  assert.equal(hp(w, w.body), 10);
  w = play(w, { type: 'move', direction });
  const room = w.state.containers[w.body];
  const foes = Object.keys(w.entities)
    .filter((e) => w.entities[e].kind === 'npc' && w.state.containers[e] === room)
    .sort();
  return { w: play(w, { type: 'attack', target_id: foes[0] }), foes };
}
function round(w: World) {
  const run_id = `aaaaaaaa-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const [from, until] = [w.state.clock, w.state.clock + 150];
  const payload = { type: 'elapsed', actor_id: w.character, run_id, from, until };
  const command = { id: elapsedCommandId(run_id, w.context, from, until), payload };
  const r = ok(stepElapsed(w, { ...command, world_context_id: w.context } as never, n));
  const d = r.decision as Extract<typeof r.decision, { kind: 'accepted' }>;
  return {
    w: r.world,
    events: d.events.map((e) => e.payload),
    keys: d.narration!.map((x) => x.key),
  };
}
const hp = (w: World, e: string) => level(w, e as never, resourceRef(w, 'hp'));
const arrows = (w: World) => level(w, w.body, resourceRef(w, 'arrows'));
const open = (w: World) => Object.values(w.state.encounters ?? {}).some((e) => e.status === 'open');

// Breaks: the foe still strikes in round 1, no arrow spent, the bow shoots after round 1 (or with
// its ammo spent) or strikes in melee, the shot is narrated as a melee blow.
test('the bow shoots first in round 1, the wolf waits, then melee follows', () => {
  const { w: start, foes } = engage(sampler(), 'south');
  const [wolf] = foes;
  const one = round(start);
  assert.deepEqual([hp(one.w, wolf), arrows(one.w), hp(one.w, one.w.body)], [2, 1, 10]);
  const blows = one.events.filter((e) => e.type === 'attack_result');
  assert.equal(blows.length, 1);
  assert.deepEqual(
    blows.map((e) => e.type === 'attack_result' && [e.attacker_id, e.hit, e.loss]),
    [[one.w.body, true, 4]],
  );
  assert.deepEqual(one.keys, ['combat.shot_hit']);
  const two = round(one.w);
  assert.deepEqual([hp(two.w, two.w.body), hp(two.w, wolf), arrows(two.w)], [9, 1, 1]);
  assert.deepEqual(two.keys, ['combat.npc_hit', 'combat.player_hit']);
  const three = round(two.w);
  assert.deepEqual([hp(three.w, wolf), arrows(three.w), hp(three.w, three.w.body)], [0, 1, 9]);
  assert.ok(three.events.some((e) => e.type === 'entity_died' && e.victim_id === wolf));
  assert.equal(open(three.w), false);
});

// Breaks: the foe's turn is skipped only on a hit, or the miss is narrated as a melee miss.
test('a missed shot still spends the arrow and the wolf still waits', () => {
  const blind = sampler((c) => (c.items[BOW].weapon.attack.chance = 0));
  const one = round(engage(blind, 'south').w);
  assert.deepEqual([arrows(one.w), hp(one.w, one.w.body)], [1, 10]);
  assert.deepEqual(one.keys, ['combat.shot_miss']);
});

// Breaks: the shot is taken without ammo (the pool would fault below 0) or the foe still waits.
test('with no arrows round 1 is melee', () => {
  const empty = sampler((c) => (c.resources[`${S}:resource/arrows`].start = 0));
  const { w, foes } = engage(empty, 'south');
  const one = round(w);
  assert.deepEqual([hp(one.w, foes[0]), hp(one.w, one.w.body), arrows(one.w)], [5, 9, 0]);
});

// Breaks: the shot ignores the weapon's skill (a farmer does not know archery).
test('a farmer with the bow strikes unarmed and keeps the arrows', () => {
  const { w, foes } = engage(sampler(), 'south', 'farmer');
  const one = round(w);
  assert.deepEqual([hp(one.w, foes[0]), arrows(one.w), hp(one.w, one.w.body)], [5, 2, 9]);
});

// Breaks: only the ordinary round skips the foe, so the pack's selected goblin still strikes.
test('in a pack round the shot hits the primary and the selected goblin waits', () => {
  const { w, foes } = engage(sampler(), 'east');
  const [a, b] = foes;
  const one = round(w);
  assert.deepEqual(
    [hp(one.w, a), hp(one.w, b), hp(one.w, one.w.body), arrows(one.w)],
    [2, 6, 10, 1],
  );
});

// Twin of test/loka/content_ranged_test.exs. Breaks: the loader admits `ranged` below API 1.67,
// a ranged weapon without shot_hit or shot_miss, or an unknown ammo pool.
test('the loader keeps ranged weapons to API 1.67, their narration and a known pool', () => {
  const diagnostic = (edit: (c: any) => void) => {
    const r = reload(edit);
    return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path];
  };
  const narration = '.cartridge.world.combat.narration';
  const ammo = { cartridge_id: 'ranged_sampler', cartridge_version: '0.0.1', kind: 'resource' };
  const cases: [(c: any) => void, unknown][] = [
    [
      (c) => (c.manifest.requires.kernel_api.at_least = '1.66'),
      ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'],
    ],
    [
      (c) => delete c.world.combat.narration.shot_hit,
      ['SCHEMA_VIOLATION', `${narration}.shot_hit`],
    ],
    [
      (c) => delete c.world.combat.narration.shot_miss,
      ['SCHEMA_VIOLATION', `${narration}.shot_miss`],
    ],
    [
      (c) => (c.items[BOW].weapon.ranged.ammo = { ...ammo, key: 'quivers' }),
      ['UNRESOLVED_REFERENCE', `.cartridge.items["${BOW}"].weapon.ranged.ammo`],
    ],
  ];
  for (const [edit, expected] of cases) assert.deepEqual(diagnostic(edit), expected);
});

// Toolbox row 21 on the bow. Breaks: a hit shot does not wear the bow, or a broken bow still
// shoots in round 1 (spending an arrow) instead of striking unarmed.
test('a hit shot wears the bow; a broken bow makes round 1 melee', () => {
  const strung = (edge: number) =>
    sampler((c) => {
      c.manifest.requires.kernel_api.at_least = '1.69';
      c.facts[`${S}:fact/string`] = {
        key: 'string',
        version: 1,
        value_type: { type: 'int', default: edge, minimum: 0, maximum: 1 },
        scopes: ['instance'],
        per_subject: true,
        meaning: 'The bow string; at 0 it is broken.',
      };
      c.items[BOW].weapon.durability = {
        fact: {
          cartridge_id: 'ranged_sampler',
          cartridge_version: '0.0.1',
          kind: 'fact',
          key: 'string',
        },
        wear: 1,
      };
    });
  const string = (w: World) =>
    value(
      w,
      w.character,
      {
        cartridge_id: 'ranged_sampler',
        cartridge_version: '0.0.1',
        kind: 'fact',
        key: 'string',
      } as never,
      w.entityIds[BOW] as never,
    );
  const { w: whole, foes } = engage(strung(1), 'south');
  const shot = round(whole);
  assert.deepEqual([hp(shot.w, foes[0]), arrows(shot.w), string(shot.w)], [2, 1, 0]);
  const broken = round(engage(strung(0), 'south').w);
  assert.deepEqual([hp(broken.w, foes[0]), arrows(broken.w), string(broken.w)], [5, 2, 0]);
});
