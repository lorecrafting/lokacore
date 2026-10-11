// Toolbox row W22, fire, in the showcase smithy (docs/SHOWCASE.md): content on rows G1, G3, G4, G6,
// G12 and W1 plus the reaction barrier step (Beads loka-kgd.96). The dropped torch sets every
// burnable thing in the room burning (co_present with tag burnable); a burning thing's first tick
// spreads, opens each burnable barrier on the room's exits (nobody names the woodstore door) and
// marks it spent, so the fire burns out; water from the bucket quenches; the smoke is a smell cue
// of the burning status, read one room away. Each test continues the world the one before it left.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { gameView, INSTALLED, loadCartridge, newWorld, step } from '../src/index.ts';
import { encode } from '../src/foundation/canonical.ts';
import type { Cartridge, World } from '../src/runtime/decision.ts';
import { key } from '../src/foundation/compose.ts';
import { barrierState } from '../src/mechanics/lookups.ts';
import { content, fresh, go, id, play, ref, refused, take, wait } from './showcase_fixture.ts';

const WORLD = '5ca5e000-0000-4000-8000-0000000f1e22';
const C = { cartridge_id: 'toolbox_showcase', cartridge_version: '0.0.1' };
const burning = (w: World, item: string) =>
  w.state.statuses?.[
    key({
      kind: 'status',
      body_id: id(w, 'item', item),
      status: { ...C, kind: 'status', key: 'burning' },
    })
  ]?.active === true;
const door = (w: World) => barrierState(w, { ...C, kind: 'barrier', key: 'store_door' } as never);
const smoke = (w: World) => gameView(w).cues?.filter((c) => c.text === 'cue.smoke') ?? [];

let w: World;
let lit: number; // the clock when the torch was dropped

// Breaks: co_present ignores the tag (the anvil burns) or lands on NPCs only (nothing burns); the
// barred door opens without fire.
test('fire 1: the dropped torch sets the bench and kindling burning, not the anvil', () => {
  w = go(go(go(fresh(WORLD), 'north').world, 'east').world, 'south').world;
  assert.equal(refused(w, { type: 'open', direction: 'south' }), 'invalid_state');
  w = take(w, 'smithy_torch');
  w = play(w, { type: 'drop', item_id: id(w, 'item', 'smithy_torch') }).world;
  lit = w.state.clock;
  assert.deepEqual(
    ['bench', 'kindling', 'anvil'].map((k) => burning(w, k)),
    [true, true, false],
  );
  assert.equal(door(w), 'closed');
});

// Breaks: the smoke is not shown next door, or shown from the wrong side.
test('fire 2: smoke reads in the fold, from the south', () => {
  w = go(w, 'north').world;
  const line = { sense: 'smell', text: 'cue.smoke', direction: 'south' };
  assert.deepEqual(smoke(w), [line, line]); // one per burning thing (row G6)
  w = go(w, 'south').world;
});

// Breaks: barrier.set writes nothing, misses a tagged exit barrier, or obeys opens_when.
test('fire 3: the first tick opens the woodstore door nobody named', () => {
  w = wait(w, lit + 60).world;
  assert.equal(door(w), 'open');
  assert.equal(go(w, 'south').world.state.containers[w.body], w.roomIds[ref('room', 'woodstore')]);
});

// Breaks: the quench recipe does not cure a showcase item (asserted before the fire could burn out).
test('fire 4: the bucket puts both out', () => {
  w = take(w, 'smithy_bucket');
  for (const target of ['bench', 'kindling'])
    w = play(w, {
      type: 'perform',
      action: 'quench',
      target_id: id(w, 'item', target),
      item_id: id(w, 'item', 'smithy_bucket'),
    }).world;
  assert.deepEqual(
    ['bench', 'kindling'].map((k) => burning(w, k)),
    [false, false],
  );
  w = wait(w, lit + 600).world;
  assert.deepEqual(
    ['bench', 'kindling'].map((k) => burning(w, k)),
    [false, false],
  );
  assert.deepEqual(smoke(go(w, 'north').world), []);
});

// Breaks: each tick re-lights everything (the spread rule ignores spent), so a fire never ends.
test('fire 5: left alone, the fire burns out', () => {
  let x = go(go(go(fresh(WORLD), 'north').world, 'east').world, 'south').world;
  x = take(x, 'smithy_torch');
  x = play(x, { type: 'drop', item_id: id(x, 'item', 'smithy_torch') }).world;
  x = wait(x, x.state.clock + 900).world;
  assert.deepEqual(
    ['bench', 'kindling'].map((k) => burning(x, k)),
    [false, false],
  );
});

// The red control (row W22: a spread is cut by the composition budget). One accepted drop that
// sets n things burning creates n status jobs; created_jobs is 64
// (docs/spec/conformance/composition-profile.json), so 64 burnables light and 65 fault, committing
// nothing. Breaks: the budget not counted for co_present holders, or a partial fire committed.
test('budget: 64 burnables light at once, 65 fault budget_exceeded and nothing burns', () => {
  const kindling = content.items![ref('item', 'kindling')]!;
  const smithy = (extra: number) => {
    const items = { ...content.items! };
    for (let i = 0; i < extra; i += 1) {
      const k = `fuel_${i}`;
      items[ref('item', k)] = { ...kindling, key: k } as never;
    }
    return { ...content, items } as Cartridge;
  };
  const drop = (extra: number) => {
    let x = newWorld(smithy(extra), WORLD as never, [1, 2, 3, 4]);
    x = go(go(go(x, 'north').world, 'east').world, 'south').world;
    x = take(x, 'smithy_torch');
    return step(
      x,
      {
        id: '5ca5e000-6666-4333-8444-000000000001' as never,
        world_context_id: x.context,
        payload: {
          type: 'drop',
          actor_id: x.character,
          item_id: id(x, 'item', 'smithy_torch'),
        } as never,
      },
      1000,
    );
  };
  assert.equal(drop(62).decision.kind, 'accepted'); // bench, kindling and 62 more
  const over = drop(63);
  assert.deepEqual(over.decision, { kind: 'fault', code: 'budget_exceeded' });
  assert.equal(over.limit, 'created_jobs');
});

/** The showcase, edited and re-hashed, loaded: its first diagnostic's code and path, or 'ok'. */
function reload(edit: (c: any) => void) {
  const c = structuredClone(content) as any;
  edit(c);
  const canonical = encode(c);
  const sha256 = createHash('sha256').update(canonical).digest('hex');
  const r = loadCartridge(
    new TextEncoder().encode(`{"cartridge":${canonical},"content_hash":"${sha256}"}`),
    INSTALLED,
  );
  return r.ok ? 'ok' : `${r.diagnostic.code} ${r.diagnostic.path}`;
}

// Twin of the compiler rows in test/loka/content_showcase_test.exs. Breaks: a barrier.set step or a
// co_present tag loads under API 1.55 (each alone); a barrier.set to locked on a barrier without
// key_item loads (named or by tag), or one with a key_item is refused.
test('loader: barrier.set and co_present tag need API 1.56; to locked needs a key_item', () => {
  const spread = (c: any) => c.reactions[ref('reaction', 'fire_spreads')].apply;
  const at155 = (c: any) => {
    c.manifest.requires.kernel_api.at_least = '1.55';
    delete c.reactions[ref('reaction', 'kindle')];
  };
  const untagged = (c: any) => {
    delete spread(c)[0].tag; // and the door named, so no tag is left
    spread(c)[1] = {
      op: 'barrier.set',
      to: 'open',
      barrier: { ...C, kind: 'barrier', key: 'store_door' },
    };
  };
  const noDoor = (c: any) => spread(c).splice(1, 1);
  const api = 'KERNEL_API_RANGE_INVALID .cartridge.manifest.requires.kernel_api.at_least';
  assert.equal(
    reload((c) => (at155(c), untagged(c), noDoor(c))),
    'ok',
  );
  assert.equal(
    reload((c) => (at155(c), untagged(c))),
    api,
  );
  assert.equal(
    reload((c) => (at155(c), noDoor(c))),
    api,
  );

  const door = (by: object) => (c: any) =>
    (spread(c)[1] = { op: 'barrier.set', to: 'locked', ...by });
  const site = `.cartridge.reactions["${ref('reaction', 'fire_spreads')}"].apply[1].to`;
  const lockout = `BARRIER_UNREACHABLE_KEY ${site}`;
  const named = { barrier: { ...C, kind: 'barrier', key: 'store_door' } };
  assert.equal(reload(door({ tag: 'burnable' })), lockout);
  assert.equal(reload(door(named)), lockout);
  const keyed = (c: any) =>
    (c.barriers[ref('barrier', 'store_door')].key_item = { ...C, kind: 'item', key: 'anvil' });
  assert.equal(
    reload((c) => (keyed(c), door({ tag: 'burnable' })(c))),
    'ok',
  );
  // A keyless burnable barrier on no exit (a lid) is out of a tag's reach.
  const stray = (c: any) => {
    const b = { ...c.barriers[ref('barrier', 'store_door')], key: 'stray' };
    delete b.opens_when;
    delete b.key_item;
    c.barriers[ref('barrier', 'stray')] = b;
  };
  assert.equal(
    reload((c) => (keyed(c), stray(c), door({ tag: 'burnable' })(c))),
    'ok',
  );
  // Breaks: a barrier.set naming no barrier of the cartridge loads.
  const gate = { barrier: { ...C, kind: 'barrier', key: 'gate' } };
  assert.equal(
    reload((c) => (spread(c)[1] = { op: 'barrier.set', to: 'open', ...gate })),
    `UNRESOLVED_REFERENCE .cartridge.reactions["${ref('reaction', 'fire_spreads')}"].apply[1].barrier`,
  );
});

/** The showcase edited, the player in the smithy carrying `carry`, the torch then dropped. */
function light(edit: (c: any) => void, carry: string[] = []) {
  const c = structuredClone(content) as any;
  edit(c);
  let x = newWorld(c as Cartridge, WORLD as never, [1, 2, 3, 4]);
  x = go(go(go(x, 'north').world, 'east').world, 'south').world;
  for (const item of [...carry, 'smithy_torch']) x = take(x, item);
  return play(x, { type: 'drop', item_id: id(x, 'item', 'smithy_torch') }).world;
}
const storeDoor = { ...C, kind: 'barrier', key: 'store_door' };
const spreadOf = (c: any) => c.reactions[ref('reaction', 'fire_spreads')].apply;

// Breaks: a named barrier.set ignores its barrier, or moves a locked door to open in one illegal
// transition (the composer refuses it) instead of locked, closed, open.
test('a named barrier.set opens a locked door through closed', () => {
  const x = light((c) => {
    c.barriers[ref('barrier', 'store_door')].initial = 'locked';
    spreadOf(c)[1] = { op: 'barrier.set', to: 'open', barrier: storeDoor };
  });
  assert.equal(door(x), 'locked');
  assert.equal(door(wait(x, x.state.clock + 60).world), 'open');
});

// Breaks: co_present lands on tagged items outside the event's room (in the pack, or next door).
test('kindling carried or lying in another room does not catch', () => {
  const x = light(
    (c) => {
      const k = c.items[ref('item', 'kindling')];
      const fold = { ...C, kind: 'room', key: 'the_fold' };
      c.items[ref('item', 'fold_kindling')] = {
        ...k,
        key: 'fold_kindling',
        location: { in: 'room', room: fold },
      };
    },
    ['kindling'],
  );
  assert.deepEqual(
    ['bench', 'kindling', 'fold_kindling'].map((k) => burning(x, k)),
    [true, false, false],
  );
});

// Breaks: barrier.set by tag moves an exit barrier that lacks the tag.
test('a door that is not burnable stays shut', () => {
  const x = light((c) => (c.barriers[ref('barrier', 'store_door')].tags = ['wooden']));
  assert.equal(door(wait(x, x.state.clock + 60).world), 'closed');
});

// Breaks: a later rule's write to the door the spread opened takes a new writer group (the wait
// faults conflicting_write) instead of joining the spread's; or one rule's second barrier.set on a
// barrier reads the committed state, not its first step's (the door stays open).
test('a later rule, or a later step, re-closes the door the spread opened', () => {
  const reclose = { op: 'barrier.set', to: 'closed', barrier: storeDoor };
  const laterRule = light((c) => {
    const spread = c.reactions[ref('reaction', 'fire_spreads')];
    c.reactions[ref('reaction', 'zz_reclose')] = {
      key: 'zz_reclose',
      on: spread.on,
      apply: [reclose],
    };
  });
  assert.equal(door(wait(laterRule, laterRule.state.clock + 60).world), 'closed');
  const laterStep = light((c) => spreadOf(c).splice(2, 0, reclose), ['kindling']); // one spread only
  assert.equal(door(wait(laterStep, laterStep.state.clock + 60).world), 'closed');
});
