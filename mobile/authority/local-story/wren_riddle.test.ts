import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { read } from '../../../kernel/ts/test/read.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { presenter } from '../../app/book/presenter.ts';
import { openStory } from './authority.ts';
import {
  INSTALLED,
  loadCartridge,
  newWorld,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';

const bundle = read('protocol/fixtures/missing_child_v010_hash.json');
const ids = read('protocol/fixtures/missing_child_v010_ids.json');
function setup(path = ':memory:') {
  const a = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  const book = presenter(a.game);
  a.game.subscribe(book.update);
  const view = () => a.game.view().view;
  const invoke = (action_key: string, target_ids: string[] = [], input: object = {}) =>
    a.game.invoke({ action_key, target_ids, input } as never);
  const ok = (action: string, target: string[] = [], input: object = {}) => {
    const r = invoke(action, target, input);
    assert.equal(r.kind, 'saved', JSON.stringify(r));
    if (r.kind === 'saved') assert.equal(r.decision.kind, 'accepted', JSON.stringify(r));
    return r;
  };
  const move = (...directions: string[]) =>
    directions.forEach((direction) => ok('move', [], { direction }));
  const choose = (choice_id: string, answer?: string) =>
    ok('choose', [], {
      choice_id,
      continuation_id: view().choice!.continuation_id,
      ...(answer !== undefined && { answer }),
    });
  const riddle = () => {
    ok('elspeth', [ids['npc/elspeth']]);
    choose('accept');
    ok('close_choice'); // the hub stays open after an answer (loka-x6t.5): Leave the conversation
    move('north', 'north');
    ok('take', [ids['item/fox_drawing']]);
    move('south', 'south');
    ok('a_elspeth_report', [ids['npc/elspeth']]);
    choose('report');
    move('south', 'south');
    ok('study_tracks');
    move('south', 'south');
    ok('a_vesper_meeting', [ids['npc/vesper']]);
    choose('meet_wren');
    ok('b_vesper_riddle', [ids['npc/vesper']]);
  };
  const submit = (answer: string) => {
    const button = book
      .screen()
      .buttons.find((b) => b.action_key === 'choose' && (b.input as any).choice_id === 'answer')!;
    assert.ok(button);
    book.press({ ...button, input: { ...button.input, answer } }, ids['npc/vesper']);
  };
  const row = () => {
    const c = view().choice!.continuation_id;
    return JSON.parse(
      a.sql.prepare("SELECT value FROM state_row WHERE section='choices' AND key=?").get(c)!
        .value as string,
    );
  };
  return { ...a, book, view, invoke, ok, move, choose, riddle, submit, row };
}

// Breaks: saved roles/beat or narration routing is lost across reopen, answer changes evade intent identity,
// or success restores its line to World after removing the pending continuation.
test('file-backed riddle cold opens before, after wrong and after success with exact replay/conflict', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-q2-b-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'riddle.db');
  let a = setup(path);
  a.riddle();
  const row = a.row(),
    continuation = a.view().choice!.continuation_id;
  assert.deepEqual(row.roles, [
    { role: 'vesper', entity_id: ids['npc/vesper'] },
    { role: 'wren', entity_id: ids['npc/wren'] },
  ]);
  assert.equal(row.beat, 'b_vesper_riddle');
  a.sql.close();
  a = setup(path);
  assert.deepEqual(a.row(), row);
  for (const answer of ['', 'A!', 'A\n', 'N'.repeat(33)]) {
    assert.equal(
      a.invoke('choose', [], { choice_id: 'answer', continuation_id: continuation, answer }).kind,
      'invalid',
    );
    assert.deepEqual(a.row(), row);
  }
  a.submit('STONE');
  assert.equal(a.view().choice!.continuation_id, continuation);
  assert.deepEqual(a.row(), row);
  assert.equal(a.game.lastNarration()!.detail_id, ids['npc/vesper']);
  assert.equal(
    a.book
      .screen()
      .log.some((line) => typeof line === 'string' && line.includes('Try the letters')),
    false,
  );
  const saved = a.sql.prepare('SELECT * FROM receipt ORDER BY revision DESC LIMIT 1').get()!;
  const command = JSON.parse(saved.command as string);
  const invocation = {
    invocation_id: saved.invocation_id,
    actor_id: command.payload.actor_id,
    action_key: 'choose',
    target_ids: [],
    input: { choice_id: 'answer', continuation_id: continuation, answer: 'STONE' },
  };
  const loaded = loadCartridge(
    new TextEncoder().encode(
      JSON.stringify({ cartridge: bundle.value, content_hash: bundle.sha256 }),
    ),
    INSTALLED,
  );
  assert.ok(loaded.ok);
  const fresh = newWorld(
    loaded.cartridge as Cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
  const story = openStory(a.db, [{ fresh, content_hash: bundle.sha256 }], a.host);
  assert.equal(story.kind, 'open');
  if (story.kind !== 'open') return;
  const replay = story.invoke(invocation);
  assert.equal(replay.kind, 'saved');
  if (replay.kind === 'saved') assert.equal(replay.replay, true);
  assert.equal(
    story.invoke({ ...invocation, input: { ...invocation.input, answer: 'LANTERN' } }).kind,
    'conflict',
  );
  a.sql.close();
  a = setup(path);
  assert.deepEqual(a.row(), row);
  assert.equal(
    a.book
      .screen()
      .detail(ids['npc/vesper'])
      .filter((line) => typeof line === 'string' && line.includes('Try the letters')).length,
    1,
  );
  a.submit('LANTERN');
  assert.equal(a.view().choice, undefined);
  assert.equal(
    a.view().journal.find((q) => q.quest.key === 'missing_child')!.journal,
    'quest.missing_child.answered',
  );
  assert.equal(a.view().journal.find((q) => q.quest.key === 'missing_child')!.state, 'active');
  a.sql.close();
  a = setup(path);
  assert.equal(a.view().choice, undefined);
  assert.equal(a.game.lastNarration()!.detail_id, ids['npc/vesper']);
  assert.equal(a.book.screen().detail(ids['npc/vesper']).length, 1);
  assert.equal(
    a.book.screen().log.some((line) => typeof line === 'string' && line.includes('Well answered')),
    false,
  );
  a.sql.close();
});

// Breaks: malformed stored answer/identity/evidence is silently routed to a current or substituted NPC.
test('stored riddle command, binding and root evidence mismatches become typed save corruption', () => {
  const mutations = [
    (a: ReturnType<typeof setup>, r: any) => {
      r.command.id = 'dddddddd-0000-4000-8000-000000000001';
    },
    (a: ReturnType<typeof setup>, r: any) => {
      r.command.payload.choice_id = 'greet';
    },
    (a: ReturnType<typeof setup>, r: any) => {
      r.command.payload.answer = 'STONE';
    },
    (a: ReturnType<typeof setup>, r: any) => {
      r.response.events = [];
    },
    (a: ReturnType<typeof setup>, r: any) => {
      r.response.delta.ops = [];
    },
    (a: ReturnType<typeof setup>, r: any) => {
      r.response.narration[0].participants.wren = ids['npc/vesper'];
    },
    (a: ReturnType<typeof setup>, r: any) => {
      const found = a.sql
        .prepare("SELECT key,value FROM state_row WHERE section='choices' AND key=?")
        .get(r.command.payload.continuation_id)!;
      const row = JSON.parse(found.value as string);
      row.roles[1].entity_id = ids['npc/elspeth'];
      r.response.narration[0].participants.wren = ids['npc/elspeth'];
      a.sql
        .prepare("UPDATE state_row SET value=? WHERE section='choices' AND key=?")
        .run(JSON.stringify(row), found.key);
    },
  ];
  for (const mutate of mutations) {
    const a = setup();
    a.riddle();
    a.submit('LANTERN');
    const last = a.sql
      .prepare('SELECT command_id,command,response FROM receipt ORDER BY revision DESC LIMIT 1')
      .get()!;
    const r = {
      command: JSON.parse(last.command as string),
      response: JSON.parse(last.response as string),
    };
    mutate(a, r);
    a.sql
      .prepare('UPDATE receipt SET command=?,response=? WHERE command_id=?')
      .run(JSON.stringify(r.command), JSON.stringify(r.response), last.command_id);
    // A second authority on the same test connection validates the cold-open path without touching files.
    assert.throws(
      () => elapsedReopen(a),
      (e: any) => e.cause?.kind === 'save_corrupt',
    );
    a.sql.close();
  }
});
function elapsedReopen(a: ReturnType<typeof setup>) {
  return openGame(a.db, bundle, a.host);
}
import { localSession, openGame } from './session.ts';

// Breaks: a null/missing saved source throws before typed corruption offers explicit Start over.
test('malformed retained riddle source offers typed recovery and explicit Start over', async (t) => {
  for (const source of [null, undefined]) {
    await t.test(source === null ? 'null source' : 'missing source', () => {
      const a = setup();
      try {
        a.riddle();
        const continuation = a.view().choice!.continuation_id;
        a.submit('LANTERN');
        const saved = a.sql
          .prepare("SELECT value FROM state_row WHERE section='choices' AND key=?")
          .get(continuation)!;
        const resolved = JSON.parse(saved.value as string);
        assert.equal(resolved.status, 'resolved');
        resolved.source = source;
        a.sql
          .prepare("UPDATE state_row SET value=? WHERE section='choices' AND key=?")
          .run(JSON.stringify(resolved), continuation);
        const session = localSession(() => a.db, assert.fail, bundle, a.host);
        assert.equal(session.game(), undefined);
        assert.equal(session.failed()?.kind, 'save_corrupt');
        assert.equal(session.failed()?.startOver, true);
        assert.equal(session.startOver(), undefined);
        assert.deepEqual(session.game()!.view().view.journal, []);
      } finally {
        a.sql.close();
      }
    });
  }
});

// Breaks: live redraw strands unchanged answer controls or freshness ignores changed continuation/bank.
test('answer input refreshes only across unchanged offered riddle context and reads its own eventless receipt', (t) => {
  const a = setup();
  t.after(() => a.sql.close());
  a.riddle();
  const old = a.book.screen().buttons.find((b) => b.action_key === 'choose')!;
  a.clock.wall += 250;
  a.clock.mono += 250;
  a.game.pulse();
  const requested: (string | undefined)[] = [];
  const original = a.game.lastNarration;
  a.game.lastNarration = (id) => {
    requested.push(id);
    assert.ok(id, 'live result must name its exact receipt');
    return original(id);
  };
  a.book.press({ ...old, input: { ...old.input, answer: 'STONE' } }, ids['npc/vesper']);
  assert.equal(a.book.recovered(), true);
  assert.equal(requested.length, 1);
  assert.equal(a.view().choice!.continuation_id, (old.input as any).continuation_id);
  assert.equal(
    requested[0],
    a.sql.prepare('SELECT command_id FROM receipt ORDER BY revision DESC LIMIT 1').get()!
      .command_id,
  );
  a.game.lastNarration = original;
  const fresh = a.book.screen().buttons.find((b) => b.action_key === 'choose')!;
  a.clock.wall += 250;
  a.clock.mono += 250;
  a.game.pulse();
  const view = a.game.view;
  a.game.view = () => {
    const p = view();
    const choice = p.view.choice!;
    return {
      ...p,
      view: {
        ...p.view,
        choice: {
          ...choice,
          riddle: { ...choice.riddle!, bank: ['N', 'R', 'A', 'O', 'L', 'T', 'E', 'N', 'S'] },
        },
      },
    };
  };
  const beforeBank = a.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n;
  a.book.press({ ...fresh, input: { ...fresh.input, answer: 'LANTERN' } }, ids['npc/vesper']);
  assert.equal(a.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n, beforeBank);
  a.game.view = view;
  a.ok('close_choice');
  a.ok('b_vesper_riddle', [ids['npc/vesper']]);
  const beforeRetalk = a.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n;
  a.book.press({ ...old, input: { ...old.input, answer: 'LANTERN' } }, ids['npc/vesper']);
  assert.equal(a.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n, beforeRetalk);
  assert.equal(
    a.view().journal.find((q) => q.quest.key === 'missing_child')!.journal,
    'quest.missing_child.met',
  );
});

// Breaks: an unknown answer COMMIT leaks success before confirmation, or retry uses the new tile buffer.
test('failed and lost COMMIT answers retain the exact invocation and answer until reconciliation', () => {
  for (const kind of ['failed', 'lost'] as const)
    for (const answer of ['STONE', 'LANTERN']) {
      const a = setup();
      a.riddle();
      a.sql.exec(
        'PRAGMA foreign_keys = ON; CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(id INTEGER REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
      );
      const continuation = a.view().choice!.continuation_id;
      a.fault.kind = kind;
      a.fault.armed = true;
      a.submit(answer);
      assert.equal(a.game.pending(), true);
      const invocation = a.game.pendingInvocation();
      assert.ok(invocation);
      assert.equal(a.book.screen().view.choice!.continuation_id, continuation);
      assert.equal(
        a.book
          .screen()
          .detail(ids['npc/vesper'])
          .some((line) => typeof line === 'string' && line.includes('Well answered')),
        false,
      );
      a.fault.reads = false;
      a.submit(answer === 'STONE' ? 'LANTERN' : 'STONE');
      assert.equal(a.game.pending(), false);
      const stored = a.sql
        .prepare('SELECT command FROM receipt WHERE invocation_id=?')
        .get(invocation)!;
      assert.equal(JSON.parse(stored.command as string).payload.answer, answer);
      assert.equal(a.view().choice?.continuation_id, answer === 'STONE' ? continuation : undefined);
      assert.equal(
        a.view().journal.find((q) => q.quest.key === 'missing_child')!.journal,
        answer === 'STONE' ? 'quest.missing_child.met' : 'quest.missing_child.answered',
      );
      assert.equal(
        a.book
          .screen()
          .detail(ids['npc/vesper'])
          .filter(
            (line) =>
              typeof line === 'string' &&
              line.includes(answer === 'STONE' ? 'Try the letters' : 'Well answered'),
          ).length,
        1,
      );
      a.sql.close();
    }
});
