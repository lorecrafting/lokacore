import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import {
  INSTALLED,
  loadCartridge,
  newWorld,
  gameView,
  step,
  type Cartridge,
  type World,
} from '../src/index.ts';
import { resolve } from '../src/commands/target.ts';
import { createHash } from 'node:crypto';
import { encode } from '../src/foundation/canonical.ts';
import { read } from './read.ts';
import { elapsedHost } from '../../../mobile/authority/local-story/__tests__/elapsed-host.test.ts';
import { openGame } from '../../../mobile/authority/local-story/session.ts';
import { openStory } from '../../../mobile/authority/local-story/authority.ts';
import { load } from '../../../mobile/authority/local-story/store.ts';
import { presenter } from '../../../mobile/app/book/presenter.ts';

const bundle = read('protocol/fixtures/missing_child_d5_hash.json');
const ids = read('protocol/fixtures/missing_child_d5_ids.json');
const inscription =
  'A worn ring surrounds a carved doorway. Beneath it, the remaining marks read: “Keep the threshold. Let the path remain open.”';
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

function setup(path = ':memory:', bundled = bundle) {
  const a = elapsedHost(path, { wall: 10000, mono: 0 }, bundled);
  let game = a.game;
  let book = presenter(game);
  const subscribe = () => game.subscribe(book.update);
  subscribe();
  const reopen = () => {
    if (path !== ':memory:') {
      a.sql.close();
      a.sql.open();
    }
    game = openGame(a.db, bundled, a.host);
    book = presenter(game);
    subscribe();
  };
  const ok = (action_key: string, target_ids: string[] = [], input: object = {}) => {
    const r = game.invoke({ action_key, target_ids, input } as never);
    assert.equal(r.kind, 'saved', JSON.stringify(r));
    if (r.kind === 'saved') assert.equal(r.decision.kind, 'accepted', JSON.stringify(r));
  };
  const move = (...directions: string[]) =>
    directions.forEach((direction) => ok('move', [], { direction }));
  const choose = (choice_id: string, answer?: string) =>
    ok('choose', [], {
      choice_id,
      continuation_id: game.view().view.choice!.continuation_id,
      ...(answer && { answer }),
    });
  const row = (section: string, key: string) => {
    const r = a.sql
      .prepare('SELECT value FROM state_row WHERE section=? AND key=?')
      .get(section, key);
    return r && JSON.parse(r.value as string);
  };
  const rows = () => a.sql.prepare('SELECT * FROM state_row ORDER BY section,key').all();
  const here = (key: string) => assert.equal(row('containers', ids.body), ids[`room/${key}`]);
  const stone = () => {
    const before = rows();
    ok('look', [ids['detail/fox_den_deep/ward_stone']]);
    const button = book.screen().buttons.find((b) => b.label === 'Read the ward stone');
    assert.ok(button);
    assert.deepEqual(button.target_ids, [ids['detail/fox_den_deep/ward_stone']]);
    book.press(button, button.target_ids[0]);
    assert.equal(book.screen().detail(button.target_ids[0]).at(-1), inscription);
    assert.equal(book.screen().log.includes(inscription), false);
    assert.deepEqual(rows(), before);
  };
  const offer = (branch = 'rescue') => {
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
    if (branch === 'lost') return;
    move('south', 'south');
    ok('a_vesper_meeting', [ids['npc/vesper']]);
    choose('meet_wren');
    ok('b_vesper_riddle', [ids['npc/vesper']]);
    choose('answer', 'LANTERN');
    if (branch === 'rescue') ok('a_wren_escort', [ids['npc/wren']]);
    else ok('c_vesper_answered', [ids['npc/vesper']]);
  };
  return {
    ...a,
    game: () => game,
    book: () => book,
    reopen,
    ok,
    move,
    choose,
    row,
    rows,
    here,
    stone,
    offer,
  };
}

// Breaks: a reciprocal edge is missing, a new current room cannot reopen, or Pool gains false bottom access.
test('fresh dry exploration traverses every reciprocal edge and reopens all five new rooms', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-d5-route-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const a = setup(join(dir, 'save.db'));
  t.after(() => a.sql.close());
  a.move('south', 'south', 'south', 'west');
  for (const [direction, room] of [
    ['up', 'oak_branches'],
    ['up', 'oak_crown'],
    ['down', 'oak_branches'],
    ['down', 'drowned_oak'],
    ['south', 'black_pool'],
    ['east', 'fox_hollow'],
    ['down', 'fox_den_deep'],
    ['up', 'fox_hollow'],
    ['west', 'black_pool'],
    ['south', 'fishing_shallows'],
    ['north', 'black_pool'],
    ['north', 'drowned_oak'],
    ['east', 'mire_crossing'],
  ]) {
    a.move(direction);
    a.here(room);
    a.reopen();
    a.here(room);
    if (room === 'oak_crown') {
      const before = a.rows();
      a.ok('scan');
      assert.deepEqual(
        a
          .game()
          .view()
          .view.exits.map((e) => [e.direction, e.sight?.room, e.sight?.entities.map((x) => x.id)]),
        [['down', ids['room/oak_branches'], []]],
      );
      assert.deepEqual(a.rows(), before);
    }
    if (room === 'black_pool') {
      assert.deepEqual(
        a
          .game()
          .view()
          .view.exits.map((e) => e.direction),
        ['east', 'north', 'south'],
      );
      const r = a
        .game()
        .invoke({ action_key: 'move', target_ids: [], input: { direction: 'down' } } as never);
      assert.equal(r.kind, 'saved');
      if (r.kind === 'saved') assert.equal(r.decision.kind, 'rejected');
      a.here('black_pool');
    }
    if (room === 'fox_den_deep') {
      const world = load(a.db, fresh, assert.fail)!.world;
      for (const name of ['stone', 'ward', 'ward stone', 'at the ward stone'])
        assert.deepEqual(resolve(world, world.character, name), {
          kind: 'unique',
          target_id: ids['detail/fox_den_deep/ward_stone'],
        });
      a.stone();
      a.reopen();
      assert.deepEqual(a.book().screen().detail(ids['detail/fox_den_deep/ward_stone']), [
        inscription,
      ]);
    }
  }
});

// Breaks: movement/Read adopt before a real failed COMMIT, or lost acknowledgements duplicate their receipt or prose.
test('D5 movement and stone Read reconcile committed and absent COMMIT outcomes and replay exactly', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-d5-fault-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const action of ['move', 'read'])
    for (const kind of ['failed', 'lost'] as const) {
      const a = setup(join(dir, `${action}-${kind}.db`));
      try {
        a.move('south', 'south', 'south', 'south');
        if (action === 'read') a.move('down');
        const before = a.rows();
        const count = a.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n as number;
        if (kind === 'failed')
          a.sql.exec(
            'PRAGMA foreign_keys=ON; CREATE TABLE parent(id PRIMARY KEY); CREATE TABLE child(id REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED)',
          );
        a.fault.kind = kind;
        a.fault.armed = true;
        const intent =
          action === 'move'
            ? { action_key: 'move', target_ids: [], input: { direction: 'down' } }
            : {
                action_key: 'read',
                target_ids: [ids['detail/fox_den_deep/ward_stone']],
                input: {},
              };
        assert.equal(a.game().invoke(intent as never).kind, 'pending');
        assert.equal(a.game().pending(), true);
        assert.equal(a.book().screen().detail(ids['detail/fox_den_deep/ward_stone']).length, 0);
        assert.equal(
          a.game().view().view.place.title.key,
          `room.${action === 'move' ? 'fox_hollow' : 'fox_den_deep'}.title`,
        );
        assert.equal(a.game().invoke(intent as never).kind, 'pending');
        if (kind === 'failed') assert.deepEqual(a.rows(), before);
        a.fault.reads = false;
        assert.equal(a.game().invoke(intent as never).kind, 'saved');
        a.here('fox_den_deep');
        assert.equal(a.sql.prepare('SELECT count(*) AS n FROM receipt').get()!.n, count + 1);
        const receipt = a.sql
          .prepare('SELECT * FROM receipt ORDER BY revision DESC LIMIT 1')
          .get()!;
        const story = openStory(a.db, [{ fresh, content_hash: bundle.sha256 }], a.host);
        assert.equal(story.kind, 'open');
        if (story.kind !== 'open') continue;
        const replay = story.invoke({
          ...intent,
          invocation_id: receipt.invocation_id,
          actor_id: ids.character,
        } as never);
        assert.equal(replay.kind, 'saved');
        if (replay.kind === 'saved') assert.equal(replay.replay, true);
        a.reopen();
        a.here('fox_den_deep');
        assert.deepEqual(
          a.book().screen().detail(ids['detail/fox_den_deep/ward_stone']),
          action === 'read' ? [inscription] : [],
        );
      } finally {
        a.sql.close();
      }
    }
});

// Breaks: den darkness hides separated original Wren from a zero-gear player, escort travel loses him, or Read alters rescue evidence.
test('actual fatal separation in the den reopens and permits gear-free original-Wren Rejoin and rescue', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-d5-wren-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  // Controlled fatal input uses the existing rat; shipped chapter authors no den enemy.
  const controlled = structuredClone(bundle.value);
  const rat =
    controlled.npcs[`ashmere_missing_child@${controlled.manifest.version}:npc/cellar_rat_1`];
  controlled.calendar.start = 72000; // Night makes a hidden-NPC darkness regression observable.
  rat.room.key = 'fox_den_deep';
  controlled.world.death_credit[0].room.key = 'fox_den_deep';
  rat.attack = { chance: 100, damage_min: 100, damage_max: 100 };
  const canonical = encode(controlled);
  const a = setup(join(dir, 'save.db'), {
    canonical,
    sha256: createHash('sha256').update(canonical).digest('hex'),
  });
  t.after(() => a.sql.close());
  a.offer();
  a.choose('rescue');
  a.move('west', 'east', 'down');
  a.here('fox_den_deep');
  assert.equal(a.row('containers', ids['npc/wren']), ids['room/fox_den_deep']);
  a.stone();
  a.ok('attack', [ids['npc/cellar_rat_1']]);
  a.clock.wall += 3000;
  a.clock.mono += 3000;
  a.game().pulse();
  a.reopen();
  a.here('chapel_nave');
  assert.equal(a.row('escorts', ids.character).npc_id, ids['npc/wren']);
  assert.equal(a.row('escorts', ids.character).status, 'separated');
  assert.equal(a.row('containers', ids['npc/wren']), ids['room/fox_den_deep']);
  assert.equal(a.row('containers', ids['item/vesper_message']), ids['npc/vesper']);
  assert.equal(a.game().view().view.inventory.length, 0);
  a.move('south', 'south', 'south', 'south', 'south', 'south', 'south', 'south', 'south', 'down');
  a.here('fox_den_deep');
  a.reopen();
  assert.ok(
    a
      .game()
      .view()
      .view.entities.find((x) => x.id === ids['npc/wren'])!
      .actions.some((x) => x.action_key === 'b_wren_rejoin' && x.available),
  );
  a.stone();
  a.ok('b_wren_rejoin', [ids['npc/wren']]);
  a.choose('rejoin');
  assert.equal(a.row('escorts', ids.character).status, 'following');
  a.ok('take', [ids['item/fox_drawing']]);
  assert.equal(a.row('containers', ids['item/fox_drawing']), ids.body);
  a.stone();
  a.move('up', 'north', 'north', 'north', 'north');
  a.here('ferry_landing');
  a.ok('a_elspeth_rescue', [ids['npc/elspeth']]);
  a.choose('rescued');
  assert.equal(a.row('escorts', ids.character).status, 'completed');
  const quest = a
    .game()
    .view()
    .view.journal.find((q) => q.quest.key === 'missing_child')!;
  assert.equal(quest.state, 'resolved');
  assert.equal(quest.journal, 'quest.missing_child.rescued');
  a.move('south', 'south', 'south', 'south', 'down');
  a.stone();
  a.reopen();
  assert.equal(a.row('containers', ids['item/vesper_message']), ids['npc/vesper']);
});

// Breaks: reading the stone borrows original-message custody/return credit or rewrites terminal Q2 state.
test('fixed stone preserves original-message custody before and after stays and preserves lost', () => {
  for (const branch of ['stays', 'lost']) {
    const a = setup();
    try {
      a.offer(branch);
      if (branch === 'stays') {
        a.choose('carry_message');
        assert.equal(a.row('containers', ids['item/vesper_message']), ids.body);
        a.move('down');
        a.stone();
        a.reopen();
        assert.equal(a.row('containers', ids['item/vesper_message']), ids.body);
        a.ok('drop', [ids['item/vesper_message']]);
        a.stone();
        assert.equal(a.row('containers', ids['item/vesper_message']), ids['room/fox_den_deep']);
        a.ok('take', [ids['item/vesper_message']]);
        a.move('up', 'north', 'north', 'north', 'north');
        a.ok('a_elspeth_return', [ids['npc/elspeth']]);
        a.choose('stays');
        assert.equal(a.row('containers', ids['item/vesper_message']), ids['npc/elspeth']);
      } else {
        a.move('north', 'north', 'north', 'north', 'north', 'north', 'north');
        a.ok('a_aldric_offer', [ids['npc/aldric']]);
        a.choose('accept');
        a.move('up', 'up');
        a.ok('ring_bell', [ids['detail/belfry/bell']]);
        while (a.game().view().view.scene) {
          const scene = a.game().view().view.scene!;
          a.ok('continue', [], { scene: scene.scene, line: scene.index });
        }
        a.move('down', 'down', 'south', 'south', 'south', 'south', 'south');
        assert.equal(a.row('containers', ids['item/vesper_message']), ids['npc/vesper']);
      }
      assert.equal(
        a
          .game()
          .view()
          .view.journal.find((q) => q.quest.key === 'missing_child')!.journal,
        `quest.missing_child.${branch}`,
      );
      a.move('south', 'south', 'south', 'south', 'down');
      a.stone();
      a.reopen();
      assert.equal(
        a
          .game()
          .view()
          .view.journal.find((q) => q.quest.key === 'missing_child')!.journal,
        `quest.missing_child.${branch}`,
      );
      assert.equal(
        a.row('containers', ids['item/vesper_message']),
        ids[`npc/${branch === 'stays' ? 'elspeth' : 'vesper'}`],
      );
    } finally {
      a.sql.close();
    }
  }
});

// Breaks: a same-named held item can substitute for the original message bound into Elspeth's pending return.
test('the current chapter refuses a lookalike item substituted into the original-message role', () => {
  const a = setup();
  try {
    a.offer('stays');
    a.choose('carry_message');
    a.move('north', 'north', 'north', 'north');
    a.ok('a_elspeth_return', [ids['npc/elspeth']]);
    const world = load(a.db, fresh, assert.fail)!.world;
    const continuation = a.game().view().view.choice!.continuation_id;
    const copy = ids['item/tin_whistle'];
    const controlled: World = {
      ...world,
      entities: {
        ...world.entities,
        [copy]: { ...world.entities[copy], keywords: ['message', 'vesper_message'] },
      },
      state: {
        ...world.state,
        containers: { ...world.state.containers, [copy]: world.body },
        choices: {
          ...world.state.choices,
          [continuation]: {
            ...world.state.choices![continuation],
            roles: world.state.choices![continuation].roles.map((r) =>
              r.role === 'message' ? { ...r, entity_id: copy } : r,
            ),
          },
        },
      },
    };
    assert.equal(controlled.state.containers[ids['item/vesper_message']], ids.body);
    const option = gameView(controlled).choice!.choices.find((c) => c.choice_id === 'stays')!;
    assert.equal(option.available, false);
    assert.deepEqual('reason' in option && option.reason, { code: 'invalid_state' });
    const result = step(
      controlled,
      {
        id: 'aaaaaaaa-0000-4000-8000-000000000777',
        world_context_id: world.context,
        payload: {
          type: 'choose',
          actor_id: world.character,
          continuation_id: continuation,
          choice_id: 'stays',
        },
      } as never,
      777,
    );
    assert.deepEqual(result.decision, { kind: 'rejected', error: { code: 'invalid_state' } });
    assert.equal(result.world, controlled);
  } finally {
    a.sql.close();
  }
});
