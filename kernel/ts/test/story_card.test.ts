// The Quest and Dialogue cards' logic (play/card.ts, E6d): expected answers are hand-checked
// literals from schemas/source and the compiler sources cited at each case.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { added, allowed, awaits, minimal, pickKind } from '../play/card.ts';
import { choiceMenu, nested, refuseChoices, refuseNew, refuseRemove } from '../play/choice.ts';
import { refuseLink } from '../play/link.ts';
import { hiddenSkills, unlinkable } from '../play/story_counts.ts';

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
// transport route (a transport). Kinds from the fields' descriptions in source.QuestDefinition and dialogues.ex:362.
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
  assert.equal(pickKind(['details', 'gate', 'transport', 'route']), 'transport'); // not a room
  assert.equal(pickKind(['exits', 'north', 'to']), 'to'); // only a route's to is a room
});

// Break: the Quest or Dialogue card's add writes a value the compiler refuses (an offer without its
// target: quests.ex:63-66, so it waits in the draft for the target pick), or invents a key
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
        offer: { label: tilde }, // the target is the author's: written with it (awaits)
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
  // the choice tree's adds (Choices.tsx): a new choice, then each field the folded block adds;
  // all compiled into the showcase's bess_talk
  const choice = minimal(defs.DialogueChoice, defs);
  assert.deepEqual(choice, { label: tilde, narration: tilde });
  const policy = { op: 'all', items: [] };
  const fields = { once: true, asked: true, policy, steps: [], availability: {} };
  const take = (f: string) => added(choice, f, defs, 'DialogueChoice')!;
  assert.deepEqual(Object.fromEntries(Object.keys(fields).map((f) => [f, take(f)[f]])), fields);
  const dialogues = new Ajv2020({ strict: false }).compile(served('dialogues'));
  for (const f of Object.keys(fields))
    assert.ok(
      dialogues({ ...dialogue, choices: { a: take(f) } }),
      `${f}: ${JSON.stringify(dialogues.errors)}`,
    );
  assert.ok(awaits('source.QuestDefinition', 'offer'));
  assert.ok(!awaits('source.QuestDefinition', 'journal'));
  const target = { kind: 'npc', npc: 'bess' }; // the pick: compiled into the showcase's carry_letter
  const offered = added(quest, 'offer', defs, 'source.QuestDefinition')!;
  const picked = { ...offered, offer: { ...(offered.offer as object), target } };
  assert.ok(new Ajv2020({ strict: false }).compile(served('quests'))(picked));
});

// Break: the Quest card offers an expedition or patrol the cartridge's capabilities do not declare
// (UNDECLARED_CAPABILITY; owners from expedition.ex:29 and patrol.ex:31) or on a quest the mechanic
// cannot take (OUTCOME_MISMATCH), repeatable without an exchange (exchanges.ex:94-95); or the Dialogue
// card entry on a keyword dialogue (dialogue_links.ex:205-206), a keyword without speech@1 or beside
// an entry or riddle (keywords.ex:15-16), a name or riddle on a dialogue teaching a hidden skill
// (skills.ex:157-158), a quest or riddle on a dialogue a then leaves, or an offer, deadline, exchange
// or repeatable on a patrol or expedition quest (the other way round).
test("a quest's and a dialogue's add menus offer only what the compiler accepts there", () => {
  const menu = ['deadline', 'expedition', 'patrol'];
  const exp = { expedition: 1, movement: 1, quest: 1, fact: 1, combat: 1, death: 1, population: 1 };
  const pat = { patrol: 1, movement: 1, quest: 1, dialogue: 1, fact: 1, death: 1 };
  const by = (evidence: string, more = {}) => ({ objective: { evidence }, ...more });
  assert.deepEqual(allowed('quests', menu, {}, by('expedition')), ['deadline']);
  assert.deepEqual(allowed('quests', menu, exp, by('expedition')), ['deadline', 'expedition']);
  assert.deepEqual(allowed('quests', menu, pat, by('patrol')), ['deadline', 'patrol']);
  const { population: _, ...noPopulation } = exp;
  const { dialogue: __, ...noDialogue } = pat;
  const most = { ...noPopulation, ...noDialogue };
  assert.deepEqual(allowed('quests', menu, most, by('expedition')), ['deadline']);
  // expedition.ex:99-100, patrol.ex:18-19: the evidence names it, and no offer, deadline or other mechanic
  const all = { ...exp, ...pat };
  assert.deepEqual(allowed('quests', menu, all, by('current_state')), ['deadline']);
  assert.deepEqual(allowed('quests', menu, all, by('patrol', { deadline: {} })), ['deadline']);
  assert.deepEqual(
    allowed('quests', ['expedition', 'patrol'], all, by('expedition', { deadline: {} })),
    [],
  );
  // the same lines the other way: a patrol or expedition quest takes none of them
  const runs = ['deadline', 'exchange', 'offer', 'repeatable'];
  assert.deepEqual(allowed('quests', runs, all, by('current_state', { exchange: {} })), runs);
  assert.deepEqual(allowed('quests', runs, all, by('patrol', { patrol: {}, exchange: {} })), []);
  assert.deepEqual(
    allowed('quests', runs, all, by('expedition', { expedition: {}, exchange: {} })),
    [],
  );
  const caps = { quest: 1, dialogue: 1 };
  assert.deepEqual(allowed('quests', ['repeatable'], caps, {}), []);
  assert.deepEqual(allowed('quests', ['repeatable'], caps, { exchange: {} }), ['repeatable']);
  assert.deepEqual(allowed('dialogues', ['entry'], caps, { keyword: 'ash' }), []);
  assert.deepEqual(allowed('dialogues', ['entry'], caps, {}), ['entry']);
  // keywords.ex:15-16: a keyword needs speech@1, and no entry or riddle beside it
  const said = ['keyword', 'riddle'];
  assert.deepEqual(allowed('dialogues', said, caps, {}), ['riddle']);
  assert.deepEqual(allowed('dialogues', said, { ...caps, speech: 1 }, {}), said);
  assert.deepEqual(allowed('dialogues', said, { speech: 1 }, { entry: true }), ['riddle']);
  assert.deepEqual(allowed('dialogues', ['keyword'], { speech: 1 }, { riddle: {} }), []);
  assert.deepEqual(allowed('dialogues', ['riddle'], { speech: 1 }, { keyword: 'ash' }), []);
  // skills.ex:157-158: no name or riddle on a dialogue that teaches a hidden skill
  const named = ['name', 'riddle'];
  const teaching = { choices: { j: { steps: [{ op: 'skill.acquire', skill: 'joinery' }] } } };
  assert.deepEqual(allowed('dialogues', named, caps, teaching, {}, ['joinery']), []);
  assert.deepEqual(allowed('dialogues', named, caps, teaching, {}, ['carving']), named);
  // dialogue_links.ex:394: no quest or riddle on a dialogue a then leaves; `end` is not a link (:402-404)
  const ended = ['quest', 'riddle'];
  const thenTo = (then: Record<string, string>) => ({ choices: { a: {}, b: then } });
  assert.deepEqual(allowed('dialogues', ended, caps, thenTo({ then: 'aldous_yard' })), []);
  assert.deepEqual(allowed('dialogues', ended, caps, thenTo({ then_failed: 'aldous_yard' })), []);
  assert.deepEqual(allowed('dialogues', ended, caps, thenTo({ then: 'end' })), ended);
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
  // dialogue_links.ex:388, 392: no then into a keyword, quest or riddle dialogue
  const into = { wat_letter: 'quest' };
  const more = [...keys, 'wat_letter'];
  assert.equal(
    refuseLink('then', 'wat_letter', {}, plain, more, into),
    'wat_letter has a quest: no then into it',
  );
  assert.equal(refuseLink('then', 'aldous_yard', {}, plain, more, into), undefined);
});

// Break: the story model names a visible skill hidden, misses a hidden one, or misses (or adds) a
// dialogue a then cannot enter; the cards' gates read them (skills.ex hidden/2, dialogue_links.ex:388).
test('the hidden skills and the dialogues no then enters, by key', () => {
  const c = {
    skills: { 'w/skill/joinery': { hidden: true }, 'w/skill/carving': {} },
    dialogues: {
      'w/dialogue/a': { keyword: 'ash' },
      'w/dialogue/b': { quest: 'w/quest/q' },
      'w/dialogue/c': { riddle: {} },
      'w/dialogue/d': {},
    },
  };
  assert.deepEqual(hiddenSkills(c), ['joinery']);
  assert.deepEqual(unlinkable(c), { a: 'keyword', b: 'quest', c: 'riddle' });
});

// Break: the choice tree writes a dialogue the compiler refuses, or refuses one it accepts: each
// pair beside its cite (dialogues.ex, dialogue_links.ex, dialogue_asked.ex, skills.ex), refused one
// way and accepted with either side gone.
test("a dialogue's choices are refused as the compiler refuses them, and only then", () => {
  const one = (c: object, d: object = {}) => refuseChoices({ ...d, choices: { a: c } });
  assert.equal(
    one({ accept: 'q' }, { quest: 'q' }),
    "a: accept would resolve this dialogue's own quest",
  ); // dialogues.ex:367
  assert.equal(one({ accept: 'q' }), undefined);
  assert.equal(one({}, { quest: 'q' }), undefined);
  assert.equal(one({ accept: 'q', hand_over: {} }), 'a: accept and hand_over do not go together'); // :368
  assert.equal(one({ receive: {}, hand_over: {} }), 'a: receive and hand_over do not go together'); // :386
  assert.equal(one({ receive: {} }), undefined);
  assert.equal(one({ hand_over: {} }), undefined);
  assert.equal(one({ then_failed: 'x' }), 'a: then_failed needs a check'); // dialogue_links.ex:45
  assert.equal(one({ then_failed: 'x', check: {} }), undefined);
  assert.equal(one({ patrol: {}, then: 'x' }), 'a: a patrol ends the talk: no then'); // :393
  assert.equal(
    one({ patrol: {}, then_failed: 'x', check: {} }),
    'a: a patrol ends the talk: no then',
  );
  assert.equal(one({ patrol: {}, then: 'end' }), undefined);
  assert.equal(one({ then: 'x' }), undefined);
  const riddle = { riddle: { choice_id: 'a' } };
  assert.equal(one({ asked: true }, riddle), "a: the riddle's answer is never asked"); // dialogue_asked.ex:32
  assert.equal(one({ asked: true }, { riddle: { choice_id: 'b' } }), undefined);
  assert.equal(one({}, riddle), undefined);
  assert.equal(one({ asked: false }, riddle), undefined); // :41 asks only `true`
  const teach = { steps: [{ op: 'skill.acquire', skill: 'joinery' }] };
  assert.equal(
    refuseChoices({ name: 'n', choices: { a: teach } }, ['joinery']),
    'a dialogue with a name teaches no hidden skill',
  ); // skills.ex:157-158
  assert.equal(
    refuseChoices({ riddle: {}, choices: { a: teach } }, ['joinery']),
    'a dialogue with a riddle teaches no hidden skill',
  );
  assert.equal(refuseChoices({ name: 'n', choices: { a: teach } }, ['carving']), undefined);
  assert.equal(refuseChoices({ choices: { a: teach } }, ['joinery']), undefined);
});

// Break: a check, patrol or lesson choice compiles in the card but not in the compiler, or is
// refused where the compiler accepts it: refused one way, accepted with either side gone.
test('a check, patrol or lesson choice is refused beside what the compiler refuses it with', () => {
  const one = (c: object, d: object = {}) => refuseChoices({ ...d, choices: { a: c } });
  const check = { check: {}, label: 'k', steps: [], then: 'x', then_failed: 'y', policy: {} };
  assert.equal(one(check), undefined); // check_kinds.ex:18
  assert.equal(one({ ...check, once: true }), 'a: a check choice carries no once'); // :151-157
  assert.equal(one({ once: true }), undefined);
  assert.equal(one(check, { quest: 'q' }), 'a: a check choice is never in a dialogue with a quest');
  assert.equal(
    one(check, { riddle: {} }),
    'a: a check choice is never in a dialogue with a riddle',
  );
  assert.equal(one({}, { quest: 'q', riddle: {} }), undefined);
  const patrol = { patrol: {}, once: true, policy: {} };
  assert.equal(one(patrol), undefined);
  for (const f of ['escort', 'sequence', 'payment', 'lesson_payment', 'receive', 'hand_over'])
    assert.equal(one({ ...patrol, [f]: {} }), `a: patrol and ${f} do not go together`); // patrol.ex:165-168
  assert.equal(one({ escort: {} }), undefined);
  assert.equal(
    one(patrol, { quest: 'q' }),
    'a: a patrol choice is never in a dialogue with a quest',
  ); // :160
  const pq = (transition: string) => ({ patrol: { quest: 'q', transition }, accept: 'q' });
  assert.equal(one(pq('end')), 'a: only a patrol start accepts'); // :161-163
  assert.equal(one(pq('start')), undefined);
  const end = { choices: { a: { patrol: { transition: 'end' } } } };
  assert.deepEqual(choiceMenu(end, 'a', ['accept', 'once'], { quest: 1 }), ['once']);
  const paid = { lesson_payment: {}, payment: {} };
  assert.equal(one(paid), 'a: lesson_payment and payment do not go together'); // skills.ex:275
  assert.equal(one({ lesson_payment: {} }), undefined);
  assert.equal(one({ payment: {} }), undefined);
});

// Break: an edit to a dialogue already broken is refused for the old break, so the author cannot
// fix it; or an edit that adds a break is let through because another one was there first.
test('only a refusal an edit adds refuses it', () => {
  const broken = { choices: { a: { then_failed: 'x' }, b: { receive: {}, hand_over: {} } } };
  const fixA = { choices: { a: {}, b: broken.choices.b } };
  assert.equal(refuseNew(broken, fixA), undefined);
  assert.equal(refuseNew(broken, { choices: { a: {}, b: { receive: {} } } }), undefined);
  assert.equal(refuseNew(broken, { ...broken, quest: 'q' }), undefined);
  const worse = { choices: { ...broken.choices, c: { patrol: {}, then: 'x' } } };
  assert.equal(refuseNew(broken, worse), 'c: a patrol ends the talk: no then');
  assert.equal(refuseNew({}, broken), 'a: then_failed needs a check');
});

// Break: a choice's add menu offers a field the compiler refuses beside the dialogue's other parts,
// hides one it accepts, re-offers one present, or offers `order` (the compiler's scene mark:
// scene_merge.ex:56-57), or `receive` / `escort` / `check` without the capability that owns them
// (dialogues.ex:383 containment, escort.ex:10 escort, check_kinds.ex:26 check); or the last choice
// or the riddle's answer is removed (dialogues.ex:315, :288).
test('a choice offers only the fields it can take, and keeps the ones the dialogue needs', () => {
  const menu = ['accept', 'hand_over', 'receive', 'then_failed', 'asked', 'once', 'order', 'steps'];
  const doc = { quest: 'q', riddle: { choice_id: 'b' }, choices: { a: { receive: {} }, b: {} } };
  const caps = { containment: 1 };
  assert.deepEqual(choiceMenu(doc, 'a', menu, caps), ['asked', 'once', 'steps']);
  assert.deepEqual(choiceMenu(doc, 'b', menu, caps), ['hand_over', 'receive', 'once', 'steps']);
  assert.deepEqual(choiceMenu(doc, 'b', menu, {}), ['hand_over', 'once', 'steps']);
  assert.deepEqual(choiceMenu({ choices: { a: {} } }, 'a', ['escort', 'once'], {}), ['once']);
  assert.deepEqual(choiceMenu({ choices: { a: {} } }, 'a', ['escort'], { escort: 1 }), ['escort']);
  assert.deepEqual(choiceMenu({ choices: { a: {} } }, 'a', menu, caps), [
    'accept',
    'hand_over',
    'receive',
    'asked',
    'once',
    'steps',
  ]);
  const offer = ['check', 'patrol', 'once', 'payment', 'lesson_payment', 'escort', 'steps'];
  const all = { check: 1, patrol: 1, escort: 1, skills: 1, commerce: 1 };
  const menuOf = (c: object, d: object = {}) =>
    choiceMenu({ ...d, choices: { a: c } }, 'a', offer, all);
  assert.deepEqual(menuOf({ check: {} }), ['steps']); // check_kinds.ex:18
  assert.deepEqual(menuOf({ patrol: {} }), ['once', 'steps']); // patrol.ex:165-168
  assert.deepEqual(menuOf({}, { quest: 'q' }), [
    'once',
    'payment',
    'lesson_payment',
    'escort',
    'steps',
  ]);
  assert.deepEqual(menuOf({ payment: {} }), ['once', 'escort', 'steps']); // skills.ex:275
  assert.deepEqual(menuOf({ lesson_payment: {} }), ['once', 'escort', 'steps']);
  assert.deepEqual(menuOf({}), offer);
  assert.deepEqual(choiceMenu({ choices: { a: {} } }, 'a', ['check'], {}), []); // check_kinds.ex:26
  assert.equal(refuseRemove(doc, 'b'), "the riddle's answer is b");
  assert.equal(refuseRemove(doc, 'a'), undefined);
  assert.equal(refuseRemove({ choices: { a: {} } }, 'a'), 'a dialogue keeps one choice at least');
});

// Break: a dialogue the player can open shows as a nested set, or a nested set loses its prompt,
// a label, the generated key of an unset prompt or label, or where a choice leads (mechanics.md:504).
test('a nested set shows its prompt, labels and links; an entry dialogue is not one', () => {
  const doc = { entry: false, choices: { a: { label: 'k.a', then: 'deeper' }, b: {} } };
  assert.deepEqual(nested(doc, 'lesson'), {
    prompt: 'dialogue.lesson.prompt',
    choices: [
      { label: 'k.a', then: 'deeper' },
      { label: 'dialogue.lesson.choices.b.label', then: undefined },
    ],
  });
  assert.equal(nested({ ...doc, entry: true }, 'lesson'), undefined);
  assert.equal(nested({ prompt: 'p', choices: {} }, 'lesson'), undefined);
  assert.equal(nested(undefined, 'lesson'), undefined);
});
