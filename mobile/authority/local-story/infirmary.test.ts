import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gameView } from '../../../kernel/ts/src/index.ts';
import {
  bundle,
  fresh,
  herbs,
  bandages,
  wick,
  patch,
  id,
} from '../../../kernel/ts/test/infirmary_fixture.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { openStory } from './authority.ts';

function setup(path = ':memory:', clock = { wall: 10000, mono: 0 }) {
  const a = elapsedHost(path, clock, bundle);
  let opened = openStory(a.db, [{ fresh, content_hash: bundle.sha256 }], a.host);
  assert.equal(opened.kind, 'open', JSON.stringify(opened));
  if (opened.kind !== 'open') throw new Error('open');
  let story = opened,
    n = 0;
  const invoke = (
    action_key: string,
    target_ids: string[] = [],
    input: object = {},
    expected = 'accepted',
  ) => {
    const invocation = {
      invocation_id: `dddddddd-0000-4000-8000-${String(++n).padStart(12, '0')}`,
      actor_id: fresh.character,
      action_key,
      target_ids,
      input,
    };
    const reply = story.invoke(invocation);
    assert.equal(reply.kind, 'saved', JSON.stringify(reply));
    if (reply.kind === 'saved')
      assert.equal(
        (reply.decision as any).kind === 'accepted'
          ? 'accepted'
          : (reply.decision as any).error?.code,
        expected,
        JSON.stringify(reply),
      );
    return { reply, invocation };
  };
  const move = (...directions: string[]) =>
    directions.forEach((direction) => invoke('move', [], { direction }));
  const answer = (choice_id: string) =>
    invoke('choose', [], {
      continuation_id: gameView(story.world()).choice!.continuation_id,
      choice_id,
    });
  const reopen = () => {
    const next = openStory(a.db, [{ fresh, content_hash: bundle.sha256 }], a.host);
    assert.equal(next.kind, 'open', JSON.stringify(next));
    if (next.kind !== 'open') throw new Error('reopen');
    story = next;
  };
  const gather = () => {
    move('south', 'south', 'west');
    for (let i = 0; i < 12; i++) invoke('harvest', [patch]);
    move('east', 'north', 'north', 'north', 'north', 'north', 'north', 'north', 'north', 'east');
  };
  const accept = () => {
    invoke('a_wick_offer', [wick]);
    answer('accept');
  };
  const turn = () => {
    invoke('b_wick_turn_in', [wick]);
    return answer('exchange');
  };
  return { ...a, invoke, move, answer, reopen, gather, accept, turn, story: () => story };
}

// Breaks: retirement leaves two quest rows, old receipt refills reward, or post-exchange Drop custody fails reopen.
test('real SQLite reopens every immediate occurrence, exact replay and later ordinary bandage custody', () => {
  const a = setup();
  a.gather();
  a.reopen();
  const occurrences = new Set<string>();
  for (let i = 0; i < 4; i++) {
    a.accept();
    a.reopen();
    const q = Object.entries(a.story().world().state.quests!).filter(
      ([, q]) => q.quest.key === 'infirmary_herbs',
    );
    assert.equal(q.length, 1);
    assert.equal(occurrences.has(q[0][0]), false);
    occurrences.add(q[0][0]);
    const { reply, invocation } = a.turn();
    a.reopen();
    const world = a.story().world();
    const replay = a.story().invoke(invocation);
    assert.equal(replay.kind, 'saved');
    if (replay.kind === 'saved' && reply.kind === 'saved') {
      assert.equal(replay.replay, true);
      assert.deepEqual(replay.decision, JSON.parse(JSON.stringify(reply.decision)));
    }
    assert.deepEqual(a.story().world().state, world.state);
  }
  herbs.forEach((h) => assert.equal(a.story().world().state.containers[h], wick));
  bandages.forEach((b) => assert.equal(a.story().world().state.containers[b], fresh.body));
  a.invoke('drop', [bandages[0]]);
  a.reopen();
  assert.equal(a.story().world().state.containers[bandages[0]], id('room', 'infirmary'));
  a.sql.close();
});

// Breaks: an unknown failed COMMIT adopts partial custody/quest/facts, or successful lost-ack replay transfers twice.
test('failed and lost COMMIT exchange outcomes reconcile all-prior or all-next rows', () => {
  for (const kind of ['failed', 'lost'] as const) {
    const a = setup();
    a.gather();
    a.accept();
    a.invoke('b_wick_turn_in', [wick]);
    if (kind === 'failed')
      a.sql.exec(
        'PRAGMA foreign_keys=ON; CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(id INTEGER REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
      );
    const before = a.story().world().state;
    a.fault.kind = kind;
    a.fault.armed = true;
    const invocation = {
      invocation_id: 'ffffffff-0000-4000-8000-000000000001',
      actor_id: fresh.character,
      action_key: 'choose',
      target_ids: [],
      input: {
        continuation_id: gameView(a.story().world()).choice!.continuation_id,
        choice_id: 'exchange',
      },
    };
    assert.equal(a.story().invoke(invocation).kind, 'pending');
    assert.deepEqual(a.story().world().state, before);
    a.fault.reads = false;
    if (kind === 'failed' && a.sql.isTransaction) a.sql.exec('ROLLBACK');
    a.reopen();
    const holder = a.story().world().state.containers[herbs[0]];
    assert.equal(holder, kind === 'failed' ? fresh.body : wick);
    const reply = a.story().invoke(invocation);
    assert.equal(reply.kind, 'saved', JSON.stringify(reply));
    a.reopen();
    assert.equal(a.story().world().state.containers[herbs[0]], wick);
    a.sql.close();
  }
});

// Breaks: forged contribution, occurrence, transfer receipt or current custody is accepted as a lawful repeat save.
test('exchange history corruption refuses without rewriting the SQLite rows', () => {
  for (const corruption of ['contribution', 'occurrence', 'transfer', 'custody']) {
    const a = setup();
    a.gather();
    a.accept();
    a.turn();
    if (corruption === 'contribution')
      a.sql
        .prepare(
          "UPDATE state_row SET value='0' WHERE section='facts' AND key LIKE '%infirmary_contribution%'",
        )
        .run();
    if (corruption === 'occurrence')
      a.sql
        .prepare(
          "UPDATE state_row SET value=json_set(value,'$.quest_instance_id','aaaaaaaa-1111-4222-8333-444444444444') WHERE section='choices' AND json_extract(value,'$.choice_id')='exchange'",
        )
        .run();
    if (corruption === 'custody')
      a.sql
        .prepare("UPDATE state_row SET value=? WHERE section='containers' AND key=?")
        .run(JSON.stringify(fresh.body), herbs[0]);
    if (corruption === 'transfer') {
      const row = a.sql
        .prepare(
          "SELECT rowid,response FROM receipt WHERE json_extract(response,'$.outcome')='exchange'",
        )
        .get() as { rowid: number; response: string };
      const d = JSON.parse(row.response);
      d.delta.ops = d.delta.ops.filter((o: any) => o.entity_id !== herbs[0]);
      a.sql
        .prepare('UPDATE receipt SET response=? WHERE rowid=?')
        .run(JSON.stringify(d), row.rowid);
    }
    const snapshot = a.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all();
    assert.equal(
      openStory(a.db, [{ fresh, content_hash: bundle.sha256 }], a.host).kind,
      'save_corrupt',
    );
    assert.deepEqual(a.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all(), snapshot);
    a.sql.close();
  }
});

// Breaks: temporary loss of direct custody resets the active occurrence or makes it unreopenable.
test('accepted herbs can be dropped, reopened and retrieved for the same exact occurrence', () => {
  const a = setup();
  a.gather();
  a.accept();
  const instance = Object.keys(a.story().world().state.quests!).find(
    (k) => a.story().world().state.quests![k].quest.key === 'infirmary_herbs',
  )!;
  a.invoke('drop', [herbs[0]]);
  a.reopen();
  assert.equal(a.story().world().state.quests![instance].state, 'active');
  a.invoke('take', [herbs[0]]);
  a.turn();
  a.reopen();
  assert.equal(a.story().world().state.quests![instance].state, 'resolved');
  a.sql.close();
});

// Breaks: S9 checks an old B2 faction result against today's row, or B2 assumes faction starts at its default.
test('B2 and S9 faction receipts reopen in both composed orders without changing pennies', () => {
  for (const first of ['B2', 'S9']) {
    const a = setup();
    const debt = () => {
      a.invoke('a_peg_debt', [id('npc', 'peg')]);
      a.answer('accept_on_time');
      a.invoke('close_choice'); // the hub stays open after an answer (loka-x6t.5): Leave the conversation
      a.move('east', 'north', 'north', 'north', 'north');
      a.invoke('a_aldric_debt', [id('npc', 'aldric')]);
      a.answer('on_time');
    };
    if (first === 'B2') {
      a.move('north', 'west');
      debt();
      a.move('south', 'south', 'south', 'south', 'south');
      a.gather();
      a.accept();
      a.turn();
    } else {
      a.gather();
      a.accept();
      a.turn();
      a.move('west', 'south', 'south', 'south', 'south', 'south', 'west');
      debt();
    }
    a.reopen();
    const facts = a.story().world().state.facts!;
    assert.equal(
      Object.entries(facts).find(([k]) => JSON.parse(k).fact.key === 'priory_fen_axis')![1],
      3,
    );
    assert.equal(
      Object.entries(facts).find(([k]) => JSON.parse(k).fact.key === 'infirmary_contribution')![1],
      1,
    );
    a.sql.close();
  }
});

// Breaks: failed retirement deletes the resolved row, or successful uncertain reacceptance retains/reuses it.
test('reacceptance retirement and fresh activation reconcile as one real SQLite commit', () => {
  for (const kind of ['failed', 'lost'] as const) {
    const a = setup();
    a.gather();
    a.accept();
    a.turn();
    a.invoke('a_wick_offer', [wick]);
    const before = a.story().world().state;
    const prior = Object.keys(before.quests!).find(
      (k) => before.quests![k].quest.key === 'infirmary_herbs',
    )!;
    if (kind === 'failed')
      a.sql.exec(
        'PRAGMA foreign_keys=ON; CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(id INTEGER REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
      );
    a.fault.kind = kind;
    a.fault.armed = true;
    const invocation = {
      invocation_id: 'ffffffff-0000-4000-8000-000000000002',
      actor_id: fresh.character,
      action_key: 'choose',
      target_ids: [],
      input: {
        continuation_id: gameView(a.story().world()).choice!.continuation_id,
        choice_id: 'accept',
      },
    };
    assert.equal(a.story().invoke(invocation).kind, 'pending');
    assert.deepEqual(a.story().world().state, before);
    a.fault.reads = false;
    if (kind === 'failed' && a.sql.isTransaction) a.sql.exec('ROLLBACK');
    a.reopen();
    assert.equal(
      a.story().world().state.quests?.[prior]?.state,
      kind === 'failed' ? 'resolved' : undefined,
    );
    assert.equal(a.story().invoke(invocation).kind, 'saved');
    a.reopen();
    const rows = Object.entries(a.story().world().state.quests!).filter(
      ([, q]) => q.quest.key === 'infirmary_herbs',
    );
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0][0], prior);
    assert.equal(rows[0][1].state, 'active');
    a.sql.close();
  }
});

// Breaks: receipt validation replays a random lineage from the release template's RNG rather than its saved seed.
test('randomly seeded B5 lineage reopens and Start over preserves the drawn seed', () => {
  const a = setup();
  Object.assign(a.host, { random: () => new Uint32Array([5, 6, 7, 8]) });
  assert.equal(a.story().newGame().kind, 'replaced');
  a.reopen();
  assert.deepEqual(a.story().world().state.rng, [5, 6, 7, 8]);
  a.sql.close();
});

// Breaks: cold replay delivers trusted elapsed through player admission, marking a lawful save corrupt.
test('trusted elapsed reopens before S9 and reaches the actual herb exchange consumer', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-b5-elapsed-')),
    path = join(dir, 'save.db');
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const a = setup(path);
  a.clock.wall += 20;
  a.clock.mono += 20;
  assert.equal(a.story().pulse('active', a.story().runId()).kind, 'ready');
  assert.equal(a.story().world().state.clock, 64801);
  assert.equal(
    a.sql
      .prepare(
        "SELECT count(*) AS n FROM receipt WHERE json_extract(command,'$.payload.type')='elapsed'",
      )
      .get()!.n,
    1,
  );
  a.sql.close();
  const reopened = setup(path, { wall: 10020, mono: 0 });
  try {
    assert.equal(reopened.story().world().state.clock, 64801);
    reopened.gather();
    reopened.accept();
    reopened.turn();
    reopened.reopen();
    assert.equal(reopened.story().world().state.containers[herbs[0]], wick);
  } finally {
    reopened.sql.close();
  }
});
