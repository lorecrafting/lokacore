import assert from 'node:assert/strict';
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
import { key } from '../src/foundation/compose.ts';
import { read } from './read.ts';

const bundle = read('protocol/fixtures/missing_child_v010_hash.json');
const ids = read('protocol/fixtures/missing_child_v010_ids.json');
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
    cartridge_version: '0.0.10',
    kind,
    key: name,
  }) as DefinitionRef;
function setup() {
  let world = newWorld(cartridge, '0d4e8a5c-3f1b-4c2a-9e7d-6b5a4c3d2e1f' as never, [1, 2, 3, 4]);
  let n = 0;
  const run = (payload: object, expected = 'accepted') => {
    const command = {
      id: `bbbbbbbb-0000-4000-8000-${String(++n).padStart(12, '0')}`,
      world_context_id: world.context,
      payload: { actor_id: world.character, ...payload },
    } as Command;
    const result = step(world, command, n);
    assert.equal(
      result.decision.kind === 'rejected' ? result.decision.error.code : result.decision.kind,
      expected,
      JSON.stringify(result.decision),
    );
    world = result.world;
    return result.decision;
  };
  const move = (...directions: string[]) =>
    directions.forEach((direction) => run({ type: 'move', direction }));
  const choose = (choice_id: string, answer?: string, expected?: string) =>
    run(
      {
        type: 'choose',
        continuation_id: gameView(world).choice!.continuation_id,
        choice_id,
        ...(answer !== undefined && { answer }),
      },
      expected,
    );
  const talk = (name: string) => run({ type: 'talk', target_id: ids[`npc/${name}`] });
  const flag = (name: string) => value(world, world.character, ref('fact', name));
  const journal = () => gameView(world).journal.find((q) => q.quest.key === 'missing_child');
  const report = () => {
    talk('elspeth');
    choose('accept');
    run({ type: 'close_choice', continuation_id: gameView(world).choice!.continuation_id }); // the hub stays open after an answer (loka-x6t.5): Leave the conversation
    move('north', 'north');
    run({ type: 'take', item_id: ids['item/fox_drawing'] });
    move('south', 'south');
    talk('elspeth');
    choose('report');
  };
  const meeting = () => {
    report();
    move('south', 'south');
    run({ type: 'perform', action: 'study_tracks' });
    move('south', 'south');
    talk('vesper');
  };
  return {
    run,
    move,
    choose,
    talk,
    flag,
    journal,
    report,
    meeting,
    world: () => world,
    set: (w: World) => {
      world = w;
    },
  };
}

// Breaks: visiting/looking/talking banks encounter credit before activation, Study or acceptance.
test('only accepted meeting after actual report and Study marks Wren met at every hour', () => {
  const a = setup();
  a.move('south', 'south', 'south', 'south');
  a.run({ type: 'look', target_id: ids['npc/wren'] });
  a.talk('vesper');
  a.choose('greet');
  assert.equal(a.flag('fen_wren_met'), false);
  assert.equal(a.journal(), undefined);
  a.move('north', 'north', 'north', 'north');
  a.report();
  a.move('south', 'south', 'south', 'south');
  a.talk('vesper');
  a.choose('greet');
  assert.equal(a.flag('fen_wren_met'), false);
  assert.equal(a.journal()!.journal, 'quest.missing_child.active');
  a.move('north', 'north');
  a.run({ type: 'perform', action: 'study_tracks' });
  assert.equal(a.journal()!.journal, 'quest.missing_child.lead');
  a.move('south', 'south');
  for (const hour of [0, 6, 12, 19, 23]) {
    const w = a.world();
    a.set({ ...w, state: { ...w.state, clock: hour * 3600 + 86400 } });
    assert.ok(gameView(a.world()).entities.some((e) => e.id === ids['npc/wren']));
    a.talk('vesper');
    assert.equal(a.flag('fen_wren_met'), false);
    a.run({ type: 'close_choice', continuation_id: gameView(a.world()).choice!.continuation_id });
  }
  a.talk('vesper');
  a.choose('meet_wren');
  assert.equal(a.flag('fen_wren_met'), true);
  assert.equal(a.journal()!.journal, 'quest.missing_child.met');
  a.run({ type: 'attack', target_id: ids['npc/wren'] }, 'invalid_target');
  a.run({ type: 'attack', target_id: ids['npc/vesper'] }, 'invalid_target');
});

// Breaks: comparison/assignment is missing, wrong answers consume the continuation, or banks allow excess tiles.
test('wrong answer retries the same bound row; malformed banks refuse; correct answer is once-only and nonterminal', () => {
  const a = setup();
  a.meeting();
  a.choose('meet_wren');
  a.talk('vesper');
  const before = gameView(a.world()).choice!;
  assert.deepEqual(before.riddle, {
    choice_id: 'answer',
    bank: ['R', 'N', 'A', 'O', 'L', 'T', 'E', 'N', 'S'],
  });
  for (const answer of [undefined, 'NNN', 'LANTERNN', 'Z']) {
    const state = a.world().state;
    a.choose('answer', answer, 'invalid_state');
    assert.deepEqual(a.world().state, state);
  }
  const wrong = a.choose('answer', 'STONE');
  assert.equal(wrong.kind, 'accepted');
  if (wrong.kind !== 'accepted') return;
  assert.equal(wrong.outcome, 'riddle_wrong');
  assert.deepEqual(wrong.events, []);
  assert.deepEqual(wrong.delta.ops, []);
  assert.equal(wrong.narration?.[0].key, 'narration.vesper_wrong');
  assert.deepEqual(gameView(a.world()).choice, before);
  assert.equal(a.flag('fen_vesper_riddle_answered'), false);
  const correct = a.choose('answer', 'LaNtErN');
  assert.equal(correct.kind, 'accepted');
  if (correct.kind !== 'accepted') return;
  assert.equal(correct.outcome, 'answer');
  assert.equal(correct.events.filter((e) => e.payload.type === 'choice_resolved').length, 1);
  assert.equal(
    correct.events.some((e) => e.payload.type === 'quest_resolved'),
    false,
  );
  assert.equal(a.flag('fen_vesper_riddle_answered'), true);
  assert.equal(a.journal()!.state, 'active');
  assert.equal(a.journal()!.journal, 'quest.missing_child.answered');
  assert.equal(gameView(a.world()).choice, undefined);
  a.run(
    {
      type: 'choose',
      continuation_id: before.continuation_id,
      choice_id: 'answer',
      answer: 'lantern',
    },
    'invalid_state',
  );
  a.talk('vesper');
  assert.deepEqual(
    gameView(a.world()).choice!.choices.map((o) => o.choice_id),
    ['acknowledge'],
  );
  a.choose('acknowledge', 'lantern', 'invalid_state');
  a.choose('acknowledge');
});

// Breaks: Choose rebinds by blueprint, ignores one role, or accepts dead/departed bound participants.
test('either original participant leaving or dying disables Choose while Close stays available', () => {
  for (const role of ['wren', 'vesper'])
    for (const failure of ['departed', 'dead', 'substitute']) {
      const a = setup();
      a.meeting();
      a.choose('meet_wren');
      a.talk('vesper');
      const w = a.world(),
        id = ids[`npc/${role}`];
      const other = ids['room/mire_crossing'];
      const resource = key({ kind: 'resource', resource: ref('resource', 'hp'), entity_id: id });
      const hp = { minimum: 0, maximum: 10, start: 10, gain: 0 };
      if (failure === 'dead')
        a.set({
          ...w,
          entities: { ...w.entities, [id]: { ...w.entities[id], hp } },
          entityResourceSpecs: { ...w.entityResourceSpecs, [resource]: hp },
          state: {
            ...w.state,
            resources: { ...w.state.resources, [resource]: { value: 0, at: w.state.clock } },
          },
        } as World);
      else {
        const substitute = 'dddddddd-0000-4000-8000-000000000001';
        a.set({
          ...w,
          entities: {
            ...w.entities,
            ...(failure === 'substitute' && { [substitute]: w.entities[id] }),
          },
          state: {
            ...w.state,
            containers: {
              ...w.state.containers,
              [id]: other,
              ...(failure === 'substitute' && { [substitute]: ids['room/fox_hollow'] }),
            },
          },
        });
      }
      const choice = gameView(a.world()).choice!;
      assert.equal(choice.closable, true);
      assert.deepEqual(choice.choices[0], {
        choice_id: 'answer',
        label: 'dialogue.b_vesper_riddle.answer',
        available: false,
        reason: { code: 'not_present' },
      });
      a.choose('answer', 'lantern', 'not_present');
      a.run({ type: 'close_choice', continuation_id: choice.continuation_id });
      assert.equal(a.flag('fen_vesper_riddle_answered'), false);
    }
});
