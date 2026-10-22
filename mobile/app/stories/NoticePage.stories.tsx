// C row Pages, Notices (design-input-batch-4-2026-10-09.md 1); routes: stories/routes.ts.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { NoticePage } from '../book/notices.tsx';
import { DreamResume } from '../book/DreamPage.tsx';
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

// The showcase authors no dream, so the resume control takes a synthetic notice.
// Breaks: an available dream shows no Resume control, or an acknowledged one still offers it.
const notice = (dream: object) => ({ id: 'n', dream }) as never;
export const DreamAvailable: StoryObj = {
  name: 'Dream resume',
  render: () => <DreamResume detail={notice({ available: true, index: 1 })} open={() => {}} />,
};
export const DreamAcknowledged: StoryObj = {
  name: 'Dream acknowledged',
  render: () => <DreamResume detail={notice({ available: false, index: -1 })} open={() => {}} />,
};
