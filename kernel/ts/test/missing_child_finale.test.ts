import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import {
  gameView,
  INSTALLED,
  loadCartridge,
  newWorld,
  step,
  type Cartridge,
  type World,
} from '../src/index.ts';
import type { Command, DefinitionRef } from '../src/contracts.gen.ts';
import { value } from '../src/mechanics/fact.ts';
import { encode } from '../src/foundation/canonical.ts';
import { read } from './read.ts';

const bundle = read('protocol/fixtures/missing_child_v017_hash.json');
const ids = read('protocol/fixtures/missing_child_v017_ids.json');
const loaded = loadCartridge(
  new TextEncoder().encode(
    JSON.stringify({ cartridge: bundle.value, content_hash: bundle.sha256 }),
  ),
  INSTALLED,
);
assert.ok(loaded.ok, JSON.stringify(loaded));
const cartridge = loaded.cartridge as Cartridge;
const ref = (kind: string, name: string) =>
  ({
    cartridge_id: 'ashmere_missing_child',
    cartridge_version: '0.0.17',
    kind,
    key: name,
  }) as DefinitionRef;

function route() {
  let world = newWorld(cartridge, '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]);
  let n = 0;
  const run = (payload: object, expected = 'accepted') => {
    const command = {
      id: `eeeeeeee-0000-4000-8000-${String(++n).padStart(12, '0')}`,
      world_context_id: world.context,
      payload: { actor_id: world.character, ...payload },
    } as Command;
    const before = world;
    const result = step(world, command, n);
    assert.equal(
      result.decision.kind === 'rejected' ? result.decision.error.code : result.decision.kind,
      expected,
      JSON.stringify(result.decision),
    );
    if (expected !== 'accepted') assert.equal(result.world, before);
    world = result.world;
    return result.decision;
  };
  const move = (...directions: string[]) =>
    directions.forEach((direction) => run({ type: 'move', direction }));
  const talk = (name: string) => run({ type: 'talk', target_id: ids[`npc/${name}`] });
  const choose = (choice_id: string, answer?: string) =>
    run({
      type: 'choose',
      continuation_id: gameView(world).choice!.continuation_id,
      choice_id,
      ...(answer && { answer }),
    });
  const flag = (name: string) => value(world, world.character, ref('fact', name));
  const continueScene = () => {
    const s = gameView(world).scene!;
    return run({ type: 'continue', scene: s.scene, line: s.index });
  };
  const search = () => {
    talk('elspeth');
    choose('accept');
    move('north', 'north');
    run({ type: 'take', item_id: ids['item/fox_drawing'] });
    move('south', 'south');
    talk('elspeth');
    choose('report');
    move('south', 'south');
    run({ type: 'perform', action: 'study_tracks' });
  };
  const childReturn = (child: 'rescued' | 'stays') => {
    move('south', 'south');
    talk('vesper');
    choose('meet_wren');
    talk('vesper');
    choose('answer', 'LANTERN');
    if (child === 'stays') {
      talk('vesper');
      choose('carry_message');
    } else {
      talk('wren');
      choose('rescue');
    }
    move('north', 'north', 'north', 'north');
    talk('elspeth');
    choose(child);
  };
  const bell = (choice: 'prior' | 'fox', lost: boolean) => {
    move(...Array(lost ? 7 : 5).fill('north'));
    talk('aldric');
    choose('accept');
    move('up', 'up');
    run({ type: 'perform', action: choice === 'prior' ? 'ring_bell' : 'silence_bell' });
    while (gameView(world).scene) continueScene();
    move('down', 'down', 'south', 'south', 'south');
  };
  return { run, move, flag, search, childReturn, bell, continueScene, world: () => world };
}

const rows = [
  ['rescued', 'prior', 'stilled'],
  ['rescued', 'fox', 'free'],
  ['stays', 'prior', 'stilled'],
  ['stays', 'fox', 'free'],
  ['lost', 'prior', 'stilled'],
] as const;

// Breaks: a source-valid action scene can bind a foreign detail at the loader boundary.
test('loaded Green scene must bind the Begin recipe detail', () => {
  const changed = structuredClone(bundle.value);
  const scene = changed.scenes['ashmere_missing_child@0.0.17:scene/epilogue_lost_prior'];
  const room = changed.rooms['ashmere_missing_child@0.0.17:room/village_green'];
  room.details.notice = structuredClone(room.details.market_cross);
  room.details.notice.aliases = ['notice'];
  scene.on.detail = 'notice';
  const content_hash = createHash('sha256').update(encode(changed)).digest('hex');
  const result = loadCartridge(
    new TextEncoder().encode(JSON.stringify({ cartridge: changed, content_hash })),
    INSTALLED,
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.diagnostic.code, 'OUTCOME_MISMATCH', JSON.stringify(result));
    assert.equal(
      result.diagnostic.path,
      '.cartridge.scenes["ashmere_missing_child@0.0.17:scene/epilogue_lost_prior"].on',
    );
  }
});

// Breaks: Begin starts on arrival, chooses the wrong pair, or exports before the final shown line.
test('five Green endings require voluntary Begin and final-line acknowledgement', () => {
  for (const [child, bell, fox] of rows) {
    const a = route();
    a.search();
    if (child !== 'lost') a.childReturn(child);
    a.bell(bell, child === 'lost');
    const before = gameView(a.world());
    assert.equal(before.place.id, ids['room/village_green']);
    assert.equal(before.scene, undefined);
    assert.deepEqual(
      before.actions
        .filter((x) => x.action_key.startsWith('begin_epilogue_') && x.available)
        .map((x) => x.action_key),
      [`begin_epilogue_${child}_${bell}`],
    );
    assert.deepEqual(
      [
        a.flag('memory_village_ending'),
        a.flag('memory_fox_fate'),
        a.flag('memory_chapter_1_guild_tilt'),
        a.flag('story_point_prologue_completed'),
      ],
      ['unreached', 'unreached', 'unreached', 'unreached'],
    );
    a.run(
      {
        type: 'perform',
        action: `begin_epilogue_${child}_${bell}`,
        target_id: ids['detail/notice'],
      },
      'invalid_target',
    );
    a.run({
      type: 'perform',
      action: `begin_epilogue_${child}_${bell}`,
      target_id: ids['detail/market_cross'],
    });
    assert.equal(gameView(a.world()).scene?.index, 1);
    a.run({ type: 'continue' }, 'invalid_state');
    a.continueScene();
    a.continueScene();
    assert.equal(gameView(a.world()).scene?.index, 3);
    assert.deepEqual(
      [a.flag('memory_village_ending'), a.flag('story_point_prologue_completed')],
      ['unreached', 'unreached'],
    );
    const old = gameView(a.world()).scene!;
    a.run({ type: 'continue', scene: old.scene, line: 2 }, 'invalid_state');
    const done = a.continueScene();
    assert.equal(gameView(a.world()).scene, undefined);
    assert.equal(gameView(a.world()).chapter?.index, 1);
    assert.deepEqual(
      [
        a.flag('memory_village_ending'),
        a.flag('memory_fox_fate'),
        a.flag('memory_chapter_1_guild_tilt'),
        a.flag('story_point_prologue_completed'),
      ],
      [child, fox, bell, `${child}_${bell}`],
    );
    assert.equal(done.kind, 'accepted');
    if (done.kind === 'accepted')
      assert.equal(done.events.filter((e) => e.payload.type === 'story_point_reached').length, 1);
  }
});
