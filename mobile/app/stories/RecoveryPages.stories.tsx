// C row Pages, Recovery (design-input-batch-4-2026-10-09.md 1): shell states, hand props over the
// first room's view; SaveError has no game.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { fn } from 'storybook/test';
import { SaveError } from '../SaveError.tsx';
import { pageStory } from './screen.tsx';
import firstRoom from './views/room-first.json';

const meta: Meta = { title: 'Pages/Recovery', component: SaveError };
export default meta;
const failed = (
  kind: 'unsupported_save_format' | 'save_corrupt' | 'pinned_release_missing',
  message: string,
) => ({
  render: () => <SaveError failed={{ kind, message, startOver: true }} startOver={fn()} />,
});

export const SaveErrorRelease: StoryObj = {
  ...failed('pinned_release_missing', 'pinned_release_missing'),
  name: 'Save error: release missing',
};
export const SaveErrorFormat: StoryObj = {
  ...failed('unsupported_save_format', 'unsupported_save_format'),
  name: 'Save error: format',
};
export const SaveErrorCorrupt: StoryObj = {
  ...failed('save_corrupt', 'row 4 failed its hash'),
  name: 'Save error: corrupt',
};
export const SaveErrorLocked: StoryObj = {
  ...failed(
    'save_corrupt',
    'Access Handles cannot be created if there is another open Access Handle',
  ),
  name: 'Save error: lock sentence',
};
export const Fault: StoryObj = {
  ...pageStory(firstRoom, { fault: 'The save file is full.' }),
  name: 'Fault',
};
export const Pending: StoryObj = {
  ...pageStory(firstRoom, { pending: true }),
  name: 'Pending save',
};
export const CatchingUp: StoryObj = {
  ...pageStory(firstRoom, { catchingUp: true }),
  name: 'Catching up',
};
