// The Quest and Dialogue cards' logic (play/card.ts, E6d): expected answers are hand-checked
// literals from schemas/source and the compiler sources cited at each case.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { added, allowed, pickKind } from '../play/card.ts';
import { refuseLink } from '../play/link.ts';

const SOURCE = join(import.meta.dirname, '../../../schemas/source');
const read = (f: string) => JSON.parse(readFileSync(join(SOURCE, f), 'utf8'));
const defs = read('defs.schema.json').$defs;
// as write.ts's GET /schema/<dir> serves it
const served = (dir: string) => {
  const stub = read(`${dir}.schema.json`);
  return { ...stub, $ref: stub.$ref.replace(/^defs\.schema\.json/, ''), $defs: defs };
};

// Break: a quest's or dialogue's reference field is free text (or the wrong kind's picker): a
// choice's accept, an expedition's rooms, a patrol's route; or `patrol.route` leaks to a detail's
// transport route. Kinds from the fields' descriptions in source.QuestDefinition and dialogues.ex:362.
test("a quest's and a dialogue's reference fields pick their kind", () => {
  assert.equal(pickKind(['choices', 'bounty', 'accept']), 'quest');
  assert.equal(pickKind(['expedition', 'route', '1', 'from']), 'room');
  assert.equal(pickKind(['expedition', 'route', 0, 'to']), 'room');
  assert.equal(pickKind(['expedition', 'start_room']), 'room');
  assert.equal(pickKind(['expedition', 'footprint', '0']), 'room');
  assert.equal(pickKind(['patrol', 'route', '2']), 'room');
  assert.equal(pickKind(['patrol', 'checkpoints', 0]), 'room');
  assert.equal(pickKind(['patrol', 'trust_fact']), 'fact');
  assert.equal(pickKind(['exchange', 'incoming', '0']), 'item');
  assert.equal(pickKind(['objective', 'item_acquired']), 'item');
  assert.equal(pickKind(['details', 'gate', 'transport', 'route']), 'route'); // not a room
  assert.equal(pickKind(['exits', 'north', 'to']), 'to'); // only a route's to is a room
});

// Break: the Quest or Dialogue card's add writes a value the compiler refuses (an offer without its
// target: quests.ex:63-66), or invents a key
// the author picks. Each written value was compiled into the showcase (mix loka.compile, no diagnostic).
test("a quest's and a dialogue's added fields are the least valid ones, their words `~`", () => {
  const tilde = { prose: '~' };
  const quest = { name: 'quest.a.name', objective: { evidence: 'current_state' } };
  const dialogue = { npc: 'ada', prompt: 'dialogue.a.prompt', roles: {}, choices: {} };
  const cases: [Record<string, unknown>, string, string, Record<string, unknown>][] = [
    [
      quest,
      'quests',
      'source.QuestDefinition',
      {
        deadline: undefined, // exactly one of after or at: the author's
        exchange: undefined,
        expedition: undefined,
        journal: {
          active: tilde,
          objectives_met: tilde,
          resolved: tilde,
          failed: tilde,
          abandoned: tilde,
        },
        offer: undefined,
        patrol: undefined,
        repeatable: true, // offered only with an exchange (allowed)
      },
    ],
    [
      dialogue,
      'dialogues',
      'source.DialogueDefinition',
      {
        entry: true,
        keyword: undefined,
        name: tilde,
        policy: { op: 'all', items: [] },
        quest: undefined,
        riddle: undefined,
      },
    ],
  ];
  for (const [doc, dir, def, want] of cases) {
    const got = Object.fromEntries(
      Object.keys(want).map((f) => [f, added(doc, f, defs, def)?.[f]]),
    );
    assert.deepEqual(got, want);
    const validate = new Ajv2020({ strict: false }).compile(served(dir));
    for (const f of Object.keys(want)) {
      const next = added(doc, f, defs, def);
      if (next) assert.ok(validate(next), `${f}: ${JSON.stringify(validate.errors)}`);
    }
  }
});

// Break: the Quest card offers an expedition or patrol the cartridge's capabilities do not declare
// (UNDECLARED_CAPABILITY; owners from expedition.ex:29 and patrol.ex:31), repeatable without an
// exchange (exchanges.ex:94-95), or the Dialogue card entry on a keyword dialogue (dialogue_links.ex:205-206).
test("a quest's add menu offers an expedition or a patrol only with every owning capability", () => {
  const menu = ['deadline', 'expedition', 'patrol'];
  const exp = { expedition: 1, movement: 1, quest: 1, fact: 1, combat: 1, death: 1, population: 1 };
  const pat = { patrol: 1, movement: 1, quest: 1, dialogue: 1, fact: 1, death: 1 };
  assert.deepEqual(allowed('quests', menu, {}), ['deadline']);
  assert.deepEqual(allowed('quests', menu, exp), ['deadline', 'expedition']);
  assert.deepEqual(allowed('quests', menu, pat), ['deadline', 'patrol']);
  const { population: _, ...noPopulation } = exp;
  const { dialogue: __, ...noDialogue } = pat;
  assert.deepEqual(allowed('quests', menu, { ...noPopulation, ...noDialogue }), ['deadline']);
  const caps = { quest: 1, dialogue: 1 };
  assert.deepEqual(allowed('quests', ['repeatable'], caps, {}), []);
  assert.deepEqual(allowed('quests', ['repeatable'], caps, { exchange: {} }), ['repeatable']);
  assert.deepEqual(allowed('dialogues', ['entry'], caps, { keyword: 'ash' }), []);
  assert.deepEqual(allowed('dialogues', ['entry'], caps, {}), ['entry']);
});

// Break: the link picker writes a `then` the compiler refuses (dialogue_links.ex): an unknown
// dialogue (UNRESOLVED_REFERENCE), a then_failed with no check (:45-46), a then out of a patrol
// choice or a quest or riddle dialogue (unlinkable, :368-379); or refuses `end` or a clear.
test("a choice's then names a known dialogue or end, as the compiler links it", () => {
  const keys = ['aldous_talk', 'aldous_yard'];
  const plain = {};
  assert.equal(refuseLink('then', 'aldous_yard', {}, plain, keys), undefined);
  assert.equal(refuseLink('then', 'end', {}, plain, keys), undefined);
  assert.equal(refuseLink('then', '', {}, plain, keys), undefined); // cleared: removed
  assert.equal(refuseLink('then', 'aldous_lesson', {}, plain, keys), 'no dialogue aldous_lesson');
  assert.equal(refuseLink('then', 'any', {}, plain, []), undefined); // no keys known: free text
  assert.equal(refuseLink('then_failed', 'end', {}, plain, keys), 'then_failed needs a check');
  assert.equal(refuseLink('then_failed', 'end', { check: {} }, plain, keys), undefined);
  const out = 'aldous_yard';
  assert.equal(
    refuseLink('then', out, { patrol: {} }, plain, keys),
    'a patrol ends the talk: no then',
  );
  assert.equal(
    refuseLink('then', out, {}, { quest: 'bounty' }, keys),
    'a quest ends the talk: no then',
  );
  assert.equal(
    refuseLink('then', out, {}, { riddle: {} }, keys),
    'a riddle ends the talk: no then',
  );
  assert.equal(refuseLink('then', 'end', {}, plain, ['end']), 'a dialogue named end shadows end');
});
