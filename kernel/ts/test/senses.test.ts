// Toolbox row G6 on the compiled senses sampler: storeroom -east- hall -east- forge; hall -north-
// barracks -east- tower; storeroom -south- guardroom. The forge sounds hammering (range 1) and gives
// heat (range 0); the tower's kitchen smells of stew (range 2); the torch in the hall smokes
// (range 1) while lit; the sentry in the barracks smokes a pipe (smell, range 0); a failed pick of
// the storeroom lock (pick level 0 against rating 5) rattles (range 1). The guard stands in the
// guardroom, three rooms from the forge; each one's reaction to the failed pick needs
// cue_perceived sound.
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
import { LIMITS, type DefinitionRef, type EntityId } from '../src/contracts.gen.ts';
import { encode } from '../src/foundation/canonical.ts';
import { value } from '../src/mechanics/fact.ts';
import { holds } from '../src/mechanics/policy.ts';
import { statusKey } from '../src/mechanics/status/shared.ts';
import type { Obj } from '../src/content/cartridge_refs.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-senses-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/senses_sampler', file], {
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
const ref = (kind: string, key: string) =>
  ({ cartridge_id: 'senses_sampler', cartridge_version: '0.0.1', kind, key }) as DefinitionRef;
const id = (w: World, kind: string, key: string) =>
  w.entityIds[`senses_sampler@0.0.1:${kind}/${key}`] as EntityId;

let n = 0;
const fresh = (c: Cartridge = content) =>
  newWorld(c, '7e1f0c2a-5d3b-4c8e-9a6f-000000000006' as never, [1, 2, 3, 4]);
function play(w: World, p: object): World {
  n += 1;
  const r = step(
    w,
    {
      id: `dddddddd-6666-4333-8444-${String(n).padStart(12, '0')}` as never,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...p } as never,
    },
    n,
  );
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}

// Breaks: range ignored (the forge heat shows next door), the last exit taken as the direction
// (stew "east" instead of "north"), unsorted cues, or a cue past its range listed (storeroom).
test('the view lists the cues within range, with the first exit towards each', () => {
  const w = fresh();
  assert.deepEqual(gameView(w).cues, [
    { sense: 'sound', text: 'cue.hammering', direction: 'east' },
    { sense: 'smell', text: 'cue.stew', direction: 'north' },
  ]);
  assert.equal(gameView(play(w, { type: 'move', direction: 'west' })).cues, undefined);
  assert.deepEqual(gameView(play(w, { type: 'move', direction: 'east' })).cues, [
    { sense: 'heat', text: 'cue.forge_heat' },
    { sense: 'sound', text: 'cue.hammering' },
  ]);
});

// Breaks: a fuel source's cues shown while unlit, or never shown once lit.
test('a fuel source smokes only while lit', () => {
  const held = play(fresh(), { type: 'take', item_id: id(fresh(), 'item', 'torch') });
  const smoke = { sense: 'smell', text: 'cue.smoke' };
  assert.ok(!gameView(held).cues!.some((c) => c.text === smoke.text));
  const lit = play(held, { type: 'ignite', item_id: id(held, 'item', 'torch') });
  assert.deepEqual(gameView(lit).cues![0], smoke);
});

// Breaks: a cue's `when` ignored.
test('a cue whose condition fails is not listed', () => {
  const c = structuredClone(content) as unknown as Obj;
  const forge = Object.values(c.rooms as Obj).find((r) => r.key === 'forge');
  forge.cues[0].when = {
    policy_version: 1,
    root: { op: 'fact_compare', fact: ref('fact', 'guard_alerted'), equals: true },
  };
  const texts = gameView(fresh(c as unknown as Cartridge)).cues!.map((x) => x.text);
  assert.deepEqual(texts, ['cue.stew']);
});

// Breaks: a cue carried through an exit hidden from the player (row 11): hiding the hall's east
// exit must drop the forge's hammering.
test('a hidden exit carries no cue', () => {
  const c = structuredClone(content) as unknown as Obj;
  const hall = Object.values(c.rooms as Obj).find((r) => r.key === 'hall');
  hall.exits.east.hidden_until = { fact: ref('fact', 'lock_picked'), equals: true };
  const texts = gameView(fresh(c as unknown as Cartridge)).cues!.map((x) => x.text);
  assert.deepEqual(texts, ['cue.stew']);
});

// Breaks: a closed door stops a cue: with a closed door on the hall's east exit the forge's
// hammering is still heard.
test('a closed door carries cues', () => {
  const c = structuredClone(content) as unknown as Obj;
  const door = ref('barrier', 'door');
  c.barriers = {
    'senses_sampler@0.0.1:barrier/door': {
      key: 'door',
      keywords: ['door'],
      short: 'x',
      initial: 'closed',
    },
  };
  Object.values(c.rooms as Obj).find((r) => r.key === 'hall').exits.east.barrier = door;
  const texts = gameView(fresh(c as unknown as Cartridge)).cues!.map((x) => x.text);
  assert.deepEqual(texts, ['cue.hammering', 'cue.stew']);
});

// Breaks: a dead NPC's cues still given (the sentry's pipe from the barracks), or a dead NPC still
// perceiving (the stew from the tower still reaches its room).
test('a dead NPC gives no cue and perceives nothing', () => {
  const c = structuredClone(content) as unknown as Obj;
  const hp = { minimum: 0, maximum: 2, start: 0, gain: 0 };
  c.resources = { 'senses_sampler@0.0.1:resource/hp': { key: 'hp', ...hp } };
  Object.values(c.npcs as Obj).find((e) => e.key === 'sentry').hp = hp;
  const leaf = { op: 'cue_perceived', npc: ref('npc', 'sentry'), sense: 'smell' } as const;
  const look = (x: Cartridge) => {
    const w = play(fresh(x), { type: 'move', direction: 'north' });
    return [gameView(w).cues!.map((v) => v.text), holds(w, w.character, leaf, { steps: { n: 0 } })];
  };
  assert.deepEqual(look(content), [['cue.pipe', 'cue.stew'], true]);
  assert.deepEqual(look(c as unknown as Cartridge), [['cue.stew'], false]);
});

// Breaks: a status's cues read from an inactive row, or not from the holder's room (the sentry
// one room north of the hall).
test('an active status gives its cues from its holder', () => {
  const c = structuredClone(content) as unknown as Obj;
  const smoulder = ref('status', 'smoulder');
  c.statuses = {
    'senses_sampler@0.0.1:status/smoulder': {
      key: 'smoulder',
      cues: [{ sense: 'smell', text: 'cue.smoke', range: 1 }],
    },
  };
  const w = fresh(c as unknown as Cartridge);
  const row = (active: boolean) => ({
    ...w,
    state: {
      ...w.state,
      statuses: {
        [statusKey(id(w, 'npc', 'sentry'), smoulder)]: active
          ? { generation: 1, active, ends_at: 9, next_tick_at: 9, job_id: 'j' }
          : { generation: 1, active },
      },
    },
  });
  const smoke = (x: World) => gameView(x).cues!.some((v) => v.text === 'cue.smoke');
  assert.deepEqual([smoke(row(true) as World), smoke(row(false) as World)], [true, false]);
});

// Breaks: the outcome's transient cue never perceived (the guard misses it), range ignored or the
// leaf always true (the sentry two rooms away hears it).
test('a failed pick is heard by the guard next door, not the sentry two rooms away', () => {
  const w = play(fresh(), { type: 'move', direction: 'west' });
  const picked = play(w, { type: 'perform', action: 'pick_lock' });
  const fact = (k: string) => value(picked, picked.character, ref('fact', k));
  assert.deepEqual([fact('guard_alerted'), fact('sentry_alerted')], [true, false]);
});

// Breaks: ambient noise counted in a reaction to a recipe outcome: with the rattle removed and the
// guardroom itself noisy, the guard must still not be alerted by the failed pick.
test('in a reaction to a failed pick only the outcome cues are heard', () => {
  const c = structuredClone(content) as unknown as Obj;
  Object.values(c.recipes as Obj)[0].outcomes.failure.cues = undefined;
  const guardroom = Object.values(c.rooms as Obj).find((r) => r.key === 'guardroom');
  guardroom.cues = [{ sense: 'sound', text: 'cue.hammering', range: 0 }];
  const w = play(fresh(c as unknown as Cartridge), { type: 'move', direction: 'west' });
  const picked = play(w, { type: 'perform', action: 'pick_lock' });
  assert.equal(value(picked, picked.character, ref('fact', 'guard_alerted')), false);
});

// Breaks: a passed check or a completed action heard with the failure cues: given a success
// cue of smell, the guard smells a passed pick and a completed one, and hears no rattle.
test('a passed check or completed action carries the success cues', () => {
  const c = structuredClone(content) as unknown as Obj;
  Object.values(c.recipes as Obj)[0].outcomes.success.cues = [
    { sense: 'smell', text: 'cue.stew', range: 1 },
  ];
  const w = play(fresh(c as unknown as Cartridge), { type: 'move', direction: 'west' });
  const heard = (type: string, sense: 'smell' | 'sound') =>
    holds(
      w,
      w.character,
      { op: 'cue_perceived', npc: ref('npc', 'guard'), sense },
      {
        steps: { n: 0 },
        cause: { payload: { type, check: { key: 'pick_lock' }, action: 'pick_lock' } } as never,
      },
    );
  assert.deepEqual(
    [heard('check_passed', 'smell'), heard('action_completed', 'smell')],
    [true, true],
  );
  assert.deepEqual(
    [heard('check_passed', 'sound'), heard('check_failed', 'smell')],
    [false, false],
  );
});

// Breaks: the walk not charged to query_steps. The sentry smells its own pipe; from the barracks
// the walk crosses 6 exits, so 5 steps short of the limit it is exhausted (uncharged, 3 suffice).
test('an exhausted query budget perceives nothing', () => {
  const w = fresh();
  const leaf = { op: 'cue_perceived', npc: ref('npc', 'sentry'), sense: 'smell' } as const;
  assert.equal(holds(w, w.character, leaf, { steps: { n: 0 } }), true);
  assert.equal(holds(w, w.character, leaf, { steps: { n: LIMITS.query_steps - 5 } }), false);
});

// Breaks: the loader accepts a cue or a lone cue_perceived leaf below kernel_api 1.48, a cue
// without sense_cue@1 or with a text key missing from the catalog.
test('the loader refuses a cue below 1.48, without sense_cue or without its text', () => {
  const load = (change: (c: Obj) => void) => {
    const c = structuredClone(content) as unknown as Obj;
    change(c);
    const canonical = encode(c);
    const sha256 = createHash('sha256').update(canonical).digest('hex');
    const r = loadCartridge(
      new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
      INSTALLED,
    );
    return r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path];
  };
  assert.deepEqual(
    load((c) => (c.manifest.requires.kernel_api.at_least = '1.47')),
    ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'],
  );
  const strip = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(strip)
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.entries(v)
              .filter(([k]) => k !== 'cues')
              .map(([k, x]) => [k, strip(x)]),
          )
        : v;
  // the reactions' cue_perceived leaves alone still need 1.48
  assert.deepEqual(
    load((c) => {
      for (const k of ['rooms', 'npcs', 'items', 'recipes']) c[k] = strip(c[k]);
      c.manifest.requires.kernel_api.at_least = '1.47';
    }),
    ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'],
  );
  const [owner, at] = load((c) => {
    delete c.manifest.requires.capabilities.sense_cue;
    delete c.lock.capabilities.sense_cue;
    c.reactions = {}; // their cue_perceived leaves would be refused first
  });
  assert.deepEqual([owner, at.slice(-8)], ['UNDECLARED_CAPABILITY', '.cues[0]']);
  const [missing, key] = load((c) => delete c.text['cue.rattle']);
  assert.deepEqual(
    [missing, key.slice(-29)],
    ['UNRESOLVED_REFERENCE', 'outcomes.failure.cues[0].text'],
  );
});
