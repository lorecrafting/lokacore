// Toolbox row 41 (decay) on the compiled decay sampler: a fish spoils a day after it is taken and
// goes to the sealed midden, which restocks the market every 5000 s; smoked fish is immune; a
// dropped rag rots in an hour and is swept unless held. Expected values are hand-derived from the
// sampler's literals (86400, 3600, 5000).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { newWorld, step, stepElapsed } from '../src/index.ts';
import { elapsedCommandId } from '../src/foundation/id_source.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import type { EntityId } from '../src/contracts.gen.ts';
import { activeStatuses } from '../src/mechanics/status/shared.ts';
import { moveItem } from '../src/mechanics/containment/react.ts';
import { uses } from '../src/content/cartridge_reactions.ts';
import { cartridgeOf, commands, ctx, reload } from './harness.ts';

const scratch = mkdtempSync(join(tmpdir(), 'loka-decay-'));
let artifact: Uint8Array;
try {
  const file = join(scratch, 'artifact.json');
  execFileSync('mix', ['loka.compile', 'cartridges/decay_sampler', file], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    stdio: 'pipe',
  });
  artifact = readFileSync(file);
} finally {
  rmSync(scratch, { recursive: true });
}
const S = 'decay_sampler@0.0.1:';
const ref = (kind: string, key: string) => ({
  cartridge_id: 'decay_sampler',
  cartridge_version: '0.0.1',
  kind,
  key,
});
const base = cartridgeOf(artifact);
const content = (edit?: (c: any) => void) => {
  const loaded = reload(base, edit);
  assert.ok(loaded.ok, JSON.stringify(loaded));
  return loaded.cartridge as Cartridge;
};

const stream = commands('dddddddd-4444-4444-8444');
const { send: play } = stream;
const ok = (r: ReturnType<typeof play>) => {
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  return r.world;
};
const fresh = (edit?: (c: any) => void) => {
  stream.n = 0;
  return newWorld(content(edit), ctx('6a1c3e5f-2b4d-4f6a-8c1e-3d5f7a9b1c2e'), [1, 2, 3, 4]);
};
const item = (w: World, k: string) => w.entityIds[`${S}item/${k}`] as EntityId;
const room = (w: World, k: string) => w.roomIds[`${S}room/${k}`]!;
const body = (w: World) => w.body as EntityId;
/** Where `k` is: 'held', 'market', 'midden' or another holder id. */
const at = (w: World, k: string) => {
  const c = w.state.containers[item(w, k)];
  return c === body(w)
    ? 'held'
    : c === room(w, 'market')
      ? 'market'
      : c === room(w, 'midden')
        ? 'midden'
        : c;
};
const take = (w: World, k: string) => ok(play(w, { type: 'take', item_id: item(w, k) }));
const drop = (w: World, k: string) => ok(play(w, { type: 'drop', item_id: item(w, k) }));
const wait = (w: World, until: number) => ok(play(w, { type: 'wait', until }));

// Break: the reaction step is skipped, or moves the item anywhere but the authored room.
test('a taken fish spoils into the midden after a day, and the midden restocks the market', () => {
  let w = take(fresh(), 'fish');
  const c0 = w.state.clock;
  w = wait(w, c0 + 86399);
  assert.equal(at(w, 'fish'), 'held');
  w = wait(w, c0 + 86400);
  assert.equal(at(w, 'fish'), 'midden');
  // Break: the midden is not a replenish reserve (b): the grid is C0 + 5000k.
  w = wait(w, c0 + 89999);
  assert.equal(at(w, 'fish'), 'midden');
  w = wait(w, c0 + 90000);
  assert.equal(at(w, 'fish'), 'market');
});

// Break: no writer-group join (the spoil move at 86400 and the restock at 90000 both write the
// fish's container in different groups: conflicting_write).
test('one wait across the spoil and the restock leaves the fish in the market', () => {
  let w = take(fresh(), 'fish');
  w = wait(w, w.state.clock + 90000);
  assert.equal(at(w, 'fish'), 'market');
});

// Break: item.move ignores the item's earlier group (the move and the respoil's status write
// would then hold the fish in two groups across the spoil and the restock: conflicting_write).
test('a spoil rule that respoils the fish it moves composes in one wait', () => {
  const edit = (c: any) => {
    const spoil = c.reactions[`${S}reaction/spoil`];
    spoil.apply = [spoil.apply[0], c.reactions[`${S}reaction/catch`].apply[0]];
  };
  let w = take(fresh(edit), 'fish');
  w = wait(w, w.state.clock + 90000);
  assert.equal(at(w, 'fish'), 'market');
});

// Break: the immune smoked fish takes the spoiling status and spoils anyway.
test('smoked fish never spoils', () => {
  let w = take(fresh(), 'smoked_fish');
  w = wait(w, w.state.clock + 172800);
  assert.equal(at(w, 'smoked_fish'), 'held');
  assert.deepEqual(activeStatuses(w, item(w, 'smoked_fish')), []);
});

// Break: the sweep moves a rag the player holds (the rule's `when` ignored).
test('a dropped rag is swept after an hour unless the player took it back', () => {
  let w = drop(take(fresh(), 'rag'), 'rag');
  const c0 = w.state.clock;
  w = wait(w, c0 + 3599);
  assert.equal(at(w, 'rag'), 'market');
  w = wait(w, c0 + 3600);
  assert.equal(at(w, 'rag'), 'midden');

  let held = drop(take(fresh(), 'rag'), 'rag');
  const d0 = held.state.clock;
  held = take(wait(held, d0 + 1800), 'rag');
  held = wait(held, d0 + 3600);
  assert.equal(at(held, 'rag'), 'held');
});

// Break: the step moves any entity kind (the dropper's body would go to the midden).
test('a subject that is not an item stays where it is', () => {
  const move = { op: 'item.move', room: ref('room', 'midden') };
  let w = take(
    fresh((c) => (c.reactions[`${S}reaction/litter`].apply = [move])),
    'rag',
  );
  w = drop(w, 'rag');
  assert.equal(w.state.containers[body(w)], room(w, 'market'));
  assert.equal(at(w, 'rag'), 'market');
  // An NPC subject (the sampler has none: the body poses as one) takes nothing either.
  const npc = { ...w, entities: { ...w.entities, [body(w)]: { kind: 'npc' } } } as never;
  assert.deepEqual(moveItem(npc, move as never, body(w), 1, [], new Map()), []);
});

// Break: a later step moves the item from where it was before the rule (a stale source faults).
test('a second item.move in one rule starts where the first left the item', () => {
  const steps = ['midden', 'market'].map((k) => ({ op: 'item.move', room: ref('room', k) }));
  let w = take(
    fresh((c) => (c.reactions[`${S}reaction/spoil`].apply = steps)),
    'fish',
  );
  w = wait(w, w.state.clock + 86400);
  assert.equal(at(w, 'fish'), 'market');
});

// Break: no "already there" check (a transfer from the midden to itself).
test('an item already in the room takes no transfer', () => {
  const w0 = fresh((c) => {
    c.items[`${S}item/fish`].location.room = ref('room', 'midden');
    c.reactions[`${S}reaction/catch`].on = { event: 'item_acquired', item: ref('item', 'rag') };
    delete c.replenish; // no restock out of the midden
  });
  // Taking the rag lays spoiling on the fish where it lies (in the midden).
  let w = take(w0, 'rag');
  assert.equal(activeStatuses(w, item(w, 'fish')).length, 1);
  const r = play(w, { type: 'wait', until: w.state.clock + 86400 });
  assert.equal(r.decision.kind, 'accepted', JSON.stringify(r.decision));
  const fish = item(w, 'fish');
  const ops = r.decision.kind === 'accepted' ? r.decision.delta.ops : [];
  assert.deepEqual(
    ops.filter((o) => o.op === 'entity.transfer' && o.entity_id === fish),
    [],
  );
  w = r.world;
  assert.equal(at(w, 'fish'), 'midden');
  assert.deepEqual(activeStatuses(w, fish), []);
});

// Break: no consumed guard (an eaten fish keeps its status, which still expires, and its transfer
// out of the consumed holder faults the advance).
test('an eaten fish stays eaten when its spoiling ends', () => {
  const mv = `${S}resource/mv`;
  let w = fresh((c) => {
    c.manifest.requires.capabilities.food = c.lock.capabilities.food = 1;
    c.manifest.time_policy = { profile: 'real_elapsed', rate: 50 }; // mv regen needs it
    c.resources[mv].start = 50;
    c.resources[mv].regen = {
      every: 3600,
      by_position: { standing: 1, sitting: 1, resting: 1, sleeping: 1 },
    };
    const label = 'item.fish.short';
    c.items[`${S}item/fish`].edible = {
      resource: ref('resource', 'mv'),
      amount: 1,
      label,
      narration: label,
    };
  });
  w = ok(play(take(w, 'fish'), { type: 'eat', item_id: item(w, 'fish') }));
  assert.equal(activeStatuses(w, item(w, 'fish')).length, 1);
  const run_id = 'aaaaaaaa-0000-4000-8000-000000000001';
  const [from, until] = [w.state.clock, w.state.clock + 86400];
  const payload = { type: 'elapsed', actor_id: w.character, run_id, from, until };
  const command = { id: elapsedCommandId(run_id, w.context, from, until), payload };
  w = ok(stepElapsed(w, { ...command, world_context_id: w.context } as never, ++stream.n));
  assert.deepEqual(activeStatuses(w, item(w, 'fish')), []);
  assert.equal(w.state.containers[item(w, 'fish')], w.consumed);
});

test('item.move is not counted as a fact_changed writer', () => {
  // Break: item.move counted as a fact_changed writer (it emits no event, so needs no fact@1).
  const steps = uses(JSON.parse(new TextDecoder().decode(artifact)).cartridge).filter(([, , p]) =>
    /(spoil|sweep)"\]\.apply/.test(p),
  );
  assert.deepEqual(steps, []);
});

// Break: replenish.run ignores the item's earlier group (hs-1: the spoil move and the same-event
// restock would write the fish in two groups: conflicting_write). `tidy` sorts after `spoil`, so
// it sees the move.
test('a restock rule on the spoil event moves the spoiled fish to the market at once', () => {
  const edit = (c: any) => {
    c.manifest.requires.kernel_api.at_least = '1.101';
    c.reactions[`${S}reaction/tidy`] = {
      key: 'tidy',
      on: { event: 'status_expired', status: ref('status', 'spoiling') },
      apply: [{ op: 'replenish.run', key: ref('replenish', 'restock') }],
    };
  };
  let w = take(fresh(edit), 'fish');
  w = wait(w, w.state.clock + 86400);
  assert.equal(at(w, 'fish'), 'market');
});

// Break: replenish.run does not record the group it wrote the item in (hs-1: `back` would write
// the fish `toss` just moved in a second group: conflicting_write). `pitch` sorts before `reclaim`.
test('two runs on one event move the fish out and back in one wait', () => {
  const edit = (c: any) => {
    c.manifest.requires.kernel_api.at_least = '1.101';
    const restock = c.replenish[`${S}replenish/restock`];
    const [market, midden] = [restock.to, restock.from];
    c.replenish[`${S}replenish/toss`] = { ...restock, key: 'toss', from: market, to: midden };
    c.replenish[`${S}replenish/back`] = { ...restock, key: 'back' };
    const on = { event: 'status_expired', status: ref('status', 'rot') };
    for (const [key, run] of [
      ['pitch', 'toss'],
      ['reclaim', 'back'],
    ])
      c.reactions[`${S}reaction/${key}`] = {
        key,
        on,
        apply: [{ op: 'replenish.run', key: ref('replenish', run!) }],
      };
  };
  let w = drop(take(fresh(edit), 'rag'), 'rag');
  w = wait(w, w.state.clock + 3600);
  assert.equal(at(w, 'fish'), 'market');
});

// Break: replenish.run prefers the item's earlier group to the root command's (hs-1: `litter`'s
// status group then writes the rag's container after the drop did: conflicting_write when the
// toss rule sorts after `litter`). Both orders must pass.
for (const rule of ['a_toss', 'z_toss'])
  test(`a drop-time ${rule} run moves the dropped rag in the drop's group`, () => {
    const edit = (c: any) => {
      c.manifest.requires.kernel_api.at_least = '1.101';
      c.replenish[`${S}replenish/toss`] = {
        ...c.replenish[`${S}replenish/restock`],
        key: 'toss',
        items: [ref('item', 'rag')],
        from: { in: 'room', room: ref('room', 'market') },
        to: { in: 'room', room: ref('room', 'midden') },
      };
      c.reactions[`${S}reaction/${rule}`] = {
        ...c.reactions[`${S}reaction/litter`],
        key: rule,
        apply: [{ op: 'replenish.run', key: ref('replenish', 'toss') }],
      };
    };
    const w = drop(take(fresh(edit), 'rag'), 'rag');
    assert.equal(at(w, 'rag'), 'midden');
  });
