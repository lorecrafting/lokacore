import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bundle,
  forge,
  fresh,
  only,
  otherId,
  otherPlayer,
  setup,
  staged,
} from './__tests__/chandlers-setup.test.ts';
import { openStory } from './authority.ts';

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
  const a = staged('accept');
  const job = Object.entries(a.world().state.jobs ?? {}).find(([, j]) => !!j.quest_instance_id)![0];
  a.sql.prepare("DELETE FROM state_row WHERE section='jobs' AND key=?").run(job);
  const result = openStory(a.db, [{ fresh, content_hash: bundle.sha256 }], a.host);
  assert.equal(result.kind, 'save_corrupt');
});

// Breaks: an elapsed expiry commits a failed quest that its own saved receipt cannot justify.
test('expired B2 obligation reopens with one trust penalty', () => {
  const a = staged('expire');
  a.reopen();
  assert.equal(
    Object.values(a.world().state.quests ?? {}).find((q) => q.quest.key === 'chandlers_debt')
      ?.outcome,
    'never',
  );
});

// Breaks: a forged bounded Priory/Fen value survives despite the committed +2 turn-in.
test('on-time saved axis must agree with its turn-in receipt', () => {
  const a = staged('deliver');
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
  const a = staged('deliver');
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
  trust.scope = otherPlayer;
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

// Breaks: reopen accepts an on-time acceptance resolved after the on-time window closed.
test('reopen refuses an accept receipt resolved outside its availability window', () => {
  const kind = forge('accept', (r) => {
    r.events.find((e) => e.payload.type === 'choice_resolved')!.logical_time = 151201;
  });
  assert.equal(kind, 'save_corrupt');
});

// Breaks: reopen accepts an accept receipt that activates the quest twice.
test('reopen refuses an accept receipt with two quest activations', () => {
  const kind = forge('accept', (r) => r.delta.ops.push({ ...only(r, 'quest.activate') }));
  assert.equal(kind, 'save_corrupt');
});

// Breaks: reopen accepts an accept receipt that activates another quest instance.
test('reopen refuses an accept receipt that activates another instance', () => {
  const kind = forge('accept', (r) => {
    only(r, 'quest.activate').instance_id = otherId;
  });
  assert.equal(kind, 'save_corrupt');
});

// Breaks: reopen accepts an accept receipt whose activation binds other entities to its roles.
test('reopen refuses an accept receipt with swapped role bindings', () => {
  const kind = forge('accept', (r) => {
    const bindings = only(r, 'quest.activate').bindings as { entity_id: string }[];
    [bindings[0].entity_id, bindings[1].entity_id] = [bindings[1].entity_id, bindings[0].entity_id];
  });
  assert.equal(kind, 'save_corrupt');
});

// Breaks: reopen accepts an accept receipt that schedules the due job twice.
test('reopen refuses an accept receipt with two due job schedules', () => {
  const kind = forge('accept', (r) => r.delta.ops.push({ ...only(r, 'job.schedule') }));
  assert.equal(kind, 'save_corrupt');
});

// Breaks: reopen accepts an accept receipt that schedules a job other than the saved due job.
test('reopen refuses an accept receipt that schedules another job', () => {
  const kind = forge('accept', (r) => {
    only(r, 'job.schedule').job_id = otherId;
  });
  assert.equal(kind, 'save_corrupt');
});

// Breaks: reopen accepts an expiry receipt whose outcome fact_changed event disagrees with the deadline (M5 twin).
test('reopen refuses an expiry receipt with a forged outcome event', () => {
  const kind = forge('expire', (r) => {
    const event = r.events.find(
      (e) =>
        e.payload.type === 'fact_changed' &&
        (e.payload.fact as { key: string }).key === 'priory_tithe_delivered',
    )!;
    event.payload.new = 'late';
  });
  assert.equal(kind, 'save_corrupt');
});

// Breaks: reopen accepts an expiry receipt whose trust assignment is not the deadline penalty.
test('reopen refuses an expiry receipt with another trust value', () => {
  const kind = forge('expire', (r) => {
    only(r, 'fact.assign', 'peg_trust').value = -4;
  });
  assert.equal(kind, 'save_corrupt');
});

// Breaks: reopen accepts an expiry receipt whose trust assignment is outside the expiry's writer group.
test('reopen refuses an expiry receipt with trust in another writer group', () => {
  const kind = forge('expire', (r) => {
    only(r, 'fact.assign', 'peg_trust').writer_group = 2;
  });
  assert.equal(kind, 'save_corrupt');
});

// Breaks: reopen accepts an expiry receipt that fails the quest with another outcome.
test('reopen refuses an expiry receipt that transitions to another outcome', () => {
  const kind = forge('expire', (r) => {
    only(r, 'quest.transition').outcome = 'late';
  });
  assert.equal(kind, 'save_corrupt');
});

// Breaks: reopen accepts an expiry receipt that assigns another outcome fact value.
test('reopen refuses an expiry receipt that assigns another outcome value', () => {
  const kind = forge('expire', (r) => {
    only(r, 'fact.assign', 'priory_tithe_delivered').value = 'late';
  });
  assert.equal(kind, 'save_corrupt');
});
