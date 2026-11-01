// size: allow 740, every reopen case here shares one SQLite setup() and its forged-row table
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  bundle as escortBundle,
  entity,
  genesis,
  prefix,
  ref,
  room,
} from '../../../kernel/ts/test/escort_fixture.ts';
import { elapsedHost } from './__tests__/elapsed-host.test.ts';
import { presenter } from '../../app/book/presenter.ts';
import { localSession, openGame } from './session.ts';
import { openStory } from './authority.ts';

const bundle = escortBundle();
const fresh = genesis();
const id = (kind: string, name: string) => entity(fresh, kind, name);
const startLine = 'The child joins you for the walk to Ferry Landing.';
const rejoinLine = 'The child steps beside you again';
const endLine = 'The child runs to the keeper.';
const homeward = (a: ReturnType<typeof setup>) =>
  a.view().journal.find((q) => q.quest.key === 'homeward')!;

// Breaks: a malformed unrelated quest row (the cellar Lantern quest) crashes receipt recovery or
// silently disappears from the journal instead of offering typed corruption recovery.
test('a malformed other quest after rescue selection or completion offers typed recovery without replacing progress', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-escort-malformed-quest-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const terminal of [false, true])
    for (const [field, malformed] of [
      [null, null],
      [null, false],
      [null, 0],
      [null, []],
      [null, {}],
      [null, { quest: {}, scope: {} }],
      [null, { quest: true, scope: true }],
      ['quest', {}],
      ['scope', {}],
    ] as const)
      await t.test(
        `${terminal ? 'completed' : 'following'} ${field ?? 'row'}: ${JSON.stringify(malformed)}`,
        () => {
          const a = setup(join(dir, `${terminal}-${field}-${JSON.stringify(malformed)}.db`));
          try {
            a.offer();
            a.choose('rescue');
            if (terminal) a.end();
            a.sql.close();
            a.sql.open();
            assert.equal(openGame(a.db, bundle, a.host).view().view.journal.length, 2);
            const q1 = a.rows('quests').find((q) => q.value.quest.key === 'lantern')!;
            a.put('quests', q1.key, field ? { ...q1.value, [field]: malformed } : malformed);
            const before = a.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all();
            a.sql.close();
            a.sql.open();
            assert.equal(
              openStory(a.db, [{ content_hash: bundle.sha256, fresh }], a.host).kind,
              'save_corrupt',
            );
            const session = localSession(() => a.db, assert.fail, bundle, a.host);
            assert.equal(session.game(), undefined);
            assert.equal(session.failed()?.kind, 'save_corrupt');
            assert.equal(session.failed()?.startOver, true);
            assert.deepEqual(
              a.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all(),
              before,
            );
            assert.equal(session.startOver(), undefined);
            assert.equal(session.failed(), undefined);
            assert.deepEqual(session.game()!.view().view.journal, []);
          } finally {
            a.sql.close();
          }
        },
      );
});

function setup(path = ':memory:', source = bundle) {
  const a = elapsedHost(path, { wall: 10000, mono: 0 }, source);
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
  const accept = (dialogue: string, npc: string) => {
    ok(dialogue, [id('npc', npc)]);
    choose('accept');
    if (view().choice) ok('close_choice');
  };
  // Two quests (the cellar Lantern quest and Homeward), then the child's escort offer.
  const offer = () => {
    accept('bram_offer', 'bram');
    accept('keeper_offer', 'keeper');
    move('north', 'north');
    ok('child_escort', [id('npc', 'child')]);
  };
  const press = (npc: string) => {
    const button = book.screen().buttons.find((b) => b.action_key === 'choose');
    assert.ok(button);
    book.press(button, id('npc', npc));
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
  const quest = () => rows('quests').find((r) => r.value.quest.key === 'homeward')!;
  const escort = () => row('escorts', fresh.character);
  const lines = (npc: string, text: string) =>
    book
      .screen()
      .detail(id('npc', npc))
      .filter((line) => typeof line === 'string' && line.includes(text));
  const end = () => {
    move('south', 'south');
    ok('keeper_home', [id('npc', 'keeper')]);
    choose('home');
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
    actor_id: fresh.character,
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

// Breaks: a narrate step on the escort answer read as a save-changing assignment the row cannot
// show, so every reopen after the answer is save_corrupt.
test('a save reopens after an escort answer with a narrate step', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-escort-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'save.db');
  const narrated = escortBundle((c) =>
    c.dialogues[`${prefix}:dialogue/child_escort`].choices.rescue.steps.push({
      op: 'narrate',
      text: 'narration.accept',
    }),
  );
  let a = setup(path, narrated);
  a.offer();
  a.choose('rescue');
  a.sql.close();
  a = setup(path, narrated);
  assert.equal(a.escort()!.status, 'following');
  a.sql.close();
});

// Breaks: an escort row is lost/rejected at reopen or reconciliation, a lawful separated save is
// rejected, or start/Rejoin/terminal receipts restore to the wrong NPC after their pending row ends.
test('real SQLite escort reopens start, death separation, Rejoin and terminal with their own narration', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-escort-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'save.db');
  let a = setup(path);
  a.offer();
  const origin = a.view().choice!.continuation_id;
  const quest = a.quest().key;
  // A committed-but-unacknowledged new relation must pass the same real load boundary on retry.
  a.fault.kind = 'lost';
  a.fault.armed = true;
  a.press('child');
  assert.equal(a.game.pending(), true);
  assert.equal(a.view().choice!.continuation_id, origin);
  assert.equal(a.lines('child', startLine).length, 0);
  a.fault.reads = false;
  a.press('child');
  assert.equal(a.game.pending(), false);
  assert.deepEqual(a.escort(), {
    kind: 'escort',
    actor_id: fresh.character,
    body_id: fresh.body,
    npc_id: id('npc', 'child'),
    quest_instance_id: quest,
    continuation_id: origin,
    choice_id: 'rescue',
    status: 'following',
  });
  assert.equal(a.quest().value.state, 'active');
  assert.equal(a.fact('homeward_started')!.value, true);
  assert.equal(a.lines('child', startLine).length, 1);
  assert.equal(a.lines('stranger', startLine).length, 0);
  replay(a, 'rescue');
  a.sql.close();
  a = setup(path);
  assert.equal(a.lines('child', startLine).length, 1);
  assert.equal(
    a.book.screen().log.filter((s) => (typeof s === 'string' ? s : s.text).includes(startLine))
      .length,
    1, // its page's line also lands in the room log once (book-ui.md Line placement)
  );
  a.move('south');
  assert.equal(a.quest().value.state, 'active');
  a.move('east', 'down');
  // Controlled lethal input; the real combat sequence supplies the persisted separation evidence.
  const hp = a.rows('resources').find((r) => {
    const k = JSON.parse(r.key);
    return k.entity_id === fresh.body && k.resource.key === 'hp';
  })!;
  a.put('resources', hp.key, { ...hp.value, value: 1 });
  a.sql.close();
  a = setup(path);
  a.ok('attack', [id('npc', 'cellar_rat_1')]);
  a.clock.wall += 3000;
  a.clock.mono += 3000;
  a.game.pulse();
  assert.equal(a.escort().status, 'separated');
  assert.equal(a.row('containers', fresh.body), room(fresh, 'chapel_nave'));
  assert.equal(a.row('containers', id('npc', 'child')), room(fresh, 'lantern_cellar'));
  a.sql.close();
  a = setup(path);
  assert.equal(homeward(a).journal, 'quest.homeward.separated');
  a.move('south', 'south', 'south', 'south', 'east', 'down');
  // Returning to the child's room is a legal separated save, not proof of an accepted Rejoin.
  a.sql.close();
  a = setup(path);
  assert.equal(a.escort().status, 'separated');
  a.ok('child_rejoin', [id('npc', 'child')]);
  a.press('child');
  assert.equal(a.escort().continuation_id, origin);
  assert.equal(a.escort().status, 'following');
  assert.equal(a.lines('child', rejoinLine).length, 1);
  replay(a, 'rejoin');
  a.sql.close();
  a = setup(path);
  assert.equal(a.lines('child', rejoinLine).length, 1);
  // Every line lands in the room log too, restored once (book-ui.md Line placement).
  assert.equal(
    a.book.screen().log.filter((s) => (typeof s === 'string' ? s : s.text).includes(rejoinLine))
      .length,
    1,
  );
  a.move('up', 'west', 'south');
  a.ok('keeper_home', [id('npc', 'keeper')]);
  // A real failed COMMIT must leave the completed row behind the pending receipt fence.
  a.sql.exec(
    'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
  );
  a.fault.kind = 'failed';
  a.fault.armed = true;
  a.press('keeper');
  assert.equal(a.game.pending(), true);
  assert.equal(homeward(a).state, 'active');
  assert.equal(a.lines('keeper', endLine).length, 0);
  a.fault.reads = false;
  a.press('keeper');
  assert.equal(a.game.pending(), false);
  assert.equal(a.escort().status, 'completed');
  assert.equal(a.quest().value.outcome, 'home');
  assert.equal(a.lines('keeper', endLine).length, 1);
  assert.equal(a.lines('child', endLine).length, 0);
  replay(a, 'home');
  a.sql.close();
  a = setup(path);
  assert.equal(a.lines('keeper', endLine).length, 1);
  assert.equal(homeward(a).journal, 'quest.homeward.home');
  a.move('north', 'north');
  assert.equal(a.row('containers', id('npc', 'child')), room(fresh, 'ferry_landing'));
  a.sql.close();
  a = setup(path);
  assert.equal(a.escort().status, 'completed');
  assert.equal(a.row('containers', id('npc', 'child')), room(fresh, 'ferry_landing'));
  a.sql.close();
});

// Breaks: a completed escort refused after a lawful keeper death or reaction move, for good.
test('a completed escort reopens after the keeper dies or a reaction moves the child', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-escort-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const reopens = (
    name: string,
    source: typeof bundle,
    after: (a: ReturnType<typeof setup>) => void,
  ) => {
    const path = join(dir, `${name}.db`);
    const a = setup(path, source);
    a.offer();
    a.choose('rescue');
    a.end();
    after(a);
    a.sql.close();
    setup(path, source).sql.close();
  };
  reopens(
    'killed',
    escortBundle((c) => {
      Object.assign(c.npcs[`${prefix}:npc/keeper`], {
        hp: { minimum: 0, maximum: 1, start: 1, gain: 0 },
        attack: { chance: 0, damage_min: 1, damage_max: 1 },
      });
    }),
    (a) => {
      a.ok('attack', [id('npc', 'keeper')]);
      const here = () => JSON.stringify(a.game.view().view).includes(id('npc', 'keeper'));
      for (let i = 0; i < 100 && here(); i++) {
        a.clock.wall += 5000;
        a.clock.mono += 5000;
        a.game.pulse();
      }
      assert.equal(here(), false);
    },
  );
  reopens(
    'moved',
    escortBundle((c) => {
      const npc = c.dialogues[`${prefix}:dialogue/keeper_home`].npc;
      (c.reactions ??= {})[`${prefix}:reaction/child_runs`] = {
        key: 'child_runs',
        on: {
          event: 'quest_resolved',
          quest: c.dialogues[`${prefix}:dialogue/keeper_home`].quest,
          outcome: 'home',
        },
        steps: [
          {
            op: 'npc.move',
            npc: { ...npc, key: 'child' },
            room: { ...npc, kind: 'room', key: 'village_green' },
          },
        ],
      };
    }),
    (a) => assert.equal(a.row('containers', id('npc', 'child')), room(fresh, 'village_green')),
  );
});

const mortal = {
  hp: { minimum: 0, maximum: 1, start: 1, gain: 0 },
  attack: { chance: 0, damage_min: 1, damage_max: 1 },
};
// Attack an NPC with one hit point and run rounds until it is gone from the view.
function kill(a: ReturnType<typeof setup>, npc: string) {
  a.ok('attack', [id('npc', npc)]);
  const here = () => JSON.stringify(a.game.view().view).includes(id('npc', npc));
  for (let i = 0; i < 100 && here(); i++) {
    a.clock.wall += 5000;
    a.clock.mono += 5000;
    a.game.pulse();
  }
  assert.equal(here(), false);
}
// A reaction step fired when the player and child walk north into North Gate.
const onGate = (step: (quest: object, npc: object) => object) =>
  escortBundle((c) => {
    const d = c.dialogues[`${prefix}:dialogue/keeper_home`];
    (c.reactions ??= {})[`${prefix}:reaction/on_gate`] = {
      key: 'on_gate',
      on: { event: 'entity_entered_room', room: { ...d.npc, kind: 'room', key: 'north_gate' } },
      steps: [step(d.quest, { ...d.npc, key: 'child' })],
    };
  });

// Breaks: following escort left in a state the kernel refuses every Move on, or a save check that
// refuses the lawful state for good. Each case plays, reopens, keeps moving and reopens again.
for (const [name, source, act, status, child, walk] of [
  [
    'child killed',
    escortBundle((c) => void Object.assign(c.npcs[`${prefix}:npc/child`], mortal)),
    (a: ReturnType<typeof setup>) => kill(a, 'child'),
    'separated',
    'village_green',
    ['south', 'north'],
  ],
  [
    'keeper killed',
    escortBundle((c) => void Object.assign(c.npcs[`${prefix}:npc/keeper`], mortal)),
    (a: ReturnType<typeof setup>) => {
      a.move('south', 'south');
      kill(a, 'keeper');
    },
    'following',
    'village_green',
    ['north', 'north'],
  ],
  [
    'npc.move on the child',
    onGate((_, npc) => ({
      op: 'npc.move',
      npc,
      room: { ...npc, kind: 'room', key: 'ferry_landing' },
    })),
    (a: ReturnType<typeof setup>) => a.move('north'),
    'following',
    'well_lane',
    ['south', 'south'],
  ],
  [
    'quest failed',
    onGate((quest) => ({ op: 'quest.fail', quest, outcome: 'home' })),
    (a: ReturnType<typeof setup>) => a.move('north'),
    'separated',
    'north_gate',
    ['south', 'north'],
  ],
] as const) {
  test(`a following escort reopens and keeps moving after: ${name}`, (t) => {
    const dir = mkdtempSync(join(tmpdir(), 'loka-vduxr.23-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const path = join(dir, 'save.db');
    let a = setup(path, source);
    a.offer();
    a.choose('rescue');
    act(a);
    a.sql.close();
    a = setup(path, source);
    assert.equal(a.escort().status, status);
    a.move(...walk);
    assert.equal(a.row('containers', id('npc', 'child')), room(fresh, child));
    a.sql.close();
    setup(path, source).sql.close();
  });
}

// Breaks: reopen refuses an NPC out of the room, Move faults on it for good, or Move teleports it.
// No shipped mover parts a following authored NPC yet, so the row itself is placed.
test('a following escort out of the room reopens, and the next Move leaves it and separates', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-vduxr.23-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'save.db');
  let a = setup(path);
  a.offer();
  a.choose('rescue');
  a.put('containers', id('npc', 'child'), room(fresh, 'ferry_landing'));
  a.sql.close();
  a = setup(path);
  a.move('north');
  assert.equal(a.escort().status, 'separated');
  assert.equal(a.row('containers', id('npc', 'child')), room(fresh, 'ferry_landing'));
  a.sql.close();
  setup(path).sql.close();
});

// Breaks: escort save validation admits a forged binding, placement or terminal, or an unrelated
// latest receipt hides a missing/swapped original escort or its evidence. The chapter cases (rescue
// message removed from Vesper, branch changed to stays) are gone: they pinned chapter story content.
// An escort naming a repeatable exchange quest (compile accepts it): the turn-in cannot be its
// Complete, the next acceptance retires the row the escort names, and the repeat starts it again.
const repeating = (c: any) => {
  const named = (kind: string, key: string) => `${prefix}:${kind}/${key}`;
  const int = (key: string) => ({
    key,
    version: 1,
    value_type: { type: 'int', minimum: 0, maximum: 9, default: 0 },
    scopes: ['player'],
    meaning: key,
  });
  c.facts[named('fact', 'favour')] = int('favour');
  c.facts[named('fact', 'standing')] = int('standing');
  const ware = (key: string, location: object) =>
    (c.items[named('item', key)] = {
      key,
      keywords: [key],
      name: 'npc.child.short',
      room_line: 'npc.child.room',
      description: 'npc.child.description',
      mass_grams: 10,
      location,
    });
  const keeper = ref('npc', 'keeper');
  for (const n of ['1', '2']) {
    ware(`coin_${n}`, { in: 'room', room: ref('room', 'ferry_landing') });
    ware(`loaf_${n}`, { in: 'npc', npc: keeper });
  }
  Object.assign(c.quests[named('quest', 'homeward')], {
    repeatable: true,
    exchange: {
      npc: keeper,
      outgoing: [ref('item', 'coin_1'), ref('item', 'coin_2')],
      incoming: [ref('item', 'loaf_1'), ref('item', 'loaf_2')],
      quantity: 1,
      contribution: ref('fact', 'favour'),
      faction: ref('fact', 'standing'),
      increment: 1,
    },
  });
  delete c.dialogues[named('dialogue', 'keeper_home')];
  const escorting = c.dialogues[named('dialogue', 'child_escort')];
  escorting.policy.items.pop(); // the fact gate would refuse the repeat
  delete escorting.choices.rescue.steps;
  delete escorting.roles.stranger; // he stays on the green; the repeat starts at the landing
  c.dialogues[named('dialogue', 'keeper_turn_in')] = {
    key: 'keeper_turn_in',
    npc: keeper,
    quest: ref('quest', 'homeward'),
    prompt: 'dialogue.keeper_home.prompt',
    policy: {
      op: 'all',
      items: [{ op: 'quest_state', quest: ref('quest', 'homeward'), state: 'active' }],
    },
    roles: { keeper: { role: 'npc', npc: keeper } },
    choices: {
      swap: { label: 'dialogue.home.label', narration: 'narration.home', exchange: true },
    },
  };
};

// Breaks: quest.retire deletes the quest row an escort or its receipts name, so reopen is
// save_corrupt for good, Move faults on the missing quest, or the repeat cannot start again.
test('an escort on a repeatable quest reopens after re-acceptance and starts again on the repeat', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-vduxr.23-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'save.db');
  const source = escortBundle(repeating);
  const quests = genesis(repeating);
  const reopened = (a: ReturnType<typeof setup>) => {
    a.sql.close();
    return setup(path, source);
  };
  let a = setup(path, source);
  a.ok('take', [entity(quests, 'item', 'coin_1')]);
  a.ok('take', [entity(quests, 'item', 'coin_2')]);
  a.offer();
  a.choose('rescue');
  const first = a.escort();
  a.move('south', 'south');
  a.ok('keeper_turn_in', [id('npc', 'keeper')]);
  a.choose('swap');
  if (a.view().choice) a.ok('close_choice');
  a.ok('keeper_offer', [id('npc', 'keeper')]);
  a.choose('accept');
  if (a.view().choice) a.ok('close_choice');
  assert.notEqual(a.quest().key, first.quest_instance_id);
  a = reopened(a);
  a.move('north');
  a = reopened(a);
  a.move('south');
  a.ok('child_escort', [id('npc', 'child')]);
  a.choose('rescue');
  assert.equal(a.escort().status, 'following');
  assert.equal(a.escort().quest_instance_id, a.quest().key);
  assert.notEqual(a.escort().continuation_id, first.continuation_id);
  a = reopened(a);
  a.move('north', 'north');
  assert.equal(a.row('containers', id('npc', 'child')), room(fresh, 'village_green'));
  a = reopened(a);
  a.sql.close();
});

test('retained escort identity, physical state and own receipts reject corruption behind a later look', async (t) => {
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
      (a) => a.put('escorts', fresh.character, { ...a.escort(), npc_id: id('npc', 'stranger') }),
    ],
    [
      'wrong quest instance',
      false,
      (a) =>
        a.put('escorts', fresh.character, {
          ...a.escort(),
          quest_instance_id: a.rows('quests').find((q) => q.value.quest.key !== 'homeward')!.key,
        }),
    ],
    [
      'wrong originating continuation',
      false,
      (a) =>
        a.put('escorts', fresh.character, {
          ...a.escort(),
          continuation_id: a.rows('choices').find((r) => r.value.source.key === 'keeper_offer')!
            .key,
        }),
    ],
    [
      'separated row with no committed transition',
      false,
      (a) => a.put('escorts', fresh.character, { ...a.escort(), status: 'separated' }),
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
    ...(
      [
        [
          'a start whose continuation is another choice',
          (a) => ({
            continuation_id: a.rows('choices').find((r) => r.value.source.key === 'keeper_offer')!
              .key,
          }),
        ],
        ['a start whose choice is another', () => ({ choice_id: 'other' })],
        ['a start whose NPC is another', () => ({ npc_id: id('npc', 'stranger') })],
      ] as [string, (a: ReturnType<typeof setup>) => object][]
    ).map(
      ([name, patch]) =>
        [
          `row and start receipt both forged: ${name}`,
          false,
          (a: ReturnType<typeof setup>) => {
            const value = { ...a.escort(), ...patch(a) };
            const r = a.sql
              .prepare(
                "SELECT command_id,response FROM receipt WHERE json_extract(command,'$.payload.continuation_id')=?",
              )
              .get(a.escort().continuation_id)!;
            const response = JSON.parse(r.response as string);
            for (const op of response.delta.ops)
              if (op.op === 'escort.transition') op.value = value;
            a.sql
              .prepare('UPDATE receipt SET response=? WHERE command_id=?')
              .run(JSON.stringify(response), r.command_id);
            a.put('escorts', fresh.character, value);
          },
        ] as [string, boolean, (a: ReturnType<typeof setup>) => void],
    ),
    [
      'forged home terminal without turn-in',
      false,
      (a) => {
        a.put('quests', a.quest().key, {
          ...a.quest().value,
          state: 'resolved',
          outcome: 'home',
        });
        a.put('escorts', fresh.character, { ...a.escort(), status: 'completed' });
      },
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
