// Toolbox row W13 (mechanics.md Tracks and trails) on the compiled tracks sampler: a clearing
// (entry), a thicket east, a burrow north; one hound (plan hounds: trail, pack, 7 HP, flight below
// 25%) and one hunter (plan hunters: hunts), both homed in the clearing with the thicket as nest;
// fresh_for 300; the clock starts at 64800 and the first wander is due at 68400.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step, stepElapsed } from '../src/index.ts';
import { holds } from '../src/runtime/world.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import { encode } from '../src/foundation/canonical.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-tracks-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/tracks_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const source = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
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
const loaded = load();
assert.ok(loaded.ok, JSON.stringify(loaded));
const content = loaded.cartridge as Cartridge;
const REF = 'tracks_sampler@0.0.1';

let n = 0;
type Decision = { kind: string; outcome?: string; narration?: { key: string }[] };
let last: Decision;
function play(w: World, payload: object) {
  const r = step(
    w,
    {
      id: `eeeeeeee-1313-4313-8313-${String(++n).padStart(12, '0')}`,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...payload },
    } as never,
    n,
  );
  last = r.decision as Decision;
  assert.equal(last.kind, 'accepted', JSON.stringify(last));
  return r.world;
}
/** The world with its clock moved to `until`. */
function to(w: World, until: number) {
  const run_id = `aaaaaaaa-1313-4313-8313-${String(++n).padStart(12, '0')}`;
  const from = w.state.clock;
  const payload = { type: 'elapsed', actor_id: w.character, run_id, from, until };
  const command = { id: elapsedCommandId(run_id, w.context, from, until), payload };
  const r = stepElapsed(w, { ...command, world_context_id: w.context } as never, n);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
const start = (c = content) => {
  n = 0;
  return newWorld(c, '3d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]);
};
const roomKey = (w: World, id: string) => w.rooms[id]?.title.split('.')[1];
const where = (w: World, e: string) => roomKey(w, w.state.containers[e]!);
const member = (w: World, plan: string) =>
  Object.keys(w.state.created ?? {}).find((e) => {
    const o = w.state.created![e].origin as { kind: string; by?: { key: string } };
    return (
      o.kind === 'spawned' && o.by?.key === plan && w.state.created![e].definition.kind === 'npc'
    );
  })!;
/** The trail rows of `fact` by room key: [exit, at] where written. */
function trails(w: World, prefix: string) {
  const out: Record<string, unknown[]> = {};
  for (const [k, v] of Object.entries(w.state.facts ?? {})) {
    const t = JSON.parse(k) as { fact: { key: string }; subject_id: string };
    const r = roomKey(w, t.subject_id);
    if (r && t.fact.key.startsWith(prefix)) (out[r] ??= [])[t.fact.key.endsWith('_at') ? 1 : 0] = v;
  }
  return out;
}
const track = (w: World, r: string) => {
  play(w, { type: 'perform', action: `track_${r}` });
  return [last.outcome, ...(last.narration ?? []).map((l) => l.key)];
};

// Breaks: freshness read as now - at <= fresh_for (399 past fails at 300's edge), the trail written
// at the destination room, the lead line dropped or put before the outcome's, or the check passing
// on a never-written room (exit none).
test("a hound's wander writes its source room only; tracking there passes until fresh_for", () => {
  let w = to(start(), 68401);
  assert.equal(where(w, member(w, 'hounds')), 'thicket');
  assert.deepEqual(trails(w, 'trail_hounds'), { clearing: ['east', 68400] });
  assert.deepEqual(track(to(w, 68699), 'clearing'), [
    'success',
    'narration.track.success',
    'trail.lead.east',
  ]);
  assert.deepEqual(track(to(w, 68700), 'clearing'), ['failure', 'narration.track.failure']);
  w = play(w, { type: 'move', direction: 'north' });
  assert.deepEqual(track(w, 'burrow'), ['failure', 'narration.track.failure']);
  assert.ok(holds('facts_typed', w));
});

// Breaks: a second step overwriting the first room's row.
test('two steps: each room keeps its own next exit', () => {
  const w = to(start(), 72001);
  assert.equal(where(w, member(w, 'hounds')), 'clearing');
  assert.deepEqual(trails(w, 'trail_hounds'), {
    clearing: ['east', 68400],
    thicket: ['west', 72000],
  });
  const there = play(w, { type: 'move', direction: 'east' });
  assert.deepEqual(track(there, 'thicket'), [
    'success',
    'narration.track.success',
    'trail.lead.west',
  ]);
});

// Breaks: two hounds leaving one room in one wander job each writing its row (once() dropped:
// the second write's expected value is stale and the job faults).
test('two hounds leaving together write one row', () => {
  const pack = structuredClone(content) as any;
  Object.assign(pack.populations[`${REF}:population/hounds`], {
    cap: 2,
    day_target: 2,
    night_target: 2,
  });
  const w = to(start(pack), 68401);
  assert.deepEqual(trails(w, 'trail_hounds'), { clearing: ['east', 68400] });
});

// Breaks: C4 flight leaving no trail, or the trail written at the room fled to.
test('a wounded hound flees east and leaves its trail in the clearing', () => {
  let w = play(start(), { type: 'attack', target_id: member(start(), 'hounds') });
  for (let i = 0; i < 3; i++) w = to(w, w.state.clock + 150);
  assert.equal(where(w, member(w, 'hounds')), 'thicket');
  const [exit, at] = trails(w, 'trail_hounds').clearing;
  assert.deepEqual([exit, Object.keys(trails(w, 'trail_hounds'))], ['east', ['clearing']]);
  assert.ok((at as number) > 64800 && (at as number) <= w.state.clock);
  assert.equal(track(w, 'clearing')[2], 'trail.lead.east');
});

// Breaks: the hunt ignoring freshness (the cold case follows too), chase skipped (the fresh case
// wanders to the thicket), or npcPassage not consulted (the shut door case follows).
test("a hunter follows the player's fresh trail; a cold or shut one gives its plain wander", () => {
  const hunt = (leave: number, c = content) => {
    const shut = !!c.barriers;
    let w = to(start(c), leave);
    if (shut) w = play(w, { type: 'open', direction: 'north' });
    w = play(w, { type: 'move', direction: 'north' });
    if (shut) w = play(w, { type: 'close', direction: 'south' });
    assert.deepEqual(trails(w, 'trail_')['clearing'].slice(-2), ['north', leave]);
    w = to(w, 68401);
    return where(w, member(w, 'hunters'));
  };
  assert.equal(hunt(68101), 'burrow');
  assert.equal(hunt(68100), 'thicket');
  // A shut door between the clearing and the burrow: the hunter does not pass it.
  const door = structuredClone(content) as any;
  const barrier = { ...door.rooms[`${REF}:room/clearing`].exits.north.to, kind: 'barrier' };
  barrier.key = 'door';
  door.barriers = {
    [`${REF}:barrier/door`]: {
      key: 'door',
      keywords: ['door'],
      short: 'item.fur.short',
      initial: 'closed',
    },
  };
  door.lock.capabilities.barrier = 1;
  door.rooms[`${REF}:room/clearing`].exits.north.barrier = barrier;
  door.rooms[`${REF}:room/burrow`].exits.south.barrier = barrier;
  assert.equal(hunt(68101, door), 'thicket');
});

// Breaks: the hold dropped (the hunter leaves north along the fresh trail, away from the player).
test("a hunter in the player's room holds even on a fresh trail", () => {
  let w = to(start(), 68101);
  w = play(w, { type: 'move', direction: 'north' });
  w = play(w, { type: 'move', direction: 'south' });
  assert.deepEqual(trails(w, 'trail_')['clearing'].slice(-2), ['north', 68101]);
  w = to(w, 68401);
  assert.equal(where(w, member(w, 'hunters')), 'clearing');
});

// Breaks: trail ops written without the opt-in (a byte change for every older cartridge).
test('without hunts the player leaves no trail; without trail a wander writes none', () => {
  const r = load((c) => {
    for (const p of Object.values(c.populations) as any[]) (delete p.trail, delete p.hunts);
    for (const f of Object.keys(c.facts)) if (f.includes('/trail_')) delete c.facts[f];
    c.recipes = {};
    delete c.world.trails;
  });
  assert.ok(r.ok, JSON.stringify(r));
  let w = play(start(r.cartridge as Cartridge), { type: 'move', direction: 'north' });
  w = to(w, 68401);
  assert.deepEqual([w.state.facts ?? {}, trails(w, 'trail_')], [{}, {}]);
});

const fact = (k: string) => `${REF}:fact/${k}`;
const recipe = (k: string) => `${REF}:recipe/${k}`;
/** The loader's first diagnostic for the sampler after `change`. */
function refused(change: (c: any) => void) {
  const r = load(change);
  assert.equal(r.ok, false);
  const { code, path, data } = (r as { diagnostic: { code: string; path: string; data?: object } })
    .diagnostic;
  return [code, path, data];
}
const hounds = `.cartridge.populations["${REF}:population/hounds"]`;

// Breaks: each loader check dropped (the cartridge loads) or reporting another path.
test('the loader refuses each bad trail declaration', () => {
  const cases: [(c: any) => void, unknown[]][] = [
    [
      (c) => (c.manifest.requires.kernel_api.at_least = '1.84'),
      ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least', {}],
    ],
    [(c) => (c.facts[fact('trail_hounds_exit')].meaning = 'Mine.'), ['RESERVED_FACT']],
    [
      (c) => {
        const seq = c.recipes[recipe('track_clearing')].outcomes.success.sequence;
        seq.push({ ...structuredClone(seq[0]), value: 1 });
        seq[1].fact.key = 'trail_hounds_at';
      },
      ['RESERVED_FACT'],
    ],
    [
      (c) => delete c.world.trails.leads.north,
      ['UNRESOLVED_REFERENCE', '.cartridge.world.trails.leads', { target: 'north' }],
    ],
    [
      (c) => (c.world.trails.leads.north = 'trail.lead.nowhere'),
      [
        'UNRESOLVED_REFERENCE',
        '.cartridge.world.trails.leads.north',
        { target: 'trail.lead.nowhere' },
      ],
    ],
    [
      (c) => (c.recipes[recipe('track_burrow')].check.plan = 'hunters'),
      [
        'UNRESOLVED_REFERENCE',
        `.cartridge.recipes["${REF}:recipe/track_burrow"].check.plan`,
        { target: 'hunters' },
      ],
    ],
    [
      (c) => delete c.world.trails,
      ['UNRESOLVED_REFERENCE', `${hounds}.trail`, { target: 'trails' }],
    ],
  ];
  for (const [change, want] of cases)
    assert.deepEqual(refused(change).slice(0, want.length), want, String(change));
});

// Breaks: facts_typed admitting a room subject for any fact (rooms are subjects of the engine's
// trail facts only), or refusing the trail rows.
test('facts_typed admits a room subject for trail facts only', () => {
  const w = to(start(), 68401);
  assert.ok(holds('facts_typed', w));
  const [k, v] = Object.entries(w.state.facts!).find(([k]) => k.includes('trail_hounds_exit'))!;
  const scent = structuredClone(w.cartridge) as any;
  scent.facts[fact('scent')] = {
    ...scent.facts[fact('trail_hounds_exit')],
    key: 'scent',
    meaning: 'Authored, per subject.',
  };
  const as = (row: string) => ({
    ...w,
    cartridge: scent,
    state: { ...w.state, facts: { [row]: v } },
  });
  assert.ok(
    holds(
      'facts_typed',
      as(
        k
          .replace('trail_hounds_exit', 'scent')
          .replace(/"subject_id":"[^"]*"/, `"subject_id":"${member(w, 'hounds')}"`),
      ),
    ),
  );
  assert.equal(holds('facts_typed', as(k.replace('trail_hounds_exit', 'scent'))), false);
});
