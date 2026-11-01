// Lawful play that reload must never refuse: custody and fact history reload cannot infer from state
// (dialogue-save.ts keeps row shape, bindings and receipts only). Each test plays real commands
// through real SQLite on literal content and cold-reopens the save.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LABEL,
  SAID,
  TOKEN,
  accept,
  adding,
  flag,
  give,
  holder,
  put,
  survives,
  line,
  quest,
  reopened,
  run,
  take,
  talkTo,
  withToken,
  withWorld,
  type Play,
} from './__tests__/branching-play.ts';
import { compiled } from './__tests__/compiled.ts';
import { coldReopen } from './__tests__/elapsed-host.test.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const roles = {
  guard: { role: 'npc', npc: 'guard' },
  clerk: { role: 'npc', npc: 'clerk' },
  token: { role: 'item', item: 'token' },
};
const held = { op: 'has_item', item: 'token' };
const active = { op: 'quest_state', quest: 'job', state: 'active' };
const open = { op: 'fact_compare', fact: 'gate_open', equals: true };
const not = (item: object) => ({ op: 'not', item });
const all = (...items: object[]) => ({ op: 'all', items });
const deliver = { ...line, hand_over: { item: 'token', to: 'clerk' } };
const offer = {
  ...talkTo({ job: { ...line, accept: 'job' } }),
  policy: all(held, not(active)),
};
const questTalk = (choices: object, policy: object) => ({
  ...talkTo(choices),
  roles,
  quest: 'job',
  policy: all(held, active, policy),
});
const opener = { ...talkTo({ opens: { ...line, steps: [flag(true)] } }), policy: held };

// Two dialogues of one quest: a_q when the gate is open, z_q when it is shut. Only a take that opens
// the gate reaches a_q.
const variants = (takeExtra: object, shut: object = deliver) =>
  withToken(
    {
      guard: take(takeExtra),
      b_offer: offer,
      a_q: questTalk({ deliver }, open),
      z_q: questTalk({ deliver: shut }, not(open)),
    },
    { job: quest },
  );
const toQuest = (g: Play, key: string) => {
  g.choose('take');
  accept(g);
  g.talk(key);
  g.choose('deliver');
};

// Breaks: an answered-outcome check looking only at the dialogue it walks, so delivering through
// either of two policy variants sharing the choice id refuses the save for good.
test('a quest delivered through either policy variant of one choice id reopens', () => {
  reopened(variants({}), (g) => {
    toQuest(g, 'z_q');
    assert.equal(holder(g), g.fresh.entityIds['persuade_sampler@0.0.1:npc/clerk']);
  });
  reopened(variants({ steps: [flag(true)] }), (g) => toQuest(g, 'a_q'));
});

// Breaks: an outcome id taken as proof of the hand-over, when a plain answer shares the id.
test('a plain answer sharing the hand-over id reopens with the item still held', () => {
  reopened(variants({}, line), (g) => {
    toQuest(g, 'z_q');
    assert.equal(holder(g), g.fresh.body);
  });
});

const millFact = {
  mill_known: {
    version: 1,
    value_type: { type: 'bool', default: false },
    scopes: ['player'],
    meaning: 'x',
  },
};
const topicFile = { 'topics/mill.json': { name: LABEL, fact: 'mill_known' } };
const assignMill = { op: 'fact.assign', fact: 'mill_known', value: true };
const millKnown = { op: 'fact_compare', fact: 'mill_known', equals: true };
const takeSetsMill = {
  ...take({ steps: [assignMill] }),
  policy: all(not(held), millKnown),
};
const ask = (steps: object[]) => ({
  ...talkTo({ ask: { ...line, steps } }),
  policy: not(millKnown),
});

// Breaks: a fact read as one-writer because only assign steps are counted, when a topic grant wrote
// it before the take.
test('a topic grant setting the fact before a one-way take reopens', () => {
  const c = withToken(
    { guard: ask([{ op: 'topic.grant', topic: 'mill' }]), z_take: takeSetsMill },
    {},
    adding(topicFile, millFact, { topic: 1 }),
  );
  reopened(c, (g) => g.choose('ask'));
});

// Breaks: the same inference when a book, not a dialogue, grants the topic.
test('a book granting the fact before a one-way take reopens', () => {
  const book = {
    keywords: ['ledger'],
    name: LABEL,
    room_line: LABEL,
    description: LABEL,
    location: { in: 'room', room: 'gate_room' },
    readable: { label: LABEL, text: SAID, topic: 'mill' },
  };
  const c = withToken(
    {
      guard: { ...talkTo({ leave: line }), policy: not(millKnown) },
      z_take: takeSetsMill,
    },
    {},
    adding({ ...topicFile, 'items/ledger.json': book }, millFact, { topic: 1, readable: 1 }),
  );
  reopened(c, (g) => {
    g.choose('leave');
    const ledger = g.fresh.entityIds['persuade_sampler@0.0.1:item/ledger']!;
    g.go('take', {}, [ledger]);
    g.go('read', {}, [ledger]);
  });
});

// Breaks: a fact counted as one-writer by reading dialogues only, when a reaction wrote it.
test('a reaction setting the fact before a one-way take reopens', () => {
  const reaction = { on: { event: 'fact_changed', fact: 'gate_open' }, steps: [assignMill] };
  const c = withToken(
    { guard: ask([flag(true)]), z_take: takeSetsMill },
    {},
    adding({ ...topicFile, 'reactions/grant.json': reaction }, millFact, { reaction: 1, topic: 1 }),
  );
  reopened(c, (g) => g.choose('ask'));
});

// Breaks: a quest outcome taken as proof its hand-over answer ran, when a reaction resolved the quest
// under that outcome and the item never moved.
test('a reaction resolving the quest under the hand-over id reopens', () => {
  const reaction = {
    on: { event: 'fact_changed', fact: 'gate_open' },
    when: active,
    steps: [{ op: 'quest.resolve', quest: 'job', outcome: 'deliver' }],
  };
  const c = withToken(
    {
      guard: take(),
      b_offer: offer,
      z_q: questTalk({ deliver }, not(open)),
      y_tip: {
        ...talkTo({ tip: { ...line, steps: [flag(true)] } }),
        policy: all(active, not(open)),
      },
    },
    { job: quest },
    adding({ 'reactions/settle.json': reaction }, {}, { reaction: 1 }),
  );
  reopened(c, (g) => {
    g.choose('take');
    accept(g);
    g.talk('y_tip');
    g.choose('tip');
    assert.equal(holder(g), g.fresh.body);
  });
});

const npcId = (g: Play, name: string) => g.fresh.entityIds[`persuade_sampler@0.0.1:npc/${name}`]!;
// One blow kills: the world's player attack always hits for 1 and each NPC has 1 hp.
const kill = (g: Play, name: string, clock: { wall: number; mono: number }) => {
  g.go('attack', {}, [npcId(g, name)]);
  pass(g, clock);
};
const pass = (g: Play, clock: { wall: number; mono: number }, seconds = 3) => {
  const from = g.story.world().state.clock;
  clock.wall += seconds;
  clock.mono += seconds * 1000;
  const r = g.story.elapsed({ expected_run_id: g.story.runId(), from, until: from + seconds * 50 });
  assert.equal(r.kind === 'saved' && (r.decision as any).kind, 'accepted', JSON.stringify(r));
};
const onWorld = (c: ReturnType<typeof compiled>, play: (g: Play, clock: any) => void) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-branching-'));
  try {
    const path = join(dir, 'save.db');
    const clock = { wall: 10000, mono: 0 };
    const g = run(path, c, 1, clock);
    play(g, clock);
    g.sql.close();
    coldReopen(path, c);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
const worldQuest = () =>
  withWorld({ guard: take(), b_offer: offer, z_q: questTalk({ deliver }, all()) }, { job: quest });

// Breaks: a delivered item required to sit on its destination, when a reaction moved it on. Taking it
// starts a status on the item; its expiry, after the delivery, is the item.move.
test('a reaction moving the delivered item away reopens', () => {
  const c = withWorld(
    { guard: take(), b_offer: offer, z_q: questTalk({ deliver }, all()) },
    { job: quest },
    adding(
      {
        'statuses/spoiling.json': {
          duration: 3600,
          tick_every: 1800,
          resource: 'hp',
          per_tick: -1,
          name: LABEL,
          narration: { applied: SAID, tick: SAID, expired: SAID },
        },
        'reactions/catch.json': {
          on: { event: 'item_acquired', item: 'token' },
          steps: [{ op: 'status.apply', status: 'spoiling', item: 'token' }],
        },
        'reactions/spoil.json': {
          on: { event: 'status_expired', status: 'spoiling' },
          steps: [{ op: 'item.move', room: 'green' }],
        },
      },
      {},
      { reaction: 1, status: 1 },
    ),
  );
  onWorld(c, (g, clock) => {
    g.talk();
    toQuest(g, 'z_q');
    for (let step = 0; step < 2; step++) pass(g, clock, 36); // the tick at 1800, the end at 3600
    assert.notEqual(holder(g), npcId(g, 'clerk'));
  });
});

// Breaks: an untaken item required to sit on its giver, when the giver died and dropped it.
test('a giver killed before the take reopens', () => {
  onWorld(worldQuest(), (g, clock) => {
    kill(g, 'guard', clock);
    assert.notEqual(holder(g), npcId(g, 'guard'));
  });
});

// Breaks: a delivered item required to sit on its destination, when the destination died.
test('a destination killed after the delivery reopens', () => {
  onWorld(worldQuest(), (g, clock) => {
    g.talk();
    g.choose('take');
    accept(g);
    g.talk('z_q');
    g.choose('deliver');
    kill(g, 'clerk', clock);
    assert.notEqual(holder(g), npcId(g, 'clerk'));
  });
});

// Breaks: a holder chain required to reach a room or NPC, when eating leaves the item consumed.
test('a Give-restricted item taken and eaten reopens', () => {
  onWorld(withWorld({ guard: take(), back: give() }), (g) => {
    g.talk();
    g.choose('take');
    g.go('move', { direction: 'south' });
    g.go('eat', {}, [g.fresh.entityIds[TOKEN]!]);
    assert.equal(holder(g), g.story.world().consumed);
  });
});

// Breaks: a taken item refused as back on an NPC. The compiler keeps a crow from scavenging a
// Give-restricted item (population.ex scavenge_item?), so the holder is written here as a crow's
// theft would leave it; the hold still has to load and keep playing.
test('a taken item later held by another NPC keeps playing', () => {
  survives(
    withToken({ guard: take() }),
    (g) => g.choose('take'),
    (g) => put(g.sql, 'containers', g.fresh.entityIds[TOKEN]!, npcId(g, 'clerk')),
    (g) => g.talk(),
    (g) => assert.equal(holder(g), npcId(g, 'clerk')),
  );
});

// Breaks: receipt evidence refusing a moving answer that writes one fact twice, or writes it by
// assign and by grant, since the two ops read as disagreement.
test('a moving answer writing one fact twice reopens', () => {
  reopened(withToken({ guard: take({ steps: [flag(true), flag(false)] }) }), (g) =>
    g.choose('take'),
  );
  const c = withToken(
    {
      guard: take({
        steps: [
          { op: 'topic.grant', topic: 'mill' },
          { op: 'fact.assign', fact: 'mill_known', value: true },
        ],
      }),
    },
    {},
    adding(topicFile, millFact, { topic: 1 }),
  );
  reopened(c, (g) => g.choose('take'));
});
