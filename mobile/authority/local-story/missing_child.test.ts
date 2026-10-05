import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadCartridge,
  newWorld,
  gameView,
  INSTALLED,
  type Cartridge,
} from '../../../kernel/ts/src/index.ts';
import type { DefinitionRef, EntityId } from '../../../kernel/ts/src/contracts.gen.ts';
import { read } from '../../../kernel/ts/test/read.ts';
import { value } from '../../../kernel/ts/src/mechanics/fact.ts';
import { living } from '../../../kernel/ts/src/mechanics/death/shared.ts';
import { engaged } from '../../../kernel/ts/src/mechanics/combat/shared.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { openStory } from './authority.ts';

const bundle = read('protocol/fixtures/missing_child_v008_hash.json');
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
// Independent Python IdSource literals for this release, not allocated by the test.
const keyId = 'b3b7a7a6-b9e6-8d9c-82a2-c9cc728e3462';
const chestId = '329aae20-7fc7-8e3d-9119-ad44c022c439' as EntityId;
const brassId = '2a2d32e5-e113-8dca-a989-b9f1a35c4c78';
const maudId = '8a20c3d3-0f0f-84ec-b058-d27c85d5ba17';
const entity = (kind: string, name: string) =>
  fresh.entityIds[`ashmere_missing_child@0.0.8:${kind}/${name}`];
const ref = (name: string) =>
  ({
    cartridge_id: 'ashmere_missing_child',
    cartridge_version: '0.0.8',
    kind: 'fact',
    key: name,
  }) as DefinitionRef;
function setup(path = ':memory:') {
  const p = elapsedHost(path, { wall: 10000, mono: 0 }, bundle);
  const story = openStory(p.db, [{ fresh, content_hash: bundle.sha256 }], p.host);
  assert.equal(story.kind, 'open');
  if (story.kind !== 'open') throw new Error('production save');
  let n = Number(p.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n);
  const invoke = (
    action_key: string,
    target_ids: string[] = [],
    input: object = {},
    expected = 'accepted',
  ) => {
    const invocation = {
      invocation_id: `bbbbbbbb-0000-4000-8000-${String(++n).padStart(12, '0')}`,
      actor_id: fresh.character,
      action_key,
      target_ids,
      input,
    };
    const reply = story.invoke(invocation);
    assert.equal(reply.kind, 'saved');
    if (reply.kind === 'saved') {
      const d = reply.decision as { kind: string; error?: { code: string } };
      assert.equal(
        d.kind === 'accepted' ? 'accepted' : d.error?.code,
        expected,
        JSON.stringify(reply),
      );
    }
    return { invocation, reply };
  };
  const move = (...directions: string[]) =>
    directions.forEach((direction) => invoke('move', [], { direction }));
  const answer = (choice_id: string, code = 'accepted') =>
    invoke(
      'choose',
      [],
      { choice_id, continuation_id: gameView(story.world()).choice!.continuation_id },
      code,
    );
  const offer = () => {
    invoke('maud_offer', [maudId]);
    answer('accept');
  };
  const kill = (number: number) => {
    const id = entity('npc', `cellar_rat_${number}`);
    for (let attempt = 0; attempt < 10 && living(story.world(), id); attempt++) {
      invoke('attack', [id]);
      for (let round = 0; round < 100 && engaged(story.world(), fresh.body); round++) {
        const from = story.world().state.clock;
        const result = story.elapsed({ expected_run_id: story.runId(), from, until: from + 150 });
        assert.equal(result.kind, 'saved');
        if (result.kind === 'saved')
          assert.equal((result.decision as { kind: string }).kind, 'accepted');
      }
      assert.equal(engaged(story.world(), fresh.body), undefined);
      if (gameView(story.world()).place.title.key === 'room.chapel_nave.title')
        move('south', 'south', 'south', 'south', 'east', 'down');
    }
    assert.equal(living(story.world(), id), false, `rat ${number} actually died`);
  };
  return { ...p, story, invoke, move, answer, offer, kill, view: () => gameView(story.world()) };
}

// Breaks: a production leaf/binding loses preacceptance credit, pays a new/wrong key,
// or the chest uses the attic key / loses deposited custody on a real cold reopen.
test('active chapter five actual kills, shrine return, Maud reward and cold-reopen storage', (t) => {
  // Breaks: adding details shifts entity allocation but release bindings retain stale IDs.
  const expectedIds = read('protocol/fixtures/missing_child_v008_ids.json');
  assert.deepEqual(
    {
      character: fresh.character,
      body: fresh.body,
      ...Object.fromEntries(
        Object.entries({ ...fresh.roomIds, ...fresh.entityIds }).map(([ref, id]) => [
          ref.split(':')[1],
          id,
        ]),
      ),
      ...Object.fromEntries(
        Object.entries(fresh.details).map(([id, detail]) => [`detail/${detail.key}`, id]),
      ),
      'slot/cloak': fresh.slots.cloak,
    },
    expectedIds,
  );
  const dir = mkdtempSync(join(tmpdir(), 'loka-maud-production-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'save.db');
  let p = setup(path);
  assert.equal(p.story.world().state.containers[keyId], maudId);
  p.move('north', 'east', 'down'); // fresh, keyless and unaccepted
  for (const number of [1, 2, 3, 4, 5]) p.kill(number);
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((n) => value(p.story.world(), fresh.character, ref(`rat_${n}_killed`))),
    [true, true, true, true, true],
  );
  assert.deepEqual(p.story.world().state.quests ?? {}, {});
  assert.ok(
    Object.values(p.story.world().state.created ?? {}).some(
      (x) => x.definition.key === 'player_corpse',
    ),
    'actual lethal combat exercised the free shrine return route',
  );
  p.sql.close();
  p = setup(path);
  p.move('up');
  p.offer();
  assert.equal(p.story.world().state.containers[keyId], maudId, 'acceptance gives no key');
  assert.equal(p.view().journal[0].journal, 'quest.mauds_cellar.ready');
  p.invoke('maud_turn_in', [maudId]);
  p.answer('done');
  assert.equal(p.story.world().state.containers[keyId], fresh.body);
  assert.equal(value(p.story.world(), fresh.character, ref('maud_trust')), 5);
  assert.equal(value(p.story.world(), fresh.character, ref('inn_cellar_cleared')), true);
  assert.deepEqual(
    p.view().journal.map((q) => [q.state, q.journal]),
    [['resolved', 'quest.mauds_cellar.resolved']],
  );
  p.move('up');
  const chest = () => p.view().entities.find((e) => e.id === chestId)!;
  assert.equal(chest().state, 'locked');
  assert.equal(Object.values(p.story.world().state.containers).includes(chestId), false);
  p.invoke('unlock', [chestId]);
  p.invoke('open', [chestId]);
  p.invoke('take', [brassId]);
  p.invoke('put', [brassId, chestId]);
  p.invoke('close', [chestId]);
  p.move('up');
  assert.equal(p.view().entities.find((e) => e.id === entity('item', 'trunk'))!.state, 'locked');
  p.invoke('unlock', [entity('item', 'trunk')], {}, 'not_owned');
  p.move('down');
  p.sql.close();
  p = setup(path);
  assert.equal(p.story.world().state.containers[brassId], chestId);
  p.invoke('open', [chestId]);
  p.invoke('take', [brassId]);
  assert.equal(p.story.world().state.containers[brassId], fresh.body);
  p.move('down', 'west', 'south', 'south', 'south', 'south', 'south');
  assert.equal(p.view().place.title.key, 'room.fox_hollow.title');
  p.move('north', 'north', 'north', 'north');
  assert.equal(p.view().place.title.key, 'room.ferry_landing.title');
  p.sql.close();
});

const elspethId = 'a443f590-c8d3-86d8-9972-75e09b637bed';
const drawingId = '1f15fe56-3e56-8cfa-812b-1f231844c782';
const lead = (p: ReturnType<typeof setup>) =>
  p.view().journal.find((q) => q.quest.key === 'first_lead');
const acceptLead = (p: ReturnType<typeof setup>) => {
  p.invoke('elspeth', [elspethId]);
  p.answer('accept');
};

// Breaks: informational talk auto-starts Q1, the wrong item grants readiness, dropping
// leaves the report eligible, the guide masks report, or a retry/reopen resolves twice.
test('Q1 explicit acceptance, held drawing gate, report priority and durable once-only resolution', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-first-lead-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'save.db');
  let p = setup(path);
  p.invoke('elspeth', [elspethId]);
  p.answer('directions');
  assert.equal(lead(p), undefined);
  acceptLead(p);
  assert.equal(lead(p)?.journal, 'quest.first_lead.active');
  p.move('north', 'north');
  p.invoke('take', [drawingId]);
  assert.equal(lead(p)?.journal, 'quest.first_lead.ready');
  p.move('south', 'south');
  p.invoke('drop', [drawingId]);
  assert.equal(lead(p)?.journal, 'quest.first_lead.active');
  p.invoke('elspeth', [elspethId]);
  assert.ok(p.view().choice!.choices.some((c) => c.choice_id === 'directions'));
  assert.ok(!p.view().choice!.choices.some((c) => c.choice_id === 'report'));
  p.invoke('close_choice', [], { continuation_id: p.view().choice!.continuation_id });
  p.invoke('take', [drawingId]);
  p.sql.close();
  p = setup(path);
  assert.equal(p.story.world().state.containers[drawingId], fresh.body);
  assert.equal(lead(p)?.journal, 'quest.first_lead.ready');
  p.invoke('elspeth', [elspethId]);
  assert.deepEqual(
    p.view().choice!.choices.map((c) => c.choice_id),
    ['report'],
  );
  const result = p.invoke('choose', [], {
    continuation_id: p.view().choice!.continuation_id,
    choice_id: 'report',
  });
  assert.equal(lead(p)?.state, 'resolved');
  assert.equal(lead(p)?.journal, 'quest.first_lead.resolved');
  assert.equal(p.story.world().state.containers[drawingId], fresh.body);
  const count = p.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n;
  assert.equal(p.story.invoke(result.invocation).kind, 'saved');
  assert.equal(p.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n, count);
  p.sql.close();
  p = setup(path);
  assert.equal(lead(p)?.state, 'resolved');
  assert.equal(p.story.invoke(result.invocation).kind, 'saved');
  assert.equal(p.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n, count);
  p.invoke('elspeth', [elspethId]);
  assert.ok(p.view().choice!.choices.some((c) => c.choice_id === 'directions'));
  assert.ok(!p.view().choice!.choices.some((c) => c.choice_id === 'report'));
  p.answer('accept', 'invalid_state');
  p.answer('inn');
  assert.deepEqual(
    p.view().journal.map((q) => q.quest.key),
    ['first_lead'],
  );
  p.sql.close();
});

// Breaks: preacceptance pickup implicitly activates Q1 or acceptance forgets current custody.
test('picking up the clue first starts no quest and acceptance is immediately ready', () => {
  const p = setup();
  try {
    p.move('north', 'north');
    p.invoke('take', [drawingId]);
    assert.deepEqual(p.view().journal, []);
    p.move('south', 'south');
    acceptLead(p);
    assert.equal(lead(p)?.journal, 'quest.first_lead.ready');
  } finally {
    p.sql.close();
  }
});

// Breaks: Q1 masks or gates Maud's S1 offer/turn-in in any of its playable states.
for (const phase of ['unaccepted', 'active', 'ready', 'resolved']) {
  test(`Maud offer and earned turn-in stay usable while Q1 is ${phase}`, () => {
    const p = setup();
    try {
      if (phase !== 'unaccepted') acceptLead(p);
      if (phase === 'ready' || phase === 'resolved') {
        p.move('north', 'north');
        p.invoke('take', [drawingId]);
        p.move('south', 'south');
      }
      if (phase === 'resolved') {
        p.invoke('elspeth', [elspethId]);
        p.answer('report');
      }
      p.move('north', 'east');
      p.invoke('maud_offer', [maudId]);
      p.answer('accept');
      p.move('down');
      for (const number of [1, 2, 3, 4, 5]) p.kill(number);
      p.move('up');
      p.invoke('maud_turn_in', [maudId]);
      p.answer('done');
      assert.equal(p.story.world().state.containers[keyId], fresh.body);
      assert.equal(value(p.story.world(), fresh.character, ref('maud_trust')), 5);
      assert.equal(p.view().journal.find((q) => q.quest.key === 'mauds_cellar')?.state, 'resolved');
    } finally {
      p.sql.close();
    }
  });
}

// Breaks: a new schedule/hour gate strands the opening quest or Maud on the no-wait route.
test('Q1 acceptance, Green pickup, report and Maud offer work throughout the day', () => {
  for (let hours = 0; hours < 24; hours++) {
    const p = setup();
    try {
      if (hours) {
        const from = p.story.world().state.clock;
        assert.equal(
          p.story.elapsed({ expected_run_id: p.story.runId(), from, until: from + hours * 3600 })
            .kind,
          'saved',
        );
      }
      acceptLead(p);
      p.move('north', 'north');
      p.invoke('take', [drawingId]);
      p.move('south', 'south');
      p.invoke('elspeth', [elspethId]);
      p.answer('report');
      assert.equal(lead(p)?.state, 'resolved');
      p.move('north', 'east');
      p.offer();
    } finally {
      p.sql.close();
    }
  }
});

// Breaks: an hour/Q1 gate, wrong approach or missing reciprocal strands the player;
// a saved hollow reopens without its north return. Expected destinations are literal geography.
test('Mire Crossing and Fox Hollow offer both approaches and cold return at every hour', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-fen02-'));
  t.after(() => rmSync(dir, { recursive: true }));
  for (const phase of ['unaccepted', 'resolved']) {
    for (let hour = 0; hour < 24; hour++) {
      const path = join(dir, `${phase}-${hour}.db`);
      let p = setup(path);
      const walk = (direction: string, destination: string) => {
        assert.ok(p.view().exits.some((e) => e.direction === direction && e.available));
        p.move(direction);
        assert.equal(p.view().place.title.key, `room.${destination}.title`);
      };
      try {
        if (phase === 'resolved') {
          acceptLead(p);
          p.move('north', 'north');
          p.invoke('take', [drawingId]);
          p.move('south', 'south');
          p.invoke('elspeth', [elspethId]);
          p.answer('report');
        }
        const from = p.story.world().state.clock;
        assert.equal(
          p.story.elapsed({ expected_run_id: p.story.runId(), from, until: from + hour * 3600 })
            .kind,
          'saved',
        );
        walk('south', 'reed_path');
        walk('south', 'reed_bank');
        walk('south', 'mire_crossing');
        walk('south', 'fox_hollow');
        assert.deepEqual(
          p.view().exits.map((e) => [e.direction, e.available]),
          [['north', true]],
        );
        p.sql.close();
        p = setup(path);
        assert.equal(p.view().place.title.key, 'room.fox_hollow.title');
        walk('north', 'mire_crossing');
        walk('west', 'drowned_oak');
        walk('north', 'willow_shade');
        walk('east', 'reed_bank');
        walk('west', 'willow_shade');
        walk('south', 'drowned_oak');
        walk('east', 'mire_crossing');
        walk('north', 'reed_bank');
        assert.deepEqual(
          p.view().journal.map((q) => [q.quest.key, q.state]),
          phase === 'resolved' ? [['first_lead', 'resolved']] : [],
        );
      } finally {
        p.sql.close();
      }
    }
  }
});
