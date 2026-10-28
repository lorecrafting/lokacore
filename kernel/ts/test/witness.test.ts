// Toolbox row FD5 (loka-kgd.142) on the compiled rivals sampler: a reaction's `witness` filter holds
// when the named NPC is alive in the event subject's room and sees the subject (not blind, the
// subject not concealed from it unless pierced_by lets it see through); the loader's checks.
// Expected values hand-written.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { INSTALLED, loadCartridge, newWorld, step } from '../src/index.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import type { EntityId } from '../src/contracts.gen.ts';
import { decode } from '../src/foundation/canonical.ts';
import { statusKey } from '../src/mechanics/status/shared.ts';
import { triggered } from '../src/mechanics/reaction.ts';
import { cartridgeOf, verdict } from './harness.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-witness-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/rivals_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const loaded = loadCartridge(artifact, INSTALLED);
assert.ok(loaded.ok, JSON.stringify(loaded));
const S = 'rivals_sampler@0.0.1';
const ref = (kind: string, key: string) => ({
  cartridge_id: 'rivals_sampler',
  cartridge_version: '0.0.1',
  kind,
  key,
});
const status = (key: string, extra: object) => ({
  key,
  duration: 600,
  tick_every: 60,
  resource: ref('resource', 'hp'),
  label: `condition.${key}`,
  narration: { applied: 'x', tick: 'x', expired: 'x' },
  ...extra,
});
// The sampler plus a hidden and a blind status and the stealth skill they need (test-side only).
const content = {
  ...(loaded.cartridge as Cartridge),
  statuses: {
    [`${S}:status/blind`]: status('blind', { perception: { sight: 'blind' } }),
    [`${S}:status/hidden`]: status('hidden', {
      concealment: 'hidden',
      pierced_by: { skill: ref('skill', 'stealth'), attribute: ref('attribute', 'alertness') },
    }),
  },
  skills: { [`${S}:skill/stealth`]: { growth: [] } },
  facts: {
    ...(loaded.cartridge as Cartridge).facts,
    [`${S}:fact/skill_stealth`]: {
      key: 'skill_stealth',
      value_type: { type: 'bool', default: false },
      scopes: ['player'],
    },
  },
} as unknown as Cartridge;
const CONTEXT = '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f';
const id = (w: World, k: string) => w.entityIds[`${S}:${k}`] as EntityId;

// A world with the baker in `room` (the sampler places him in the mill), edited by `edit`.
const world = (room: string, edit: (w: World, baker: EntityId) => World = (w) => w) => {
  const w = newWorld(content, CONTEXT as never, [1, 2, 3, 4]);
  const baker = id(w, 'npc/baker');
  const containers = { ...w.state.containers, [baker]: w.roomIds[`${S}:room/${room}`]! };
  return edit({ ...w, state: { ...w.state, containers } } as World, baker);
};
const active = (w: World, body: EntityId, key: string) =>
  ({
    ...w,
    state: {
      ...w.state,
      statuses: {
        ...w.state.statuses,
        [statusKey(body, ref('status', key) as never)]: { generation: 1, active: true },
      },
    },
  }) as World;

let n = 0;
let changes = 0;
const act = (w: World, p: object) => {
  n += 1;
  const s = step(
    w,
    {
      id: `cccccccc-5555-4333-8444-${String(n).padStart(12, '0')}`,
      world_context_id: w.context,
      payload: { actor_id: w.character, ...p },
    } as never,
    n,
  );
  assert.equal(s.decision.kind, 'accepted', JSON.stringify(s.decision));
  const events = (s.decision as never as { events: { payload: Record<string, any> }[] }).events;
  changes += events.filter((e) => e.payload.fact?.key === 'gratitude').length;
  return s.world;
};
const take = (w: World) => act(w, { type: 'take', item_id: id(w, 'item/apple') });
const grateful = (w: World) =>
  Object.entries(w.state.facts ?? {}).flatMap(([k, v]) => {
    const row = decode(k) as any;
    return row.fact.key === 'gratitude' ? [[row.subject_id, row.scope.kind, v]] : [];
  });

// Breaks: the filter ignored (the baker in the mill grateful), the subject's room or the witness's
// sight not read, or the step writing at the body instead of the named NPC.
test('the baker who sees the apple taken is grateful; in the mill or blind he is not', () => {
  changes = 0;
  let w = take(world('square'));
  w = act(w, { type: 'give', item_id: id(w, 'item/apple'), recipient_id: id(w, 'npc/smith') });
  assert.deepEqual(grateful(w), [[id(w, 'npc/baker'), 'player', true]]);
  assert.equal(changes, 1); // the give, seen too, re-asserts it unchanged
  assert.deepEqual(grateful(take(world('mill'))), []);
  assert.deepEqual(grateful(take(world('square', (w, baker) => active(w, baker, 'blind')))), []);
});

// Breaks: concealment not read (a hidden taker seen), or pierced_by not applied (an alert witness,
// alertness 2 over stealth level 0, still blind to him).
test('a hidden taker is unseen unless the baker is alert enough to pierce it', () => {
  const hidden = (w: World) => active(w, w.body, 'hidden');
  assert.deepEqual(grateful(take(world('square', hidden))), []);
  const alert = (w: World, baker: EntityId) => {
    const e = {
      ...w.entities[baker],
      attributes: [{ attribute: ref('attribute', 'alertness'), value: 2 }],
    };
    return hidden({ ...w, entities: { ...w.entities, [baker]: e } } as World);
  };
  const w = take(world('square', alert));
  assert.deepEqual(grateful(w), [[id(w, 'npc/baker'), 'player', true]]);
});

// Breaks: a named npc.move with no room reading the NPC's own room instead of the event subject's
// (item_acquired carries no room_id), so the baker never leaves the mill.
test('an npc.move naming the baker and no room brings him to the taker', () => {
  const rule = `${S}:reaction/witnessed`;
  const reactions = (content as any).reactions;
  const on = { event: 'item_acquired', item: ref('item', 'apple') };
  const apply = [{ op: 'npc.move', npc: ref('npc', 'baker') }];
  const moving = {
    ...content,
    reactions: { ...reactions, [rule]: { ...reactions[rule], on, apply } },
  };
  let w = newWorld(moving as Cartridge, CONTEXT as never, [1, 2, 3, 4]);
  w = take(w);
  assert.equal(w.state.containers[id(w, 'npc/baker')], w.roomIds[`${S}:room/square`]);
});

// Breaks: the subject counted as its own witness (the baker taking the apple, or a victim alive in
// the pre-command world, sees itself).
test('the baker is never his own witness', () => {
  const w = world('square');
  const got = (holder_id: EntityId) =>
    triggered(w, {
      payload: { type: 'item_acquired', item_id: id(w, 'item/apple'), holder_id },
    } as never).some((r) => r.key === 'witnessed');
  assert.equal(got(w.body), true);
  assert.equal(got(id(w, 'npc/baker')), false);
});

const base = cartridgeOf(artifact);

// Breaks: the loader's witness reference, spawn-template check, 1.95 floor or the npc.move step's
// checks skipped (twin of test/loka/content_witness_test.exs).
test('the loader refuses a template witness, a pre-1.95 manifest and a bad npc.move', () => {
  const rule = `.cartridge.reactions["${S}:reaction/witnessed"]`;
  const on = (c: any) => c.reactions[`${S}:reaction/witnessed`].on;
  const move = (s: object) => (c: any) =>
    (c.reactions[`${S}:reaction/witnessed`].apply = [{ op: 'npc.move', ...s }]);
  assert.equal(
    verdict(base, () => {}),
    'loaded',
  );
  assert.deepEqual(
    verdict(base, (c) => (c.npcs[`${S}:npc/baker`].spawn_template = true)),
    ['SCHEMA_VIOLATION', `${rule}.on.witness`],
  );
  assert.deepEqual(
    verdict(base, (c) => (on(c).witness = { ...on(c).witness, key: 'ghost' })),
    ['UNRESOLVED_REFERENCE', `${rule}.on.witness`],
  );
  assert.deepEqual(
    verdict(base, (c) => (c.manifest.requires.kernel_api.at_least = '1.94')),
    ['KERNEL_API_RANGE_INVALID', '.cartridge.manifest.requires.kernel_api.at_least'],
  );
  assert.deepEqual(verdict(base, move({ npc: ref('npc', 'baker'), room: ref('room', 'attic') })), [
    'UNRESOLVED_REFERENCE',
    `${rule}.apply[0].room`,
  ]);
  assert.deepEqual(
    verdict(base, (c) => {
      move({ npc: ref('npc', 'baker') })(c);
      c.npcs[`${S}:npc/baker`].spawn_template = true;
      delete on(c).witness;
    }),
    ['SCHEMA_VIOLATION', `${rule}.apply[0].npc`],
  );
});
