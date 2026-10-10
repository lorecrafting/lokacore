import { pathToFileURL } from 'node:url';
import { elapsedHost } from '../../authority/local-story/__tests__/elapsed-host.test.ts';
import { openGame } from '../../authority/local-story/session.ts';
import { presenter } from './presenter.ts';
import { group } from './model.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { test } from 'node:test';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const react = pathToFileURL(require.resolve('react')).href;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'react') return { url: 'test:training-react', shortCircuit: true };
    return specifier === 'react-native'
      ? { url: 'test:training-native', shortCircuit: true }
      : next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'test:training-react')
      return {
        format: 'module',
        shortCircuit: true,
        source: `export * from ${JSON.stringify(react)}; export const useContext = c => c._currentValue; export const useRef=v=>({current:v});`,
      };
    if (url === 'test:training-native')
      return {
        format: 'module',
        shortCircuit: true,
        source:
          "export const Pressable='Pressable',Text='Text',View='View',ScrollView='ScrollView',AccessibilityInfo={};",
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
const { SkillDetails, ItemDetails } = await import('./skills.tsx');
const { CharacterPage } = await import('./sections.tsx');
const { NpcDetail } = await import('./Menu.tsx');
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
    'Sword craft — unqualified; STR at least 10',
    'Back to World',
  ]);
  assert.deepEqual(words(SkillDetails({ view, text })), [
    'STR 9',
    'Sword craft — unqualified; STR at least 10',
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

// Breaks: item detail invents a profile from its name, drops skill requirements, or hides actual shield chance.
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
    'Attack: 82% chance, 7–9 damage; requires Sword craft (STR at least 10).',
  ]);
  assert.deepEqual(
    words(ItemDetails({ thing: { slot: 'off_hand', block_chance: 37 } as any, text })),
    ['Slot: off_hand', 'Block: 37% chance.'],
  );
});

function nodes(element: any): any[] {
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (!element || typeof element !== 'object') return [];
  return typeof element.type === 'function'
    ? nodes(element.type(element.props))
    : [element, ...nodes(element.props?.children)];
}
// Breaks: Tobin controls route outside their NPC detail, replay duplicates success, or cold reopen loses the next lesson/confirmed line.
test('Book interaction teaches swords then dodge in Tobin detail and recovers each committed result once', (t) => {
  const pin = JSON.parse(
    readFileSync(
      new URL('../../../protocol/fixtures/missing_child_v021_hash.json', import.meta.url),
      'utf8',
    ),
  );
  const ids = JSON.parse(
    readFileSync(
      new URL('../../../protocol/fixtures/missing_child_v021_ids.json', import.meta.url),
      'utf8',
    ),
  );
  const a = elapsedHost(':memory:', { wall: 10000, mono: 0 }, pin);
  t.after(() => a.sql.close());
  let book = presenter(a.game);
  for (const direction of ['north', 'north', 'north']) {
    const button = book
      .screen()
      .buttons.find((b) => b.action_key === 'move' && b.input.direction === direction);
    assert.ok(button);
    book.press(button);
  }
  const tobin = ids['npc/tobin'];
  const draw = () => {
    const screen = book.screen();
    return NpcDetail({
      screen,
      g: group(screen.buttons),
      press: book.press,
      speaker: tobin,
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
  const swords = 'Tobin accepts two pennies and teaches you swords. He gives you his rusty sword.';
  const dodge = 'Tobin accepts two pennies and teaches you dodge.';
  const talk = book.screen().buttons.find((b) => b.action_key === 'tobin_swords');
  assert.ok(talk);
  tap(talk.label);
  assert.ok(words(draw()).includes('Learn swords — 2 pennies'));
  tap('Learn swords — 2 pennies');
  assert.equal(words(draw()).filter((line) => line === swords).length, 1);
  reopen();
  assert.equal(words(draw()).filter((line) => line === swords).length, 1);
  assert.ok(book.screen().buttons.some((b) => b.action_key === 'tobin_dodge'));
  const next = book.screen().buttons.find((b) => b.action_key === 'tobin_dodge')!;
  tap(next.label);
  tap('Learn dodge — 2 pennies');
  assert.equal(words(draw()).filter((line) => line === dodge).length, 1);
  reopen();
  assert.equal(words(draw()).filter((line) => line === dodge).length, 1);
  assert.ok(
    !book
      .screen()
      .buttons.some((b) => b.action_key === 'tobin_swords' || b.action_key === 'tobin_dodge'),
  );
  assert.ok(
    words(
      CharacterPage({ view: book.screen().view, text: book.screen().text, world: () => {} }),
    ).includes('Swords — qualified; STR at least 10'),
  );
  assert.ok(
    words(
      CharacterPage({ view: book.screen().view, text: book.screen().text, world: () => {} }),
    ).includes('Dodge — qualified; DEX at least 10'),
  );
});
// Breaks: moving to the shared item detail component silently drops confirmed fuel or invents ignition.
test('shared item detail draws confirmed fuel for lit and exhausted items', () => {
  assert.deepEqual(
    words(ItemDetails({ thing: { fuel: { remaining: 7, capacity: 10, lit: true } } as any, text })),
    ['Fuel 7 of 10, lit'],
  );
  assert.deepEqual(
    words(
      ItemDetails({ thing: { fuel: { remaining: 0, capacity: 10, lit: false } } as any, text }),
    ),
    ['Fuel 0 of 10, unlit'],
  );
});
