// riddle-save over the riddle fragment (kernel/ts/test/riddle_fixture.ts): a sphinx beside Bram asks
// a three-try riddle of the lantern quest (bank T I D E, answer tide). Expected texts and limits are
// authored there.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { bundle, entity, genesis } from '../../../kernel/ts/test/riddle_fixture.ts';
import { presenter } from '../../app/book/presenter.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { openStory } from './authority.ts';
import { attemptEvidence } from './riddle-receipt.ts';
import { localSession } from './session.ts';

const initial = genesis();
const id = (kind: string, name: string) => entity(initial, kind, name);

function setup(path = ':memory:', change?: (c: any) => void) {
  const b = bundle(change);
  const a = elapsedHost(path, { wall: 10000, mono: 0 }, b);
  const book = presenter(a.game);
  a.game.subscribe(book.update);
  const view = () => a.game.view().view;
  const invoke = (action_key: string, target_ids: string[] = [], input: object = {}) =>
    a.game.invoke({ action_key, target_ids, input } as never);
  const ok = (action_key: string, target_ids: string[] = [], input: object = {}) => {
    const r = invoke(action_key, target_ids, input);
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
  /** Accept the lantern quest (and take the lantern, which offers the answer) and open the riddle. */
  const start = (lantern = true) => {
    ok('lantern');
    if (lantern) ok('take', [id('item', 'lantern')]);
    ok('riddle', [id('npc', 'sphinx')]);
  };
  const row = (c = view().choice!.continuation_id) =>
    JSON.parse(
      a.sql.prepare("SELECT value FROM state_row WHERE section='choices' AND key=?").get(c)!
        .value as string,
    );
  const reopen = () => openStory(a.db, [{ fresh: genesis(), content_hash: b.sha256 }], a.host);
  const submit = (answer: string) => {
    const button = book
      .screen()
      .buttons.find((b) => b.action_key === 'choose' && (b.input as any).choice_id === 'answer');
    assert.ok(button);
    book.press({ ...button, input: { ...button.input, answer } }, id('npc', 'sphinx'));
  };
  const last = () => a.sql.prepare('SELECT * FROM receipt ORDER BY revision DESC LIMIT 1').get()!;
  const lines = (text: string) =>
    book
      .screen()
      .detail(id('npc', 'sphinx'))
      .filter((l) => typeof l === 'string' && l.includes(text)).length;
  return { ...a, b, book, view, invoke, ok, choose, move, start, row, reopen, submit, last, lines };
}
const tmp = (t: any) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-riddle-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};

// Breaks (loka-x6t.5): riddle-save not counting a Talk that left the riddle (riddle-save.ts:128),
// or its receipt query missing that close (:40), so the save cold-opens save_corrupt; or the
// attempt row or the new speaker is lost on reopen.
test('a riddle left by a Talk reopens closed at count one beside the new speaker', (t) => {
  const path = join(tmp(t), 'talk.db');
  let a = setup(path);
  a.start();
  const riddle = a.view().choice!.continuation_id;
  a.submit('EDIT');
  a.ok('bram', [id('npc', 'bram')]);
  const ops = JSON.parse(a.last().response as string).delta.ops;
  assert.ok(ops.some((o: any) => o.op === 'choice.close' && o.continuation_id === riddle));
  a.sql.close();
  a = setup(path);
  assert.deepEqual(
    [a.row(riddle).status, a.row(riddle).attempts],
    ['closed', { count: 1, limit: 3 }],
  );
  assert.equal(a.view().choice!.speaker_id, id('npc', 'bram'));
  a.sql.close();
});

// Breaks: intermediate attempt rows, the walk-away state, the third close, the immediate reset or
// the solved fact are lost on file reopen.
test('real SQLite reopens at counts zero one two, third close, reset and solved', (t) => {
  const path = join(tmp(t), 'story.db');
  let a = setup(path);
  a.start();
  const original = a.view().choice!.continuation_id;
  for (const count of [0, 1, 2]) {
    assert.deepEqual(a.row().attempts, { count, limit: 3 });
    if (count === 1) a.move('north');
    a.sql.close();
    a = setup(path);
    assert.deepEqual(a.row(original).attempts, { count, limit: 3 });
    if (count === 1) {
      assert.equal(a.view().choice!.choices[0].available, false);
      assert.ok(a.book.screen().buttons.some((b) => b.action_key === 'close_choice'));
      a.move('south');
    }
    a.submit('EDIT');
  }
  assert.equal(a.view().choice, undefined);
  assert.equal(a.row(original).status, 'closed');
  a.sql.close();
  a = setup(path);
  assert.equal(a.view().choice, undefined);
  assert.equal(a.view().journal.find((q) => q.quest.key === 'lantern')!.state, 'active');
  a.ok('riddle', [id('npc', 'sphinx')]);
  assert.deepEqual(a.row().attempts, { count: 0, limit: 3 });
  a.sql.close();
  a = setup(path);
  a.submit('TIDE');
  a.sql.close();
  a = setup(path);
  assert.equal(a.view().choice, undefined);
  assert.equal(a.lines('The sphinx nods.'), 1);
  a.sql.close();
});

// Breaks: saved roles are lost across reopen, malformed answers reach the kernel, a wrong answer
// consumes the continuation, or an answer change evades intent identity on replay.
test('file-backed riddle cold opens with roles, refuses malformed answers, replays exactly', (t) => {
  const path = join(tmp(t), 'riddle.db');
  let a = setup(path);
  a.start();
  const row = a.row(),
    continuation = a.view().choice!.continuation_id;
  assert.deepEqual(row.roles, [
    { role: 'bram', entity_id: id('npc', 'bram') },
    { role: 'sphinx', entity_id: id('npc', 'sphinx') },
  ]);
  a.sql.close();
  a = setup(path);
  assert.deepEqual(a.row(), row);
  for (const answer of ['', 'A!', 'A\n', 'N'.repeat(33)]) {
    const r = a.invoke('choose', [], {
      choice_id: 'answer',
      continuation_id: continuation,
      answer,
    });
    assert.equal(r.kind, 'invalid', answer);
    assert.deepEqual(a.row(), row);
  }
  a.submit('EDIT');
  assert.equal(a.view().choice!.continuation_id, continuation);
  assert.equal(a.game.lastNarration()!.detail_id, id('npc', 'sphinx'));
  const saved = a.last();
  const invocation = {
    invocation_id: saved.invocation_id,
    actor_id: initial.character,
    action_key: 'choose',
    target_ids: [],
    input: { choice_id: 'answer', continuation_id: continuation, answer: 'EDIT' },
  };
  const story = a.reopen();
  assert.equal(story.kind, 'open');
  if (story.kind !== 'open') return;
  const replay = story.invoke(invocation as never);
  assert.ok(replay.kind === 'saved' && replay.replay);
  const changed = { ...invocation, input: { ...invocation.input, answer: 'TIDE' } };
  assert.equal(story.invoke(changed as never).kind, 'conflict');
  a.sql.close();
  a = setup(path);
  assert.equal(a.lines('The sphinx shakes its head.'), 1);
  a.submit('TIDE');
  assert.equal(a.view().choice, undefined);
  a.sql.close();
});

// Breaks: a failed or uncertain COMMIT partly adopts count, closure or the solved line, a lost
// acknowledgement counts twice, or the retry sends the new answer instead of the pending one.
test('failed and lost COMMIT of wrong, third and correct answers reconcile once', () => {
  for (const kind of ['failed', 'lost'] as const)
    for (const phase of ['wrong', 'third', 'correct'] as const) {
      const a = setup();
      a.start();
      if (phase === 'third') ['EDIT', 'DIET'].forEach(a.submit);
      const continuation = a.view().choice!.continuation_id,
        before = a.row();
      const answer = phase === 'correct' ? 'TIDE' : 'TIED';
      const after = {
        count: { wrong: 1, third: 3, correct: 0 }[phase],
        status: { wrong: 'pending', third: 'closed', correct: 'resolved' }[phase],
      };
      a.sql.exec(
        'PRAGMA foreign_keys=ON; CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(id INTEGER REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
      );
      a.fault.kind = kind;
      a.fault.armed = true;
      a.submit(answer);
      assert.equal(a.game.pending(), true);
      const invocation = a.game.pendingInvocation();
      assert.ok(invocation);
      assert.deepEqual(a.book.screen().view.choice!.riddle!.attempts, before.attempts);
      assert.equal(a.lines('The sphinx nods.'), 0);
      const stored = a.row(continuation);
      if (kind === 'failed') assert.deepEqual(stored, before);
      else assert.deepEqual([stored.attempts.count, stored.status], [after.count, after.status]);
      a.fault.reads = false;
      a.submit(phase === 'correct' ? 'EDIT' : 'TIDE');
      assert.equal(a.game.pending(), false);
      const receipt = a.sql
        .prepare('SELECT command FROM receipt WHERE invocation_id=?')
        .get(invocation)!;
      assert.equal(JSON.parse(receipt.command as string).payload.answer, answer);
      const final = a.row(continuation);
      assert.deepEqual([final.attempts.count, final.status], [after.count, after.status]);
      assert.equal(a.lines('The sphinx nods.'), phase === 'correct' ? 1 : 0);
      const opened = a.reopen();
      assert.equal(opened.kind, 'open');
      if (opened.kind === 'open') {
        const replay = opened.invoke({
          invocation_id: invocation,
          actor_id: initial.character,
          action_key: 'choose',
          target_ids: [],
          input: { choice_id: 'answer', continuation_id: continuation, answer },
        } as never);
        assert.ok(replay.kind === 'saved' && replay.replay);
      }
      assert.equal(a.row(continuation).attempts.count, after.count);
      a.sql.close();
    }
});

// Breaks: forged count, actor, source, quest or revision on the saved row, or a forged attempt
// op, loads as lawful state, or the refusal deletes progress.
test('bounded saves refuse forged rows and wrong receipts without deleting progress', () => {
  const bram = id('npc', 'bram');
  const mutations: ((r: any) => void)[] = [
    (r) => delete r.attempts,
    (r) => (r.attempts = null),
    (r) => delete r.attempts.count,
    (r) => (r.attempts.count = null),
    (r) => (r.attempts.count = 2),
    (r) => (r.attempts.count = 3),
    (r) => (r.actor_id = bram),
    (r) => (r.source.key = 'bram'),
    (r) => (r.quest_instance_id = bram),
    (r) => r.opened_revision++,
  ];
  for (const mutate of mutations) {
    const a = setup();
    a.start();
    a.submit('EDIT');
    const c = a.view().choice!.continuation_id,
      r = a.row();
    mutate(r);
    a.sql
      .prepare("UPDATE state_row SET value=? WHERE section='choices' AND key=?")
      .run(JSON.stringify(r), c);
    const rows = a.sql.prepare('SELECT count(*) AS n FROM state_row').get()!.n;
    assert.equal(a.reopen().kind, 'save_corrupt', mutate.toString());
    assert.equal(a.sql.prepare('SELECT count(*) AS n FROM state_row').get()!.n, rows);
    a.sql.close();
  }
  const ops: ((o: any) => void)[] = [
    (o) => (o.prior_count = 1),
    (o) => (o.source.key = 'bram'),
    (o) => (o.quest_instance_id = bram),
    (o) => (o.actor_id = bram),
  ];
  for (const mutate of ops) {
    const a = setup();
    a.start();
    a.submit('EDIT');
    const last = a.last();
    const response = JSON.parse(last.response as string);
    mutate(response.delta.ops[0]);
    a.sql
      .prepare('UPDATE receipt SET response=? WHERE command_id=?')
      .run(JSON.stringify(response), last.command_id);
    assert.equal(a.reopen().kind, 'save_corrupt', mutate.toString());
    a.sql.close();
  }
  // A one-time quest's sitting binds to its row even with row and receipt forged together.
  const a = setup();
  a.start();
  a.submit('EDIT');
  const row = a.row();
  const forged = a.sql
    .prepare('UPDATE receipt SET response=replace(response,?,?) WHERE response LIKE ?')
    .run(row.quest_instance_id, bram, `%${a.view().choice!.continuation_id}%`);
  assert.ok(forged.changes >= 2);
  a.sql
    .prepare("UPDATE state_row SET value=? WHERE section='choices' AND key=?")
    .run(JSON.stringify({ ...row, quest_instance_id: bram }), a.view().choice!.continuation_id);
  assert.equal(a.reopen().kind, 'save_corrupt');
  a.sql.close();
});

// Breaks: a stored answer, choice, command id, outcome evidence or participant binding that no
// longer matches its row is replayed onto the current speakers instead of refusing the save.
test('stored riddle command, binding and evidence mismatches become typed save corruption', () => {
  const sphinx = id('npc', 'sphinx');
  const mutations: ((a: ReturnType<typeof setup>, r: any) => void)[] = [
    (_, r) => (r.command.id = 'dddddddd-0000-4000-8000-000000000001'),
    (_, r) => (r.command.payload.choice_id = 'greet'),
    (_, r) => (r.command.payload.answer = 'EDIT'),
    (_, r) => (r.response.events = []),
    (_, r) => (r.response.delta.ops = []),
    (_, r) => (r.response.narration[0].participants.bram = sphinx),
    (a, r) => {
      const c = r.command.payload.continuation_id,
        row = a.row(c);
      row.roles[0].entity_id = sphinx;
      r.response.narration[0].participants.bram = sphinx;
      a.sql
        .prepare("UPDATE state_row SET value=? WHERE section='choices' AND key=?")
        .run(JSON.stringify(row), c);
    },
  ];
  for (const mutate of mutations) {
    const a = setup();
    a.start();
    a.submit('TIDE');
    const last = a.last();
    const r = {
      command: JSON.parse(last.command as string),
      response: JSON.parse(last.response as string),
    };
    mutate(a, r);
    a.sql
      .prepare('UPDATE receipt SET command=?,response=? WHERE command_id=?')
      .run(JSON.stringify(r.command), JSON.stringify(r.response), last.command_id);
    assert.equal(a.reopen().kind, 'save_corrupt', mutate.toString());
    a.sql.close();
  }
});

// Breaks: the attempt verifier trusts the op's actor, source or quest instead of the saved sitting.
test('attempt evidence rejects a forged actor, source or quest', () => {
  const a = setup();
  a.start();
  a.submit('EDIT');
  const saved = a.last();
  const command = JSON.parse(saved.command as string),
    response = JSON.parse(saved.response as string),
    row = a.row();
  assert.equal(attemptEvidence(response, command, row), true);
  for (const [field, v] of [
    ['actor_id', id('npc', 'bram')],
    ['source', { ...row.source, key: 'bram' }],
    ['quest_instance_id', id('npc', 'bram')],
  ] as const) {
    const forged = structuredClone(response);
    forged.delta.ops[0][field] = v;
    assert.equal(attemptEvidence(forged, command, row), false, field);
  }
  a.sql.close();
});

// Breaks: a null or missing saved source throws before typed corruption offers explicit Start over.
test('a malformed retained riddle source offers typed recovery and Start over', () => {
  for (const source of [null, undefined]) {
    const a = setup();
    a.start();
    const c = a.view().choice!.continuation_id;
    a.submit('TIDE');
    const resolved = a.row(c);
    assert.equal(resolved.status, 'resolved');
    resolved.source = source;
    a.sql
      .prepare("UPDATE state_row SET value=? WHERE section='choices' AND key=?")
      .run(JSON.stringify(resolved), c);
    const session = localSession(() => a.db, assert.fail, a.b, a.host);
    assert.equal(session.game(), undefined);
    assert.equal(session.failed()?.kind, 'save_corrupt');
    assert.equal(session.failed()?.startOver, true);
    assert.equal(session.startOver(), undefined);
    assert.deepEqual(session.game()!.view().view.journal, []);
    a.sql.close();
  }
});

// Breaks: a live redraw strands unchanged answer controls, freshness ignores a changed bank or
// continuation, or the result reads another receipt's narration.
test('answer input refreshes only across unchanged riddle context and reads its own receipt', (t) => {
  // Real elapsed time (which refuses timed scripted actions), so a pulse changes the view token.
  const a = setup(':memory:', (c) => {
    c.manifest.time_policy = { profile: 'real_elapsed', rate: 50 };
    delete c.scripted_actions[`${c.manifest.id}@0.0.1:action/coil_rope`].duration;
  });
  t.after(() => a.sql.close());
  a.start();
  const receipts = () => a.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n;
  const pulse = () => {
    a.clock.wall += 250;
    a.clock.mono += 250;
    a.game.pulse();
  };
  const old = a.book.screen().buttons.find((b) => b.action_key === 'choose')!;
  pulse();
  const requested: (string | undefined)[] = [];
  const original = a.game.lastNarration;
  a.game.lastNarration = (c) => {
    requested.push(c);
    return original(c);
  };
  a.book.press({ ...old, input: { ...old.input, answer: 'EDIT' } }, id('npc', 'sphinx'));
  assert.equal(a.book.recovered(), true);
  assert.equal(a.view().choice!.continuation_id, (old.input as any).continuation_id);
  assert.deepEqual(requested, [a.last().command_id]);
  a.game.lastNarration = original;
  const fresh = a.book.screen().buttons.find((b) => b.action_key === 'choose')!;
  pulse();
  const view = a.game.view;
  a.game.view = () => {
    const p = view();
    const choice = p.view.choice;
    if (!choice) return p;
    return {
      ...p,
      view: {
        ...p.view,
        choice: { ...choice, riddle: { ...choice.riddle!, bank: ['T', 'I', 'D', 'E', 'S'] } },
      },
    };
  };
  const beforeBank = receipts();
  a.book.press({ ...fresh, input: { ...fresh.input, answer: 'TIDE' } }, id('npc', 'sphinx'));
  assert.equal(receipts(), beforeBank);
  a.game.view = view;
  a.ok('close_choice');
  a.ok('riddle', [id('npc', 'sphinx')]);
  const beforeRetalk = receipts();
  a.book.press({ ...old, input: { ...old.input, answer: 'TIDE' } }, id('npc', 'sphinx'));
  assert.equal(receipts(), beforeRetalk);
});
