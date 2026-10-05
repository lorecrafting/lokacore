// size: allow 550, message receipt, custody, corruption and COMMIT recovery share one real SQLite journey
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { read } from '../../../kernel/ts/test/read.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { presenter } from '../../app/book/presenter.ts';
import { localSession, openGame } from './session.ts';
import { openStory } from './authority.ts';
import {
  INSTALLED,
  loadCartridge,
  newWorld,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';

const bundle = read('protocol/fixtures/missing_child_v011_hash.json');
const ids = read('protocol/fixtures/missing_child_v011_ids.json');
const message = ids['item/vesper_message'];
const vesperLine = 'Vesper places his folded message in your hand.';
const elspethLine = 'Elspeth accepts Vesper’s message and reads it slowly.';
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
    const r = a.game.invoke({ action_key, target_ids, input } as never);
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
    ok('c_vesper_answered', [ids['npc/vesper']]);
  };
  const terminal = () => {
    move('north', 'north', 'north', 'north');
    ok('a_elspeth_return', [ids['npc/elspeth']]);
  };
  const button = () => {
    const b = book.screen().buttons.find((b) => b.action_key === 'choose');
    assert.ok(b);
    return b;
  };
  const press = (npc: string) => book.press(button(), ids[`npc/${npc}`]);
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
  const fact = (key: string) => rows('facts').find((r) => JSON.parse(r.key).fact?.key === key);
  const put = (section: string, key: string, value: unknown) =>
    a.sql
      .prepare('UPDATE state_row SET value=? WHERE section=? AND key=?')
      .run(JSON.stringify(value), section, key);
  const lines = (npc: string, text: string) =>
    book
      .screen()
      .detail(ids[`npc/${npc}`])
      .filter((line) => typeof line === 'string' && line.includes(text));
  return {
    ...a,
    book,
    view,
    ok,
    move,
    choose,
    offer,
    terminal,
    button,
    press,
    row,
    rows,
    fact,
    put,
    lines,
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
    story.invoke({ ...invocation, input: { ...invocation.input, choice_id: 'other' } }).kind,
    'conflict',
  );
  assert.deepEqual(a.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all(), before);
}

// Breaks: nonterminal receive loses its saved speaker, terminal handoff loses its outcome on reopen,
// replay repeats a transfer, or reopened status no longer drives Elspeth/Green/journal presentation.
test('original message branch and terminal reopen with their own NPC narration and exact replay', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-message-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'save.db');
  let a = setup(path);
  a.offer();
  const branch = a.view().choice!.continuation_id;
  assert.deepEqual(a.row('choices', branch).roles, [
    { role: 'message', entity_id: message },
    { role: 'vesper', entity_id: ids['npc/vesper'] },
    { role: 'wren', entity_id: ids['npc/wren'] },
  ]);
  a.press('vesper');
  assert.equal(a.row('containers', message), ids.body);
  assert.equal(a.fact('fen_return_branch')!.value, 'stays');
  assert.equal(a.fact('village_child_status')?.value ?? 'missing', 'missing');
  assert.equal(a.view().journal.find((q) => q.quest.key === 'missing_child')!.state, 'active');
  assert.equal(a.lines('vesper', vesperLine).length, 1);
  assert.equal(a.lines('elspeth', vesperLine).length, 0);
  replay(a, 'carry_message');
  a.sql.close();
  a = setup(path);
  assert.equal(a.view().choice, undefined);
  assert.equal(a.lines('vesper', vesperLine).length, 1);
  assert.equal(
    a.book.screen().log.some((s) => s.includes(vesperLine)),
    false,
  );
  a.terminal();
  a.press('elspeth');
  assert.equal(a.row('containers', message), ids['npc/elspeth']);
  assert.equal(a.fact('village_child_status')!.value, 'stays');
  assert.equal(a.view().journal.find((q) => q.quest.key === 'missing_child')!.state, 'resolved');
  assert.equal(
    a.rows('quests').find((q) => q.value.quest.key === 'missing_child')!.value.outcome,
    'stays',
  );
  assert.equal(a.lines('elspeth', elspethLine).length, 1);
  assert.equal(a.lines('vesper', elspethLine).length, 0);
  replay(a, 'stays');
  a.sql.close();
  a = setup(path);
  assert.equal(a.lines('elspeth', elspethLine).length, 1);
  assert.equal(
    a.book.screen().log.some((s) => s.includes(elspethLine)),
    false,
  );
  assert.equal(a.row('containers', message), ids['npc/elspeth']);
  assert.equal(
    a.view().journal.find((q) => q.quest.key === 'missing_child')!.journal,
    'quest.missing_child.resolved',
  );
  a.ok('b_elspeth_stays', [ids['npc/elspeth']]);
  assert.equal(a.view().choice!.prompt.key, 'dialogue.elspeth_stays.prompt');
  a.choose('directions');
  a.move('north', 'north');
  assert.equal(a.view().place.id, ids['room/village_green']);
  assert.equal(a.view().place.description.key, 'room.village_green.stays');
  a.sql.close();
});

// Breaks: a retained receive row is validated against current direct possession, rejecting legal
// Drop/Put saves, or a stale Book handoff succeeds after the same message leaves the actor's body.
test('Drop and held-container Put reopen and recover the same item; stale handoff never prints success', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-message-custody-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'save.db');
  let a = setup(path);
  a.offer();
  a.choose('carry_message');
  a.terminal();
  const stale = a.button();
  a.ok('drop', [message]);
  const count = a.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n;
  a.book.press(stale, ids['npc/elspeth']);
  assert.equal(a.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n, count);
  assert.equal(a.lines('elspeth', elspethLine).length, 0);
  a.sql.close();
  a = setup(path);
  assert.equal(a.row('containers', message), ids['room/ferry_landing']);
  a.ok('take', [message]);
  a.ok('close_choice');
  a.move('north', 'east', 'up');
  a.ok('take', [ids['item/brass_key']]);
  a.move('up');
  a.ok('unlock', [ids['item/trunk']]);
  a.ok('open', [ids['item/trunk']]);
  a.ok('take', [ids['item/trunk']]);
  a.ok('put', [message, ids['item/trunk']]);
  a.sql.close();
  a = setup(path);
  assert.equal(a.row('containers', message), ids['item/trunk']);
  a.move('down', 'down', 'west', 'south');
  a.ok('a_elspeth_return', [ids['npc/elspeth']]);
  const nested = a.game.invoke({
    action_key: 'choose',
    target_ids: [],
    input: {
      choice_id: 'stays',
      continuation_id: a.view().choice!.continuation_id,
    },
  } as never);
  assert.equal(nested.kind, 'saved');
  if (nested.kind === 'saved') assert.equal(nested.decision.kind, 'rejected');
  assert.equal(a.row('containers', message), ids['item/trunk']);
  a.ok('take', [message]);
  a.choose('stays');
  assert.equal(a.row('containers', message), ids['npc/elspeth']);
  a.sql.close();
});

// Breaks: saved branch evidence rejects real corpse custody, or recovery replaces the original
// message instead of taking its retained identity from the corpse before terminal delivery.
test('fatal combat and cold reopen preserve the message through ordinary corpse recovery', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-message-corpse-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'save.db');
  let a = setup(path);
  a.offer();
  a.choose('carry_message');
  a.move('north', 'north', 'north', 'north', 'north', 'east', 'down');
  // Controlled lethal input; real combat creates the corpse and transfers its contents.
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
  assert.equal(a.row('containers', ids.body), ids['room/chapel_nave']);
  const corpse = a.row('containers', message);
  assert.equal(a.row('containers', corpse), ids['room/lantern_cellar']);
  assert.equal(a.rows('created').length, 1);
  a.sql.close();
  a = setup(path);
  assert.equal(a.row('containers', message), corpse);
  a.move('south', 'south', 'south', 'south', 'east', 'down');
  a.ok('take', [message]);
  assert.equal(a.row('containers', message), ids.body);
  a.move('up', 'west', 'south');
  a.ok('a_elspeth_return', [ids['npc/elspeth']]);
  a.choose('stays');
  assert.equal(a.row('containers', message), ids['npc/elspeth']);
  a.sql.close();
});

// Breaks: elapsed-only view tokens strand an unchanged branch control despite identical context.
test('elapsed redraw keeps an unchanged message choice usable', (t) => {
  const a = setup();
  t.after(() => a.sql.close());
  a.offer();
  const old = a.button();
  a.clock.wall += 250;
  a.clock.mono += 250;
  a.game.pulse();
  a.book.press(old, ids['npc/vesper']);
  assert.equal(a.book.recovered(), true);
  assert.equal(a.row('containers', message), ids.body);
  assert.equal(a.lines('vesper', vesperLine).length, 1);
});

// Breaks: retained roles/facts/custody or accepted receipt evidence can be forged once an unrelated
// command becomes latest, bypassing cold-open validation of the original receive/handoff.
test('retained delivery evidence corruption is typed even behind an unrelated latest receipt', async (t) => {
  const mutations: [string, boolean, (a: ReturnType<typeof setup>, branch: string) => void][] = [
    [
      'missing branch row',
      false,
      (a, b) => {
        a.sql.prepare("DELETE FROM state_row WHERE section='choices' AND key=?").run(b);
      },
    ],
    [
      'wrong message role',
      false,
      (a, b) => {
        const r = a.row('choices', b);
        r.roles.find((r: any) => r.role === 'message').entity_id = ids['item/fox_drawing'];
        a.put('choices', b, r);
      },
    ],
    [
      'null retained source',
      false,
      (a, b) => {
        const r = a.row('choices', b);
        r.source = null;
        a.put('choices', b, r);
      },
    ],
    [
      'branch fact reset',
      false,
      (a) => a.put('facts', a.fact('fen_return_branch')!.key, 'unselected'),
    ],
    [
      'branch fact deleted',
      false,
      (a) => {
        a.sql
          .prepare("DELETE FROM state_row WHERE section='facts' AND key=?")
          .run(a.fact('fen_return_branch')!.key);
      },
    ],
    ['message in unrelated NPC', false, (a) => a.put('containers', message, ids['npc/maud'])],
    [
      'message nested in NPC-held container',
      false,
      (a) => {
        a.put('containers', message, ids['item/trunk']);
        a.put('containers', ids['item/trunk'], ids['npc/maud']);
      },
    ],
    [
      'malformed receipt command JSON',
      false,
      (a, b) => {
        const r = a.sql
          .prepare(
            "SELECT command_id FROM receipt WHERE json_extract(command,'$.payload.continuation_id')=? ORDER BY revision DESC LIMIT 1",
          )
          .get(b)!;
        a.sql.prepare('UPDATE receipt SET command=? WHERE command_id=?').run('{', r.command_id);
      },
    ],
    [
      'receipt transfer removed',
      false,
      (a, b) => {
        const r = a.sql
          .prepare(
            "SELECT command_id,response FROM receipt WHERE json_extract(command,'$.payload.continuation_id')=? ORDER BY revision DESC LIMIT 1",
          )
          .get(b)!;
        const response = JSON.parse(r.response as string);
        response.delta.ops = response.delta.ops.filter((o: any) => o.op !== 'entity.transfer');
        a.sql
          .prepare('UPDATE receipt SET response=? WHERE command_id=?')
          .run(JSON.stringify(response), r.command_id);
      },
    ],
    [
      'receive narration names another speaker',
      false,
      (a, b) => {
        const r = a.sql
          .prepare(
            "SELECT command_id,response FROM receipt WHERE json_extract(command,'$.payload.continuation_id')=? ORDER BY revision DESC LIMIT 1",
          )
          .get(b)!;
        const response = JSON.parse(r.response as string);
        response.narration[0].participants.vesper = ids['npc/elspeth'];
        a.sql
          .prepare('UPDATE receipt SET response=? WHERE command_id=?')
          .run(JSON.stringify(response), r.command_id);
      },
    ],
    [
      'terminal fact event missing',
      true,
      (a) => {
        const r = a.sql
          .prepare(
            "SELECT command_id,response FROM receipt WHERE json_extract(command,'$.payload.choice_id')='stays' ORDER BY revision DESC LIMIT 1",
          )
          .get()!;
        const response = JSON.parse(r.response as string);
        response.events = response.events.filter((e: any) => e.payload.type !== 'fact_changed');
        a.sql
          .prepare('UPDATE receipt SET response=? WHERE command_id=?')
          .run(JSON.stringify(response), r.command_id);
      },
    ],
    [
      'terminal status reset',
      true,
      (a) => a.put('facts', a.fact('village_child_status')!.key, 'missing'),
    ],
    ['terminal message returned to actor', true, (a) => a.put('containers', message, ids.body)],
    [
      'terminal quest reopened',
      true,
      (a) => {
        const q = a.rows('quests').find((r) => r.value.quest.key === 'missing_child')!;
        q.value.state = 'active';
        delete q.value.outcome;
        a.put('quests', q.key, q.value);
      },
    ],
  ];
  for (const [name, terminal, mutate] of mutations)
    await t.test(name, () => {
      const a = setup();
      try {
        a.offer();
        const branch = a.view().choice!.continuation_id;
        a.choose('carry_message');
        if (terminal) {
          a.terminal();
          a.choose('stays');
        }
        a.ok('look');
        mutate(a, branch);
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

// Breaks: uncertain receive/handoff COMMIT exposes a success before confirmation or reconciliation
// repeats its transfer; failed COMMIT must exercise real rollback, not only lost acknowledgements.
test('failed and lost branch/terminal COMMIT keep narration and custody behind confirmed disk', () => {
  for (const kind of ['failed', 'lost'] as const)
    for (const terminal of [false, true]) {
      const a = setup();
      try {
        a.offer();
        if (terminal) {
          a.choose('carry_message');
          a.terminal();
        }
        a.sql.exec(
          'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
        );
        const npc = terminal ? 'elspeth' : 'vesper';
        const line = terminal ? elspethLine : vesperLine;
        const before = a.view();
        a.fault.kind = kind;
        a.fault.armed = true;
        a.press(npc);
        assert.equal(a.game.pending(), true);
        const invocation = a.game.pendingInvocation();
        assert.ok(invocation);
        assert.deepEqual(a.view(), before);
        assert.equal(a.lines(npc, line).length, 0);
        a.fault.reads = false;
        a.press(npc);
        assert.equal(a.game.pending(), false);
        assert.equal(a.row('containers', message), terminal ? ids['npc/elspeth'] : ids.body);
        assert.equal(
          a.sql.prepare('SELECT count(*) AS n FROM receipt WHERE invocation_id=?').get(invocation)!
            .n,
          1,
        );
        assert.equal(a.lines(npc, line).length, 1);
      } finally {
        a.sql.close();
      }
    }
});

// Breaks: the v011 app silently opens or replaces a v010 save despite its different release pin.
test('v011 refuses the frozen v010 SQLite save and offers explicit Start over without changing it', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-message-old-pin-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const old = elapsedHost(
    join(dir, 'save.db'),
    { wall: 10000, mono: 0 },
    read('protocol/fixtures/missing_child_v010_hash.json'),
  );
  t.after(() => old.sql.close());
  const moved = old.game.invoke({
    action_key: 'move',
    target_ids: [],
    input: { direction: 'north' },
  } as never);
  assert.equal(moved.kind, 'saved');
  if (moved.kind === 'saved') assert.equal(moved.decision.kind, 'accepted');
  const snapshot = () =>
    ['head', 'state_row', 'receipt', 'elapsed'].map((table) =>
      old.sql.prepare(`SELECT * FROM ${table} ORDER BY 1,2`).all(),
    );
  const before = snapshot();
  const session = localSession(() => old.db, assert.fail, bundle, old.host);
  assert.equal(session.game(), undefined);
  assert.equal(session.failed()?.kind, 'pinned_release_missing');
  assert.equal(session.failed()?.startOver, true);
  assert.deepEqual(snapshot(), before);
});
