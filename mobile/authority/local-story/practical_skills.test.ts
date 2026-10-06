import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { practicalHost, ids } from './__tests__/practical-host.ts';
import { gameView } from '../../../kernel/ts/src/index.ts';
import { pool } from '../../../kernel/ts/test/practical_skills_fixture.ts';
import { openStory } from './authority.ts';
const patch = ids['detail/willow_shade/fenwort_patch'];
const herbs = [ids['item/fenwort_02'], ids['item/fenwort_09']];
const money = (a: ReturnType<typeof practicalHost>, teacher: string) => [
  a.world().state.resources![pool(a.world(), 'pennies')].value,
  a.world().state.resources![pool(a.world(), 'pennies', ids[`npc/${teacher}`])].value,
];
function accepted(a: ReturnType<typeof practicalHost>, i: object) {
  const r = a.story().invoke(i);
  assert.equal(r.kind, 'saved', JSON.stringify(r));
  if (r.kind === 'saved') assert.equal((r.decision as any).kind, 'accepted', JSON.stringify(r));
  return r;
}
// Breaks: actual Sedge/Peg binding charges the wrong teacher, qualification gates acquisition, or repeat learning grants/charges twice.
test('both original 2p teachers learn below qualification, refuse low funds and replay one receipt on disk', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'd12-lessons-'));
  t.after(() => rmSync(dir, { recursive: true }));
  for (const [teacher, skill, room, initial] of [
    ['sedge', 'herbalism', 'isle_hut', 0],
    ['peg', 'haggle', 'chandler', 20],
  ] as const) {
    const a = practicalHost(room, 9, 3, join(dir, `${skill}.db`));
    t.after(() => a.sql.close());
    const i = a.learn(teacher, skill);
    a.reopen();
    accepted(a, i);
    a.reopen();
    assert.deepEqual(money(a, teacher), [1, initial + 2]);
    assert.deepEqual(
      gameView(a.world()).skills!.find((s) => s.skill.key === skill),
      {
        skill: {
          cartridge_id: 'ashmere_missing_child',
          cartridge_version: '0.0.30',
          kind: 'skill',
          key: skill,
        },
        label: `skill.${skill}.label`,
        requirement: `skill.${skill}.requirement`,
        acquired: true,
        qualified: false,
        usable: false,
      },
    );
    const count = a.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n;
    const replay = accepted(a, i);
    assert.equal(replay.kind === 'saved' && replay.replay, true);
    assert.equal(a.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n, count);
    assert.deepEqual(money(a, teacher), [1, initial + 2]);
    const repeat = a.story().invoke(a.invocation(`${teacher}_${skill}`, [ids[`npc/${teacher}`]]));
    assert.equal(repeat.kind === 'saved' && (repeat.decision as any).kind, 'rejected');
    a.reopen();
  }
  const poor = practicalHost('isle_hut', 10, 1);
  t.after(() => poor.sql.close());
  const i = poor.learn();
  const before = poor.world().state;
  const r = poor.story().invoke(i);
  assert.equal(r.kind === 'saved' && (r.decision as any).kind, 'rejected');
  assert.deepEqual(poor.world().state, before);
  poor.reopen();
});
// Breaks: current MV or later herb custody invalidates lawful historical qualification, or careful transfers fail cold/replay.
test('careful harvest and discounted Buy retain historical truth across cold opens and later custody/qualification', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'd12-consumers-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const a = practicalHost('isle_hut', 10, 20, join(dir, 'careful.db'));
  t.after(() => a.sql.close());
  accepted(a, a.learn());
  a.reopen();
  a.toPatch();
  a.reopen();
  const i = a.invocation('gather_carefully', [patch], { method: 'careful' });
  accepted(a, i);
  a.reopen();
  assert.deepEqual(
    herbs.map((id) => a.world().state.containers[id]),
    [a.world().body, a.world().body],
  );
  assert.equal(gameView(a.world()).notices!.find((n) => n.id === patch)!.remaining, 10);
  assert.equal(accepted(a, i).kind, 'saved');
  a.invoke('drop', [herbs[0]]);
  a.reopen();
  assert.equal(a.world().state.containers[herbs[0]], ids['room/willow_shade']);
  a.invoke('take', [herbs[0]]);
  a.invoke('harvest', [patch]);
  a.reopen();
  for (const direction of [
    'east',
    'north',
    'north',
    'north',
    'north',
    'north',
    'north',
    'north',
    'north',
    'east',
  ])
    a.invoke('move', [], { direction });
  a.invoke('a_wick_offer', [ids['npc/wick']]);
  a.invoke('choose', [], {
    continuation_id: gameView(a.world()).choice!.continuation_id,
    choice_id: 'accept',
  });
  a.invoke('b_wick_turn_in', [ids['npc/wick']]);
  a.invoke('choose', [], {
    continuation_id: gameView(a.world()).choice!.continuation_id,
    choice_id: 'exchange',
  });
  a.reopen();
  assert.deepEqual(
    [...herbs, ids['item/fenwort_01']].map((id) => a.world().state.containers[id]),
    [ids['npc/wick'], ids['npc/wick'], ids['npc/wick']],
  );
  assert.deepEqual(
    [ids['item/bandage_04'], ids['item/bandage_08'], ids['item/bandage_05']].map(
      (id) => a.world().state.containers[id],
    ),
    [a.world().body, a.world().body, a.world().body],
  );
  assert.deepEqual(money(a, 'sedge'), [18, 2]);
  const b = practicalHost('chandler', 10, 3, join(dir, 'buy.db'), 5);
  t.after(() => b.sql.close());
  accepted(b, b.learn('peg', 'haggle'));
  b.reopen();
  const buy = b.invocation('buy', [ids['npc/peg'], ids['item/lamp_oil']], { quoted_price: 1 });
  accepted(b, buy);
  b.reopen();
  assert.deepEqual(money(b, 'peg'), [0, 23]);
  assert.equal(b.world().state.containers[ids['item/lamp_oil']], b.world().body);
  assert.equal(accepted(b, buy).kind, 'saved');
  b.invoke('drop', [ids['item/lamp_oil']]);
  b.invoke('move', [], { direction: 'east' });
  b.reopen();
  assert.equal(gameView(b.world()).skills!.find((s) => s.skill.key === 'haggle')!.usable, false);
});
// Breaks: failed or uncertain writes adopt partial skill/payment, two-herb custody, or discounted payment before reconciliation; replay duplicates them.
test('all three new writers reconcile real failed COMMIT and lost acknowledgement, fence, reopen and replay once', () => {
  for (const boundary of ['lesson', 'careful', 'buy'])
    for (const fault of ['known_failed', 'failed', 'lost'] as const) {
      const a = practicalHost(boundary === 'buy' ? 'chandler' : 'isle_hut');
      try {
        let i;
        if (boundary === 'lesson') i = a.learn();
        else if (boundary === 'careful') {
          accepted(a, a.learn());
          a.toPatch();
          i = a.invocation('gather_carefully', [patch], { method: 'careful' });
        } else {
          accepted(a, a.learn('peg', 'haggle'));
          i = a.invocation('buy', [ids['npc/peg'], ids['item/torch']], { quoted_price: 2 });
        }
        const before = a.world().state;
        a.sql.exec(
          'PRAGMA foreign_keys=ON; CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(id INTEGER REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
        );
        a.fault.kind = fault === 'known_failed' ? 'failed' : fault;
        a.fault.armed = true;
        if (fault === 'known_failed') {
          const exec = a.db.execSync;
          a.db.execSync = (operation) => {
            try {
              exec(operation);
            } catch (error) {
              a.fault.reads = false;
              throw error;
            }
          };
          assert.throws(() => a.story().invoke(i), /COMMIT failed; nothing was saved/);
        } else assert.equal(a.story().invoke(i).kind, 'pending');
        assert.deepEqual(a.world().state, before);
        if (fault !== 'known_failed') {
          assert.equal(a.story().invoke(a.invocation('look')).kind, 'pending');
          assert.equal(
            a.story().elapsed({ expected_run_id: a.story().runId(), from: 0, until: 1 }).kind,
            'pending',
          );
        }
        a.fault.reads = false;
        if (a.sql.isTransaction) a.sql.exec('ROLLBACK');
        a.reopen();
        if (fault !== 'lost') assert.deepEqual(a.world().state, before);
        else assert.notDeepEqual(a.world().state, before);
        const retry = accepted(a, i);
        assert.equal(retry.kind === 'saved' && retry.replay, fault === 'lost');
        a.reopen();
        const next = a.world().state;
        accepted(a, i);
        assert.deepEqual(a.world().state, next);
      } finally {
        a.sql.close();
      }
    }
});
// Breaks: incomplete careful custody/event evidence or forged effective price is accepted by the save loader.
test('corrupt two-item receipt and fully funded forged discounted quote refuse without rewriting the save', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'd12-corrupt-'));
  t.after(() => rmSync(dir, { recursive: true }));
  for (const corruption of ['transfer', 'event', 'price']) {
    const path = join(dir, `${corruption}.db`);
    const a = practicalHost(corruption === 'price' ? 'chandler' : 'isle_hut', 10, 20, path);
    try {
      accepted(
        a,
        a.learn(
          corruption === 'price' ? 'peg' : 'sedge',
          corruption === 'price' ? 'haggle' : 'herbalism',
        ),
      );
      if (corruption === 'price')
        a.invoke('buy', [ids['npc/peg'], ids['item/torch']], { quoted_price: 2 });
      else {
        a.toPatch();
        a.invoke('gather_carefully', [patch], { method: 'careful' });
      }
      const row: any = a.sql
        .prepare('SELECT command_id,command,response FROM receipt ORDER BY revision DESC LIMIT 1')
        .get();
      const command = JSON.parse(row.command),
        response = JSON.parse(row.response);
      if (corruption === 'transfer') response.delta.ops.pop();
      if (corruption === 'event') response.events.pop();
      if (corruption === 'price') {
        command.payload.quoted_price = 3;
        for (const op of response.delta.ops)
          if (op.op === 'resource.adjust') op.to += op.entity_id === a.world().body ? -1 : 1;
        for (const [entity, by] of [
          [a.world().body, -1],
          [ids['npc/peg'], 1],
        ] as const)
          a.sql
            .prepare(
              "UPDATE state_row SET value=json_set(value,'$.value',json_extract(value,'$.value')+?) WHERE section='resources' AND key=?",
            )
            .run(by, pool(a.world(), 'pennies', entity));
      }
      a.sql
        .prepare('UPDATE receipt SET command=?,response=? WHERE command_id=?')
        .run(JSON.stringify(command), JSON.stringify(response), row.command_id);
      const before = a.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all();
      const bytes = readFileSync(path);
      const opened = openStory(a.db, a.releases, a.host);
      assert.equal(opened.kind, 'save_corrupt', JSON.stringify(opened));
      assert.deepEqual(a.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all(), before);
      assert.deepEqual(readFileSync(path), bytes);
    } finally {
      a.sql.close();
    }
  }
});
