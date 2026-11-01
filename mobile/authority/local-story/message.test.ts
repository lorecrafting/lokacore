// Protected message saves over the message fragment (kernel/ts/test/message_fixture.ts): a courier on
// the green hands the player a sealed message (receive, branch carried) and Bram's lantern-quest
// dialogue takes it (hand_over, delivered). Expected texts and roles are authored there.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { bundle, genesis, prefix } from '../../../kernel/ts/test/message_fixture.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { presenter } from '../../app/book/presenter.ts';
import { localSession, openGame } from './session.ts';
import { openStory } from './authority.ts';

// A 100g satchel fits beside the message under the 1000g ceiling, so it can be carried and filled.
const light = (c: any) => {
  c.items[`${prefix}:item/satchel`].mass_grams = 100;
};
const b = bundle(light);
const fresh = genesis(light);
const id = (kind: string, name: string) => fresh.entityIds[`${prefix}:${kind}/${name}`]!;
const message = id('item', 'message'),
  satchel = id('item', 'satchel'),
  courier = id('npc', 'courier'),
  bram = id('npc', 'bram');
const npcs: Record<string, string> = { courier, bram };
const courierLine = 'The courier hands you the sealed message.';
const bramLine = 'Bram takes the sealed message.';

function setup(path = ':memory:') {
  const a = elapsedHost(path, { wall: 10000, mono: 0 }, b);
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
  const choose = (choice_id: string) =>
    ok('choose', [], { choice_id, continuation_id: view().choice!.continuation_id });
  /** Accept the lantern quest, walk to the courier and open the message offer. */
  const offer = () => {
    ok('lantern');
    move('north');
    ok('courier', [courier]);
  };
  /** Carry the message back to Ferry Landing and open Bram's turn-in. */
  const terminal = () => {
    move('south');
    ok('deliver', [bram]);
  };
  const button = () => {
    const b = book.screen().buttons.find((b) => b.action_key === 'choose');
    assert.ok(b);
    return b;
  };
  const press = (npc: string) => book.press(button(), npcs[npc]);
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
      .detail(npcs[npc])
      .filter((line) => typeof line === 'string' && line.includes(text));
  const quest = () => view().journal.find((q) => q.quest.key === 'lantern');
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
    quest,
  };
}

function replay(a: ReturnType<typeof setup>, choice_id: string) {
  const r = a.sql.prepare('SELECT * FROM receipt ORDER BY revision DESC LIMIT 1').get()!;
  const command = JSON.parse(r.command as string);
  const invocation = {
    invocation_id: r.invocation_id,
    actor_id: fresh.character,
    action_key: 'choose',
    target_ids: [],
    input: { choice_id, continuation_id: command.payload.continuation_id },
  };
  const story = openStory(a.db, [{ fresh, content_hash: b.sha256 }], a.host);
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
// replay repeats a transfer, or reopened status no longer drives the journal.
test('message receive and terminal handoff reopen with their own NPC narration and exact replay', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-message-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'save.db');
  let a = setup(path);
  a.offer();
  const branch = a.view().choice!.continuation_id;
  assert.deepEqual(a.row('choices', branch).roles, [
    { role: 'courier', entity_id: courier },
    { role: 'message', entity_id: message },
  ]);
  a.press('courier');
  assert.equal(a.row('containers', message), fresh.body);
  assert.equal(a.fact('branch')!.value, 'carried');
  assert.equal(a.fact('delivered')?.value ?? false, false);
  assert.equal(a.quest()!.state, 'active');
  assert.equal(a.lines('courier', courierLine).length, 1);
  assert.equal(a.lines('bram', courierLine).length, 0);
  replay(a, 'carry');
  a.sql.close();
  a = setup(path);
  assert.equal(a.view().choice, undefined);
  assert.equal(a.lines('courier', courierLine).length, 1);
  assert.equal(
    a.book.screen().log.filter((s) => (typeof s === 'string' ? s : s.text).includes(courierLine))
      .length,
    1, // its page's line also lands in the room log once (book-ui.md Line placement)
  );
  a.terminal();
  a.press('bram');
  assert.equal(a.row('containers', message), bram);
  assert.equal(a.fact('delivered')!.value, true);
  assert.equal(a.quest()!.state, 'resolved');
  assert.equal(
    a.rows('quests').find((q) => q.value.quest.key === 'lantern')!.value.outcome,
    'deliver',
  );
  assert.equal(a.lines('bram', bramLine).length, 1);
  assert.equal(a.lines('courier', bramLine).length, 0);
  replay(a, 'deliver');
  a.sql.close();
  a = setup(path);
  assert.equal(a.lines('bram', bramLine).length, 1);
  // Every line lands in the room log too, restored once (book-ui.md Line placement).
  assert.equal(
    a.book.screen().log.filter((s) => (typeof s === 'string' ? s : s.text).includes(bramLine))
      .length,
    1,
  );
  assert.equal(a.row('containers', message), bram);
  assert.equal(a.quest()!.state, 'resolved');
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
  a.choose('carry');
  a.terminal();
  const stale = a.button();
  a.ok('drop', [message]);
  const count = a.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n;
  a.book.press(stale, bram);
  assert.equal(a.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n, count);
  assert.equal(a.lines('bram', bramLine).length, 0);
  a.sql.close();
  a = setup(path);
  assert.equal(a.row('containers', message), fresh.roomIds[`${prefix}:room/ferry_landing`]);
  a.ok('take', [message]);
  a.ok('close_choice');
  a.move('north');
  a.ok('take', [satchel]);
  a.ok('put', [message, satchel]);
  a.sql.close();
  a = setup(path);
  assert.equal(a.row('containers', message), satchel);
  a.move('south');
  a.ok('deliver', [bram]);
  const nested = a.game.invoke({
    action_key: 'choose',
    target_ids: [],
    input: { choice_id: 'deliver', continuation_id: a.view().choice!.continuation_id },
  } as never);
  assert.equal(nested.kind, 'saved');
  if (nested.kind === 'saved') assert.equal(nested.decision.kind, 'rejected');
  assert.equal(a.row('containers', message), satchel);
  a.ok('take', [message]);
  a.choose('deliver');
  assert.equal(a.row('containers', message), bram);
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
  a.book.press(old, courier);
  assert.equal(a.book.recovered(), true);
  assert.equal(a.row('containers', message), fresh.body);
  assert.equal(a.lines('courier', courierLine).length, 1);
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
        r.roles.find((r: any) => r.role === 'message').entity_id = satchel;
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
    ['branch fact reset', false, (a) => a.put('facts', a.fact('branch')!.key, 'unselected')],
    [
      'branch fact deleted',
      false,
      (a) => {
        a.sql
          .prepare("DELETE FROM state_row WHERE section='facts' AND key=?")
          .run(a.fact('branch')!.key);
      },
    ],
    ['message back with the courier', false, (a) => a.put('containers', message, courier)],
    [
      'message nested in NPC-held container',
      false,
      (a) => {
        a.put('containers', message, satchel);
        a.put('containers', satchel, courier);
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
        response.narration[0].participants.courier = bram;
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
            "SELECT command_id,response FROM receipt WHERE json_extract(command,'$.payload.choice_id')='deliver' ORDER BY revision DESC LIMIT 1",
          )
          .get()!;
        const response = JSON.parse(r.response as string);
        response.events = response.events.filter((e: any) => e.payload.type !== 'fact_changed');
        a.sql
          .prepare('UPDATE receipt SET response=? WHERE command_id=?')
          .run(JSON.stringify(response), r.command_id);
      },
    ],
    ['terminal delivered fact reset', true, (a) => a.put('facts', a.fact('delivered')!.key, false)],
    ['terminal message returned to actor', true, (a) => a.put('containers', message, fresh.body)],
    [
      'terminal quest reopened',
      true,
      (a) => {
        const q = a.rows('quests').find((r) => r.value.quest.key === 'lantern')!;
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
        a.choose('carry');
        if (terminal) {
          a.terminal();
          a.choose('deliver');
        }
        a.ok('look');
        mutate(a, branch);
        const before = a.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all();
        assert.throws(
          () => openGame(a.db, b, a.host),
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
          a.choose('carry');
          a.terminal();
        }
        a.sql.exec(
          'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
        );
        const npc = terminal ? 'bram' : 'courier';
        const line = terminal ? bramLine : courierLine;
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
        assert.equal(a.row('containers', message), terminal ? bram : fresh.body);
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

// Breaks: a forged terminal quest row before receiving the message bypasses handoff validation,
// showing delivery while leaving the branch, delivered fact and original custody untouched.
test('terminal quest without a message branch refuses reopen and requires explicit Start over', (t) => {
  const a = setup();
  t.after(() => a.sql.close());
  assert.deepEqual(openGame(a.db, b, a.host).view().view.journal, []);
  a.ok('lantern');
  assert.equal(openGame(a.db, b, a.host).view().view.journal[0].state, 'active');
  const q = a.rows('quests').find((r) => r.value.quest.key === 'lantern')!;
  const forged = { ...q.value, state: 'resolved', outcome: 'deliver' };
  a.put('quests', q.key, forged);
  const session = localSession(() => a.db, assert.fail, b, a.host);
  assert.equal(session.game(), undefined);
  assert.equal(session.failed()?.kind, 'save_corrupt');
  assert.equal(session.failed()?.startOver, true);
  assert.deepEqual(a.row('quests', q.key), forged);
  assert.equal(a.row('containers', message), courier);
  assert.equal(a.fact('branch'), undefined);
  assert.equal(a.fact('delivered'), undefined);
  assert.equal(session.startOver(), undefined);
  assert.equal(session.failed(), undefined);
  assert.deepEqual(session.game()!.view().view.journal, []);
});
