// Toolbox row 4 on the compiled levelling sampler: rats grant 10 experience each, level 2 at 30
// grants one point, Raise spends it, and the quest reward grants 20 (mechanics.md row 4).
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
import { resolve } from '../src/commands/invocation.ts';
import { derived } from '../src/mechanics/attributes/shared.ts';
import { oneWrite } from '../src/mechanics/levelling/shared.ts';
import { decide } from '../src/mechanics/attributes/rule.ts';
import { gameView } from '../src/view/view.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-levelling-sampler-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/levelling_sampler', file], {
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
const LEVEL_UP = 'levelling.level_up';
const attr = (key: string) => ({
  cartridge_id: 'levelling_sampler',
  cartridge_version: '0.0.1',
  kind: 'attribute',
  key,
});
let n = 0;
const id = () => `dddddddd-6666-4666-8666-${String(++n).padStart(12, '0')}` as never;
function play(w: World, p: object, action?: string) {
  const command = {
    id: id(),
    world_context_id: w.context,
    payload: { actor_id: w.character, ...p },
  };
  const r = step(w, command as never, n, action as never);
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r;
}
function wait(w: World, seconds: number) {
  const run_id = `aaaaaaaa-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const until = w.state.clock + seconds;
  const r = stepElapsed(
    w,
    {
      id: elapsedCommandId(run_id, w.context, w.state.clock, until) as never,
      world_context_id: w.context,
      payload: { type: 'elapsed', actor_id: w.character, run_id, from: w.state.clock, until },
    } as never,
    n,
  );
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r;
}
const narration = (r: { decision: object }) =>
  ((r.decision as { narration?: { key: string }[] }).narration ?? []).map((t) => t.key);
const fresh = (c: Cartridge = content) =>
  newWorld(c, '2d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]);
/** One rat in the pit killed in one round; the step and the world after it. */
function kill(w: World, rat: string) {
  const target_id = w.entityIds[`levelling_sampler@0.0.1:npc/${rat}`];
  return wait(play(w, { type: 'attack', target_id }).world, 150);
}
/** Three rats killed from the pit, and the step of the third kill. */
function cull(c: Cartridge = content) {
  let w = play(fresh(c), { type: 'move', direction: 'east' }).world;
  w = kill(kill(w, 'rat_a').world, 'rat_b').world;
  const two = gameView(w);
  const third = kill(w, 'rat_c');
  return { two, third, w: third.world };
}
/** The raise_attribute invocation taken from the GameView, resolved and stepped with its key. */
function raise(w: World, key: string) {
  const offered = gameView(w).actions.find((a) => a.action_key === 'raise_attribute');
  assert.ok(offered, 'raise_attribute offered');
  const invocation = {
    invocation_id: id(),
    actor_id: w.character,
    action_key: offered.action_key,
    target_ids: [],
    input: { attribute: attr(key) },
  };
  const command = resolve(w, { invocation, command_id: id() } as never);
  assert.ok(!('kind' in command), JSON.stringify(command));
  return play(w, command.payload, offered.action_key);
}
const hp = (w: World) => {
  const { current, maximum } = gameView(w).resources!.find((r) => r.resource.key === 'hp')!;
  return [current, maximum];
};

// Breaks: kill credit grants nothing or the wrong amount, the level counts a threshold above the
// experience (or misses the one at it), the level grants no point, Raise is offered without a
// point, or the level-up line is dropped from the killing step (or emitted by an earlier kill).
test('three rat kills reach level 2 with one point and narrate the level-up once', () => {
  const { two, third, w } = cull();
  assert.deepEqual(two.levelling, { level: 1, experience: 20, next: 30, unspent: 0 });
  assert.ok(!two.actions.some((a) => a.action_key === 'raise_attribute'));
  assert.deepEqual(gameView(w).levelling, { level: 2, experience: 30, next: 100, unspent: 1 });
  assert.equal(narration(third).filter((k) => k === LEVEL_UP).length, 1);
});

// Breaks: value() ignores allocated points (damage stays +0), Raise keeps the point, a spent point
// is still offered, a forged Raise without points is accepted, or Raise narrates a level-up.
test('Raise STR spends the point, raises the derived damage by 1 and is then refused', () => {
  const { w } = cull();
  const damage = (x: World) => derived(x, x.character, x.cartridge.world!.derived!.damage!);
  assert.equal(damage(w), 0);
  const raised = raise(w, 'str');
  assert.equal(narration(raised).includes(LEVEL_UP), false);
  assert.equal(damage(raised.world), 1);
  const view = gameView(raised.world);
  assert.deepEqual(view.levelling, { level: 2, experience: 30, next: 100, unspent: 0 });
  assert.equal(view.attributes!.find((a) => a.attribute.key === 'str')!.value, 11);
  assert.ok(!view.actions.some((a) => a.action_key === 'raise_attribute'));
  const command = {
    id: id(),
    world_context_id: raised.world.context,
    payload: { type: 'raise_attribute', actor_id: raised.world.character, attribute: attr('str') },
  };
  const forged = step(raised.world, command as never, n, 'raise_attribute' as never);
  assert.notEqual(forged.decision.kind, 'accepted');
  // The rule itself keeps the points within the grant: composition does not (mechanics.md row 4).
  const ruled = decide(raised.world, command as never, undefined as never);
  assert.deepEqual(ruled.kind === 'rejected' && ruled.error.code, 'invalid_state');
});

// Breaks (PM ruling, loka-kgd.11): Raise CON writes no zero-amount hp settle first, so the 4 hours
// banked at full hp 10/10 are granted by the raised maximum at once (11/11 instead of 10/11).
test('Raise CON after 4 h idle at full hp keeps hp 10 of 11, then regenerates from there', () => {
  let w = wait(cull().w, 4 * 3600).world;
  assert.deepEqual(hp(w), [10, 10]);
  w = raise(w, 'con').world;
  assert.deepEqual(hp(w), [10, 11]);
  assert.deepEqual(hp(wait(w, 3600).world), [11, 11]);
});

// Breaks: the experience.grant step on the quest's quest_resolved reaction writes nothing, or a
// level reached by a reaction write is not narrated on the step that caused it.
test('resolving the den quest grants 20 experience; after two kills it narrates level 2', () => {
  const accept = (w: World) =>
    play(w, { type: 'accept_quest', quest: { ...attr('cull'), kind: 'quest' } }, 'cull');
  const den = (w: World) => play(accept(w).world, { type: 'move', direction: 'west' });
  const quest = den(fresh());
  assert.deepEqual(gameView(quest.world).levelling, {
    level: 1,
    experience: 20,
    next: 30,
    unspent: 0,
  });
  assert.equal(narration(quest).includes(LEVEL_UP), false);
  let w = play(fresh(), { type: 'move', direction: 'east' }).world;
  w = kill(kill(w, 'rat_a').world, 'rat_b').world;
  w = play(w, { type: 'move', direction: 'west' }).world;
  const up = den(w);
  assert.deepEqual(gameView(up.world).levelling, {
    level: 2,
    experience: 40,
    next: 100,
    unspent: 1,
  });
  assert.ok(narration(up).includes(LEVEL_UP));
});

// Breaks: the loader drops a levelling check, so an artifact with an old API floor, no
// attributes@1, non-rising thresholds, an unknown NPC or text, or a grant without world.levelling
// loads and fails in play. Equal thresholds catch `<` for `<=`.
test('the loader refuses each unsound levelling declaration', () => {
  const source = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  const at = '.cartridge.world.levelling';
  const api = '.cartridge.manifest.requires.kernel_api.at_least';
  const grant = '.cartridge.reactions["levelling_sampler@0.0.1:reaction/cull_reward"].apply[0].op';
  const rows: [(c: any) => void, string, string][] = [
    [(c) => (c.manifest.requires.kernel_api.at_least = '1.41'), 'KERNEL_API_RANGE_INVALID', api],
    [
      (c) => {
        c.manifest.requires.kernel_api.at_least = '1.41';
        delete c.world.levelling;
      },
      'KERNEL_API_RANGE_INVALID',
      api,
    ],
    [(c) => delete c.world.levelling, 'SCHEMA_VIOLATION', grant],
    [
      (c) => {
        delete c.manifest.requires.capabilities.attributes;
        delete c.lock.capabilities.attributes;
        delete c.attributes;
        delete c.world.derived;
      },
      'UNDECLARED_CAPABILITY',
      at,
    ],
    [(c) => (c.world.levelling.thresholds = [30, 30]), 'SCHEMA_VIOLATION', `${at}.thresholds[1]`],
    [(c) => (c.world.levelling.thresholds = [30, 20]), 'SCHEMA_VIOLATION', `${at}.thresholds[1]`],
    [
      (c) => (c.world.levelling.kills[1].npc.key = 'wolf'),
      'UNRESOLVED_REFERENCE',
      `${at}.kills[1].npc`,
    ],
    [
      (c) => (c.world.levelling.level_up = 'levelling.missing'),
      'UNRESOLVED_REFERENCE',
      `${at}.level_up`,
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
    assert.deepEqual(r.ok ? 'loaded' : [r.diagnostic.code, r.diagnostic.path], [code, path], path);
  }
});

/** The sampler with its loaded levelling declaration changed by `change`. */
function variant(change: (l: any) => void) {
  const c = structuredClone(content);
  change(c.world!.levelling!);
  return c;
}

// Breaks (#344 review, finding 1): credit matches any kills entry, so a kill of an NPC the
// cartridge does not list still grants experience.
test('killing an NPC that kills does not list leaves experience unchanged', () => {
  const { w } = cull(variant((l) => (l.kills = l.kills.filter((k: any) => k.npc.key !== 'rat_c'))));
  assert.deepEqual(gameView(w).levelling, { level: 1, experience: 20, next: 30, unspent: 0 });
});

// Breaks (#344 review, finding 2): unspent ignores points_per_level (one point per level).
test('a level with points_per_level 2 grants two unspent points', () => {
  const { w } = cull(variant((l) => (l.points_per_level = 2)));
  assert.equal(gameView(w).levelling!.unspent, 2);
});

// Breaks (#344 review, finding 3): Raise accepts an attribute the cartridge does not declare and
// spends the point on it.
test('a forged Raise of an unknown attribute is refused not_found and keeps the point', () => {
  const { w } = cull();
  const command = {
    id: id(),
    world_context_id: w.context,
    payload: { type: 'raise_attribute', actor_id: w.character, attribute: attr('luck') },
  };
  const r = step(w, command as never, n, 'raise_attribute' as never);
  assert.equal(r.decision.kind === 'rejected' && r.decision.error.code, 'not_found');
  assert.equal(gameView(r.world).levelling!.unspent, 1);
});

// Breaks (#344 review, finding 4): a kill grant past the ResourceInt maximum does not saturate.
test('experience saturates at the ResourceInt maximum', () => {
  const max = 2147483647;
  const c = variant((l) => (l.kills[0].experience = max));
  const w = kill(play(fresh(c), { type: 'move', direction: 'east' }).world, 'rat_a').world;
  assert.equal(gameView(kill(w, 'rat_b').world).levelling!.experience, max);
});

// Breaks (#344 batch review, finding 1): the kill grant (fatal group) and the quest reward
// (reaction group) each write the levelling row, so the killing step faults conflicting_write.
test('a kill that also resolves a rewarding quest writes experience once and levels up once', () => {
  const c: any = structuredClone(content);
  const ref = (kind: string, key: string) => ({ ...attr(key), kind });
  c.world.death_credit = [
    { npc: ref('npc', 'rat_a'), room: ref('room', 'pit'), fact: ref('fact', 'den_found') },
  ];
  let w = play(fresh(c), { type: 'accept_quest', quest: ref('quest', 'cull') }, 'cull').world;
  w = play(w, { type: 'move', direction: 'east' }).world;
  const r = kill(w, 'rat_a');
  assert.ok(r.decision.kind === 'accepted');
  assert.deepEqual(
    r.decision.delta.ops.flatMap((o) => (o.op === 'levelling.set' ? [[o.expected, o.value]] : [])),
    [[null, { experience: 30, allocated: {} }]],
  );
  assert.deepEqual(gameView(r.world).levelling, {
    level: 2,
    experience: 30,
    next: 100,
    unspent: 1,
  });
  assert.equal(narration(r).filter((k) => k === LEVEL_UP).length, 1);
});

// Breaks: several credited kills in one decision (fatal groups 1 and 2, not reachable in play
// while Attack is single-opponent) keep one write each, or the collapse merges across characters
// or keeps the last write's own expected instead of the row before the first write.
test('one levelling write per character keeps the last value and the first expected', () => {
  const [a, b] = ['a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002'];
  const row = (experience: number) => ({ experience, allocated: {} });
  const set = (g: number, c: string, from: number | null, to: number) => ({
    op: 'levelling.set' as const,
    writer_group: g,
    character_id: c as never,
    expected: from === null ? null : row(from),
    value: row(to),
  });
  const other = { op: 'time.advance', writer_group: 0, from: 0, to: 1 } as never;
  assert.deepEqual(
    oneWrite([set(1, a, null, 10), other, set(1, b, 5, 15), set(2, a, 10, 20), set(3, a, 20, 40)]),
    [other, set(1, b, 5, 15), set(3, a, null, 40)],
  );
});
