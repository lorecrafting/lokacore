// C row Pages, Notices (design-input-batch-4-2026-10-09.md 1); routes: stories/routes.ts.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { DreamResume } from '../book/DreamPage.tsx';
import { NoticePage } from '../book/notices.tsx';
import { pageStory } from './screen.tsx';
import NoticeBoardView from './views/notice-board.json';
import NoticeReadView from './views/notice-read.json';
import NoticeBedResumeView from './views/notice-bed-resume.json';

const meta: Meta = {
  title: 'Pages/Notices',
  component: NoticePage,
  subcomponents: { DreamResume },
};
export default meta;

export const Board: StoryObj = { ...pageStory(NoticeBoardView), name: 'Board' };
export const NoticeWithRead: StoryObj = { ...pageStory(NoticeReadView), name: 'Notice with Read' };
export const BedWithResumeDream: StoryObj = {
  ...pageStory(NoticeBedResumeView),
  name: 'Bed with Resume dream',
};
