// Toolbox row G3 on the compiled NPC status sampler: the dart corridor poisons a scheduled guard
// per tick, a stone golem immune to poison takes nothing, a dropped torch sets a door burning,
// and the tick and expiry events reach reactions.
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
import { key } from '../src/foundation/compose.ts';
import { encode } from '../src/foundation/canonical.ts';
import { value } from '../src/mechanics/fact.ts';
import { applyStatus } from '../src/mechanics/status/shared.ts';
import { runStatus } from '../src/mechanics/status/job.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-npc-status-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/npc_status_sampler', file], {
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
const C = 'npc_status_sampler@0.0.1';
const ref = (kind: string, k: string) =>
  ({ cartridge_id: C.split('@')[0], cartridge_version: '0.0.1', kind, key: k }) as never;
const fresh = (c: Cartridge = content) =>
  newWorld(c, '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]);
const id = (w: World, kind: string, k: string) => w.entityIds[`${C}:${kind}/${k}`]!;
const hp = (w: World, npc: string) => level(w, id(w, 'npc', npc), resourceRef(w, 'hp'));
const row = (w: World, kind: string, k: string, status: string) =>
  w.state.statuses?.[
    key({ kind: 'status', body_id: id(w, kind, k), status: ref('status', status) })
  ];
const fact = (w: World, k: string) => value(w, w.character, ref('fact', k));
// The sampler with `name`'s reaction given one more step.
const plus = (name: string, extra: object) => {
  const k = `${C}:reaction/${name}`;
  const r = content.reactions![k]!;
  return {
    ...content,
    reactions: { ...content.reactions, [k]: { ...r, apply: [...r.apply, extra] } },
  } as Cartridge;
};
let n = 0;
const narration: string[] = [];
function play(w: World, p: object): World {
  n += 1;
  const r = step(
    w,
    {
      id: `cccccccc-4444-4333-8444-${String(n).padStart(12, '0')}` as never,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...p } as never,
    },
    n,
  );
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
}
// A chain of bounded elapsed commands, each to the earliest pending job (status.test.ts wait).
function wait(w: World, seconds: number): World {
  const target = w.state.clock + seconds;
  while (w.state.clock < target) {
    n += 1;
    const until = Object.values(w.state.jobs ?? {})
      .filter((j) => j.status === 'pending')
      .reduce((t, j) => Math.min(t, j.due_time), target);
    const run_id = 'aaaaaaaa-0000-4000-8000-000000000010';
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
    if (r.decision.kind === 'accepted')
      narration.push(...(r.decision.narration ?? []).map((t) => t.key as string));
    w = r.world;
  }
  return w;
}

// Breaks: status.apply skipping a non-player subject (row 1's rule), a tick job that only reads
// world.body, an immune list ignored, a tick that never emits status_ticked, or the guard's
// lines narrated to the player.
test('the dart poisons the scheduled guard per tick; the immune golem takes nothing', () => {
  narration.length = 0;
  let w = wait(fresh(), 3600); // 06:00 to 07:00: both walk into the dart corridor
  assert.equal(row(w, 'npc', 'guard', 'poison')?.active, true);
  assert.equal(row(w, 'npc', 'golem', 'poison'), undefined);
  assert.equal(fact(w, 'groaned'), false);
  w = wait(w, 60);
  assert.equal(hp(w, 'guard'), 9);
  assert.equal(fact(w, 'groaned'), true);
  w = wait(w, 240); // ticks at +60, +120, +180, +240; the job at +300 expires without one
  assert.equal(hp(w, 'guard'), 6);
  assert.equal(row(w, 'npc', 'guard', 'poison')?.active, false);
  assert.equal(hp(w, 'golem'), 10);
  assert.deepEqual(narration, []);
});

// Breaks: an item holder refused by the composer, a step's `item` ignored, an item tick
// draining a pool it does not have, or status_expired never reaching a reaction.
test('a dropped torch sets the door burning until it burns out', () => {
  let w = play(fresh(), { type: 'take', item_id: id(fresh(), 'item', 'torch') });
  w = play(w, { type: 'move', direction: 'north' });
  w = play(w, { type: 'drop', item_id: id(w, 'item', 'torch') });
  assert.equal(row(w, 'item', 'door', 'burning')?.active, true);
  w = wait(w, 120);
  assert.equal(fact(w, 'charred'), false);
  const door = key({
    kind: 'resource',
    resource: resourceRef(w, 'hp'),
    entity_id: id(w, 'item', 'door'),
  });
  assert.equal(w.state.resources?.[door], undefined);
  w = wait(w, 60);
  assert.equal(row(w, 'item', 'door', 'burning')?.active, false);
  assert.equal(fact(w, 'charred'), true);
});

// Breaks: an NPC's fatal tick passing the player as owner (death faults), or the NPC's other
// status left active on the dead body (death clears only the player's).
test('a fatal tick kills the guard and ends its other status', () => {
  const guard = content.npcs![`${C}:npc/guard`]!;
  const dart = content.reactions![`${C}:reaction/dart`]!;
  const burning = { op: 'status.apply', status: ref('status', 'burning') } as const;
  const frail = {
    ...content,
    npcs: { ...content.npcs, [`${C}:npc/guard`]: { ...guard, hp: { ...guard.hp!, start: 2 } } },
    reactions: {
      ...content.reactions,
      [`${C}:reaction/dart`]: { ...dart, apply: [...dart.apply, burning] },
    },
  } as Cartridge;
  // Poison and burning each take 1 at +60: the second brings hp to 0, whichever runs first.
  const w = wait(fresh(frail), 3600 + 60);
  assert.equal(hp(w, 'guard'), 0);
  assert.equal(row(w, 'npc', 'guard', 'poison')?.active, false);
  assert.equal(row(w, 'npc', 'guard', 'burning')?.active, false);
  const corpses = Object.values(w.state.created ?? {}).filter((c) => c.origin.kind === 'death');
  assert.equal(corpses.length, 1);
  // Breaks: a dead NPC taking a fresh status (an entity_died reaction's subject is the victim).
  assert.deepEqual(
    applyStatus(w, id(w, 'npc', 'guard'), ref('status', 'poison'), 1, () => 'x'),
    [],
  );
});

// Breaks: a reaction's status.apply on a ticking or expiring holder written in its own writer
// group, so the elapsed command faults conflicting_write and time cannot advance (mechanics.md G3).
test('a tick re-poisons the guard', () => {
  const poison = { op: 'status.apply', status: ref('status', 'poison') };
  let w = wait(fresh(plus('groan', poison)), 3600 + 60);
  assert.equal(hp(w, 'guard'), 9);
  assert.equal(
    (row(w, 'npc', 'guard', 'poison') as { ends_at: number }).ends_at,
    w.state.clock + 300,
  );
  w = wait(w, 240); // the first application would have expired here
  assert.equal(hp(w, 'guard'), 5);
  assert.equal(row(w, 'npc', 'guard', 'poison')?.active, true);
});

// Breaks: as above, on an expiry: the reaction re-setting the door's status faults.
test('an expiry re-sets the door burning', () => {
  let d = fresh(plus('charred', { op: 'status.apply', status: ref('status', 'burning') }));
  d = play(d, { type: 'take', item_id: id(d, 'item', 'torch') });
  d = play(d, { type: 'move', direction: 'north' });
  d = play(d, { type: 'drop', item_id: id(d, 'item', 'torch') });
  d = wait(d, 180);
  assert.equal(fact(d, 'charred'), true);
  const burning = row(d, 'item', 'door', 'burning');
  assert.deepEqual([burning?.active, burning?.generation], [true, 2]);
  assert.equal(d.state.jobs?.[(burning as { job_id: string }).job_id]?.status, 'pending');
});

// Breaks: a rule's second status.apply of one status skipped although it names another holder.
test('one rule burns the door and the torch', () => {
  const torch = {
    op: 'status.apply',
    status: ref('status', 'burning'),
    item: ref('item', 'torch'),
  };
  let w = fresh(plus('kindle', torch));
  w = play(w, { type: 'take', item_id: id(w, 'item', 'torch') });
  w = play(w, { type: 'move', direction: 'north' });
  w = play(w, { type: 'drop', item_id: id(w, 'item', 'torch') });
  assert.equal(row(w, 'item', 'door', 'burning')?.active, true);
  assert.equal(row(w, 'item', 'torch', 'burning')?.active, true);
});

// Breaks: a status death closing a pack's fight when one member falls, or leaving a lone NPC's
// fight open on its dead body (job.ts, as combat's fatal round).
test('a fatal tick ends a lone fight but not a pack fight', () => {
  const guard = content.npcs![`${C}:npc/guard`]!;
  const frail = {
    ...content,
    npcs: { ...content.npcs, [`${C}:npc/guard`]: { ...guard, hp: { ...guard.hp!, start: 1 } } },
  } as Cartridge;
  const w = wait(fresh(frail), 3600);
  const g = id(w, 'npc', 'guard');
  const job_id = (row(w, 'npc', 'guard', 'poison') as { job_id: string }).job_id as never;
  const E = 'dddddddd-0000-4000-8000-000000000001';
  const closes = (active_ids: string[]) => {
    const encounter = {
      character_id: w.character,
      body_id: w.body,
      npc_id: g,
      room_id: w.roomIds[`${C}:room/dart_room`],
      job_id: 'dddddddd-0000-4000-8000-000000000004',
      status: 'open',
      round: 1,
      active_ids,
      next_opponent_id: g,
    };
    const fight = {
      ...w,
      state: {
        ...w.state,
        encounters: { [E]: encounter },
        jobs: {
          ...w.state.jobs,
          [encounter.job_id]: { ...w.state.jobs![job_id]!, encounter_id: E },
        },
      },
    } as never;
    const r = runStatus(fight, { id: 'x' as never }, job_id, w.state.jobs![job_id]!, () => 'y');
    assert.equal(r.kind, 'accepted');
    return r.kind === 'accepted' && r.delta.ops.some((o) => o.op === 'encounter.close');
  };
  assert.equal(closes([g]), true);
  assert.equal(closes([g, id(w, 'npc', 'golem')].sort()), false);
});

// Breaks: the loader drops a G3 check, so an artifact naming no status or item, or a G3 field
// under an older kernel_api, loads and fails in play.
test('the loader refuses each unsound G3 declaration', () => {
  const source = JSON.parse(new TextDecoder().decode(artifact)).cartridge;
  const golem = `${C}:npc/golem`;
  const kindle = `.cartridge.reactions[${JSON.stringify(`${C}:reaction/kindle`)}]`;
  const rows: [(c: any) => void, string, string][] = [
    [
      (c) => (c.npcs[golem].immune[0].key = 'plague'),
      'UNRESOLVED_REFERENCE',
      `.cartridge.npcs[${JSON.stringify(golem)}].immune[0]`,
    ],
    [
      (c) => (c.items[`${C}:item/torch`].immune = [{ ...c.npcs[golem].immune[0], key: 'plague' }]),
      'UNRESOLVED_REFERENCE',
      `.cartridge.items[${JSON.stringify(`${C}:item/torch`)}].immune[0]`,
    ],
    [
      (c) => (c.reactions[`${C}:reaction/kindle`].apply[0].item.key = 'gate'),
      'UNRESOLVED_REFERENCE',
      `${kindle}.apply[0].item`,
    ],
    [
      (c) => (c.reactions[`${C}:reaction/groan`].on.status.key = 'plague'),
      'UNRESOLVED_REFERENCE',
      `.cartridge.reactions[${JSON.stringify(`${C}:reaction/groan`)}].on.status`,
    ],
    [
      (c) => (c.manifest.requires.kernel_api.at_least = '1.45'),
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
