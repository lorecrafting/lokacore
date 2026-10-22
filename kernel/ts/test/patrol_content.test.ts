import assert from 'node:assert/strict';
import { test } from 'node:test';
import { load, prefix, ref, fresh } from './patrol_fixture.ts';

const r = (kind: string, key: string) => ref(fresh, kind, key);
// A reaction that activates `quest` on entering Well Lane (a character-subject trigger, loka-kgd.150.2).
const reaction = (quest: string) => (c: any) => {
  c.manifest.requires.capabilities.reaction = c.lock.capabilities.reaction = 1;
  c.reactions = {
    [`${prefix}:reaction/call`]: {
      key: 'call',
      on: { event: 'entity_entered_room', room: r('room', 'well_lane') },
      apply: [{ op: 'quest.activate', quest: r('quest', quest) }],
    },
  };
};

// Breaks: finite-route validation admits disconnected/repeated or unreachable checkpoint definitions, a competing leader writer or forged trust.
test('loader refuses malformed patrol route, writer ownership and bare quest activation', () => {
  const quest = (c: any) => c.quests[`${prefix}:quest/watch_rounds`].patrol;
  const tobin = (c: any) => c.npcs[`${prefix}:npc/tobin`];
  const mutations: [string, string, (c: any) => void][] = [
    ['bad occurrence cursor', 'OUTCOME_MISMATCH', (c) => (quest(c).initial_cursor = 6)],
    [
      'disconnected edge',
      'OUTCOME_MISMATCH',
      (c) => (quest(c).route[1] = r('room', 'chapel_nave')),
    ],
    [
      'duplicate checkpoint',
      'OUTCOME_MISMATCH',
      (c) => (quest(c).checkpoints[1] = quest(c).checkpoints[0]),
    ],
    ['too much credit required', 'OUTCOME_MISMATCH', (c) => (quest(c).required = 5)],
    [
      'nonplayer trust',
      'OUTCOME_MISMATCH',
      (c) => (c.facts[`${prefix}:fact/watch_gate_trusts_player`].scopes = ['instance']),
    ],
    [
      'mortal leader',
      'OUTCOME_MISMATCH',
      (c) => (tobin(c).hp = { minimum: 0, maximum: 10, start: 10, gain: 0 }),
    ],
    [
      'other location writer',
      'OUTCOME_MISMATCH',
      (c) => (tobin(c).daily_schedule = { '23': r('room', 'watch_post') }),
    ],
    [
      'missing capability',
      'UNDECLARED_CAPABILITY',
      (c) => {
        delete c.manifest.requires.capabilities.patrol;
        delete c.lock.capabilities.patrol;
      },
    ],
    [
      'bare activation',
      'OUTCOME_MISMATCH',
      (c) => delete c.dialogues[`${prefix}:dialogue/tobin_watch`].choices.start.patrol,
    ],
    [
      'ordinary trust write',
      'RESERVED_FACT',
      (c) =>
        (c.dialogues[`${prefix}:dialogue/bram`].choices.take_it.sequence = [
          { op: 'fact.assign', fact: r('fact', 'watch_gate_trusts_player'), value: true },
        ]),
    ],
    ['reaction activation without a patrol', 'OUTCOME_MISMATCH', reaction('watch_rounds')],
    [
      'ordinary dialogue completion without patrol credit',
      'OUTCOME_MISMATCH',
      (c) => (c.dialogues[`${prefix}:dialogue/maud_turn_in`].quest = r('quest', 'watch_rounds')),
    ],
  ];
  for (const [name, code, change] of mutations) {
    const result = load(change);
    assert.equal(result.ok, false, name);
    if (!result.ok) assert.equal(result.diagnostic.code, code, name);
  }
  // Control: the same reaction activating an ordinary quest loads.
  assert.equal(load(reaction('mauds_cellar')).ok, true);
});
