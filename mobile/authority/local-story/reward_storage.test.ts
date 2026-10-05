import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rewardHost, killFive, offer, fresh, entity } from './__tests__/reward-host.test.ts';
import { gameView } from '../../../kernel/ts/src/index.ts';
import { ref } from '../../../kernel/ts/test/reward_storage_fixture.ts';
import { value } from '../../../kernel/ts/src/mechanics/fact.ts';

const disk = (p: ReturnType<typeof rewardHost>) =>
  ['state_row', 'head', 'receipt', 'elapsed'].map((t) =>
    p.sql.prepare(`SELECT * FROM ${t} ORDER BY 1,2`).all(),
  );
const reward = (p: ReturnType<typeof rewardHost>) => {
  const w = p.story.world();
  return [
    w.state.containers[entity(w, 'item', 'reward_key')],
    value(w, w.character, ref('fact', 'maud_trust')),
    value(w, w.character, ref('fact', 'inn_cellar_cleared')),
    Object.values(w.state.quests!)[0].state,
    Object.values(w.state.choices!).at(-1)!.status,
  ];
};

// Breaks: actual M6 credits do not survive to their first reward consumer, or receipt replay/reopen pays twice.
test('five actual preacceptance kills reopen into one atomic reward and identity-preserving storage', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-reward-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'save.db');
  let p = rewardHost(path);
  killFive(p);
  assert.deepEqual(
    p.story
      .world()
      .cartridge.world!.death_credit!.map((m) => value(p.story.world(), fresh.character, m.fact)),
    [true, true, true, true, true],
  );
  assert.deepEqual(p.story.world().state.quests ?? {}, {});
  p.sql.close();
  p = rewardHost(path);
  offer(p);
  const i = p.invocation('choose', [], {
    continuation_id: gameView(p.story.world()).choice!.continuation_id,
    choice_id: 'done',
  });
  assert.equal(p.story.invoke(i).kind, 'saved');
  assert.deepEqual(reward(p), [fresh.body, 5, true, 'resolved', 'resolved']);
  const before = disk(p);
  const replay = p.story.invoke(i);
  assert.equal(replay.kind, 'saved');
  if (replay.kind === 'saved') assert.equal(replay.replay, true);
  assert.deepEqual(disk(p), before);
  const retry = p.story.invoke(p.invocation('choose', [], i.input));
  assert.equal(retry.kind, 'saved');
  if (retry.kind === 'saved')
    assert.deepEqual(retry.decision, { kind: 'rejected', error: { code: 'invalid_state' } });
  p.invoke('move', [], { direction: 'up' });
  const chest = entity(fresh, 'item', 'reward_chest'),
    item = entity(fresh, 'item', 'brass_key');
  assert.equal(p.story.world().state.containers[entity(fresh, 'item', 'reward_key')], fresh.body);
  assert.equal(Object.values(p.story.world().state.containers).includes(chest), false);
  p.invoke('unlock', [chest]);
  p.invoke('open', [chest]);
  p.invoke('take', [item]);
  p.invoke('put', [item, chest]);
  p.invoke('close', [chest]);
  p.sql.close();
  p = rewardHost(path);
  assert.equal(p.story.world().state.containers[item], chest);
  p.invoke('open', [chest]);
  p.invoke('take', [item]);
  assert.equal(p.story.world().state.containers[item], fresh.body);
  p.invoke('drop', [entity(fresh, 'item', 'reward_key')]);
  p.sql.close();
  p = rewardHost(path);
  const once = p.story.invoke(p.invocation('choose', [], i.input));
  assert.equal(once.kind, 'saved');
  if (once.kind === 'saved') assert.equal((once.decision as { kind: string }).kind, 'rejected');
  assert.equal(value(p.story.world(), fresh.character, ref('fact', 'maud_trust')), 5);
  p.sql.close();
});

// Breaks: storage faults adopt a partial reward or omit one changed row/head/receipt during reconcile.
test('real rollback, failed COMMIT and lost acknowledgement preserve complete old/new reward rows across reopen', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-reward-fault-'));
  t.after(() => rmSync(dir, { recursive: true }));
  for (const kind of ['rollback', 'failed', 'lost'] as const) {
    const path = join(dir, `${kind}.db`);
    let p = rewardHost(path);
    killFive(p);
    offer(p);
    const old = p.story.world(),
      prior = disk(p);
    const i = p.invocation('choose', [], {
      continuation_id: gameView(old).choice!.continuation_id,
      choice_id: 'done',
    });
    if (kind === 'rollback') {
      p.sql.exec(
        "CREATE TRIGGER fail_reward BEFORE INSERT ON state_row WHEN NEW.section='facts' BEGIN SELECT RAISE(ABORT, 'reward fault'); END",
      );
      assert.throws(() => p.story.invoke(i));
      assert.deepEqual(disk(p), prior);
      assert.equal(p.story.world(), old);
      p.sql.exec('DROP TRIGGER fail_reward');
    } else {
      if (kind === 'failed')
        p.sql.exec(
          'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
        );
      p.fault.kind = kind;
      p.fault.armed = true;
      assert.equal(p.story.invoke(i).kind, 'pending');
      assert.equal(p.story.world(), old);
      assert.equal(p.story.invoke(p.invocation('look')).kind, 'pending');
      p.fault.reads = false;
      if (kind === 'failed') assert.deepEqual(disk(p), prior);
      const reconciled = p.story.invoke(i);
      assert.equal(reconciled.kind, 'saved');
      if (reconciled.kind === 'saved') assert.equal(reconciled.replay, kind === 'lost');
      assert.deepEqual(reward(p), [fresh.body, 5, true, 'resolved', 'resolved']);
    }
    const saved = disk(p);
    p.sql.close();
    p = rewardHost(path);
    assert.deepEqual(disk(p), saved);
    assert.deepEqual(
      reward(p),
      kind === 'rollback'
        ? [entity(fresh, 'npc', 'maud'), 0, false, 'active', 'pending']
        : [fresh.body, 5, true, 'resolved', 'resolved'],
    );
    p.sql.close();
  }
});
