import assert from 'node:assert/strict';
import { test } from 'node:test';
import { controlled, entity, room, fatal, fresh, bundle } from './death_fixture.ts';
import { level, resourceRef } from '../src/mechanics/resource.ts';
import { positionOf } from '../src/mechanics/position/shared.ts';
import { gameView, step, INSTALLED, loadCartridge } from '../src/index.ts';
import { reach } from '../src/mechanics/lookups.ts';
import { resolve } from '../src/commands/target.ts';
import { sight } from '../src/mechanics/movement/rule.ts';
import { hydrate } from '../src/runtime/created.ts';
import { key } from '../src/foundation/compose.ts';
import { apply } from '../src/runtime/apply.ts';
import { read } from './read.ts';

// Breaks: flattened bags, missed worn roots, moved slot holders, body replacement or reset progress.
test('one fatal sequence preserves custody and returns the same body with exact restoration', () => {
  const before = controlled(),
    { next, sequence } = fatal(before),
    w = next.world,
    c = sequence.corpse_id;
  const b = entity(w, 'item/trunk'),
    l = entity(w, 'item/lantern'),
    worn = entity(w, 'item/wool_cloak');
  assert.deepEqual(
    [
      w.state.containers[c],
      w.state.containers[b],
      w.state.containers[l],
      w.state.containers[worn],
      w.state.containers[w.slots.cloak],
    ],
    [room(w, 'lantern_cellar'), c, b, c, w.body],
  );
  assert.deepEqual([w.body, w.character], [before.body, before.character]);
  assert.equal(w.state.containers[w.body], room(w, 'chapel_nave'));
  assert.deepEqual(
    ['hp', 'mv', 'ma'].map((k) => level(w, w.body, resourceRef(w, k))),
    [10, 100, 7],
  );
  assert.equal(positionOf(w, w.character), 'standing');
  assert.deepEqual(
    w.state.resources![
      key({ kind: 'resource', resource: resourceRef(w, 'mv'), entity_id: w.body })
    ],
    { value: 100, at: 64800, rate: 18, remainder: 0 },
  );
  assert.equal(w.state.containers[entity(w, 'item/tin_whistle')], entity(w, 'npc/bram'));
  assert.equal(w.entityIds, before.entityIds);
  assert.equal(w.entityIds['ashmere_sampler@0.0.8:item/player_corpse'], undefined);
  assert.deepEqual(
    sequence.events.map((e) => e.payload.type),
    ['entity_died'],
  );
  assert.equal('victim_definition' in sequence.events[0].payload, false);
  assert.deepEqual(w.state.rng, [1, 2, 3, 4]);
  assert.deepEqual([w.state.quests, w.state.choices], [before.state.quests, before.state.choices]);
  const elapsed = apply(w, [{ op: 'time.advance', writer_group: 0, from: 64800, to: 64801 }]);
  assert.ok('world' in elapsed);
  assert.equal(elapsed.world.entities, w.entities);
  assert.equal(elapsed.world.capacities, w.capacities);
  const answer = read('protocol/fixtures/corpse_creation.json').runtime_ids;
  assert.deepEqual([sequence.events[0].id, c], [answer.death_event, answer.corpse]);
});

// Breaks: portable corpse, owner-only UI without authority guard, remote/nested locked recovery.
test('owners recover roots through ordinary Take while corpses remain fixed and private', () => {
  const { next, sequence } = fatal(controlled());
  const away = next.world,
    c = sequence.corpse_id,
    bag = entity(away, 'item/trunk'),
    lantern = entity(away, 'item/lantern');
  assert.equal(reach(away, away.body, bag), false);
  const w = {
    ...away,
    state: {
      ...away.state,
      containers: { ...away.state.containers, [away.body]: room(away, 'lantern_cellar') },
    },
  };
  const command = (type: 'take' | 'drop' | 'give' | 'wear', item_id = c) =>
    ({
      id: '00000000-0000-4000-8000-000000000092' as never,
      world_context_id: w.context,
      payload: {
        type,
        actor_id: w.character,
        item_id,
        ...(type === 'give' && { recipient_id: entity(w, 'npc/bram') }),
      },
    }) as never;
  const spacious = {
    ...w,
    cartridge: { ...w.cartridge, world: { ...w.cartridge.world, carry: { max_grams: 30000 } } },
  };
  for (const verb of ['take', 'drop', 'give', 'wear'] as const)
    assert.deepEqual(step(spacious, command(verb), 2).decision, {
      kind: 'rejected',
      error: { code: 'invalid_target' },
    });
  assert.equal(reach(w, w.body, lantern), false);
  const taken = step(w, command('take', bag), 2);
  assert.equal(taken.decision.kind, 'accepted');
  assert.equal(taken.world.state.containers[bag], w.body);
  assert.equal(taken.world.state.containers[lantern], bag);
  const tooHeavy = step(taken.world, command('take', entity(w, 'item/wool_cloak')), 3).decision;
  assert.deepEqual(tooHeavy, { kind: 'rejected', error: { code: 'too_heavy' } });
  const view = gameView(w).entities.find((e) => e.id === c)!;
  assert.ok(view.contents?.some((e) => e.id === bag));
  assert.ok(!view.actions.some((a) => ['take', 'drop', 'give', 'wear'].includes(a.action_key)));
  const stranger = {
    ...w,
    knownEntities: {
      ...w.knownEntities,
      [w.body]: { kind: 'body', owner_id: '00000000-0000-4000-8000-000000000099' as never },
    },
  };
  assert.equal(reach(stranger, stranger.body, bag), false);
  assert.equal(gameView(stranger).entities.find((e) => e.id === c)!.contents, undefined);
  assert.equal(step(stranger, command('take', bag), 2).decision.kind, 'rejected');
  const second = fatal(taken.world, w.body, '00000000-0000-4000-8000-000000000093' as never, 3);
  assert.notEqual(second.sequence.corpse_id, c);
  assert.equal(second.next.world.state.containers[bag], second.sequence.corpse_id);
  assert.ok(second.next.world.state.created?.[c]);
});

// Breaks: dead rats remain targetable through names/raw IDs, scan, dialogue, or Give.
test('HP-zero NPC retains identity but leaves living projection and admission', () => {
  const before = controlled(),
    rat = entity(before, 'npc/cellar_rat_1'),
    { next, sequence } = fatal(before, rat),
    w = next.world;
  assert.ok(w.entities[rat]);
  assert.equal(level(w, rat, resourceRef(w, 'hp')), 0);
  assert.equal(resolve(w, w.character, 'cellar rat 1').kind, 'none');
  assert.ok(!gameView(w).entities.some((e) => e.id === rat));
  assert.ok(gameView(w).entities.some((e) => e.id === sequence.corpse_id));
  const hall = {
    ...w,
    state: {
      ...w.state,
      containers: { ...w.state.containers, [w.body]: room(w, 'drowned_lantern') },
      barriers: {
        [key({
          kind: 'barrier',
          barrier: {
            cartridge_id: 'ashmere_sampler',
            cartridge_version: '0.0.8',
            kind: 'barrier',
            key: 'cellar_door',
          },
        })]: 'open' as const,
      },
    },
  };
  assert.ok(
    !sight(hall, hall.body)
      .flatMap((s) => ('entities' in s ? s.entities : []))
      .includes(rat),
  );
  for (const payload of [
    { type: 'look', target_id: rat },
    { type: 'talk', target_id: rat },
    { type: 'give', recipient_id: rat, item_id: entity(w, 'item/trunk') },
  ]) {
    const out = step(
      w,
      {
        id: '00000000-0000-4000-8000-000000000094',
        world_context_id: w.context,
        payload: { ...payload, actor_id: w.character },
      } as never,
      2,
    );
    assert.equal(out.decision.kind, 'rejected');
  }
});

// Breaks: older API loads templates, dynamic identity is omitted on reopen, or malformed custody heals.
test('new API gate and narrow hydration reject invalid provenance/custody', () => {
  const older = loadCartridge(
    new TextEncoder().encode(
      JSON.stringify({ cartridge: bundle.value, content_hash: bundle.sha256 }),
    ),
    { ...INSTALLED, kernel_api: '1.4' },
  );
  assert.ok(!older.ok);
  if (!older.ok) assert.equal(older.diagnostic.code, 'KERNEL_API_UNSUPPORTED');
  const { next, sequence } = fatal(controlled());
  const restored = hydrate(fresh, next.world.state, true);
  assert.ok(restored?.entities[sequence.corpse_id]);
  for (const mutate of [
    (s: any) => {
      delete s.created;
    },
    (s: any) => {
      delete s.containers[sequence.corpse_id];
    },
    (s: any) => {
      s.created[sequence.corpse_id].origin.owner_id = null;
    },
    (s: any) => {
      s.created[sequence.corpse_id].definition.key = 'missing';
    },
    (s: any) => {
      s.containers[sequence.corpse_id] = entity(fresh, 'item/trunk');
    },
    (s: any) => {
      s.containers[entity(fresh, 'item/trunk')] = entity(fresh, 'item/trunk');
    },
    (s: any) => {
      s.created[sequence.corpse_id] = null;
    },
  ]) {
    const state = structuredClone(next.world.state);
    mutate(state);
    assert.equal(hydrate(fresh, state, true), undefined);
  }
});

// Break: missing explicit NPC HP silently projects a living NPC instead of rejecting corruption.
test('living projection refuses a missing required NPC HP row', () => {
  const w = controlled();
  const rat = entity(w, 'npc/cellar_rat_1');
  const resources = { ...w.state.resources };
  delete resources[key({ kind: 'resource', entity_id: rat, resource: resourceRef(w, 'hp') })];
  assert.throws(() => gameView({ ...w, state: { ...w.state, resources } }), /precondition_failed/);
});

// Break: root enumeration/reversal changes delta order although final custody is identical.
// The fixture inserts trunk (d68b...) before cloak (2603...); expected UUIDs are independent
// Python SHA-256/IdSource literals, with cloak before trunk in the required order.
test('fatal transfer delta orders unsorted roots between initial placement and return', () => {
  const { sequence } = fatal(controlled());
  assert.deepEqual(
    sequence.ops.filter((op) => op.op === 'entity.transfer'),
    [
      {
        op: 'entity.transfer',
        writer_group: 0,
        entity_id: 'b718d867-4d0d-8ec9-b4fa-fa5d7edca054',
        source_id: null,
        destination_id: 'd530207e-b845-8be5-9d53-b44b2cf5d8a1',
      },
      {
        op: 'entity.transfer',
        writer_group: 0,
        entity_id: '2603d738-5a68-83d2-93fe-8e50819f9741',
        source_id: 'b59d54de-ea10-84e1-964c-16d1c776e738',
        destination_id: 'b718d867-4d0d-8ec9-b4fa-fa5d7edca054',
      },
      {
        op: 'entity.transfer',
        writer_group: 0,
        entity_id: 'd68b48e6-93a5-8899-81ec-808f7be333f8',
        source_id: '3d4829ad-9e43-81ef-bc10-66b1b267e157',
        destination_id: 'b718d867-4d0d-8ec9-b4fa-fa5d7edca054',
      },
      {
        op: 'entity.transfer',
        writer_group: 0,
        entity_id: '3d4829ad-9e43-81ef-bc10-66b1b267e157',
        source_id: 'd530207e-b845-8be5-9d53-b44b2cf5d8a1',
        destination_id: '1a7c3699-2844-8a55-b29f-eac079c7bf50',
      },
    ],
  );
});
