import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { read } from '../../../kernel/ts/test/read.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { presenter } from '../../app/book/presenter.ts';
import { openGame } from './session.ts';
import { openStory } from './authority.ts';
import {
  INSTALLED,
  loadCartridge,
  newWorld,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';

const bundle = read('protocol/fixtures/missing_child_v012_hash.json');
const ids = read('protocol/fixtures/missing_child_v012_ids.json');
const startLine = 'Wren joins you for the walk to Ferry Landing.';
const rejoinLine = 'Wren steps beside you again';
const endLine = 'Wren runs into Elspeth’s arms.';
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

function setup(path = ':memory:') {
  const a = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  const book = presenter(a.game);
  a.game.subscribe(book.update);
  const view = () => a.game.view().view;
  const ok = (action_key: string, target_ids: string[] = [], input: object = {}) => {
    const reply = a.game.invoke({ action_key, target_ids, input } as never);
    assert.equal(reply.kind, 'saved', JSON.stringify(reply));
    if (reply.kind === 'saved')
      assert.equal(reply.decision.kind, 'accepted', JSON.stringify(reply));
  };
  const move = (...directions: string[]) =>
    directions.forEach((direction) => ok('move', [], { direction }));
  const choose = (choice_id: string, answer?: string) =>
    ok('choose', [], {
      choice_id,
      continuation_id: view().choice!.continuation_id,
      ...(answer && { answer }),
    });
  const offer = () => {
    ok('elspeth', [ids['npc/elspeth']]);
    choose('accept');
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
    choose('answer', 'LANTERN');
    ok('a_wren_escort', [ids['npc/wren']]);
  };
  const press = (npc: string) => {
    const button = book.screen().buttons.find((b) => b.action_key === 'choose');
    assert.ok(button);
    book.press(button, ids[`npc/${npc}`]);
  };
  const row = (section: string, key: string) => {
    const r = a.sql
      .prepare('SELECT value FROM state_row WHERE section=? AND key=?')
      .get(section, key);
    return r && JSON.parse(r.value as string);
  };
  const rows = (section: string) =>
    a.sql
      .prepare('SELECT key,value FROM state_row WHERE section=?')
      .all(section)
      .map((r) => ({ key: r.key as string, value: JSON.parse(r.value as string) }));
  const put = (section: string, key: string, value: unknown) =>
    a.sql
      .prepare('INSERT OR REPLACE INTO state_row VALUES (?,?,?)')
      .run(section, key, JSON.stringify(value));
  const fact = (key: string) => rows('facts').find((r) => JSON.parse(r.key).fact?.key === key);
  const quest = () => rows('quests').find((r) => r.value.quest.key === 'missing_child')!;
  const escort = () => row('escorts', ids.character);
  const lines = (npc: string, text: string) =>
    book
      .screen()
      .detail(ids[`npc/${npc}`])
      .filter((line) => typeof line === 'string' && line.includes(text));
  const end = () => {
    move('north', 'north', 'north', 'north');
    ok('a_elspeth_rescue', [ids['npc/elspeth']]);
    choose('rescued');
  };
  return {
    ...a,
    book,
    view,
    ok,
    move,
    choose,
    offer,
    press,
    row,
    rows,
    put,
    fact,
    quest,
    escort,
    lines,
    end,
  };
}

function replay(a: ReturnType<typeof setup>, choice_id: string) {
  const r = a.sql.prepare('SELECT * FROM receipt ORDER BY revision DESC LIMIT 1').get()!;
  const command = JSON.parse(r.command as string);
  const invocation = {
    invocation_id: r.invocation_id,
    actor_id: ids.character,
    action_key: 'choose',
    target_ids: [],
    input: { choice_id, continuation_id: command.payload.continuation_id },
  };
  const story = openStory(a.db, [{ fresh, content_hash: bundle.sha256 }], a.host);
  assert.equal(story.kind, 'open');
  if (story.kind !== 'open') return;
  const before = a.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all();
  const result = story.invoke(invocation);
  assert.equal(result.kind, 'saved');
  if (result.kind === 'saved') assert.equal(result.replay, true);
  assert.equal(
    story.invoke({ ...invocation, input: { ...invocation.input, choice_id: 'carry_message' } })
      .kind,
    'conflict',
  );
  assert.deepEqual(a.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all(), before);
}

// Breaks: an escort row is lost/rejected at reopen or reconciliation, a lawful separated save is
// rejected, or start/Rejoin/terminal receipts restore to the wrong NPC after their pending row ends.
test('real SQLite rescue reopens start, death separation, Rejoin and terminal with their own narration', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-rescue-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'save.db');
  let a = setup(path);
  a.offer();
  const origin = a.view().choice!.continuation_id;
  const quest = a.quest().key;
  // A committed-but-unacknowledged new relation must pass the same real load boundary on retry.
  a.fault.kind = 'lost';
  a.fault.armed = true;
  a.press('wren');
  assert.equal(a.game.pending(), true);
  assert.equal(a.view().choice!.continuation_id, origin);
  assert.equal(a.lines('wren', startLine).length, 0);
  a.fault.reads = false;
  a.press('wren');
  assert.equal(a.game.pending(), false);
  assert.deepEqual(a.escort(), {
    kind: 'escort',
    actor_id: ids.character,
    body_id: ids.body,
    npc_id: ids['npc/wren'],
    quest_instance_id: quest,
    continuation_id: origin,
    choice_id: 'rescue',
    status: 'following',
  });
  assert.equal(a.row('containers', ids['item/vesper_message']), ids['npc/vesper']);
  assert.equal(a.quest().value.state, 'active');
  assert.equal(a.fact('fen_return_branch')!.value, 'rescue');
  assert.equal(a.fact('village_child_status')?.value ?? 'missing', 'missing');
  assert.equal(a.lines('wren', startLine).length, 1);
  assert.equal(a.lines('vesper', startLine).length, 0);
  replay(a, 'rescue');
  a.sql.close();
  a = setup(path);
  assert.equal(a.lines('wren', startLine).length, 1);
  assert.equal(
    a.book.screen().log.some((s) => s.includes(startLine)),
    false,
  );
  a.move('north', 'north', 'north', 'north');
  assert.equal(a.quest().value.state, 'active');
  a.move('north', 'east', 'down');
  // Controlled lethal input; the real combat sequence supplies the persisted separation evidence.
  const hp = a.rows('resources').find((r) => {
    const k = JSON.parse(r.key);
    return k.entity_id === ids.body && k.resource.key === 'hp';
  })!;
  a.put('resources', hp.key, { ...hp.value, value: 1 });
  a.sql.close();
  a = setup(path);
  a.ok('attack', [ids['npc/cellar_rat_1']]);
  a.clock.wall += 3000;
  a.clock.mono += 3000;
  a.game.pulse();
  assert.equal(a.escort().status, 'separated');
  assert.equal(a.row('containers', ids.body), ids['room/chapel_nave']);
  assert.equal(a.row('containers', ids['npc/wren']), ids['room/lantern_cellar']);
  a.sql.close();
  a = setup(path);
  assert.equal(
    a.view().journal.find((q) => q.quest.key === 'missing_child')!.journal,
    'quest.missing_child.separated',
  );
  a.move('south', 'south', 'south', 'south', 'east', 'down');
  // Returning to Wren's room is a legal separated save, not proof of an accepted Rejoin.
  a.sql.close();
  a = setup(path);
  assert.equal(a.escort().status, 'separated');
  a.ok('b_wren_rejoin', [ids['npc/wren']]);
  a.press('wren');
  assert.equal(a.escort().continuation_id, origin);
  assert.equal(a.escort().status, 'following');
  assert.equal(a.lines('wren', rejoinLine).length, 1);
  replay(a, 'rejoin');
  a.sql.close();
  a = setup(path);
  assert.equal(a.lines('wren', rejoinLine).length, 1);
  assert.equal(
    a.book.screen().log.some((s) => s.includes(rejoinLine)),
    false,
  );
  a.move('up', 'west', 'south');
  a.ok('a_elspeth_rescue', [ids['npc/elspeth']]);
  // A real failed COMMIT must leave the rescued row behind the pending receipt fence.
  a.sql.exec(
    'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
  );
  a.fault.kind = 'failed';
  a.fault.armed = true;
  a.press('elspeth');
  assert.equal(a.game.pending(), true);
  assert.equal(a.view().journal.find((q) => q.quest.key === 'missing_child')!.state, 'active');
  assert.equal(a.lines('elspeth', endLine).length, 0);
  a.fault.reads = false;
  a.press('elspeth');
  assert.equal(a.game.pending(), false);
  assert.equal(a.escort().status, 'completed');
  assert.equal(a.quest().value.outcome, 'rescued');
  assert.equal(a.fact('village_child_status')!.value, 'rescued');
  assert.equal(a.lines('elspeth', endLine).length, 1);
  assert.equal(a.lines('wren', endLine).length, 0);
  replay(a, 'rescued');
  a.sql.close();
  a = setup(path);
  assert.equal(a.lines('elspeth', endLine).length, 1);
  assert.equal(
    a.view().journal.find((q) => q.quest.key === 'missing_child')!.journal,
    'quest.missing_child.rescued',
  );
  a.ok('b_elspeth_rescued', [ids['npc/elspeth']]);
  assert.equal(a.view().choice!.prompt.key, 'dialogue.elspeth_rescued.prompt');
  a.choose('directions');
  a.move('north', 'north');
  assert.equal(a.view().place.description.key, 'room.village_green.rescued');
  assert.equal(a.row('containers', ids['npc/wren']), ids['room/ferry_landing']);
  a.sql.close();
  a = setup(path);
  assert.equal(a.escort().status, 'completed');
  assert.equal(a.row('containers', ids['npc/wren']), ids['room/ferry_landing']);
  a.sql.close();
});

// Breaks: the rescue exception to protected-message validation admits forged branch/terminal
// state, or an unrelated latest receipt hides a missing/swapped original escort or its evidence.
test('retained rescue identity, physical state and own receipts reject corruption behind a later look', async (t) => {
  const cases: [string, boolean, (a: ReturnType<typeof setup>) => void][] = [
    [
      'missing escort row',
      false,
      (a) => {
        a.sql.prepare("DELETE FROM state_row WHERE section='escorts'").run();
      },
    ],
    [
      'substituted bound NPC',
      false,
      (a) => a.put('escorts', ids.character, { ...a.escort(), npc_id: ids['npc/vesper'] }),
    ],
    [
      'wrong quest instance',
      false,
      (a) =>
        a.put('escorts', ids.character, {
          ...a.escort(),
          quest_instance_id: a.rows('quests').find((q) => q.value.quest.key !== 'missing_child')!
            .key,
        }),
    ],
    [
      'wrong originating continuation',
      false,
      (a) =>
        a.put('escorts', ids.character, {
          ...a.escort(),
          continuation_id: a.rows('choices').find((r) => r.value.source.key === 'b_vesper_riddle')!
            .key,
        }),
    ],
    [
      'following NPC in another room',
      false,
      (a) => a.put('containers', ids['npc/wren'], ids['room/ferry_landing']),
    ],
    [
      'separated without committed death',
      false,
      (a) => a.put('escorts', ids.character, { ...a.escort(), status: 'separated' }),
    ],
    [
      'rescue message removed from Vesper',
      false,
      (a) => a.put('containers', ids['item/vesper_message'], ids.body),
    ],
    [
      'rescue branch changed to stays',
      false,
      (a) => a.put('facts', a.fact('fen_return_branch')!.key, 'stays'),
    ],
    [
      'missing start receipt',
      true,
      (a) => {
        a.sql
          .prepare("DELETE FROM receipt WHERE json_extract(command,'$.payload.continuation_id')=?")
          .run(a.escort().continuation_id);
      },
    ],
    [
      'old start receipt missing escort transition',
      true,
      (a) => {
        const r = a.sql
          .prepare(
            "SELECT command_id,response FROM receipt WHERE json_extract(command,'$.payload.continuation_id')=? AND json_extract(response,'$.outcome')='rescue'",
          )
          .get(a.escort().continuation_id)!;
        const response = JSON.parse(r.response as string);
        response.delta.ops = response.delta.ops.filter((op: any) => op.op !== 'escort.transition');
        a.sql
          .prepare('UPDATE receipt SET response=? WHERE command_id=?')
          .run(JSON.stringify(response), r.command_id);
      },
    ],
    [
      'forged rescued terminal without turn-in',
      false,
      (a) => {
        a.put('quests', a.quest().key, {
          ...a.quest().value,
          state: 'resolved',
          outcome: 'rescued',
        });
        a.put('escorts', ids.character, { ...a.escort(), status: 'completed' });
      },
    ],
    [
      'rescued terminal rewritten to stays',
      true,
      (a) => {
        a.put('quests', a.quest().key, { ...a.quest().value, outcome: 'stays' });
        a.put('facts', a.fact('village_child_status')!.key, 'stays');
        a.put('containers', ids['item/vesper_message'], ids['npc/elspeth']);
      },
    ],
    [
      'completed Wren moved away from Elspeth',
      true,
      (a) => a.put('containers', ids['npc/wren'], ids['room/fox_hollow']),
    ],
  ];
  for (const [name, terminal, mutate] of cases)
    await t.test(name, () => {
      const a = setup();
      try {
        a.offer();
        a.choose('rescue');
        if (terminal) a.end();
        a.ok('look');
        mutate(a);
        const before = a.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all();
        assert.throws(
          () => openGame(a.db, bundle, a.host),
          (e: any) => e.cause?.kind === 'save_corrupt',
        );
        assert.deepEqual(
          a.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all(),
          before,
        );
      } finally {
        a.sql.close();
      }
    });
});
