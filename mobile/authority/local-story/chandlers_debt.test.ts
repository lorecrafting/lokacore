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

const bundle = read('protocol/fixtures/missing_child_v016_hash.json');
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
    fresh.entityIds[`ashmere_missing_child@0.0.16:${kind}/${name}`];
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

function deliverOnTime(a: ReturnType<typeof setup>) {
  a.move('north', 'west');
  a.invoke('a_peg_debt', [a.entity('npc', 'peg')]);
  a.answer('accept_on_time');
  a.move('east', 'north', 'north', 'north', 'north');
  a.invoke('a_aldric_debt', [a.entity('npc', 'aldric')]);
  a.answer('on_time');
}

// Breaks: cold reopen loses the bound acceptance, payment or original ledger custody.
test('saved B2 acceptance and funded turn-in reopen with their exact rows', () => {
  const a = setup();
  a.move('north', 'west');
  a.invoke('a_peg_debt', [a.entity('npc', 'peg')]);
  a.answer('accept_on_time');
  a.reopen();
  assert.equal(a.world().state.containers[a.entity('item', 'tithe_ledger')], fresh.body);
  a.move('east', 'north', 'north', 'north', 'north');
  a.invoke('a_aldric_debt', [a.entity('npc', 'aldric')]);
  a.answer('on_time');
  a.reopen();
  assert.equal(
    a.world().state.containers[a.entity('item', 'tithe_ledger')],
    a.entity('npc', 'aldric'),
  );
});

// Breaks: deleting the occurrence's pending due job silently discards a saved obligation.
test('reopen refuses a missing bound expiry job', () => {
  const a = setup();
  a.move('north', 'west');
  a.invoke('a_peg_debt', [a.entity('npc', 'peg')]);
  a.answer('accept_on_time');
  const job = Object.entries(a.world().state.jobs ?? {}).find(([, j]) => !!j.quest_instance_id)![0];
  a.sql.prepare("DELETE FROM state_row WHERE section='jobs' AND key=?").run(job);
  const result = openStory(a.db, [{ fresh, content_hash: bundle.sha256 }], a.host);
  assert.equal(result.kind, 'save_corrupt');
});

// Breaks: an elapsed expiry commits a failed quest that its own saved receipt cannot justify.
test('expired B2 obligation reopens with one trust penalty', () => {
  const a = setup();
  a.move('north', 'west');
  a.invoke('a_peg_debt', [a.entity('npc', 'peg')]);
  a.answer('accept_on_time');
  const story = a.story();
  const from = story.world().state.clock;
  const result = story.elapsed({ expected_run_id: story.runId(), from, until: 237601 });
  assert.equal(result.kind, 'saved', JSON.stringify(result));
  a.reopen();
  assert.equal(
    Object.values(a.world().state.quests ?? {}).find((q) => q.quest.key === 'chandlers_debt')
      ?.outcome,
    'never',
  );
});

// Breaks: a forged bounded Priory/Fen value survives despite the committed +2 turn-in.
test('on-time saved axis must agree with its turn-in receipt', () => {
  const a = setup();
  deliverOnTime(a);
  const axis = Object.keys(a.world().state.facts ?? {}).find(
    (k) => JSON.parse(k).fact.key === 'priory_fen_axis',
  )!;
  a.sql.prepare("UPDATE state_row SET value=? WHERE section='facts' AND key=?").run('9', axis);
  assert.equal(
    openStory(a.db, [{ fresh, content_hash: bundle.sha256 }], a.host).kind,
    'save_corrupt',
  );
});

// Breaks: a receipt claims a ten-penny transfer from unrelated prior balances.
test('on-time receipt balances must match funded and saved rows', () => {
  const a = setup();
  deliverOnTime(a);
  const row = a.sql
    .prepare(
      "SELECT rowid,response FROM receipt WHERE json_extract(command,'$.payload.choice_id')='on_time'",
    )
    .get() as { rowid: number; response: string };
  const response = JSON.parse(row.response);
  const paid = response.delta.ops.filter((o: { op: string }) => o.op === 'resource.adjust');
  assert.equal(paid.length, 2);
  Object.assign(paid[0], { from: 100, to: 90 });
  Object.assign(paid[1], { from: 50, to: 60 });
  a.sql
    .prepare('UPDATE receipt SET response=? WHERE rowid=?')
    .run(JSON.stringify(response), row.rowid);
  assert.equal(
    openStory(a.db, [{ fresh, content_hash: bundle.sha256 }], a.host).kind,
    'save_corrupt',
  );
});

// Breaks: the expiry receipt moves Peg's trust at a different valid player's scope.
test('expiry receipt trust scope must name its bound actor', () => {
  const a = setup();
  a.move('north', 'west');
  a.invoke('a_peg_debt', [a.entity('npc', 'peg')]);
  a.answer('accept_on_time');
  const story = a.story();
  const from = story.world().state.clock;
  assert.equal(
    story.elapsed({ expected_run_id: story.runId(), from, until: 237601 }).kind,
    'saved',
  );
  const rows = a.sql.prepare('SELECT rowid,response FROM receipt').all() as {
    rowid: number;
    response: string;
  }[];
  const row = rows.find(({ response }) =>
    JSON.parse(response).delta?.ops?.some(
      (o: { op: string; fact?: { key: string } }) =>
        o.op === 'fact.assign' && o.fact?.key === 'peg_trust',
    ),
  )!;
  const response = JSON.parse(row.response);
  const trust = response.delta.ops.find(
    (o: { op: string; fact?: { key: string } }) =>
      o.op === 'fact.assign' && o.fact?.key === 'peg_trust',
  );
  trust.scope = { kind: 'player', character_id: 'aaaaaaaa-1111-4222-8333-444444444444' };
  a.sql
    .prepare('UPDATE receipt SET response=? WHERE rowid=?')
    .run(JSON.stringify(response), row.rowid);
  assert.equal(
    openStory(a.db, [{ fresh, content_hash: bundle.sha256 }], a.host).kind,
    'save_corrupt',
  );
});

// Breaks: reopen skips checking that the accept receipt schedules the bound due job (M8).
test('reopen refuses an accept receipt that schedules its due job at another time', () => {
  const a = setup();
  a.move('north', 'west');
  a.invoke('a_peg_debt', [a.entity('npc', 'peg')]);
  a.answer('accept_on_time');
  const row = a.sql
    .prepare(
      "SELECT rowid,response FROM receipt WHERE json_extract(command,'$.payload.choice_id')='accept_on_time'",
    )
    .get() as { rowid: number; response: string };
  const response = JSON.parse(row.response);
  const scheduled = response.delta.ops.filter((o: { op: string }) => o.op === 'job.schedule');
  assert.equal(scheduled.length, 1);
  scheduled[0].due_time += 1;
  a.sql
    .prepare('UPDATE receipt SET response=? WHERE rowid=?')
    .run(JSON.stringify(response), row.rowid);
  assert.equal(
    openStory(a.db, [{ fresh, content_hash: bundle.sha256 }], a.host).kind,
    'save_corrupt',
  );
});

// Breaks: reopen accepts an expiry receipt whose trust fact_changed event disagrees with its delta (M5).
test('reopen refuses an expiry receipt with a forged trust event', () => {
  const a = setup();
  a.move('north', 'west');
  a.invoke('a_peg_debt', [a.entity('npc', 'peg')]);
  a.answer('accept_on_time');
  const story = a.story();
  const from = story.world().state.clock;
  assert.equal(
    story.elapsed({ expected_run_id: story.runId(), from, until: 237601 }).kind,
    'saved',
  );
  const rows = a.sql.prepare('SELECT rowid,response FROM receipt').all() as {
    rowid: number;
    response: string;
  }[];
  const forged = rows.flatMap(({ rowid, response }) => {
    const parsed = JSON.parse(response);
    const event = parsed.events?.find(
      (e: { payload: { type: string; fact?: { key: string } } }) =>
        e.payload.type === 'fact_changed' && e.payload.fact?.key === 'peg_trust',
    );
    if (!event) return [];
    event.payload.new += 1;
    return [{ rowid, response: JSON.stringify(parsed) }];
  });
  assert.equal(forged.length, 1);
  a.sql
    .prepare('UPDATE receipt SET response=? WHERE rowid=?')
    .run(forged[0].response, forged[0].rowid);
  assert.equal(
    openStory(a.db, [{ fresh, content_hash: bundle.sha256 }], a.host).kind,
    'save_corrupt',
  );
});
