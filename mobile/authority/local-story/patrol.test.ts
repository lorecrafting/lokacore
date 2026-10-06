import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle, fresh, npc, room } from '../../../kernel/ts/test/patrol_fixture.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { openStory } from './authority.ts';
import { openGame } from './session.ts';
import { presenter } from '../../app/book/presenter.ts';

function setup(path = ':memory:') {
  const a = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  let game = a.game;
  let book = presenter(game);
  game.subscribe(book.update);
  const view = () => game.view().view;
  const ok = (action_key: string, target_ids: string[] = [], input: object = {}) => {
    const reply = game.invoke({ action_key, target_ids, input } as never);
    assert.equal(reply.kind, 'saved', JSON.stringify(reply));
    if (reply.kind === 'saved')
      assert.equal(reply.decision.kind, 'accepted', JSON.stringify(reply));
    return reply;
  };
  const rows = (section: string) =>
    a.sql
      .prepare('SELECT key,value FROM state_row WHERE section=?')
      .all(section)
      .map((r) => ({ key: r.key as string, value: JSON.parse(r.value as string) }));
  const patrol = () => rows('patrols')[0];
  const move = (...directions: string[]) => {
    for (const direction of directions) ok('move', [], { direction });
  };
  const talk = () => ok('tobin_watch', [npc(fresh)]);
  const choice = (choice_id: string) => {
    const chosen = book
      .screen()
      .buttons.find(
        (b) =>
          b.action_key === 'choose' && (b.input as { choice_id?: string }).choice_id === choice_id,
      );
    assert.ok(chosen, `${choice_id}: ${JSON.stringify(view().choice)}`);
    book.press(chosen, npc(fresh));
    assert.equal(game.pending(), false);
    assert.equal(view().choice, undefined);
    return chosen;
  };
  const choose = (key: string) => {
    talk();
    return choice(key);
  };
  const start = () => {
    move('north', 'north', 'north', 'east');
    choose('start');
  };
  const reopen = () => {
    a.sql.close();
    a.sql.open();
    game = openGame(a.db, bundle, a.host);
    book = presenter(game);
    game.subscribe(book.update);
  };
  return {
    ...a,
    get game() {
      return game;
    },
    get book() {
      return book;
    },
    view,
    ok,
    rows,
    patrol,
    move,
    talk,
    choice,
    choose,
    start,
    reopen,
  };
}

// Breaks: lawful leader-ahead, paused arrival or completed-later-travel rows cannot cold reopen or consume their next control.
test('real SQLite reopens every finite leg and explicit pause boundary', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-patrol-reopen-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const a = setup(join(dir, 'story.db'));
  t.after(() => a.sql.close());
  a.start();
  a.reopen();
  assert.equal(a.patrol().value.credit.length, 0);
  a.choose('continue');
  a.reopen();
  assert.equal(a.patrol().value.status, 'awaiting');
  a.move('west');
  a.reopen();
  a.move('north');
  a.reopen();
  a.move('south');
  a.reopen();
  assert.equal(a.patrol().value.status, 'paused');
  a.choose('rejoin');
  a.reopen();
  for (const [direction, credit] of [
    ['south', 2],
    ['east', 3],
    ['west', 3],
    ['north', 3],
    ['east', 4],
  ] as const) {
    a.choose('continue');
    a.reopen();
    a.move(direction);
    a.reopen();
    assert.equal(a.patrol().value.credit.length, credit);
  }
  assert.equal(a.patrol().value.status, 'completed');
  assert.equal(a.view().journal.find((q) => q.quest.key === 'watch_rounds')!.state, 'resolved');
  a.move('west', 'south');
  a.reopen();
  assert.equal(a.patrol().value.status, 'completed');
});

// Breaks: real cellar death persists old credit or Restart requires another quest/hour and cannot reopen.
test('actual cellar fatal round, shrine return, ordinary recovery and Restart survive cold reopen', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-patrol-fatal-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const a = setup(join(dir, 'story.db'));
  t.after(() => a.sql.close());
  a.start();
  a.choose('continue');
  a.move('west');
  a.choose('continue');
  a.move('south');
  const attempt = a.patrol().value.attempt_id,
    instance = a.patrol().key;
  a.move('south', 'east', 'down');
  for (let rat = 1; rat <= 5 && a.view().place.id !== room(fresh, 'chapel_nave'); rat++) {
    a.ok('attack', [npc(fresh, `cellar_rat_${rat}`)]);
    for (let round = 0; round < 30 && a.view().combat; round++) {
      a.clock.mono += 3000;
      a.clock.wall += 3000;
      const status = a.game.pulse();
      assert.equal(status.kind, 'ready', JSON.stringify(status));
    }
  }
  assert.equal(a.view().place.id, room(fresh, 'chapel_nave'));
  a.reopen();
  assert.equal(a.patrol().value.status, 'failed');
  assert.equal(a.patrol().value.credit.length, 0);
  assert.equal(a.rows('quests').find((q) => q.key === instance)!.value.state, 'active');
  a.move('south', 'south', 'south');
  a.reopen();
  a.choose('restart');
  a.reopen();
  assert.equal(a.patrol().key, instance);
  assert.notEqual(a.patrol().value.attempt_id, attempt);
  assert.equal(a.patrol().value.cursor, 2);
  for (const [direction, credit] of [
    ['east', 1],
    ['west', 2],
    ['north', 3],
    ['east', 4],
  ] as const) {
    a.choose('continue');
    a.move(direction);
    a.reopen();
    assert.equal(a.patrol().value.credit.length, credit);
  }
});

// Breaks: a malformed attempt/cursor/credit/identity or altered causal receipt reopens behind unrelated later receipts.
test('full retained receipt replay refuses forged patrol rows and proofs without rewriting SQLite', async (t) => {
  for (const field of [
    'actor_id',
    'body_id',
    'npc_id',
    'quest_instance_id',
    'continuation_id',
    'attempt_id',
    'cursor',
    'credit',
    'status',
    'fractional',
    'missing',
    'scope',
    'cause',
    'source',
    'lost-transition',
  ])
    await t.test(field, () => {
      const a = setup();
      try {
        a.start();
        a.choose('continue');
        a.move('west');
        a.ok('look');
        const p = a.patrol();
        if (field === 'fractional')
          a.sql
            .prepare('UPDATE state_row SET value=? WHERE section=? AND key=?')
            .run(JSON.stringify({ ...p.value, cursor: 0.5 }), 'patrols', p.key);
        else if (field === 'missing')
          a.sql.prepare("DELETE FROM state_row WHERE section='patrols'").run();
        else if (['scope', 'cause', 'source', 'lost-transition'].includes(field)) {
          const saved = a.sql
            .prepare(
              "SELECT command_id,response FROM receipt WHERE json_extract(command,'$.payload.type')='move' ORDER BY revision DESC LIMIT 1",
            )
            .get()!;
          const d = JSON.parse(saved.response as string);
          if (field === 'scope')
            d.events[0].scope = { kind: 'instance', world_context_id: fresh.context };
          if (field === 'cause') d.events[0].causation_id = 'bbbbbbbb-1111-4222-8333-444444444444';
          if (field === 'source')
            d.delta.ops.find((o: any) => o.op === 'entity.transfer').source_id = room(
              fresh,
              'village_green',
            );
          if (field === 'lost-transition')
            d.delta.ops = d.delta.ops.filter((o: any) => o.op !== 'patrol.transition');
          a.sql
            .prepare('UPDATE receipt SET response=? WHERE command_id=?')
            .run(JSON.stringify(d), saved.command_id);
        } else {
          const bad = {
            ...p.value,
            [field]:
              field === 'cursor'
                ? 5
                : field === 'credit'
                  ? [room(fresh, 'north_gate'), room(fresh, 'north_gate')]
                  : field === 'status'
                    ? 'completed'
                    : 'bbbbbbbb-1111-4222-8333-444444444444',
          };
          a.sql
            .prepare('UPDATE state_row SET value=? WHERE section=? AND key=?')
            .run(JSON.stringify(bad), 'patrols', p.key);
        }
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

// Breaks: uncertain COMMIT publishes departure early or retries a committed leg twice instead of reconciling all-old/all-new.
test('real failed and acknowledged-lost COMMIT reconcile one leader departure and exact Book retry', async (t) => {
  for (const kind of ['failed', 'lost'] as const)
    await t.test(kind, () => {
      const a = setup();
      try {
        a.start();
        a.talk();
        if (kind === 'failed')
          a.sql.exec(
            'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
          );
        const button = a.book
          .screen()
          .buttons.find(
            (b) =>
              b.action_key === 'choose' &&
              (b.input as { choice_id?: string }).choice_id === 'continue',
          )!;
        a.fault.kind = kind;
        a.fault.armed = true;
        a.book.press(button, npc(fresh));
        assert.equal(a.game.pending(), true);
        assert.equal(
          a.view().journal.find((q) => q.quest.key === 'watch_rounds')!.patrol!.status,
          'together',
        );
        a.fault.reads = false;
        a.book.press(button, npc(fresh));
        assert.equal(a.game.pending(), false);
        assert.equal(a.patrol().value.cursor, 1);
        assert.equal(a.patrol().value.status, 'awaiting');
        assert.equal(a.patrol().value.credit.length, 0);
        const reloaded = openGame(a.db, bundle, a.host);
        assert.equal(
          reloaded.view().view.journal.find((q) => q.quest.key === 'watch_rounds')!.patrol!.status,
          'awaiting',
        );
        a.move('west');
        assert.equal(a.patrol().value.credit.length, 1);
      } finally {
        a.sql.close();
      }
    });
});

// Breaks: uncertain final join exposes partial patrol/quest/trust, or lost-reply retry duplicates terminal narration/reward.
test('final player join commits movement, terminal quest and trust together across both uncertain outcomes', async (t) => {
  for (const kind of ['failed', 'lost'] as const)
    await t.test(kind, () => {
      const a = setup();
      try {
        a.start();
        for (const direction of ['west', 'south', 'east', 'west', 'north']) {
          a.choose('continue');
          a.move(direction);
        }
        a.choose('continue');
        if (kind === 'failed')
          a.sql.exec(
            'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
          );
        const intent = { action_key: 'move', target_ids: [], input: { direction: 'east' } };
        a.fault.kind = kind;
        a.fault.armed = true;
        assert.equal(a.game.invoke(intent as never).kind, 'pending');
        assert.equal(a.view().journal.find((q) => q.quest.key === 'watch_rounds')!.state, 'active');
        assert.equal(a.view().place.id, room(fresh, 'north_gate'));
        a.fault.reads = false;
        const reply = a.game.invoke(intent as never);
        assert.equal(reply.kind, 'saved');
        assert.equal(a.patrol().value.status, 'completed');
        assert.equal(a.view().place.id, room(fresh, 'watch_post'));
        assert.equal(
          a.rows('facts').find((r) => JSON.parse(r.key).fact.key === 'watch_gate_trusts_player')!
            .value,
          true,
        );
        assert.equal(
          a.rows('quests').find((q) => q.value.quest.key === 'watch_rounds')!.value.outcome,
          'completed',
        );
        const game = openGame(a.db, bundle, a.host);
        assert.equal(
          game.view().view.journal.find((q) => q.quest.key === 'watch_rounds')!.state,
          'resolved',
        );
        const saved = a.sql
          .prepare(
            "SELECT * FROM receipt WHERE json_extract(response,'$.outcome')='moved' ORDER BY revision DESC LIMIT 1",
          )
          .get()!;
        const command = JSON.parse(saved.command as string);
        assert.equal(command.payload.direction, 'east');
        const before = a.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all();
        const story = openStory(a.db, [{ fresh, content_hash: bundle.sha256 }], a.host);
        assert.equal(story.kind, 'open');
        if (story.kind !== 'open') return;
        const replay = story.invoke({
          invocation_id: saved.invocation_id,
          actor_id: fresh.character,
          action_key: 'move',
          target_ids: [],
          input: { direction: 'east' },
        });
        assert.equal(replay.kind, 'saved');
        if (replay.kind === 'saved') assert.equal(replay.replay, true);
        const repeats = a.sql
          .prepare(
            "SELECT count(*) AS n FROM receipt WHERE json_extract(response,'$.events') LIKE '%quest_resolved%'",
          )
          .get()!.n;
        assert.equal(repeats, 1);
        assert.deepEqual(
          a.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all(),
          before,
        );
      } finally {
        a.sql.close();
      }
    });
});

// Breaks: current patrol identity validation rejects lawful C1 payments/gift/dodge acquisition or S3 repeats those rewards.
test('real original-Tobin C1 lessons reopen during patrol and completion grants trust alone', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-patrol-lessons-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const a = setup(join(dir, 'story.db'));
  t.after(() => a.sql.close());
  a.start();
  a.ok('tobin_swords', [npc(fresh)]);
  a.choice('learn');
  a.reopen();
  a.choose('continue');
  a.move('west');
  a.ok('tobin_dodge', [npc(fresh)]);
  a.choice('learn');
  a.reopen();
  const pennies = a.rows('resources').filter((r) => JSON.parse(r.key).resource.key === 'pennies');
  const skills = a.view().skills;
  const sword = a.view().inventory.find((i) => i.name === 'item.rusty_sword.short');
  assert.ok(sword);
  for (const direction of ['south', 'east', 'west', 'north', 'east']) {
    a.choose('continue');
    a.move(direction);
  }
  a.reopen();
  assert.equal(a.patrol().value.status, 'completed');
  assert.deepEqual(
    a.rows('resources').filter((r) => JSON.parse(r.key).resource.key === 'pennies'),
    pennies,
  );
  assert.deepEqual(a.view().skills, skills);
  assert.equal(a.view().inventory.find((i) => i.name === 'item.rusty_sword.short')!.id, sword.id);
});
