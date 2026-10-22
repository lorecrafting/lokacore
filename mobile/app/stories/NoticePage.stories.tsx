// C row Pages, Notices (design-input-batch-4-2026-10-09.md 1); routes: stories/routes.ts.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { NoticePage } from '../book/notices.tsx';
import { pageStory } from './screen.tsx';
import NoticeReadView from './views/notice-read.json';

const meta: Meta = {
  title: 'Pages/Notices',
  component: NoticePage,
};
export default meta;

export const NoticeWithRead: StoryObj = {
  ...pageStory(NoticeReadView, undefined, ['detail.sign_hub.description']),
  name: 'Notice with Read',
};
