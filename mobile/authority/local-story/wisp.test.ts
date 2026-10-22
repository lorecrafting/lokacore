import { attemptEvidence } from './riddle-receipt.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle, fresh, ids } from '../../../kernel/ts/test/wisp_fixture.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { openStory } from './authority.ts';
import { presenter } from '../../app/book/presenter.ts';

function setup(path = ':memory:') {
  const a = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  const book = presenter(a.game);
  a.game.subscribe(book.update);
  const view = () => a.game.view().view;
  const ok = (action_key: string, target_ids: string[] = [], input: object = {}) => {
    const r = a.game.invoke({ action_key, target_ids, input } as never);
    assert.equal(r.kind, 'saved', JSON.stringify(r));
    if (r.kind === 'saved') assert.equal(r.decision.kind, 'accepted', JSON.stringify(r));
    return r;
  };
  const choose = (choice_id: string, answer?: string) =>
    ok('choose', [], {
      choice_id,
      continuation_id: view().choice!.continuation_id,
      ...(answer !== undefined && { answer }),
    });
  const move = (...dirs: string[]) => dirs.forEach((direction) => ok('move', [], { direction }));
  const start = () => {
    move('south', 'south', 'south', 'east');
    ok('seek_wisp');
    ok('a_wisp_offer', [ids['npc/wisp']]);
    choose('accept');
    ok('b_wisp_riddle', [ids['npc/wisp']]);
  };
  const row = (id = view().choice!.continuation_id) =>
    JSON.parse(
      a.sql.prepare("SELECT value FROM state_row WHERE section='choices' AND key=?").get(id)!
        .value as string,
    );
  const reopen = () => openStory(a.db, [{ fresh: fresh(), content_hash: bundle.sha256 }], a.host);
  const submit = (answer: string) => {
    const b = book
      .screen()
      .buttons.find((b) => b.action_key === 'choose' && (b.input as any).choice_id === 'answer');
    assert.ok(b);
    book.press({ ...b, input: { ...b.input, answer } }, ids['npc/wisp']);
  };
  return { ...a, book, view, ok, choose, move, start, row, reopen, submit };
}

// Break: intermediate attempt rows, immediate reset or committed original-speaker history are lost on file reopen.
test('real SQLite reopens at counts zero one two, third close, reset and resolved ward', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-wisp-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'story.db');
  let a = setup(path);
  a.start();
  const original = a.view().choice!.continuation_id;
  for (const count of [0, 1, 2]) {
    assert.deepEqual(a.row().attempts, { count, limit: 3 });
    if (count === 1) a.move('south');
    a.sql.close();
    a = setup(path);
    assert.deepEqual(a.row().attempts, { count, limit: 3 });
    if (count === 1) {
      assert.equal(a.view().choice!.choices[0].available, false);
      assert.ok(a.book.screen().buttons.some((b) => b.action_key === 'close_choice'));
      a.move('north');
    }
    a.submit('EDIT');
  }
  assert.equal(a.view().choice, undefined);
  assert.equal(a.row(original).status, 'closed');
  a.sql.close();
  a = setup(path);
  assert.equal(a.view().choice, undefined);
  assert.equal(a.view().journal.find((q) => q.quest.key === 'wisp_ward')!.state, 'active');
  a.ok('b_wisp_riddle', [ids['npc/wisp']]);
  assert.deepEqual(a.row().attempts, { count: 0, limit: 3 });
  a.sql.close();
  a = setup(path);
  a.submit('TIDE');
  assert.equal(a.view().topics?.[0].label, 'topic.ward');
  a.sql.close();
  a = setup(path);
  assert.equal(a.view().choice, undefined);
  assert.equal(a.view().topics?.length, 1);
  assert.equal(
    a.book
      .screen()
      .detail(ids['npc/wisp'])
      .filter((l) => typeof l === 'string' && l.includes('learn the ward')).length,
    1,
  );
  a.move('west', 'north', 'north', 'north', 'north', 'north', 'north', 'north', 'north');
  const b = a.book.screen().buttons.find((b) => b.action_key === 'c_aldric_ward');
  assert.ok(b);
  a.book.press(b, ids['npc/aldric']);
  assert.equal(a.view().choice!.prompt.key, 'dialogue.aldric.ward');
  a.choose('ward');
  assert.equal(a.reopen().kind, 'open');
  a.sql.close();
});

// Break: a failed or uncertain COMMIT partly adopts count, closure or grant, or a lost acknowledgement increments twice.
test('wrong final-wrong and correct commits reconcile both real outcomes and exact replay once', () => {
  for (const kind of ['failed', 'lost'] as const)
    for (const phase of ['wrong', 'third', 'correct'] as const) {
      const a = setup();
      a.start();
      if (phase === 'third') {
        a.submit('EDIT');
        a.submit('DIET');
      }
      const continuation = a.view().choice!.continuation_id,
        before = a.row();
      a.sql.exec(
        'PRAGMA foreign_keys=ON; CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(id INTEGER REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
      );
      a.fault.kind = kind;
      a.fault.armed = true;
      a.submit(phase === 'correct' ? 'TIDE' : 'EDIT');
      assert.equal(a.game.pending(), true);
      const invocation = a.game.pendingInvocation();
      assert.ok(invocation);
      assert.deepEqual(a.book.screen().view.choice!.riddle!.attempts, before.attempts);
      const stored = a.row(continuation);
      if (kind === 'failed') assert.deepEqual(stored, before);
      else {
        assert.equal(stored.attempts.count, phase === 'correct' ? 0 : phase === 'third' ? 3 : 1);
        assert.equal(
          stored.status,
          phase === 'correct' ? 'resolved' : phase === 'third' ? 'closed' : 'pending',
        );
      }
      assert.equal(a.book.screen().view.topics?.length, 0);
      a.fault.reads = false;
      a.submit('TIDE');
      assert.equal(a.game.pending(), false);
      const receipt = a.sql
        .prepare('SELECT command,invocation_id,revision FROM receipt WHERE invocation_id=?')
        .get(invocation)!;
      assert.equal(
        JSON.parse(receipt.command as string).payload.answer,
        phase === 'correct' ? 'TIDE' : 'EDIT',
      );
      assert.equal(
        a.row(continuation).attempts.count,
        phase === 'correct' ? 0 : phase === 'third' ? 3 : 1,
      );
      assert.equal(
        a.row(continuation).status,
        phase === 'correct' ? 'resolved' : phase === 'third' ? 'closed' : 'pending',
      );
      const opened = a.reopen();
      assert.equal(opened.kind, 'open');
      if (opened.kind === 'open') {
        const replay = opened.invoke({
          invocation_id: invocation,
          actor_id: fresh().character,
          action_key: 'choose',
          target_ids: [],
          input: {
            choice_id: 'answer',
            continuation_id: continuation,
            answer: phase === 'correct' ? 'TIDE' : 'EDIT',
          },
        } as never);
        assert.equal(replay.kind, 'saved');
        if (replay.kind === 'saved') assert.equal(replay.replay, true);
      }
      assert.equal(
        a.row(continuation).attempts.count,
        phase === 'correct' ? 0 : phase === 'third' ? 3 : 1,
      );
      a.sql.close();
    }
});

// Break: forged source/quest/actor/revision/count associations or lost prior attempt evidence load as lawful state.
test('bounded saves refuse forged rows and wrong receipts without deleting progress', () => {
  const mutations = [
    (r: any) => {
      delete r.attempts;
    },
    (r: any) => {
      r.attempts = null;
    },
    (r: any) => {
      delete r.attempts.count;
    },
    (r: any) => {
      r.attempts.count = null;
    },
    (r: any) => {
      r.attempts.count = 2;
    },
    (r: any) => {
      r.attempts.count = 3;
    },
    (r: any) => {
      r.actor_id = ids['npc/aldric'];
    },
    (r: any) => {
      r.source.key = 'c_aldric_ward';
    },
    (r: any) => {
      r.quest_instance_id = ids['npc/aldric'];
    },
    (r: any) => {
      r.opened_revision++;
    },
  ];
  for (const mutate of mutations) {
    const a = setup();
    a.start();
    a.submit('EDIT');
    const id = a.view().choice!.continuation_id,
      r = a.row();
    mutate(r);
    a.sql
      .prepare("UPDATE state_row SET value=? WHERE section='choices' AND key=?")
      .run(JSON.stringify(r), id);
    const before = a.sql.prepare('SELECT count(*) AS n FROM state_row').get()!.n;
    const opened = a.reopen();
    assert.equal(opened.kind, 'save_corrupt');
    assert.equal(a.sql.prepare('SELECT count(*) AS n FROM state_row').get()!.n, before);
    a.sql.close();
  }
  for (const mutate of [
    (r: any) => {
      r.delta.ops[0].prior_count = 1;
    },
    (r: any) => {
      r.delta.ops[0].source.key = 'c_aldric_ward';
    },
    (r: any) => {
      r.delta.ops[0].quest_instance_id = ids['npc/aldric'];
    },
    (r: any) => {
      r.delta.ops[0].actor_id = ids['npc/aldric'];
    },
  ]) {
    const a = setup();
    a.start();
    a.submit('EDIT');
    const last = a.sql
      .prepare(
        "SELECT command_id,response FROM receipt WHERE json_extract(response,'$.outcome')='riddle_wrong'",
      )
      .get()!;
    const response = JSON.parse(last.response as string);
    mutate(response);
    a.sql
      .prepare('UPDATE receipt SET response=? WHERE command_id=?')
      .run(JSON.stringify(response), last.command_id);
    assert.equal(a.reopen().kind, 'save_corrupt');
    a.sql.close();
  }
});

// Break: forged discovery or ward knowledge is accepted without an actual owned Seek/grant receipt.
test('unjustified discovery and topic facts fail cold-open reconciliation', () => {
  for (const key of ['fen_wisp_discovered', 'fen_wisp_answered', 'topic_ward_known']) {
    const a = setup(),
      w = fresh(); // Canonical target bytes are supplied independently, including the nested reference/scope order.
    const encoded = `{"fact":{"cartridge_id":"ashmere_missing_child","cartridge_version":"0.0.23","key":"${key}","kind":"fact"},"kind":"fact","scope":{"character_id":"${w.character}","kind":"player"}}`;
    a.sql.prepare('INSERT INTO state_row VALUES (?,?,?)').run('facts', encoded, 'true');
    assert.equal(a.reopen().kind, 'save_corrupt');
    a.sql.close();
  }
});

// Break: the historical attempt verifier trusts the operation's actor/source/quest instead of the saved sitting.
test('receipt association checks reject forged actor source and quest independently of later save consumers', () => {
  const a = setup();
  a.start();
  a.submit('EDIT');
  const saved = a.sql
    .prepare(
      "SELECT command,response FROM receipt WHERE json_extract(response,'$.outcome')='riddle_wrong'",
    )
    .get()!;
  const command = JSON.parse(saved.command as string),
    response = JSON.parse(saved.response as string),
    row = a.row();
  assert.equal(attemptEvidence(response, command, row), true);
  for (const [field, v] of [
    ['actor_id', ids['npc/aldric']],
    ['source', { ...row.source, key: 'c_aldric_ward' }],
    ['quest_instance_id', ids['npc/aldric']],
  ] as const) {
    const forged = structuredClone(response);
    forged.delta.ops[0][field] = v;
    assert.equal(attemptEvidence(forged, command, row), false, field);
  }
  a.sql.close();
});

// Break: exact-selector Talk receipts can justify a different eligible Aldric source after reopening.
test('cold-open verifies the ward Talk selector against its saved source', () => {
  const a = setup();
  a.start();
  a.submit('TIDE');
  a.move('west', 'north', 'north', 'north', 'north', 'north', 'north', 'north', 'north');
  a.ok('c_aldric_ward', [ids['npc/aldric']]);
  a.choose('ward');
  assert.equal(a.reopen().kind, 'open');
  const r = a.sql
    .prepare(
      "SELECT command_id,command FROM receipt WHERE json_extract(command,'$.payload.dialogue.key')='c_aldric_ward'",
    )
    .get()!;
  const command = JSON.parse(r.command as string);
  command.payload.dialogue.key = 'b_aldric';
  a.sql
    .prepare('UPDATE receipt SET command=? WHERE command_id=?')
    .run(JSON.stringify(command), r.command_id);
  assert.equal(a.reopen().kind, 'save_corrupt');
  a.sql.close();
});
