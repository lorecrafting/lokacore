// C row Pages, NPC (design-input-batch-4-2026-10-09.md 1); routes: stories/routes.ts.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { NpcDetail, NpcPage } from '../book/Menu.tsx';
import { pageStory } from './screen.tsx';
import NpcChoiceView from './views/npc-choice.json';
import NpcRiddleView from './views/npc-riddle.json';
import NpcShopView from './views/npc-shop.json';
import NpcServicesView from './views/npc-services.json';
import NpcClosedView from './views/npc-closed.json';
import NpcRefusedView from './views/npc-refused.json';

const meta: Meta = { title: 'Pages/NPC', component: NpcPage, subcomponents: { NpcDetail } };
export default meta;

export const Choice: StoryObj = { ...pageStory(NpcChoiceView), name: 'Choice' };
export const Riddle: StoryObj = { ...pageStory(NpcRiddleView), name: 'Riddle' };
export const Shop: StoryObj = { ...pageStory(NpcShopView), name: 'Shop' };
export const Services: StoryObj = { ...pageStory(NpcServicesView), name: 'Services' };
export const RefusedAnswer: StoryObj = { ...pageStory(NpcRefusedView), name: 'Refused answer' };
export const ClosedConversation: StoryObj = {
  ...pageStory(NpcClosedView),
  name: 'Closed conversation',
};
