// A conversation's exit (book-ui.md, NPC page); routes: stories/routes.ts.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect } from 'storybook/test';
import { NpcPage } from '../book/Npc.tsx';
import { pageStory } from './screen.tsx';
import NpcTalkLeaveView from './views/npc-talk-leave.json';
import { LABEL } from '../book/labels.ts';

const meta: Meta = { title: 'Pages/NPC talk', component: NpcPage, tags: ['!autodocs'] };
export default meta;

// Nell's talk, its only authored choice Leave (loka-512o): one exit, the foot's.
// Breaks: a Leave drawn among the choices beside Leave the conversation.
export const TalkLeave: StoryObj = {
  ...pageStory(NpcTalkLeaveView),
  name: 'Talk, its only choice Leave',
  play: async ({ canvas }) => {
    await canvas.findByRole('button', { name: LABEL.leaveConversation });
    await expect(canvas.queryByRole('button', { name: LABEL.leave })).toBeNull();
  },
};
