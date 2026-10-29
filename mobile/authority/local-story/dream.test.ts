import { gameView } from '../../../kernel/ts/src/index.ts';
// Real rollback-journal cold recovery, command replay and uncertain transaction proof.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { dreamHost } from './__tests__/dream-host.test.ts';
import { phase, mv, prefix, entity, ref } from '../../../kernel/ts/test/dream_fixture.ts';

const disk = (a: ReturnType<typeof dreamHost>) =>
  ['state_row', 'head', 'receipt'].map((t) =>
    a.sql.prepare(`SELECT * FROM ${t} ORDER BY 1,2`).all(),
  );

// Breaks: pending/resolved scene rows are treated as dialogue, reopening loses cursor/branch, or retries reapply acknowledgment.
test('every intermediate checkpoint and both ended branches cold-open and replay the exact original result once', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-dream-'));
  t.after(() => rmSync(dir, { recursive: true }));
  for (const branch of ['follow_fox', 'wake']) {
    const a = dreamHost(join(dir, branch + '.db'));
    try {
      a.reopen();
      assert.deepEqual(phase(a.story.world()), {
        slept: false,
        seen: false,
        cursor: 0,
        quest: null,
      });
      a.invoke('rent_room', { service: ref('service', 'bed_room'), quoted_price: 3 }, [
        entity(a.initial, 'npc', 'maud'),
      ]);
      a.reopen();
      assert.deepEqual(phase(a.story.world()), {
        slept: false,
        seen: false,
        cursor: 0,
        quest: null,
      });
      a.invoke('move', { direction: 'up' });
      a.invoke('rest');
      for (const index of [1, 2, 3, 4, 5, -1]) {
        const expected = {
          slept: true,
          seen: index === -1,
          cursor: index,
          quest: index === -1 ? 'resolved' : 'active',
        };
        assert.deepEqual(phase(a.story.world()), expected);
        a.reopen();
        assert.deepEqual(phase(a.story.world()), expected);
        assert.equal(a.dream().branch, index === 5 || index === -1 ? branch : undefined);
        if (index === -1) break;
        const i = index === 4 ? a.choose(branch) : a.next();
        const before = disk(a),
          reply = a.story.invoke(i);
        assert.equal(reply.kind === 'saved' && reply.replay, true);
        assert.deepEqual(disk(a), before);
        if (index === 4)
          assert.equal(
            a.story.narration()!.detail_id,
            `dream:${Object.keys(a.initial.details).find((id) => a.initial.details[id].key === 'bed')}`,
          );
      }
      assert.equal(a.sql.prepare('SELECT count(*) AS n FROM report').get()!.n, 0);
      assert.equal(a.story.world().state.clock, 0);
      assert.equal(mv(a.story.world()), 50);
    } finally {
      a.sql.close();
    }
  }
  // loka-x6t.5: an open conversation no longer defers the dream; Continue leaves it first, and
  // the cold reopen agrees (Bram moved beside the bed so walking up does not end it).
  const deferred = dreamHost(join(dir, 'deferred.db'), (c) => {
    const bram = c.npcs[`${prefix}:npc/bram`];
    bram.room = ref('room', 'inn_rooms');
    delete bram.daily_schedule;
  });
  try {
    deferred.invoke('rent_room', { service: ref('service', 'bed_room'), quoted_price: 3 }, [
      entity(deferred.initial, 'npc', 'maud'),
    ]);
    deferred.invoke('move', { direction: 'up' });
    deferred.invoke('bram', {}, [entity(deferred.initial, 'npc', 'bram')]);
    const ordinary = gameView(deferred.story.world()).choice!.continuation_id;
    deferred.invoke('rest');
    deferred.reopen();
    assert.deepEqual(phase(deferred.story.world()), {
      slept: true,
      seen: false,
      cursor: 1,
      quest: 'active',
    });
    assert.equal(gameView(deferred.story.world()).choice!.continuation_id, ordinary);
    assert.equal(deferred.dream().available, true);
    deferred.next();
    deferred.reopen();
    assert.equal(gameView(deferred.story.world()).choice, undefined);
    assert.equal(deferred.story.world().state.choices![ordinary]!.status, 'closed');
    assert.equal(phase(deferred.story.world()).cursor, 2);
  } finally {
    deferred.sql.close();
  }
});

// Breaks: a forged phase/branch or removed/mutated producer receipt survives history recovery and silently rewrites the save.
test('cold open refuses forged dream truth and receipt producer evidence without changing file bytes', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-dream-corrupt-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const changes = [
    (a: ReturnType<typeof dreamHost>) =>
      a.sql
        .prepare(
          "UPDATE state_row SET value='false' WHERE section='facts' AND key LIKE '%dream_seen%'",
        )
        .run(),
    (a: ReturnType<typeof dreamHost>) =>
      a.sql
        .prepare(
          "UPDATE state_row SET value=json_set(value,'$.choice_id','wake') WHERE section='choices'",
        )
        .run(),
    (a: ReturnType<typeof dreamHost>) => {
      const row = a.sql
        .prepare(
          "SELECT command_id,response FROM receipt WHERE json_extract(command,'$.payload.type')='rest'",
        )
        .get()!;
      const d = JSON.parse(String(row.response));
      d.events.find((e: any) => e.payload.type === 'rested').payload.body_id =
        '00000000-0000-4000-8000-000000000000';
      a.sql
        .prepare('UPDATE receipt SET response=? WHERE command_id=?')
        .run(JSON.stringify(d), String(row.command_id));
    },
    (a: ReturnType<typeof dreamHost>) =>
      a.sql
        .prepare(
          "UPDATE receipt SET command=json_set(command,'$.payload.dream.expected_revision',99) WHERE json_extract(command,'$.payload.type')='choose'",
        )
        .run(),
  ];
  for (const [n, change] of changes.entries()) {
    const path = join(dir, n + '.db'),
      a = dreamHost(path);
    try {
      a.start();
      a.next();
      a.next();
      a.next();
      a.choose();
      // Ended memory has a real persisted row; reverting it must contradict its final receipt.
      if (n === 0) a.next();
      change(a);
      const before = disk(a),
        bytes = readFileSync(path);
      assert.equal(a.refuse().kind, 'save_corrupt');
      assert.deepEqual(disk(a), before);
      assert.deepEqual(readFileSync(path), bytes);
    } finally {
      a.sql.close();
    }
  }
});

// Breaks: an unknown COMMIT advances memory, allows new input/elapsed, or resumes with a duplicate scene choice or acknowledgment.
test('Rest, choice opening, branch selection and final ack settle uncertain COMMIT all old or all new', () => {
  for (const index of [0, 3, 4, 5])
    for (const kind of ['failed', 'lost'] as const) {
      const a = dreamHost();
      try {
        if (index === 0) {
          a.invoke('rent_room', { service: ref('service', 'bed_room'), quoted_price: 3 }, [
            entity(a.initial, 'npc', 'maud'),
          ]);
          a.invoke('move', { direction: 'up' });
        } else {
          a.start();
          a.next();
          a.next();
        }
        if (index === 4) a.next();
        if (index === 5) {
          a.next();
          a.choose();
        }
        const prior = a.story.world(),
          before = disk(a),
          d = index === 0 ? undefined : a.dream();
        const option = d?.choice?.choices[0];
        const i =
          index === 0
            ? a.attempt('rest')
            : option
              ? a.attempt(option.action_key!, {
                  continuation_id: d!.choice!.continuation_id,
                  choice_id: option.choice_id,
                  dream: option.dream,
                })
              : a.attempt(d!.action!.action_key, { scene: d!.scene, line: d!.index });
        a.sql.exec(
          'PRAGMA foreign_keys=ON; CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(id INTEGER REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
        );
        a.fault.kind = kind;
        a.fault.armed = true;
        assert.equal(a.story.invoke(i).kind, 'pending');
        assert.equal(a.story.world(), prior);
        assert.equal(a.story.invoke(a.attempt('stand')).kind, 'pending');
        assert.equal(
          a.story.elapsed({ expected_run_id: a.story.runId(), from: 0, until: 1 }).kind,
          'pending',
        );
        a.fault.reads = false;
        if (a.sql.isTransaction) a.sql.exec('ROLLBACK');
        a.reopen();
        assert.equal(
          phase(a.story.world()).cursor,
          kind === 'lost' ? (index === 5 ? -1 : index + 1) : index,
        );
        if (kind === 'failed') assert.deepEqual(disk(a), before);
        const retry = a.story.invoke(i);
        assert.equal(retry.kind, 'saved');
        if (retry.kind === 'saved') assert.equal(retry.replay, kind === 'lost');
        a.reopen();
        assert.equal(phase(a.story.world()).cursor, index === 5 ? -1 : index + 1);
        assert.equal(Object.keys(a.story.world().state.choices ?? {}).length, index === 0 ? 0 : 1);
        const saved = disk(a);
        assert.equal(a.story.invoke(i).kind, 'saved');
        assert.deepEqual(disk(a), saved);
      } finally {
        a.sql.close();
      }
    }
});

// Breaks: a dormant dream choice blocks ordinary elapsed, death/corpse recovery resets it, or its retained same-body binding cannot resume.
test('real elapsed and fatal return preserve the dormant choice until the actor lawfully reaches its actual bed', (t) => {
  // Inline: a rat that always bites in a cellar below the landing, a one-hp player, and mv that
  // regains 36 an hour at rest, so 1800 s of rest takes mv from 50 to 68.
  const a = dreamHost(':memory:', (c) => {
    c.manifest.requires.capabilities.combat = 1;
    c.lock.capabilities.combat = 1;
    c.resources[`${prefix}:resource/hp`].start = 1;
    c.manifest.time_policy = { profile: 'real_elapsed', rate: 50 };
    // real_elapsed refuses the KAT's turn-timed coil_rope scripted action; this test never coils.
    c.scripted_actions = {};
    c.resources[`${prefix}:resource/mv`].regen = {
      every: 3600,
      by_position: { standing: 18, sitting: 18, resting: 36, sleeping: 36 },
    };
    const narration = Object.fromEntries(
      ['player_hit', 'player_miss', 'npc_hit', 'npc_miss', 'player_died', 'npc_died'].map((k) => [
        k,
        `combat.${k}`,
      ]),
    );
    c.world.combat = {
      player_attack: { chance: 75, damage_min: 1, damage_max: 2 },
      interval: 150,
      sleep_multiplier: 2,
      flee_multiplier: 2,
      narration,
    };
    c.rooms[`${prefix}:room/ferry_landing`].exits.down = { to: ref('room', 'cellar') };
    c.rooms[`${prefix}:room/cellar`] = {
      key: 'cellar',
      name: 'room.cellar.title',
      description: 'room.cellar.description',
      exits: { up: { to: ref('room', 'ferry_landing') } },
    };
    c.npcs[`${prefix}:npc/rat`] = {
      key: 'rat',
      keywords: ['rat'],
      name: 'npc.rat.short',
      room_line: 'npc.rat.room',
      description: 'npc.rat.description',
      room: ref('room', 'cellar'),
      hp: { minimum: 0, maximum: 6, start: 6, gain: 0 },
      attack: { chance: 100, damage_min: 1, damage_max: 1 },
    };
    Object.assign(c.text, Object.fromEntries(Object.values(narration).map((k) => [k, 'Combat.'])), {
      'room.cellar.title': 'Cellar',
      'room.cellar.description': 'A damp cellar.',
      'npc.rat.short': 'a rat',
      'npc.rat.room': 'A [[rat|rat]] noses about.',
      'npc.rat.description': 'A rat.',
    });
  });
  t.after(() => a.sql.close());
  a.start();
  a.next();
  a.next();
  a.next();
  const row = a.story.world().state.choices;
  assert.equal(
    a.story.elapsed({ expected_run_id: a.story.runId(), from: 0, until: 1800 }).kind,
    'saved',
  );
  assert.equal(mv(a.story.world()), 68);
  assert.deepEqual(phase(a.story.world()), {
    slept: true,
    seen: false,
    cursor: 4,
    quest: 'active',
  });
  a.reopen();
  a.invoke('stand');
  a.invoke('move', { direction: 'down' });
  a.invoke('move', { direction: 'down' });
  a.invoke('attack', {}, [entity(a.initial, 'npc', 'rat')]);
  for (
    let n = 0;
    n < 6 && Object.values(a.story.world().state.encounters ?? {}).some((e) => e.status === 'open');
    n++
  ) {
    const from = a.story.world().state.clock;
    assert.equal(
      a.story.elapsed({ expected_run_id: a.story.runId(), from, until: from + 150 }).kind,
      'saved',
    );
  }
  a.reopen();
  const w = a.story.world();
  assert.equal(w.body, a.initial.body);
  assert.equal(w.state.containers[w.body], a.initial.roomIds[`${prefix}:room/village_green`]);
  assert.ok(Object.values(w.entities).some((e) => e.kind === 'item' && e.key === 'player_corpse'));
  assert.deepEqual(w.state.choices, row);
  assert.deepEqual(phase(w), { slept: true, seen: false, cursor: 4, quest: 'active' });
  for (const direction of ['south', 'up']) a.invoke('move', { direction });
  assert.equal(a.dream().available, true);
  a.choose('wake');
  a.next();
  a.reopen();
  assert.deepEqual(phase(a.story.world()), {
    slept: true,
    seen: true,
    cursor: -1,
    quest: 'resolved',
  });
});

// Breaks (loka-x6t.5 save re-check): riddle-save not counting the dream's Continue that left an
// open riddle (riddle-save.ts talk/continue branch), so a reachable save (wrong once, walk away,
// Rest, Continue) cold-opens as save_corrupt.
test('real SQLite: a riddle left by the dream Continue reopens closed at count one', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-dream-riddle-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  // Inline: a sphinx on the landing asks a bounded riddle (answer tide, three tries).
  const a = dreamHost(join(dir, 'riddle.db'), (c) => {
    c.quests[`${prefix}:quest/tide`] = {
      key: 'tide',
      name: 'npc.sphinx.short',
      objective: {
        evidence: 'current_state',
        policy: { op: 'all', items: [] },
      },
      journal: Object.fromEntries(
        ['active', 'objectives_met', 'resolved', 'failed', 'abandoned'].map((k) => [
          k,
          'npc.sphinx.short',
        ]),
      ),
    };
    c.npcs[`${prefix}:npc/sphinx`] = {
      key: 'sphinx',
      keywords: ['sphinx'],
      name: 'npc.sphinx.short',
      description: 'npc.sphinx.description',
      room_line: 'npc.sphinx.room',
      room: ref('room', 'ferry_landing'),
    };
    c.dialogues[`${prefix}:dialogue/sphinx_offer`] = {
      key: 'sphinx_offer',
      npc: ref('npc', 'sphinx'),
      prompt: 'dialogue.riddle.prompt',
      policy: { op: 'all', items: [] },
      roles: { sphinx: { role: 'npc', npc: ref('npc', 'sphinx') } },
      choices: {
        accept: {
          label: 'dialogue.riddle.answer',
          narration: 'narration.riddle.answer',
          accept: ref('quest', 'tide'),
          sequence: [],
        },
      },
    };
    c.dialogues[`${prefix}:dialogue/riddle`] = {
      key: 'riddle',
      npc: ref('npc', 'sphinx'),
      quest: ref('quest', 'tide'),
      prompt: 'dialogue.riddle.prompt',
      // The riddle opens only once the offer bound quest tide, so its attempts have a quest.
      policy: { op: 'quest_state', quest: ref('quest', 'tide'), state: 'active' },
      roles: { sphinx: { role: 'npc', npc: ref('npc', 'sphinx') } },
      choices: {
        answer: {
          label: 'dialogue.riddle.answer',
          narration: 'narration.riddle.answer',
          sequence: [],
        },
      },
      riddle: {
        choice_id: 'answer',
        answer: 'tide',
        bank: ['T', 'I', 'D', 'E'],
        wrong: 'narration.riddle.wrong',
        wrong_limit: 3,
      },
    };
    Object.assign(c.text, {
      'npc.sphinx.short': 'a sphinx',
      'npc.sphinx.description': 'A sphinx.',
      'npc.sphinx.room': 'A sphinx is here.',
      'dialogue.riddle.prompt': 'What comes in twice a day?',
      'dialogue.riddle.answer': 'Answer',
      'narration.riddle.answer': 'The sphinx nods.',
      'narration.riddle.wrong': 'The sphinx shakes its head.',
    });
  });
  t.after(() => a.sql.close());
  const choices = () => a.story.world().state.choices!;
  a.invoke('rent_room', { service: ref('service', 'bed_room'), quoted_price: 3 }, [
    entity(a.initial, 'npc', 'maud'),
  ]);
  const sphinx = entity(a.initial, 'npc', 'sphinx');
  a.invoke('sphinx_offer', {}, [sphinx]);
  a.invoke('choose', {
    choice_id: 'accept',
    continuation_id: gameView(a.story.world()).choice!.continuation_id,
  });
  a.invoke('riddle', {}, [sphinx]);
  const id = gameView(a.story.world()).choice!.continuation_id;
  a.invoke('choose', { choice_id: 'answer', answer: 'EDIT', continuation_id: id });
  a.invoke('move', { direction: 'up' });
  a.invoke('rest');
  assert.equal(choices()[id]!.status, 'pending');
  a.next();
  a.reopen();
  assert.deepEqual(
    [choices()[id]!.status, choices()[id]!.attempts],
    ['closed', { count: 1, limit: 3 }],
  );
});
