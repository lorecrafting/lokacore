import { newWorld } from '../src/index.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { key } from '../src/foundation/compose.ts';
import { value } from '../src/mechanics/fact.ts';
import { visible } from '../src/mechanics/light/shared.ts';
import { bodyOf } from '../src/runtime/decision.ts';
import { runner, fresh, ids, ref } from './wisp_fixture.ts';

// Break: the opted marker exposes unrelated dark targets, or discovery reveals the wisp globally.
test('marsh marker is visible in darkness while ordinary details and the undiscovered wisp refuse raw IDs', () => {
  const base = fresh(),
    npcRef = 'ashmere_missing_child@0.0.23:npc/wisp';
  const controlled = {
    ...base.cartridge,
    npcs: {
      ...base.cartridge.npcs,
      [npcRef]: {
        ...base.cartridge.npcs![npcRef]!,
        hp: { minimum: 0, maximum: 10, start: 10, gain: 0 },
      },
    },
  };
  const r = runner(newWorld(controlled, base.context, [1, 2, 3, 4]));
  r.move('south', 'south', 'south', 'east');
  assert.equal(r.view().notices?.[0].title, 'detail.glow.title');
  assert.equal(r.view().notices?.[0].actions?.[0].label, 'actions.seek_wisp');
  assert.equal(
    r.view().entities.some((e) => e.id === ids['npc/wisp']),
    false,
  );
  assert.equal(r.raw('look', { target_id: ids['detail/marsh_light/reeds'] }).kind, 'rejected');
  assert.equal(r.raw('talk', { target_id: ids['npc/wisp'] }).kind, 'rejected');
  r.seek();
  assert.equal(
    r.view().entities.some((e) => e.id === ids['npc/wisp']),
    true,
  );
  const found = r.world(),
    at = key({ kind: 'resource', entity_id: ids['npc/wisp'], resource: ref('resource', 'hp') });
  const dead = {
    ...found,
    state: {
      ...found.state,
      resources: { ...found.state.resources, [at]: { value: 0, at: found.state.clock } },
    },
  };
  assert.equal(visible(dead, dead.character, ids['npc/wisp']), false);
  r.move('south', 'east', 'west', 'north', 'west');
  assert.equal(visible(r.world(), r.world().character, ids['npc/wisp']), false);
});

// Break: perception equality is treated as failure, or failed Seek draws RNG/grants discovery.
test('immutable attribute Seek passes at five, fails at four and keeps RNG and time unchanged', () => {
  for (const [per, expected] of [
    [5, 'success'],
    [4, 'failure'],
  ] as const) {
    const w = fresh(),
      r = runner({ ...w, attributes: { ...w.attributes, [key(ref('attribute', 'per'))]: per } });
    r.move('south', 'south', 'south', 'east');
    const before = r.world(),
      d = r.seek();
    assert.equal(d.kind, 'accepted');
    if (d.kind !== 'accepted') continue;
    assert.equal(d.outcome, expected);
    assert.equal(d.events[0].payload.type, per === 5 ? 'check_passed' : 'check_failed');
    assert.deepEqual(r.world().state.rng, before.state.rng);
    assert.equal(r.world().state.clock, before.state.clock);
    assert.equal(
      value(r.world(), r.world().character, ref('fact', 'fen_wisp_discovered')),
      per === 5,
    );
    assert.equal(value(r.world(), r.world().character, ref('fact', 'topic_ward_known')), false);
  }
});

// Break: malformed input consumes a sitting attempt or the third wrong answer terminates the quest.
test('only bank-valid wrong answers count and third closes only the sitting with immediate reset', () => {
  const r = runner();
  r.start();
  const opened = r.view().choice!.continuation_id,
    clock = r.view().time;
  for (const answer of [undefined, 'tttt', 'TÍDE', '']) {
    assert.equal(
      r.raw('choose', {
        choice_id: 'answer',
        continuation_id: opened,
        ...(answer !== undefined && { answer }),
      }).kind,
      'rejected',
    );
    assert.deepEqual(r.view().choice!.riddle!.attempts, { count: 0, limit: 3 });
  }
  for (const answer of ['edit', 'diet', 'tied']) r.choose('answer', answer);
  assert.equal(r.view().choice, undefined);
  assert.equal(r.view().journal.find((q) => q.title === 'quest.wisp_ward.title')!.state, 'active');
  r.talk();
  assert.notEqual(r.view().choice!.continuation_id, opened);
  assert.deepEqual(r.view().choice!.riddle!.attempts, { count: 0, limit: 3 });
  assert.equal(r.view().time, clock);
});

// Break: lighting/departure/death bypass pinned answer policies or Close becomes unavailable.
test('pending answer rechecks effective direct light and bound original participants while Close remains usable', () => {
  const w = fresh(),
    body = bodyOf(w, w.character)!,
    torch = ids['item/torch'];
  const r = runner({
    ...w,
    state: { ...w.state, containers: { ...w.state.containers, [torch]: body } },
  });
  r.start();
  r.ok('ignite', { item_id: torch });
  assert.equal(r.view().choice!.choices[0].available, false);
  assert.equal(
    r.raw('choose', {
      choice_id: 'answer',
      continuation_id: r.view().choice!.continuation_id,
      answer: 'TIDE',
    }).kind,
    'rejected',
  );
  r.ok('close_choice', { continuation_id: r.view().choice!.continuation_id });
  r.ok('douse', { item_id: torch });
  r.talk();
  r.choose('answer', 'edit');
  r.choose('answer', 'diet');
  r.ok('close_choice', { continuation_id: r.view().choice!.continuation_id });
  r.talk();
  assert.deepEqual(r.view().choice!.riddle!.attempts, { count: 0, limit: 3 });
});

// Break: a correct answer grants twice or Aldric's earlier eligible dialogue steals the exact ward selector.
test('correct uppercase answer resolves S4 once, projects one ward and exactly selects public Aldric ward dialogue', () => {
  const r = runner();
  r.start();
  r.choose('answer', 'TIDE');
  assert.equal(r.view().choice, undefined);
  assert.equal(r.view().topics?.length, 1);
  assert.equal(r.view().topics?.[0].label, 'topic.ward');
  assert.equal(value(r.world(), r.world().character, ref('fact', 'fen_wisp_answered')), true);
  r.move('west', 'north', 'north', 'north', 'north', 'north', 'north', 'north', 'north');
  r.ok(
    'talk',
    { target_id: ids['npc/aldric'], dialogue: ref('dialogue', 'c_aldric_ward') },
    'c_aldric_ward',
  );
  assert.equal(r.view().choice!.prompt.key, 'dialogue.aldric.ward');
  r.choose('ward');
  assert.equal(r.view().topics?.length, 1);
});

// Break: knowing the ward beforehand blocks S4 completion or emits a second knowledge grant.
test('an already-known ward still resolves S4 without another topic assignment', () => {
  const w = fresh(),
    fact = ref('fact', 'topic_ward_known');
  const at = key({ kind: 'fact', fact, scope: { kind: 'player', character_id: w.character } });
  const r = runner({ ...w, state: { ...w.state, facts: { ...w.state.facts, [at]: true } } });
  r.start();
  const decision = r.choose('answer', 'TIDE');
  assert.equal(decision.kind, 'accepted');
  if (decision.kind === 'accepted')
    assert.equal(
      decision.delta.ops.filter((o) => o.op === 'fact.assign' && o.fact.key === 'topic_ward_known')
        .length,
      0,
    );
  assert.equal(r.view().journal.find((q) => q.quest.key === 'wisp_ward')!.state, 'resolved');
  assert.equal(r.view().topics?.length, 1);
});

// Break: a forged sitting borrows another live co-located NPC to answer for its original speaker.
test('projected and raw bounded Choose reject a foreign NPC binding without an attempt', () => {
  const a = runner();
  a.start();
  const w = a.world(),
    continuation = a.view().choice!.continuation_id,
    row = w.state.choices![continuation];
  const forged = {
    ...w,
    state: {
      ...w.state,
      containers: { ...w.state.containers, [ids['npc/vesper']]: w.state.containers[w.body] },
      choices: {
        ...w.state.choices,
        [continuation]: {
          ...row,
          roles: [{ role: 'wisp' as never, entity_id: ids['npc/vesper'] }],
        },
      },
    },
  };
  const b = runner(forged);
  assert.equal(b.view().choice!.choices[0].available, false);
  const decision = b.raw('choose', {
    continuation_id: continuation,
    choice_id: 'answer',
    answer: 'TIDE',
  });
  assert.deepEqual(decision, { kind: 'rejected', error: { code: 'invalid_state' } });
  assert.deepEqual(b.world().state.choices![continuation].attempts, { count: 0, limit: 3 });
  assert.equal(value(b.world(), b.world().character, ref('fact', 'topic_ward_known')), false);
});
