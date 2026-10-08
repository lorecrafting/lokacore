// Controlled refusals behind e1_dispositions.json `refusal` rows (architecture.md#e1-policy-branch-evidence).
// Each case ends on its guarded talk: the same talk was accepted before the quest existed, and now
// every other admission condition holds and only the named quest-state guard is true.
import assert from 'node:assert/strict';
import type { CaseHost } from './e1_case_host.ts';
import { maudsCellar } from './e1_maud.ts';
import { chandlersDebt } from './e1_optional_quests.ts';

const state = (a: CaseHost, key: string) =>
  Object.values(a.story.world().state.quests ?? {}).find((q) => q.quest.key === key)?.state;

function refuse(a: CaseHost, action: string, npc: string, quest: string, expected: string) {
  const world = a.story.world(),
    target = a.entity('npc', npc);
  assert.equal(state(a, quest), expected);
  assert.equal(world.state.containers[target], world.state.containers[world.body]);
  assert.equal(a.view().combat, undefined);
  assert.equal(a.view().choice, undefined);
  a.invoke(action, [target], {}, 'invalid_state');
  return { refused: action, quest_state: expected };
}

function offer(a: CaseHost, action: string, npc: string, choice: string, quest: string) {
  assert.equal(state(a, quest), undefined);
  a.invoke(action, [a.entity('npc', npc)]);
  a.choose(choice);
}

const maud = (a: CaseHost) => {
  a.invoke('choose_ancestry', [], { ancestry: 'road_born' });
  a.move('north', 'east');
  offer(a, 'maud_offer', 'maud', 'accept', 'mauds_cellar');
};

const peg = (a: CaseHost) => {
  a.invoke('choose_ancestry', [], { ancestry: 'road_born' });
  a.move('north', 'west');
  offer(a, 'a_peg_debt', 'peg', 'accept_on_time', 'chandlers_debt');
};

// a_wisp_offer is all(light_off, fen_wisp_discovered, not(...)): the accepted offer shows the first
// two held, and an unchanged clock and room keep the dark until the refusal.
function wisp(a: CaseHost, resolve: boolean) {
  a.invoke('choose_ancestry', [], { ancestry: 'road_born' });
  a.move('south', 'south', 'south', 'east');
  a.invoke('seek_wisp', [a.detail('marsh_light', 'glow')]);
  const clock = a.story.world().state.clock;
  offer(a, 'a_wisp_offer', 'wisp', 'accept', 'wisp_ward');
  if (resolve) {
    a.invoke('b_wisp_riddle', [a.entity('npc', 'wisp')]);
    a.choose('answer', 'TIDE');
  }
  assert.equal(a.flag('fen_wisp_discovered'), true);
  assert.equal(a.story.world().state.clock, clock);
  return refuse(a, 'a_wisp_offer', 'wisp', 'wisp_ward', resolve ? 'resolved' : 'active');
}

export const REFUSALS: [string, (a: CaseHost) => object][] = [
  [
    'refuse-maud-active',
    (a) => (maud(a), refuse(a, 'maud_offer', 'maud', 'mauds_cellar', 'active')),
  ],
  [
    'refuse-maud-resolved',
    (a) => (maudsCellar(a), refuse(a, 'maud_offer', 'maud', 'mauds_cellar', 'resolved')),
  ],
  ['refuse-wisp-active', (a) => wisp(a, false)],
  ['refuse-wisp-resolved', (a) => wisp(a, true)],
  [
    'refuse-peg-active',
    (a) => (peg(a), refuse(a, 'a_peg_debt', 'peg', 'chandlers_debt', 'active')),
  ],
  [
    'refuse-peg-resolved',
    (a) => {
      chandlersDebt(a);
      a.move('south', 'south', 'south', 'south', 'west');
      return refuse(a, 'a_peg_debt', 'peg', 'chandlers_debt', 'resolved');
    },
  ],
  [
    'refuse-peg-failed',
    (a) => {
      peg(a);
      a.elapsed(3_457_000);
      assert.equal(a.story.world().state.clock, 237650); // debt-elapsed's clock, past the 237601 deadline
      return refuse(a, 'a_peg_debt', 'peg', 'chandlers_debt', 'failed');
    },
  ],
];
