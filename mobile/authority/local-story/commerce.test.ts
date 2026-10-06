import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  gameView,
  INSTALLED,
  loadCartridge,
  newWorld,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { openStory } from './authority.ts';

const bundle = read('protocol/fixtures/missing_child_v018_hash.json');
const loaded = loadCartridge(
  new TextEncoder().encode(
    JSON.stringify({ cartridge: bundle.value, content_hash: bundle.sha256 }),
  ),
  INSTALLED,
);
assert.ok(loaded.ok, JSON.stringify(loaded));
const fresh = newWorld(
  loaded.cartridge as Cartridge,
  '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
  [1, 2, 3, 4],
);

function setup() {
  const p = elapsedHost(':memory:', { wall: 10000, mono: 0 }, bundle);
  const opened = openStory(p.db, [{ fresh, content_hash: bundle.sha256 }], p.host);
  assert.equal(opened.kind, 'open');
  if (opened.kind !== 'open') throw new Error('open');
  let story = opened;
  let n = 0;
  const entity = (kind: string, name: string) =>
    fresh.entityIds[`ashmere_missing_child@0.0.18:${kind}/${name}`];
  const invoke = (
    action_key: string,
    target_ids: string[] = [],
    input: object = {},
    expected = 'accepted',
  ) => {
    const reply = story.invoke({
      invocation_id: `dddddddd-0000-4000-8000-${String(++n).padStart(12, '0')}`,
      actor_id: fresh.character,
      action_key,
      target_ids,
      input,
    });
    assert.equal(reply.kind, 'saved', JSON.stringify(reply));
    if (reply.kind === 'saved') {
      const decision = reply.decision as { kind: string; error?: { code: string }; code?: string };
      assert.equal(
        decision.kind === 'accepted' ? 'accepted' : (decision.error?.code ?? decision.code),
        expected,
        JSON.stringify(reply),
      );
    }
    return reply;
  };
  const move = (...directions: string[]) =>
    directions.forEach((direction) => invoke('move', [], { direction }));
  const answer = (choice_id: string) =>
    invoke('choose', [], {
      continuation_id: gameView(story.world()).choice!.continuation_id,
      choice_id,
    });
  const reopen = () => {
    const result = openStory(p.db, [{ fresh, content_hash: bundle.sha256 }], p.host);
    assert.equal(result.kind, 'open', JSON.stringify(result));
    if (result.kind !== 'open') throw new Error('reopen');
    story = result;
  };
  return {
    ...p,
    entity,
    invoke,
    move,
    answer,
    reopen,
    world: () => story.world(),
    story: () => story,
  };
}

import { key } from '../../../kernel/ts/src/foundation/compose.ts';
const pennies = (a: ReturnType<typeof setup>) =>
  [fresh.body, a.entity('npc', 'peg'), a.entity('npc', 'aldric')].map(
    (entity_id) =>
      a.world().state.resources![
        key({
          kind: 'resource',
          resource: {
            cartridge_id: 'ashmere_missing_child',
            cartridge_version: '0.0.18',
            kind: 'resource',
            key: 'pennies',
          },
          entity_id,
        })
      ].value,
  );
const shop = (a: ReturnType<typeof setup>, verb = 'buy', price = 3) =>
  a.invoke(verb, [a.entity('npc', 'peg'), a.entity('item', 'torch')], { quoted_price: price });
function accept(a: ReturnType<typeof setup>) {
  a.invoke('a_peg_debt', [a.entity('npc', 'peg')]);
  a.answer('accept_on_time');
}
function deliver(a: ReturnType<typeof setup>) {
  a.move('east', 'north', 'north', 'north', 'north');
  a.invoke('a_aldric_debt', [a.entity('npc', 'aldric')]);
  a.answer('on_time');
}
// Breaks: loading compares today's balances with an old S2 payment and rejects legal commerce.
test('real SQLite reopens buy before acceptance, active, and both chronological payout orders', () => {
  for (const order of ['buy-first', 'payout-first']) {
    const a = setup();
    a.move('north', 'west');
    if (order === 'buy-first') {
      shop(a);
      a.reopen();
      assert.deepEqual(pennies(a), [17, 23, 10]);
      accept(a);
      a.reopen();
      deliver(a);
    } else {
      accept(a);
      deliver(a);
      a.move('south', 'south', 'south', 'south', 'west');
      shop(a);
    }
    a.reopen();
    assert.deepEqual(pennies(a), [27, 23, 0]);
    assert.equal(a.world().state.containers[a.entity('item', 'torch')], fresh.body);
  }
});
// Breaks: accepted retry moves or charges the item twice; Sell fails to restore the same finite stock.
test('purchase receipt retry, sale and buyback cold reopen one exact item and conserved pennies', () => {
  const a = setup();
  a.move('north', 'west');
  const bought = shop(a);
  a.reopen();
  const row = a.sql
    .prepare(
      "SELECT invocation_id,command FROM receipt WHERE json_extract(command,'$.payload.type')='buy'",
    )
    .get()!;
  const retry = a.story().invoke({
    invocation_id: row.invocation_id,
    actor_id: fresh.character,
    action_key: 'buy',
    target_ids: [a.entity('npc', 'peg'), a.entity('item', 'torch')],
    input: { quoted_price: 3 },
  });
  assert.equal(retry.kind, 'saved');
  assert.equal(retry.kind === 'saved' && retry.replay, true);
  assert.deepEqual(pennies(a), [17, 23, 10]);
  shop(a, 'sell', 1);
  a.reopen();
  assert.deepEqual(pennies(a), [18, 22, 10]);
  assert.equal(a.world().state.containers[a.entity('item', 'torch')], a.entity('npc', 'peg'));
  shop(a);
  a.reopen();
  assert.deepEqual(pennies(a), [15, 25, 10]);
  assert.ok(bought);
});
// Breaks: a bought shop item makes active/expired deadline truth impossible to cold open.
test('buy under an active and expired S2 retains the exact ledger and pending/failure truth', () => {
  const a = setup();
  a.move('north', 'west');
  accept(a);
  shop(a);
  a.reopen();
  assert.deepEqual(pennies(a), [17, 23, 10]);
  const story = a.story();
  assert.equal(
    story.elapsed({
      expected_run_id: story.runId(),
      from: story.world().state.clock,
      until: 237601,
    }).kind,
    'saved',
  );
  a.reopen();
  assert.deepEqual(pennies(a), [17, 23, 10]);
  assert.equal(a.world().state.containers[a.entity('item', 'tithe_ledger')], fresh.body);
  assert.equal(
    Object.values(a.world().state.quests ?? {}).find((q) => q.quest.key === 'chandlers_debt')!
      .outcome,
    'never',
  );
});
// Breaks: forged historical penny/custody evidence is accepted because final rows happen to match.
test('cold open refuses omitted debit, wrong recipient, false prior balance and reversed receipt order', () => {
  for (const mutant of ['debit', 'recipient', 'prior', 'order', 'custody']) {
    const a = setup();
    a.move('north', 'west');
    shop(a);
    shop(a, 'sell', 1);
    const row = a.sql
      .prepare(
        "SELECT invocation_id,response,revision FROM receipt WHERE json_extract(command,'$.payload.type')='buy'",
      )
      .get()!;
    const d = JSON.parse(row.response as string);
    const money = d.delta.ops.filter((o: any) => o.op === 'resource.adjust');
    if (mutant === 'debit') d.delta.ops = d.delta.ops.filter((o: any) => o !== money[0]);
    if (mutant === 'recipient') money[1].entity_id = a.entity('npc', 'aldric');
    if (mutant === 'prior') {
      money[0].from = 19;
      money[0].to = 16;
    }
    if (mutant === 'custody') d.delta.ops[0].destination_id = a.entity('npc', 'aldric');
    if (mutant === 'order')
      a.sql
        .prepare('UPDATE receipt SET revision=revision+3 WHERE invocation_id=?')
        .run(row.invocation_id as string);
    else
      a.sql
        .prepare('UPDATE receipt SET response=? WHERE invocation_id=?')
        .run(JSON.stringify(d), row.invocation_id as string);
    const opened = openStory(a.db, [{ fresh, content_hash: bundle.sha256 }], a.host);
    assert.equal(opened.kind, 'save_corrupt', mutant);
  }
});
// Breaks: uncertain COMMIT adopts only half a purchase or retry re-applies its money/item effects.
test('shop failed COMMIT and both unknown outcomes retain all prior or all next rows', () => {
  for (const kind of ['failed', 'lost'] as const) {
    const a = setup();
    a.move('north', 'west');
    a.sql.exec(
      'PRAGMA foreign_keys=ON; CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(id INTEGER REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
    );
    a.fault.kind = kind;
    a.fault.armed = true;
    const attempt = {
      invocation_id: 'eeeeeeee-0000-4000-8000-000000000001',
      actor_id: fresh.character,
      action_key: 'buy',
      target_ids: [a.entity('npc', 'peg'), a.entity('item', 'torch')],
      input: { quoted_price: 3 },
    };
    assert.equal(a.story().invoke(attempt).kind, 'pending');
    a.fault.reads = false;
    if (a.sql.isTransaction) a.sql.exec('ROLLBACK');
    a.reopen();
    assert.deepEqual(pennies(a), kind === 'lost' ? [17, 23, 10] : [20, 20, 10]);
    const retried = a.story().invoke(attempt);
    assert.equal(retried.kind, 'saved');
    a.reopen();
    assert.deepEqual(pennies(a), [17, 23, 10]);
  }
});
// Breaks: selling the purchased satchel strands an active obligation inside Peg's shop.
test('satchel Put/Take is immediately useful but active S2 ancestor Sell is refused', () => {
  const a = setup();
  a.move('north', 'west');
  const satchel = a.entity('item', 'satchel'),
    ledger = a.entity('item', 'tithe_ledger');
  a.invoke('buy', [a.entity('npc', 'peg'), satchel], { quoted_price: 5 });
  accept(a);
  a.invoke('put', [ledger, satchel]);
  a.reopen();
  assert.equal(a.world().state.containers[ledger], satchel);
  a.invoke('sell', [a.entity('npc', 'peg'), satchel], { quoted_price: 2 }, 'invalid_state');
  assert.deepEqual(pennies(a), [15, 25, 10]);
  a.invoke('take', [ledger]);
  a.reopen();
  assert.equal(a.world().state.containers[ledger], fresh.body);
});

// Breaks: independently pinned IDs count non-spawned templates or omit worn-slot holders.
test('v018 ID pin binds the spawned world, purchased torch and worn slot after cold reopen', () => {
  const pinned = read('protocol/fixtures/missing_child_v018_ids.json');
  const a = setup();
  const actual = {
    character: fresh.character,
    body: fresh.body,
    ...Object.fromEntries(
      Object.entries(fresh.roomIds).map(([ref, id]) => [ref.split(':')[1], id]),
    ),
    ...Object.fromEntries(
      Object.entries(fresh.entityIds).map(([ref, id]) => [ref.split(':')[1], id]),
    ),
    ...Object.fromEntries(
      Object.entries(fresh.details).map(([id, detail]) => [
        `detail/${fresh.rooms[detail.room].key}/${detail.key}`,
        id,
      ]),
    ),
    ...Object.fromEntries(
      Object.entries(fresh.state.jobs ?? {}).map(([id, job]) => [`job/${job.job.key}`, id]),
    ),
    ...Object.fromEntries(Object.entries(fresh.slots).map(([slot, id]) => [`slot/${slot}`, id])),
  };
  assert.deepEqual(actual, pinned);
  a.move('north', 'west');
  a.invoke('buy', [pinned['npc/peg'], pinned['item/torch']], { quoted_price: 3 });
  a.invoke('wear', [pinned['item/torch']]);
  a.reopen();
  assert.deepEqual(pennies(a), [17, 23, 10]);
  assert.equal(a.world().state.containers[pinned['item/torch']], pinned['slot/light']);
  assert.equal(a.world().state.containers[pinned['slot/light']], pinned.body);
});
