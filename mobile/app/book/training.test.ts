import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { test } from 'node:test';
const ts = createRequire(import.meta.url)('typescript');
registerHooks({
  resolve(specifier, context, next) {
    return specifier === 'react-native'
      ? { url: 'test:training-native', shortCircuit: true }
      : next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'test:training-native')
      return {
        format: 'module',
        shortCircuit: true,
        source:
          "export const Pressable='Pressable',Text='Text',View='View',ScrollView='ScrollView';",
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
const { CharacterPage } = await import('./pages.tsx');
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
  assert.deepEqual(words(CharacterPage({ view, text })), [
    'Character',
    'STR 9',
    'Sword craft — unqualified; STR at least 10',
  ]);
  assert.deepEqual(words(SkillDetails({ view, text })), [
    'STR 9',
    'Sword craft — unqualified; STR at least 10',
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
