// C row Pages, Notices (design-input-batch-4-2026-10-09.md 1); routes: stories/routes.ts.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { NoticePage } from '../book/notices.tsx';
import { DreamResume } from '../book/DreamPage.tsx';
import { pageStory } from './screen.tsx';
import NoticeReadView from './views/notice-read.json';

const meta: Meta = {
  tags: ['!autodocs'],
  title: 'Pages/Notices',
  component: NoticePage,
};
export default meta;

export const NoticeWithRead: StoryObj = {
  ...pageStory(NoticeReadView, undefined, ['detail.sign_hub.description']),
  name: 'Notice with Read',
};

// A fixture the prose links: its page shows its offered cards (a hand notice dropped into the inn view; loka-x6t.120).
const hearth = {
  id: 'hearth',
  key: 'hearth',
  title: 'detail.hearth.title',
  description: 'detail.hearth.description',
  actions: [
    {
      action_key: 'gather_ash',
      label: 'actions.gather_ash',
      target: { kind: 'none' },
      input: [],
      available: true,
    },
  ],
};
export const FixtureWithCards: StoryObj = {
  ...pageStory({
    ...NoticeReadView,
    view: { ...NoticeReadView.view, notices: [hearth] },
    stack: [{ kind: 'notice', id: 'hearth' }],
  }),
  args: {
    words: {
      'detail.hearth.title': 'The hearth',
      'detail.hearth.description': 'A cold hearth, grey with ash.',
      'actions.gather_ash': 'Gather ash',
    },
  },
  name: 'Room feature with actions',
};

// The showcase authors no dream, so the resume control takes a synthetic notice.
// Breaks: an available dream shows no Resume control, or a finished dream's bed offers it or shows a line.
const notice = (dream: object) => ({ id: 'n', dream }) as never;
export const DreamAvailable: StoryObj = {
  name: 'Bed: Resume dream',
  render: () => <DreamResume detail={notice({ available: true, index: 1 })} open={() => {}} />,
};
export const DreamAcknowledged: StoryObj = {
  name: 'Bed: dream finished',
  render: () => <DreamResume detail={notice({ available: false, index: -1 })} open={() => {}} />,
};
