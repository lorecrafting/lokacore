import { reactShim } from './__tests__/react-shim.ts';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import { openGame } from '../../authority/local-story/session.ts';
import { presenter } from './presenter.ts';
import { buttonsOf, group } from './model.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { test } from 'node:test';
import { trainingPin } from '../../authority/local-story/__tests__/training-host.ts';
const require = createRequire(import.meta.url);
const ts = require('typescript');
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'react') return { url: 'test:training-react', shortCircuit: true };
    return specifier === 'react-native'
      ? { url: 'test:training-native', shortCircuit: true }
      : next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'test:training-react')
      return reactShim(
        `({ ref: v => ({ current: v }), state: v => [v, () => {}], effect: () => {} })`,
      );
    if (url === 'test:training-native')
      return {
        format: 'module',
        shortCircuit: true,
        source:
          "export const Pressable='Pressable',Text='Text',TextInput='TextInput',View='View',ScrollView='ScrollView',AccessibilityInfo={};",
      };
    if (!url.endsWith('.tsx')) return next(url, context);
    return {
      format: 'module',
      shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
      }).outputText,
    };
  },
});
const { SkillDetails, ItemDetails, npcSkills } = await import('./skills.tsx');
const { CharacterPage } = await import('./sections.tsx');
const { NpcDetail, NpcPage } = await import('./Npc.tsx');
const { usePalette, useType } = await import('./palette.ts');
function words(element: any): string[] {
  if (Array.isArray(element)) return element.flatMap(words);
  if (!element || typeof element !== 'object') return [];
  if (typeof element.type === 'function') return words(element.type(element.props));
  const flatten = (v: any): string =>
    Array.isArray(v) ? v.map(flatten).join('') : v === undefined || v === null ? '' : String(v);
  return element.type === 'Text'
    ? [flatten(element.props.children)]
    : words(element.props.children);
}
const text = (key: string) =>
  ({
    'skill.swords': 'Sword craft',
    'skill.requirement': 'STR at least 10',
    'item.description': 'A weathered blade.',
  })[key] ?? key;

// Breaks: Character hides real attributes, treats learned-unqualified as usable, or lists unlearned future skills.
test('Character draws projected attributes and acquired qualification with authored labels', () => {
  const view: any = {
    attributes: [{ attribute: { key: 'str' }, value: 9 }],
    skills: [
      {
        skill: { key: 'swords' },
        label: 'skill.swords',
        requirement: 'skill.requirement',
        acquired: true,
        qualified: false,
        usable: false,
      },
      {
        skill: { key: 'dodge' },
        label: 'Unlearned dodge',
        requirement: 'DEX',
        acquired: false,
        qualified: true,
        usable: false,
      },
    ],
  };
  assert.deepEqual(words(CharacterPage({ view, text, world: () => {} })), [
    'Character',
    'STR 9',
    'Sword craft — learned, unqualified. STR at least 10',
    'Back to World',
  ]);
  assert.deepEqual(words(SkillDetails({ view, text })), [
    'STR 9',
    'Sword craft — learned, unqualified. STR at least 10',
  ]);
});

// Breaks (hs-14, book-ui.md "Skill tree details"): a profession box drawn among the acquired lines,
// an unacquired box dropped or read "locked" when not locked, professions out of first-listed
// order, a level shown when not projected, an NPC lesson reading "not learned" while the box is
// locked, or "Nothing is known" drawn above a profession box.
test('Character groups profession boxes under their title, acquired then not learned', () => {
  const box = (key: string, profession: string | undefined, more: object) => ({
    skill: { key },
    label: key,
    requirement: `${key} req`,
    acquired: false,
    qualified: false,
    usable: false,
    ...(profession && { profession }),
    ...more,
  });
  const view: any = {
    skills: [
      box('swords', undefined, { acquired: true, qualified: true, locked: true }), // learned outranks locked
      box('whittling', 'Woodcraft', { acquired: true, qualified: true, level: 2 }),
      box('carving', 'Handcraft', { locked: true }),
      box('joinery', 'Woodcraft', { acquired: true }),
      box('turning', 'Woodcraft', { locked: false }),
      box('weaving', 'Loomcraft', {}),
    ],
  };
  assert.deepEqual(words(CharacterPage({ view, text, world: () => {} })), [
    'Character',
    'swords — learned',
    'Woodcraft',
    'whittling, level 2 — learned',
    'joinery — learned, unqualified. joinery req',
    'turning — not learned. turning req',
    'Handcraft',
    'carving — locked. carving req',
    'Loomcraft',
    'weaving — not learned. weaving req',
    'Back to World',
  ]);
  const locked = { skills: [box('carving', 'Handcraft', { locked: true })] };
  assert.deepEqual(words(CharacterPage({ view: locked, text, world: () => {} } as any)), [
    'Character',
    'Handcraft',
    'carving — locked. carving req',
    'Back to World',
  ]);
  const npc = { name: 'aldous', lessons: view.skills.map((s: any) => s.skill) };
  assert.deepEqual(words(npcSkills(usePalette(), useType(), { view, npc, text } as any)), [
    'swords: learned.',
    'whittling: learned.',
    'carving: locked. carving req',
    'joinery: learned, unqualified. joinery req',
    'Aldous teaches turning. turning req',
    'Aldous teaches weaving. weaving req',
  ]);
});

// Breaks: the displayed name missing, capitalised, labelled or not first, or the empty placeholder
// shown beside it (book-ui.md "Displayed name details"; rows W15, FD9).
test('Character opens with the authored displayed name when GameView carries one', () => {
  const say = (key: string) => (key === 'identity.name' ? 'a hooded figure' : key);
  assert.deepEqual(
    words(
      CharacterPage({ view: { actor_name: 'identity.name' } as any, text: say, world: () => {} }),
    ),
    ['Character', 'a hooded figure', 'Back to World'],
  );
  assert.deepEqual(words(CharacterPage({ view: {} as any, text: say, world: () => {} })), [
    'Character',
    'Nothing is known about you yet.',
    'Back to World',
  ]);
});

// Breaks: the Character line hides what worn items grant, or drops the sign of a loss (book-ui.md worn item affects).
test('Character appends the signed worn affect to an attribute line', () => {
  const view: any = {
    attributes: [
      { attribute: { key: 'per' }, value: 14, worn: 4 },
      { attribute: { key: 'str' }, value: 8, worn: -2 },
      { attribute: { key: 'con' }, value: 10 },
    ],
  };
  assert.deepEqual(words(SkillDetails({ view, text })), [
    'PER 14 (+4 worn)',
    'STR 8 (-2 worn)',
    'CON 10',
  ]);
});

// Breaks (pass-1 UI, book-ui.md World and status entry): a count drawn as a meter ("pennies 10 /
// 100"), or a pool (hp, ma, mv) losing its maximum or hp its band phrase.
test('Character draws a count bare and a pool as current / maximum', () => {
  const pool = (key: string, current: number, maximum: number) => ({
    resource: { key },
    current,
    maximum,
    band: 'ready',
    tone: 'normal',
  });
  const view: any = {
    resources: [pool('hp', 10, 10), pool('mv', 3, 9), pool('pennies', 10, 100), pool('ash', 0, 5)],
  };
  assert.deepEqual(words(CharacterPage({ view, text, world: () => {} })), [
    'Character',
    'hp  10 / 10, ready',
    'mv  3 / 9',
    'pennies  10',
    'ash  0',
    'Back to World',
  ]);
});

// Breaks: the level line drops the points or their plural, the xp line loses "/ next" or prints
// one at the top level, Raise is not one card per attribute (with that attribute as input) last on
// the page, shows while not offered, or leaks onto the room page as a place action.
test('Character shows the level, xp and one Raise card per attribute only while offered', () => {
  const str = { cartridge_id: 'c', cartridge_version: '0.0.1', kind: 'attribute', key: 'str' };
  const raise = { action_key: 'raise_attribute', available: true, input: ['attribute'] };
  const page = (levelling: object, actions: object[]) => {
    const view: any = {
      exits: [],
      entities: [],
      inventory: [],
      actions,
      levelling,
      attributes: [
        { attribute: str, value: 10 },
        { attribute: { ...str, key: 'con' }, value: 11 },
      ],
    };
    const buttons = buttonsOf(view, (k) => k, text) as never[];
    return { buttons, words: words(CharacterPage({ view, text, world: () => {}, buttons })) };
  };
  const spend = page({ level: 2, experience: 30, next: 100, unspent: 1 }, [raise]);
  assert.deepEqual(spend.words, [
    'Character',
    'Level 2, 1 point to spend',
    'STR 10',
    'CON 11',
    'xp  30 / 100',
    'Raise STR',
    'Raise CON',
    'Back to World',
  ]);
  assert.deepEqual((spend.buttons[0] as any).input, { attribute: str });
  assert.deepEqual(group(spend.buttons).place, []);
  const two = page({ level: 3, experience: 100, next: 200, unspent: 2 }, [raise]);
  assert.equal(two.words[1], 'Level 3, 2 points to spend');
  const top = page({ level: 3, experience: 120, unspent: 0 }, []);
  assert.deepEqual(top.words, [
    'Character',
    'Level 3',
    'STR 10',
    'CON 11',
    'xp  120',
    'Back to World',
  ]);
});

// Breaks: item detail invents a profile from its name, drops skill requirements, or hides actual shield chance,
// or prints a fixed damage as a range, 2–2 (loka-x6t.29).
test('item equipment detail copies current typed slot/profile/requirement and block chance', () => {
  const thing: any = {
    description: 'item.description',
    slot: 'wield',
    weapon: { skill: { key: 'swords' }, attack: { chance: 82, damage_min: 7, damage_max: 9 } },
    skill_label: 'skill.swords',
    skill_requirement: 'skill.requirement',
  };
  assert.deepEqual(words(ItemDetails({ thing, text })), [
    'A weathered blade.',
    'Slot: wield',
    'Attack: 82% chance, 7–9 damage; requires Sword craft. STR at least 10',
  ]);
  assert.deepEqual(
    words(ItemDetails({ thing: { slot: 'off_hand', block_chance: 37 } as any, text })),
    ['Slot: off_hand', 'Block: 37% chance.'],
  );
  const fixed = {
    ...thing,
    weapon: { ...thing.weapon, attack: { chance: 82, damage_min: 2, damage_max: 2 } },
  };
  assert.equal(
    words(ItemDetails({ thing: fixed, text }))[2],
    'Attack: 82% chance, 2 damage; requires Sword craft. STR at least 10',
  );
});

function nodes(element: any): any[] {
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!element || typeof element !== 'object') return [];
  return typeof element.type === 'function'
    ? nodes(element.type(element.props))
    : [element, ...nodes(element.props?.children)];
}
// Breaks: the teach card for a learned skill drops, or keeps a price card (book-ui.md Skill tree
// details, H3): a choice the kernel advertises unavailable draws as one `label: reason` note.
test('an unavailable teach choice draws as label: reason with no price card', () => {
  const view = {
    entities: [],
    choice: {
      speaker_id: 'tobin',
      continuation_id: 'c',
      choices: [
        {
          choice_id: 'learn',
          label: 'Learn swords — 2 pennies',
          available: false,
          reason: { code: 'unavailable', message: { key: 'You already know swords.' } },
        },
      ],
    },
  } as never;
  const page = NpcPage({
    view,
    text: (k) => k,
    g: group([]),
    press() {},
    log: [],
    leave() {},
    open() {},
  });
  const lines = words(page).filter((w) => w.includes('swords'));
  assert.deepEqual(lines, ['Learn swords — 2 pennies: You already know swords.']);
});

// Breaks: teacher controls route outside their NPC detail, replay duplicates success, or cold
// reopen loses the next lesson/confirmed line. The controlled training sampler gets distinct
// words per lesson so each line is countable.
test('Book interaction teaches swords then dodge in the teacher detail and recovers each committed result once', (t) => {
  const { pin, teacher } = trainingPin((c) => {
    const at = (kind: string, key: string) =>
      `${c.manifest.id}@${c.manifest.version}:${kind}/${key}`;
    for (const skill of ['swords', 'dodge']) {
      const choice = c.dialogues[at('dialogue', `learn_${skill}`)].choices.learn;
      choice.label = `learn.${skill}`;
      choice.narration = `learned.${skill}`;
      c.skills[at('skill', skill)].name = `skill.${skill}`;
      c.text[`learn.${skill}`] = `Learn ${skill}`;
      c.text[`learned.${skill}`] = `The teacher teaches you ${skill}.`;
      c.text[`skill.${skill}`] = skill === 'swords' ? 'Swords' : 'Dodge';
    }
  });
  const a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, pin);
  t.after(() => a.sql.close());
  let book = presenter(a.game);
  const draw = () => {
    const screen = book.screen();
    return NpcDetail({
      screen,
      g: group(screen.buttons),
      press: book.press,
      speaker: teacher,
      world() {},
    });
  };
  const tap = (label: string) => {
    const button = nodes(draw()).find(
      (n) => n.type === 'Pressable' && n.props.accessibilityLabel === label,
    );
    assert.ok(button, label);
    button.props.onPress();
  };
  const reopen = () => {
    book = presenter(openGame(a.db, pin, a.host));
  };
  const swords = 'The teacher teaches you swords.';
  const dodge = 'The teacher teaches you dodge.';
  const talk = book.screen().buttons.find((b) => b.action_key === 'learn_swords');
  assert.ok(talk);
  tap(talk.label);
  assert.ok(words(draw()).includes('Learn swords'));
  tap('Learn swords');
  assert.equal(words(draw()).filter((line) => line === swords).length, 1);
  reopen();
  assert.equal(words(draw()).filter((line) => line === swords).length, 1);
  const next = book.screen().buttons.find((b) => b.action_key === 'learn_dodge');
  assert.ok(next);
  tap(next.label);
  tap('Learn dodge');
  assert.equal(words(draw()).filter((line) => line === dodge).length, 1);
  reopen();
  assert.equal(words(draw()).filter((line) => line === dodge).length, 1);
  const sheet = words(
    CharacterPage({ view: book.screen().view, text: book.screen().text, world: () => {} }),
  );
  assert.ok(sheet.includes('Swords — learned') && sheet.includes('Dodge — learned'), String(sheet));
});

// Breaks: moving to the shared item detail component silently drops confirmed fuel or invents ignition.
test('shared item detail draws confirmed fuel for lit and exhausted items', () => {
  assert.deepEqual(
    words(ItemDetails({ thing: { fuel: { remaining: 7, capacity: 10, lit: true } } as any, text })),
    ['Nearly full of fuel, lit.'],
  );
  assert.deepEqual(
    words(
      ItemDetails({ thing: { fuel: { remaining: 0, capacity: 10, lit: false } } as any, text }),
    ),
    ['Empty, unlit.'],
  );
});
