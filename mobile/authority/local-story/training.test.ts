import { engaged } from '../../../kernel/ts/src/mechanics/combat/shared.ts';
import { living } from '../../../kernel/ts/src/mechanics/death/shared.ts';
import { key } from '../../../kernel/ts/src/foundation/compose.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadCartridge,
  INSTALLED,
  newWorld,
  gameView,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';
import { trainingBundle, productionBundle } from '../../../kernel/ts/test/training_fixture.ts';
import { ref } from '../../../kernel/ts/test/combat_fixture.ts';
import { level, resourceRef } from '../../../kernel/ts/src/mechanics/resource.ts';
import { encode } from '../../../kernel/ts/src/foundation/canonical.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { openStory } from './authority.ts';

function setup(path = ':memory:', bundle = trainingBundle(10, 41, 1)) {
  const p = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  const loaded = loadCartridge(
    new TextEncoder().encode(
      JSON.stringify({ cartridge: JSON.parse(bundle.canonical), content_hash: bundle.sha256 }),
    ),
    INSTALLED,
  );
  assert.ok(loaded.ok, JSON.stringify(loaded));
  const fresh = newWorld(
    loaded.cartridge as Cartridge,
    '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never,
    [1, 2, 3, 4],
  );
  const releases = [{ fresh, content_hash: bundle.sha256 }] as const;
  const reopen = () => {
    const r = openStory(p.db, releases, p.host);
    assert.equal(r.kind, 'open', JSON.stringify(r));
    if (r.kind !== 'open') throw new Error('open');
    return r;
  };
  let story = reopen(),
    n = 0;
  const entity = (kind: string, name: string) => fresh.entityIds[ref(fresh, kind, name)];
  const invocation = (action_key: string, target_ids: string[] = [], input: object = {}) => ({
    invocation_id: `dddddddd-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    actor_id: fresh.character,
    action_key,
    target_ids,
    input,
  });
  const invoke = (action: string, targets: string[] = [], input: object = {}) => {
    const r = story.invoke(invocation(action, targets, input));
    assert.equal(r.kind, 'saved', JSON.stringify(r));
    if (r.kind === 'saved')
      assert.equal((r.decision as { kind: string }).kind, 'accepted', JSON.stringify(r.decision));
    return r;
  };
  const answer = () =>
    invoke('choose', [], {
      continuation_id: gameView(story.world()).choice!.continuation_id,
      choice_id: 'learn',
    });
  const openLesson = (npc = 'teacher') => {
    const id = entity('npc', npc);
    const action = gameView(story.world())
      .entities.find((e) => e.id === id)!
      .actions.find(
        (a) =>
          a.available && story.world().cartridge.dialogues?.[ref(fresh, 'dialogue', a.action_key)],
      );
    assert.ok(action);
    return invoke(action.action_key, [id]);
  };
  const learn = (npc = 'teacher') => {
    openLesson(npc);
    return answer();
  };
  const money = () => [
    level(story.world(), fresh.body, resourceRef(fresh, 'pennies')),
    level(story.world(), entity('npc', 'teacher'), resourceRef(fresh, 'pennies')),
  ];
  return {
    ...p,
    fresh,
    releases,
    entity,
    invocation,
    invoke,
    answer,
    openLesson,
    learn,
    money,
    story: () => story,
    reopen: () => {
      story = reopen();
    },
    world: () => story.world(),
  };
}

// Breaks: cold saves lose a learned grant/payment/gift or lawful later wield custody invalidates the grant receipt.
test('real SQLite cold reopen retains both lessons, exact replay, wear, Attack and defended due state', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'loka-training-'));
  t.after(() => rmSync(directory, { recursive: true }));
  const path = join(directory, 'save.db');
  const a = setup(path);
  a.learn();
  a.reopen();
  assert.deepEqual(a.money(), [6, 4]);
  a.learn();
  a.reopen();
  assert.deepEqual(a.money(), [2, 8]);
  assert.deepEqual(
    gameView(a.world()).skills?.map((s) => [s.acquired, s.qualified, s.usable]),
    [
      [true, true, true],
      [true, true, true],
    ],
  );
  a.invoke('wear', [a.entity('item', 'sword')]);
  a.reopen();
  a.invoke('attack', [a.entity('npc', 'cellar_rat_1')]);
  a.reopen();
  const evidence = { expected_run_id: a.story().runId(), from: 1, until: 151 };
  const round = a.story().elapsed(evidence);
  assert.equal(round.kind, 'saved');
  const before = encode(a.world().state as never);
  a.reopen();
  assert.equal(a.story().elapsed(evidence).kind, 'saved');
  assert.equal(encode(a.world().state as never), before);
  assert.equal(level(a.world(), a.fresh.body, resourceRef(a.fresh, 'hp')), 10);
  assert.deepEqual(a.world().state.rng, [25179138, 12295, 540162, 2107404]);
  a.sql.close();
  const b = setup(path);
  t.after(() => b.sql.close());
  assert.equal(encode(b.world().state as never), before);
});

// Breaks: a grant is evidenced only by a Boolean, omits exact debit/gift, or trusts forged actor/teacher/skill evidence.
test('forged lesson receipts and contradictory acquired rows reopen as save_corrupt without rewriting', () => {
  for (const mutant of [
    'membership',
    'debit',
    'gift',
    'teacher',
    'skill',
    'actor',
    'correlation',
    'wrong-command',
    'foreign-actor-fact',
  ]) {
    const a = setup();
    a.learn();
    const row = a.sql
      .prepare(
        "SELECT invocation_id,response FROM receipt WHERE json_extract(command,'$.payload.type')='choose'",
      )
      .get()!;
    const d = JSON.parse(row.response as string);
    const grant = d.delta.ops.find((o: any) => o.op === 'fact.assign');
    const paid = d.delta.ops.filter((o: any) => o.op === 'resource.adjust');
    if (mutant === 'membership')
      a.sql
        .prepare(
          "UPDATE state_row SET value='false' WHERE section='facts' AND key LIKE '%skill_swords%'",
        )
        .run();
    if (mutant === 'debit') d.delta.ops = d.delta.ops.filter((o: any) => o !== paid[0]);
    if (mutant === 'gift') d.delta.ops = d.delta.ops.filter((o: any) => o.op !== 'entity.transfer');
    if (mutant === 'teacher') paid[1].entity_id = a.entity('npc', 'cellar_rat_1');
    if (mutant === 'skill') grant.fact.key = 'skill_dodge';
    if (mutant === 'actor') grant.scope.character_id = 'aaaaaaaa-0000-4000-8000-000000000099';
    if (mutant === 'correlation')
      d.events.find((e: any) => e.payload.type === 'fact_changed').correlation_id =
        'aaaaaaaa-0000-4000-8000-000000000099';
    if (mutant === 'foreign-actor-fact') {
      a.sql.prepare('INSERT INTO state_row VALUES (?,?,?)').run(
        'facts',
        key({
          kind: 'fact',
          fact: grant.fact,
          scope: { kind: 'player', character_id: 'aaaaaaaa-0000-4000-8000-000000000099' },
        }),
        'true',
      );
    }
    if (mutant === 'wrong-command') {
      a.invoke('look');
      const fake = {
        ...d,
        delta: {
          ...d.delta,
          ops: d.delta.ops.filter((o: any) => ['fact.assign', 'choice.resolve'].includes(o.op)),
        },
      };
      a.sql
        .prepare(
          "UPDATE receipt SET response=? WHERE json_extract(command,'$.payload.type')='look'",
        )
        .run(JSON.stringify(fake));
    }
    if (mutant !== 'membership')
      a.sql
        .prepare('UPDATE receipt SET response=? WHERE invocation_id=?')
        .run(JSON.stringify(d), row.invocation_id as string);
    const before = a.sql.prepare('SELECT * FROM state_row ORDER BY 1,2').all();
    assert.equal(openStory(a.db, a.releases, a.host).kind, 'save_corrupt', mutant);
    assert.deepEqual(a.sql.prepare('SELECT * FROM state_row ORDER BY 1,2').all(), before);
    a.sql.close();
  }
});

// Breaks: linked choice/gift evidence borrows a foreign world, player scope or root correlation.
test('each foreign lesson event identity refuses file-backed reopen after lawful later custody', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'loka-training-identities-'));
  t.after(() => rmSync(directory, { recursive: true }));
  for (const type of ['choice_resolved', 'item_acquired'])
    for (const field of ['correlation_id', 'world_context_id', 'scope']) {
      const path = join(directory, `${type}-${field}.db`);
      const a = setup(path);
      try {
        a.learn();
        a.invoke('wear', [a.entity('item', 'sword')]);
        a.reopen();
        const row = a.sql
          .prepare(
            "SELECT invocation_id,response FROM receipt WHERE json_extract(command,'$.payload.type')='choose'",
          )
          .get()!;
        const d = JSON.parse(row.response as string);
        const event = d.events.find((e: any) => e.payload.type === type);
        const foreign = 'aaaaaaaa-0000-4000-8000-000000000099';
        event[field] = field === 'scope' ? { kind: 'player', character_id: foreign } : foreign;
        a.sql
          .prepare('UPDATE receipt SET response=? WHERE invocation_id=?')
          .run(JSON.stringify(d), row.invocation_id as string);
        const before = readFileSync(path);
        assert.equal(openStory(a.db, a.releases, a.host).kind, 'save_corrupt', `${type}/${field}`);
        assert.deepEqual(readFileSync(path), before);
      } finally {
        a.sql.close();
      }
    }
});

// Breaks: lesson COMMIT adopts partial rows or an uncertain retry pays or grants twice.
test('real failed and lost-ack COMMIT keep all prior or all next lesson rows and retry once', () => {
  for (const kind of ['failed', 'lost'] as const) {
    const a = setup();
    a.openLesson();
    const attempt = a.invocation('choose', [], {
      continuation_id: gameView(a.world()).choice!.continuation_id,
      choice_id: 'learn',
    });
    a.sql.exec(
      'PRAGMA foreign_keys=ON; CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(id INTEGER REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
    );
    a.fault.kind = kind;
    a.fault.armed = true;
    assert.equal(a.story().invoke(attempt).kind, 'pending');
    assert.deepEqual(a.money(), [10, 0]);
    a.fault.reads = false;
    if (a.sql.isTransaction) a.sql.exec('ROLLBACK');
    a.reopen();
    assert.deepEqual(a.money(), kind === 'lost' ? [6, 4] : [10, 0]);
    const r = a.story().invoke(attempt);
    assert.equal(r.kind, 'saved');
    a.reopen();
    assert.deepEqual(a.money(), [6, 4]);
    assert.equal(a.world().state.containers[a.entity('item', 'sword')], a.fresh.body);
    a.sql.close();
  }
});

// Breaks: forged prevention is accepted as a landed hit or positive loss at reopen or committed view recovery.
test('defense hit/loss conjunction is guarded at saved-receipt and narration boundaries', () => {
  for (const field of ['hit', 'loss']) {
    const a = setup();
    a.learn();
    a.learn();
    a.invoke('wear', [a.entity('item', 'sword')]);
    a.invoke('attack', [a.entity('npc', 'cellar_rat_1')]);
    const r = a.story().elapsed({ expected_run_id: a.story().runId(), from: 1, until: 151 });
    assert.equal(r.kind, 'saved');
    const row = a.sql
      .prepare(
        "SELECT invocation_id,response FROM receipt WHERE json_extract(command,'$.payload.type')='elapsed'",
      )
      .get()!;
    const d = JSON.parse(row.response as string);
    const defense = d.events.find((e: any) => e.payload.prevented_by);
    assert.ok(defense);
    defense.payload[field] = field === 'hit' ? true : 1;
    a.sql
      .prepare('UPDATE receipt SET response=? WHERE invocation_id=?')
      .run(JSON.stringify(d), row.invocation_id as string);
    assert.throws(() => a.story().narration(), /inconsistent defense evidence/);
    assert.equal(openStory(a.db, a.releases, a.host).kind, 'save_corrupt');
    a.sql.close();
  }
});

// Breaks: a lawful corpse-held lesson gift is rejected on reopen or death loses permanent learned facts.
test('trained player death cold reopens and recovers the exact worn lesson sword', () => {
  const a = setup(':memory:', trainingBundle(10, 0, 1));
  a.learn();
  a.learn();
  a.invoke('wear', [a.entity('item', 'sword')]);
  a.sql
    .prepare("UPDATE state_row SET value=? WHERE section='resources' AND key=?")
    .run(
      JSON.stringify({ value: 1, at: 1, rate: 0, remainder: 0 }),
      key({ kind: 'resource', resource: resourceRef(a.fresh, 'hp'), entity_id: a.fresh.body }),
    );
  a.reopen();
  a.invoke('attack', [a.entity('npc', 'cellar_rat_1')]);
  assert.equal(
    a.story().elapsed({ expected_run_id: a.story().runId(), from: 1, until: 151 }).kind,
    'saved',
  );
  a.reopen();
  assert.equal(level(a.world(), a.fresh.body, resourceRef(a.fresh, 'hp')), 10);
  assert.equal(engaged(a.world(), a.fresh.body), undefined);
  const sword = a.entity('item', 'sword'),
    corpse = a.world().state.containers[sword];
  assert.equal(a.world().state.created![corpse].definition.key, 'player_corpse');
  assert.deepEqual(
    gameView(a.world()).skills?.map((s) => s.acquired),
    [true, true],
  );
  for (const direction of ['south', 'south', 'south', 'south', 'east', 'down'])
    a.invoke('move', [], { direction });
  a.invoke('take', [sword]);
  a.reopen();
  a.invoke('wear', [sword]);
  a.reopen();
  assert.equal(a.world().state.containers[sword], a.world().slots.wield);
  a.sql.close();
});

// Breaks: historical lesson, shop and S2 order is reconciled against today's balance or trained gear gates S1/storage.
test('authored training/shop/S2 orders retain conserved pennies and trained five-rat reward/storage', () => {
  for (const order of [
    ['learn', 'shop', 'debt'],
    ['shop', 'learn', 'debt'],
    ['debt', 'learn', 'shop'],
    ['debt', 'shop', 'learn'],
  ]) {
    const a = setup(':memory:', productionBundle());
    const move = (...ds: string[]) =>
      ds.forEach((direction) => a.invoke('move', [], { direction }));
    const choose = (choice_id: string) =>
      a.invoke('choose', [], {
        continuation_id: gameView(a.world()).choice!.continuation_id,
        choice_id,
      });
    const balances = () =>
      [a.fresh.body, ...['peg', 'aldric', 'tobin'].map((n) => a.entity('npc', n))].map((e) =>
        level(a.world(), e, resourceRef(a.fresh, 'pennies')),
      );
    move('north'); // Well Lane is the hub for each optional consumer.
    for (const part of order) {
      if (part === 'learn') {
        move('north', 'north');
        a.learn('tobin');
        a.reopen();
        a.learn('tobin');
        a.reopen();
        a.invoke('wear', [a.entity('item', 'rusty_sword')]);
        a.reopen();
        move('south', 'south');
      } else if (part === 'shop') {
        move('west');
        a.invoke('buy', [a.entity('npc', 'peg'), a.entity('item', 'wooden_shield')], {
          quoted_price: 4,
        });
        a.reopen();
        a.invoke('wear', [a.entity('item', 'wooden_shield')]);
        a.reopen();
        move('east');
      } else {
        move('west');
        a.invoke('a_peg_debt', [a.entity('npc', 'peg')]);
        choose('accept_on_time');
        a.invoke('close_choice'); // the hub stays open after an answer (loka-x6t.5): Leave the conversation
        a.reopen();
        move('east', 'north', 'north', 'north', 'north');
        a.invoke('a_aldric_debt', [a.entity('npc', 'aldric')]);
        choose('on_time');
        a.reopen();
        move('south', 'south', 'south', 'south');
      }
    }
    assert.deepEqual(balances(), [22, 24, 0, 4]);
    move('east', 'down');
    a.invoke('attack', [a.entity('npc', 'cellar_rat_1')]);
    a.reopen();
    const round = () => {
      const from = a.world().state.clock;
      const r = a.story().elapsed({ expected_run_id: a.story().runId(), from, until: from + 150 });
      assert.equal(r.kind, 'saved');
      if (r.kind === 'saved') assert.equal((r.decision as { kind: string }).kind, 'accepted');
      a.reopen();
      return r;
    };
    const first = round();
    if (first.kind === 'saved') {
      const events = (first.decision as { events: any[] }).events.filter(
        (e) => e.payload.type === 'attack_result',
      );
      assert.deepEqual(
        events.map((e) => [e.payload.hit, e.payload.loss, e.payload.prevented_by]),
        [
          [true, 3, undefined],
          [false, 0, 'dodge'],
        ],
      );
    }
    for (let n = 0; engaged(a.world(), a.fresh.body) && n < 12; n++) round();
    assert.equal(living(a.world(), a.entity('npc', 'cellar_rat_1')), false);
    move('up', 'west', 'west');
    a.invoke('buy', [a.entity('npc', 'peg'), a.entity('item', 'iron_sword')], { quoted_price: 8 });
    a.reopen();
    a.invoke('remove', [a.entity('item', 'rusty_sword')]);
    a.reopen();
    a.invoke('wear', [a.entity('item', 'iron_sword')]);
    a.reopen();
    assert.deepEqual(balances(), [14, 32, 0, 4]);
    move('east', 'east', 'down');
    for (const number of [2, 3, 4, 5]) {
      a.invoke('attack', [a.entity('npc', `cellar_rat_${number}`)]);
      a.reopen();
      for (let n = 0; engaged(a.world(), a.fresh.body) && n < 12; n++) round();
      assert.equal(living(a.world(), a.entity('npc', `cellar_rat_${number}`)), false);
    }
    move('up');
    a.invoke('maud_offer', [a.entity('npc', 'maud')]);
    choose('accept');
    a.reopen();
    a.invoke('maud_turn_in', [a.entity('npc', 'maud')]);
    choose('done');
    a.reopen();
    assert.equal(a.world().state.containers[a.entity('item', 'cellar_key')], a.fresh.body);
    move('up');
    const chest = a.entity('item', 'storage_chest');
    a.invoke('unlock', [chest]);
    a.invoke('open', [chest]);
    a.invoke('put', [a.entity('item', 'rusty_sword'), chest]);
    a.reopen();
    a.invoke('take', [a.entity('item', 'rusty_sword')]);
    a.reopen();
    assert.deepEqual(
      gameView(a.world()).skills?.map((s) => [s.acquired, s.qualified]),
      [
        [true, true],
        [true, true],
      ],
    );
    a.sql.close();
  }
});
