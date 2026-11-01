// C row Pages, Sections (design-input-batch-4-2026-10-09.md 1); routes: stories/routes.ts.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, fn, userEvent, waitFor, type Mock } from 'storybook/test';
import { ContentsPage } from '../book/Menu.tsx';
import { Professions, RaiseCards, SkillDetails, SkillsPage } from '../book/skills.tsx';
import { AncestryPage, CarryingPage, CharacterPage, SettingsPage } from '../book/sections.tsx';
import { CreditsPage } from '../book/CreditsPage.tsx';
import { JournalPage } from '../book/journal.tsx';
import { pageStory } from './screen.tsx';
import JournalView from './views/journal.json';
import CarryingEmptyView from './views/carrying-empty.json';
import CarryingHeldView from './views/carrying-held.json';
import CharacterUnknownView from './views/character-unknown.json';
import CharacterFullView from './views/character-full.json';
import ContentsView from './views/contents.json';
import SettingsView from './views/settings.json';

const meta: Meta = {
  tags: ['!autodocs'],
  title: 'Pages/Sections',
  component: JournalPage,
  subcomponents: {
    CarryingPage,
    CharacterPage,
    SkillDetails,
    SkillsPage,
    Professions,
    RaiseCards,
    ContentsPage,
    SettingsPage,
    CreditsPage,
  },
};
export default meta;

export const Journal: StoryObj = { ...pageStory(JournalView), name: 'Journal' };
export const CarryingEmpty: StoryObj = { ...pageStory(CarryingEmptyView), name: 'Carrying empty' };
export const CarryingHeld: StoryObj = { ...pageStory(CarryingHeldView), name: 'Carrying held' };
export const CharacterUnknown: StoryObj = {
  ...pageStory(CharacterUnknownView),
  name: 'Character unknown',
};
export const CharacterFull: StoryObj = { ...pageStory(CharacterFullView), name: 'Character full' };
// Chapter 1 authors no levelling, so the generated Character view gets the levelling sampler's
// level-2 projection (kernel/ts/test/levelling.test.ts) and its one raise_attribute offer.
const raise = { action_key: 'raise_attribute', label: 'action.raise_attribute', available: true };
export const CharacterPointsToSpend: StoryObj = {
  ...pageStory({
    ...CharacterFullView,
    view: {
      ...CharacterFullView.view,
      levelling: { level: 2, experience: 30, from: 30, next: 100, unspent: 1 },
      actions: [
        ...CharacterFullView.view.actions,
        { ...raise, target: { kind: 'none' }, input: ['attribute'] },
      ],
    },
  }),
  name: 'Character with points to spend',
};
// The same real view, one page along: Skills draws what Character no longer does.
const SkillsFullView = { ...CharacterFullView, stack: [{ kind: 'contents' }, { kind: 'skills' }] };
export const Skills: StoryObj = { ...pageStory(SkillsFullView), name: 'Skills' };
// A view with no skill and no spell word. Breaks: a blank page, or the Note beside real rows.
export const SkillsEmpty: StoryObj = {
  ...pageStory({
    ...SkillsFullView,
    view: { ...SkillsFullView.view, skills: [] },
  }),
  name: 'Skills, nothing known',
};
// An aimed spell (loka-x6t.109.5): the Spells block draws a Cast on… list of its targets, never a
// Spells-section line. Breaks: the list is missing, or the spell shows as `lux, cast: …`.
const sword = SkillsFullView.view.inventory[0]!;
const lux = {
  action_key: 'lux',
  command: 'cast',
  label: 'spell.lux',
  target: { kind: 'entity', scopes: ['inventory'] },
  target_ids: [sword.id],
  available: true,
};
export const SkillsAimedSpell: StoryObj = {
  ...pageStory({
    ...SkillsFullView,
    view: {
      ...SkillsFullView.view,
      inventory: [{ ...sword, actions: [...sword.actions, lux] }],
    },
  }),
  name: 'Skills with an aimed spell',
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Lux, cast on…' }));
    await expect(
      canvas.getByRole('button', { name: /^A training sword, cast lux on/i }),
    ).toBeVisible();
    await expect(canvas.queryByText(/, cast:/)).toBeNull();
  },
};
// Spell words cast from Spells (book-ui.md, Word bar; loka-evzt): a castable word is a card, a
// refused one its unavailable line. Breaks: no card, or the refused word reads as castable.
export const SkillsSpells: StoryObj = {
  ...pageStory({
    ...SkillsFullView,
    view: {
      ...SkillsFullView.view,
      spell_words: [
        { word: 'lux', available: true },
        { word: 'ward', available: false, reason: { code: 'invalid_state' } },
      ],
    },
  }),
  name: 'Skills with spell words',
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'lux, cast' })).not.toHaveAttribute(
      'aria-disabled',
    );
    await expect(canvas.getByRole('button', { name: 'ward, cast' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  },
};
export const Contents: StoryObj = { ...pageStory(ContentsView), name: 'Contents' };
// Each entry opens its own section, even pressed at the foot of its shown line (loka-462d).
// Breaks: the next entry's hit area covers this one's line, or an entry opens another section.
export const ContentsEntries: StoryObj<{ open: Mock; world: Mock }> = {
  name: 'Contents, each entry its own',
  args: { open: fn(), world: fn() },
  render: (args) => <ContentsPage {...(args as Parameters<typeof ContentsPage>[0])} />,
  play: async ({ canvas, args }) => {
    for (const button of await canvas.findAllByRole('button', { name: /, open$/ })) {
      const { left, bottom } = button.firstElementChild!.getBoundingClientRect();
      await userEvent.click(document.elementFromPoint(left + 4, bottom - 2)!);
    }
    await expect(args.open.mock.calls).toEqual(
      ['character', 'skills', 'carrying', 'map', 'journal', 'settings'].map((k) => [k]),
    );
  },
};
// Opened from Contents: no status line, and the foot goes Back to Contents (loka-8lpm).
export const Settings: StoryObj = {
  ...pageStory(SettingsView),
  name: 'Settings',
  play: async ({ canvas }) => {
    await expect(await canvas.findByLabelText('Back to Contents')).toBeVisible();
    await expect(canvas.queryByLabelText(/opens Contents$/)).toBeNull();
  },
};
// Toolbox row 46: the codex sampler's lore (kernel/ts/test/codex.test.ts) on the Journal page, its
// words given here because Chapter 1 authors no deduction. Away from the study the card is refused.
const lore = {
  topics: [
    { topic: { kind: 'topic', key: 'mill' }, label: 'topic.mill' },
    { topic: { kind: 'topic', key: 'missing_cart' }, label: 'topic.missing_cart' },
  ],
  deductions: [
    {
      action: 'deduce_smugglers',
      label: 'actions.deduce_smugglers',
      from: ['topic.mill', 'topic.missing_cart'],
    },
  ],
};
const loreWords = {
  'topic.mill': 'The mill',
  'topic.missing_cart': 'The missing cart',
  'actions.deduce_smugglers': 'Think it through',
};
const deduce = {
  action_key: 'deduce_smugglers',
  label: 'actions.deduce_smugglers',
  available: true,
  target: { kind: 'none' },
  input: [],
};
const loreStory = (
  actions: object[],
  name: string,
  journal = JournalView.view.journal,
): StoryObj => {
  const story = pageStory({
    ...JournalView,
    view: { ...JournalView.view, ...lore, actions, journal },
  });
  return { ...story, args: { words: loreWords }, name };
};
export const JournalLore: StoryObj = {
  ...loreStory([...JournalView.view.actions, deduce], 'Journal lore with a deduction here'),
  play: async ({ canvas }) => {
    await canvas.findByText('Lore');
    await canvas.findByText('The mill + The missing cart');
    await canvas.findByRole('button', { name: 'Think it through' });
  },
};
export const JournalLoreAway: StoryObj = {
  ...loreStory(JournalView.view.actions, 'Journal lore, deduction elsewhere'),
  play: async ({ canvas, userEvent }) => {
    const card = await canvas.findByRole('button', { name: 'Think it through' });
    await expect(card).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(card);
    await waitFor(() => expect(card).toHaveTextContent("Think it through You can't do that here."));
  },
};
// No quests yet, and the deduction listed here but refused with its own reason (a cost), not "You can't do that here."
export const JournalLoreRefused: StoryObj = {
  ...loreStory(
    [{ ...deduce, available: false, reason: { code: 'insufficient_resource' } }],
    'Journal lore only, deduction refused here',
    [],
  ),
  play: async ({ canvas, userEvent }) => {
    const card = await canvas.findByRole('button', { name: 'Think it through' });
    await userEvent.click(card);
    await waitFor(() => expect(card).toHaveTextContent(/^Think it through\s+\S/));
    await expect(card).not.toHaveTextContent(/do that here/);
    if (canvas.queryByText('Nothing written yet.')) throw new Error('empty line above Lore');
  },
};
// Toolbox row FD6: the Chronicle (book-ui.md, Chronicle details) under the Journal; the latest day
// open, earlier days collapsed, a story-point line in body type. Lines are the recap sampler's narration.
const TICK = 'The poison burns in your veins.';
const chronicleStory = (name: string, chronicle: object[]): StoryObj => ({
  ...pageStory({ ...JournalView, chronicle }),
  name,
});
const day1 = {
  day: 1,
  lines: [
    { line: 'A dart pricks your arm. Cold spreads from the wound.', count: 1 },
    { line: TICK, count: 11 },
    { line: 'The poison fades from your blood.', count: 1 },
  ],
  milestones: new Set<string>(),
};
export const JournalChronicle: StoryObj = {
  ...chronicleStory('Journal chronicle, one day', [day1]),
  play: async ({ canvas }) => {
    await canvas.findByRole('button', { name: 'Day 1, hide' });
    await canvas.findByText(`${TICK} (11 times)`);
  },
};
export const JournalChronicleDays: StoryObj = {
  ...chronicleStory('Journal chronicle, two days and a milestone', [
    day1,
    {
      day: 7,
      lines: [
        { line: 'You find the lost child.', count: 1 },
        { line: 'The chill passes.', count: 1 },
      ],
      milestones: new Set(['You find the lost child.']),
    },
  ]),
  play: async ({ canvas }) => {
    await canvas.findByRole('button', { name: 'Day 1, show' });
    await canvas.findByLabelText('You find the lost child., story point');
    if (canvas.queryByText(`${TICK} (11 times)`)) throw new Error('earlier day open');
  },
};

// The showcase authors no ancestry, so the page takes a synthetic view and one choose button.
// Breaks: a choice shows no button, or the button is not matched to its ancestry.
export const Ancestry: StoryObj = {
  name: 'Ancestry',
  render: () => (
    <AncestryPage
      view={
        { ancestry_choices: [{ key: 'hill', description: 'Hill folk, steady on stone.' }] } as never
      }
      text={(k) => k}
      buttons={[
        {
          action_key: 'choose_ancestry',
          label: 'Choose hill',
          input: { ancestry: 'hill' },
        } as never,
      ]}
      pending={false}
      press={() => {}}
    />
  ),
};

export const Credits: StoryObj = { render: () => <CreditsPage back={() => {}} /> };
