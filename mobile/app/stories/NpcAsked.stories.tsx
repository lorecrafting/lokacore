// Pages/NPC is at its size limit; the asked option (book-ui.md, dialogue choices) stands alone.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect } from 'storybook/test';
import { NpcPage } from '../book/Npc.tsx';
import { pageStory } from './screen.tsx';
import NpcChoiceView from './views/npc-choice.json';

const meta: Meta = {
  title: 'Pages/NPC asked',
  component: NpcPage,
  tags: ['!autodocs'],
};
export default meta;

// Breaks: Npc drops the view's `asked`, so the option taken before looks like the fresh one beside it.
export const AskedOption: StoryObj = {
  ...pageStory(
    {
      ...NpcChoiceView,
      view: {
        ...NpcChoiceView.view,
        choice: {
          ...NpcChoiceView.view.choice,
          choices: NpcChoiceView.view.choice.choices.map((c) =>
            c.choice_id === 'help' ? { ...c, asked: true } : c,
          ),
        },
      },
    },
    undefined,
    [
      'dialogue.reeve_talk.prompt',
      'dialogue.reeve_talk.accept',
      'dialogue.reeve_talk.help',
      'dialogue.reeve_talk.wrong',
    ],
  ),
  name: 'Asked option',
  play: async ({ args, canvas }) => {
    const { words } = args as { words: Record<string, string> };
    const color = async (key: string) =>
      getComputedStyle(await canvas.findByText(words[key]!)).color;
    const fresh = await color('dialogue.reeve_talk.accept');
    await expect(await color('dialogue.reeve_talk.help')).not.toBe(fresh);
    await expect(await color('dialogue.reeve_talk.wrong')).toBe(fresh);
  },
};
