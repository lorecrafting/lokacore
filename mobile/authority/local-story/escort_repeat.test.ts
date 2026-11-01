// A repeatable quest's receipts across re-acceptance, played and reopened (loka-vduxr.23).
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
import { homeward, id, setup } from './escort_play.test.ts';

const fresh = genesis();

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

const home = { label: 'dialogue.home.label', narration: 'narration.home' };
// A dialogue of its own beside the turn-in. A plain choice on the turn-in itself can never resolve:
// wares in hand bind roles it refuses, no wares fail the objective.
const ownComplete = (c: any) => {
  const own = c.dialogues[`${prefix}:dialogue/keeper_home`];
  repeating(c);
  c.dialogues[`${prefix}:dialogue/keeper_home`] = {
    ...own,
    policy: { op: 'quest_state', quest: ref('quest', 'homeward'), state: 'active' },
  };
};
const opened = (dir: string, form: string, source: Parameters<typeof setup>[1]) => {
  const path = join(dir, `${form}.db`);
  return {
    first: setup(path, source),
    again: (a: ReturnType<typeof setup>) => (a.sql.close(), setup(path, source)),
  };
};
const accepting = (a: ReturnType<typeof setup>) => {
  if (a.view().choice) a.ok('close_choice');
  a.ok('keeper_offer', [id('npc', 'keeper')]);
  a.choose('accept');
  if (a.view().choice) a.ok('close_choice');
};

const coins = (a: ReturnType<typeof setup>, quests: ReturnType<typeof genesis>) => {
  a.ok('take', [entity(quests, 'item', 'coin_1')]);
  a.ok('take', [entity(quests, 'item', 'coin_2')]);
};

// Breaks: a past Complete's receipt is read against the current quest row, which re-acceptance
// replaced, so the next reopen is save_corrupt for good (dialogue-receipt resolution). Two rounds:
// each leaves a receipt whose quest row a later acceptance retired.
test('a non-exchange Complete beside the exchange dialogue of a repeatable quest reopens after each re-acceptance', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'loka-vduxr.23-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const quests = genesis(ownComplete);
  const { first, again } = opened(dir, 'save', escortBundle(ownComplete));
  let a = first;
  coins(a, quests);
  a.offer();
  a.choose('rescue');
  a.move('south', 'south');
  for (const round of [1, 2]) {
    a.ok('keeper_home', [id('npc', 'keeper')]);
    a.choose('home');
    assert.equal(homeward(a).state, 'resolved', `round ${round}`);
    accepting(a);
    a = again(a);
    a.move('north');
    a = again(a);
    a.move('south');
    a.ok('child_escort', [id('npc', 'child')]);
    a.choose('rescue');
    assert.equal(a.escort().status, 'following');
    a = again(a);
  }
  a.sql.close();
});

// Breaks: skills-save walks a resolved skill choice through the same receipt check, no escort at
// all, and riddle-save compared a resolved sitting's instance with the current quest row.
const lesson = (c: any, extra: object) => {
  repeating(c);
  c.dialogues[`${prefix}:dialogue/keeper_home`] = {
    key: 'keeper_home',
    npc: ref('npc', 'keeper'),
    quest: ref('quest', 'homeward'),
    prompt: 'dialogue.keeper_home.prompt',
    policy: { op: 'quest_state', quest: ref('quest', 'homeward'), state: 'active' },
    roles: { keeper: { role: 'npc', npc: ref('npc', 'keeper') } },
    choices: { home },
    ...extra,
  };
};
const noEscort = {
  skill: (c: any) => {
    c.manifest.requires.capabilities.skill = c.lock.capabilities.skill = 1;
    c.skills = {
      [`${prefix}:skill/mining`]: {
        key: 'mining',
        name: 'npc.child.short',
        requirement: 'npc.child.short',
      },
    };
    c.facts[`${prefix}:fact/skill_mining`] = {
      key: 'skill_mining',
      version: 1,
      scopes: ['player'],
      value_type: { type: 'bool', default: false },
      meaning: 'Mining was learned.',
    };
    lesson(c, {
      choices: {
        home: { ...home, steps: [{ op: 'skill.acquire', skill: ref('skill', 'mining') }] },
      },
    });
  },
  riddle: (c: any) =>
    lesson(c, {
      riddle: {
        choice_id: 'home',
        answer: 'tide',
        bank: ['T', 'I', 'D', 'E'],
        wrong: 'narration.home',
        wrong_limit: 3,
      },
    }),
};
for (const [form, change] of Object.entries(noEscort))
  test(`a ${form} choice on a repeatable quest reopens after re-acceptance, no escort`, (t) => {
    const dir = mkdtempSync(join(tmpdir(), 'loka-vduxr.23-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const quests = genesis(change);
    const { first, again } = opened(dir, 'save', escortBundle(change));
    let a = first;
    coins(a, quests);
    a.offer();
    a.move('south', 'south');
    a.ok('keeper_home', [id('npc', 'keeper')]);
    a.choose('home', form === 'riddle' ? 'tide' : undefined);
    a = again(a);
    accepting(a);
    a = again(a);
    a.move('north');
    a = again(a);
    a.sql.close();
  });
