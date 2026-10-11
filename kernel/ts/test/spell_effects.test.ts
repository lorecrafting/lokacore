// Toolbox row 29b on the compiled spell effects sampler: lux ignites the held orb (a fuel source),
// flamma deals 8 fire to the wight (hp 8, fire 50: 4 a bolt), ward applies warded to the caster,
// and a reaction on status_applied sets ward_landed.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, gameView, loadCartridge, newWorld, step } from '../src/index.ts';
import { bodyOf, type Cartridge, type World } from '../src/runtime/decision.ts';
import { encode } from '../src/foundation/canonical.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { dark } from '../src/mechanics/light/shared.ts';
import { engaged } from '../src/mechanics/combat/shared.ts';
import { value } from '../src/mechanics/fact.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-spell-effects-'));
const file = join(scratch, 'artifact.json');
execFileSync('mix', ['loka.compile', 'cartridges/spell_effects_sampler', file], {
  cwd: fileURLToPath(new URL('../../../', import.meta.url)),
  stdio: 'pipe',
});
const artifact = readFileSync(file);
rmSync(scratch, { recursive: true });
const loaded = loadCartridge(artifact, INSTALLED);
assert.ok(loaded.ok, JSON.stringify(loaded));
const content = loaded.cartridge as Cartridge;
const P = 'spell_effects_sampler@0.0.1';

let n = 0;
const id = () => `eeeeeeee-2929-4929-8929-${String(++n).padStart(12, '0')}` as never;
const play = (w: World, payload: object, key?: string) =>
  step(
    w,
    {
      id: id(),
      world_context_id: w.context,
      payload: { actor_id: w.character, ...payload },
    } as never,
    n,
    key as never,
  );
function ok(r: ReturnType<typeof step>) {
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
const cast = (w: World, word: string) => play(w, { type: 'cast', word }, 'cast');
const code = (r: ReturnType<typeof step>) =>
  r.decision.kind === 'rejected' ? r.decision.error.code : r.decision.kind;
const types = (r: ReturnType<typeof step>) =>
  r.decision.kind === 'accepted' ? r.decision.events.map((e) => e.payload.type) : [];
const lines = (r: ReturnType<typeof step>) =>
  ((r.decision as { narration?: { key: string }[] }).narration ?? []).map((t) => t.key);
const wightHp = (w: World) => level(w, w.entityIds[`${P}:npc/wight`]!, resourceRef(w, 'hp'));

const R = (key: string) => `${P}:recipe/${key}`;
const W = `${P}:npc/wight`;
const success = (c: Record<string, any>, k: string) => c.recipes[R(k)].outcomes.success;

/** The sampler's artifact changed by `change`, loaded again (the loader's result). */
function variant(change: (c: Record<string, any>) => void) {
  const c = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  change(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  return loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
}
function cartridge(change: (c: Record<string, any>) => void) {
  const r = variant(change);
  assert.ok(r.ok, JSON.stringify(r));
  return r.cartridge as Cartridge;
}

/** A new world with the orb taken in the hall (when `orb`), then in the dark crypt. */
function crypt(orb = true, c = content): World {
  n = 0;
  let w = newWorld(c, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e29' as never, [1, 2, 3, 4]);
  if (orb) w = ok(play(w, { type: 'take', item_id: w.entityIds[`${P}:item/orb`] }));
  return ok(play(w, { type: 'move', direction: 'east' }));
}

// Breaks: light.ignite writes no fuel.set (the crypt stays dark), or ignites a source the caster
// does not hold.
test('lux lights the dark crypt through the held orb; without the orb it stays dark', () => {
  const w = crypt();
  assert.equal(dark(w, w.character), true);
  const lit = cast(w, 'lux');
  assert.deepEqual(lines(lit), ['narration.lux']);
  assert.equal(dark(lit.world, w.character), false);
  const bare = crypt(false);
  assert.equal(dark(ok(cast(bare, 'lux')), bare.character), true);
});

// Breaks: the bolt ignores the wight's fire resistance (8, not 4), or a fatal bolt cast in a fight
// is refused, leaves the encounter open, or kills without the death sequence (no entity_died, the
// caster not the killer).
test('flamma deals fire damage after resistance; in a fight a second bolt kills the wight', () => {
  const hall = ok(play(crypt(), { type: 'move', direction: 'west' }));
  assert.equal(code(cast(hall, 'flamma')), 'invalid_state'); // npc_present: no bolt through walls
  let w = ok(cast(crypt(), 'lux')); // the wight is seen, and so attacked, only in light
  const wight = w.entityIds[`${P}:npc/wight`]!;
  w = ok(play(w, { type: 'attack', target_id: wight }));
  assert.ok(engaged(w, wight));
  assert.ok(gameView(w).actions.some((a) => a.action_key === 'cast' && a.available));
  w = ok(cast(w, 'flamma'));
  assert.equal(wightHp(w), 4);
  const fatal = cast(w, 'flamma');
  assert.equal(wightHp(fatal.world), 0);
  assert.equal(engaged(fatal.world, wight), undefined);
  assert.ok(fatal.decision.kind === 'accepted');
  const died = fatal.decision.events.find((e) => e.payload.type === 'entity_died')!.payload;
  assert.deepEqual(
    [(died as { killer_id: string }).killer_id, types(fatal)],
    [bodyOf(w, w.character), ['entity_died', 'action_completed']],
  );
  assert.equal(code(cast(fatal.world, 'flamma')), 'invalid_state'); // a dead wight is not present
});

// Breaks: the spell's status.apply bypasses statusStep (no status_applied, so the reaction never
// fires, or no applied line), or a refresh while active is heard as a landing.
test('ward lands warded on the caster: status_applied fires the reaction once', () => {
  const w = crypt(false);
  const warded = cast(w, 'ward');
  assert.deepEqual(lines(warded), ['narration.ward', 'narration.warded.applied']);
  assert.deepEqual(types(warded), ['status_applied', 'action_completed', 'fact_changed']);
  const fact = { cartridge_id: P.split('@')[0], cartridge_version: '0.0.1', kind: 'fact' };
  assert.equal(value(warded.world, w.character, { ...fact, key: 'ward_landed' } as never), true);
  assert.deepEqual(types(cast(warded.world, 'ward')), ['action_completed']);
});

// Breaks: the TS loader admits an effect step on a recipe that is not a spell, an effect below
// kernel_api 1.55, a damage step naming no NPC of the cartridge, or light.ignite without light@1
// (both kernels refuse them; content_spell_effects_test.exs).
test('loader: effect steps sit on spells, need 1.55, resolve and declare their owner', () => {
  const seq = (k: string) =>
    `.cartridge.recipes[${JSON.stringify(R(k))}].outcomes.success.sequence[0]`;
  const rows: [(c: Record<string, any>) => void, string, string][] = [
    [
      (c) => {
        const room = { cartridge_id: 'spell_effects_sampler', cartridge_version: '0.0.1' };
        c.recipes[R('ward')].target = {
          kind: 'detail',
          room: { ...room, kind: 'room', key: 'hall' },
          detail: 'stand',
        };
      },
      'SCHEMA_VIOLATION',
      `${seq('ward')}.op`,
    ],
    [
      (c) => (c.manifest.requires.kernel_api.at_least = '1.54'),
      'KERNEL_API_RANGE_INVALID',
      '.cartridge.manifest.requires.kernel_api.at_least',
    ],
    [
      (c) => (c.recipes[R('flamma')].outcomes.success.sequence[0].npc.key = 'ghoul'),
      'UNRESOLVED_REFERENCE',
      `${seq('flamma')}.npc`,
    ],
    [
      (c) => {
        for (const caps of [c.lock.capabilities, c.manifest.requires.capabilities])
          delete caps.light;
        for (const i of ['orb', 'glowdust']) delete c.items[`${P}:item/${i}`].fuel;
        delete c.rooms[`${P}:room/crypt`].dark_description;
      },
      'UNDECLARED_CAPABILITY',
      `${seq('lux')}.op`,
    ],
  ];
  for (const [change, diagnostic, path] of rows) {
    const r = variant(change);
    assert.deepEqual(r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path], [diagnostic, path]);
  }
});

// Breaks: a step after a fatal damage still reaches the NPC the spell just killed (a status lands on
// the dead wight), or damage on an NPC with no hp pool faults instead of writing nothing.
test('a spell writes nothing more to an NPC it killed, nor damage to an NPC without hp', () => {
  const lethal = cartridge((c) => {
    const [bolt] = success(c, 'flamma').sequence;
    const ward = { ...success(c, 'ward').sequence[0], npc: bolt.npc };
    success(c, 'flamma').sequence = [{ ...bolt, amount: 16 }, bolt, ward];
  });
  const w = ok(cast(crypt(true, lethal), 'lux'));
  const killed = cast(w, 'flamma');
  assert.deepEqual(
    [wightHp(killed.world), types(killed)],
    [0, ['entity_died', 'action_completed']],
  );
  const hollow = crypt(
    true,
    cartridge((c) => {
      delete c.npcs[W].hp;
      delete c.npcs[W].attack;
    }),
  );
  const bolt = cast(hollow, 'flamma');
  assert.deepEqual(types(bolt), ['action_completed']);
});

// Breaks: a second light.ignite of the same source in one spell ignites it again from the same
// committed fuel row (a fault) instead of writing nothing.
test('two light.ignite steps on one orb light it once', () => {
  const twice = cartridge((c) => {
    const [ignite] = success(c, 'lux').sequence;
    success(c, 'lux').sequence = [ignite, ignite];
  });
  const w = crypt(true, twice);
  assert.equal(dark(ok(cast(w, 'lux')), w.character), false);
});

// Breaks: a spell with a duration is admitted in a fight (its time.advance runs the round job inside
// the cast and faults), or the refusal also bars a spell without one.
test('in a fight only a spell without a duration is cast', () => {
  // A recipe duration needs a world without real-time (as standing_sampler): no time_policy, regen.
  const slow = cartridge((c) => {
    delete c.manifest.time_policy;
    for (const r of Object.values<Record<string, unknown>>(c.resources)) delete r.regen;
    c.recipes[R('ward')].duration = 150;
  });
  let w = ok(cast(crypt(true, slow), 'lux'));
  w = ok(play(w, { type: 'attack', target_id: w.entityIds[W] }));
  const refused = cast(w, 'ward');
  assert.deepEqual([code(refused), refused.world], ['invalid_state', w]);
  assert.equal(wightHp(ok(cast(w, 'flamma'))), 4);
});
