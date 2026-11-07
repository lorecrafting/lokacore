// The sky on an exposed World page (book-ui.md, Effects: Storm, Wind). Light comes 20 to 60 s apart, so
// the storm story is mostly the page at rest; the wind corner lifts on mount.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Storm } from '../book/Storm.tsx';
import { pageStory } from './screen.tsx';
import room from './views/room-first.json';

const meta: Meta = { tags: ['!autodocs'], title: 'Pages/Sky', component: Storm };
export default meta;

const under = (weather: string, exposed: boolean) => ({
  ...room,
  view: {
    ...room.view,
    place: { ...room.view.place, exposed },
    calendar_status: { day: 1, hour: 8, subdivision: 0, weather },
  },
});

export const Wind: StoryObj = { ...pageStory(under('wind', true)), name: 'Wind, exposed' };
export const StormOut: StoryObj = { ...pageStory(under('storm', true)), name: 'Storm, exposed' };
export const Indoors: StoryObj = { ...pageStory(under('wind', false)), name: 'Wind, indoors' };
