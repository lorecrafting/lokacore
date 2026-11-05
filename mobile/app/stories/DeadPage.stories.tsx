// The dead page (book-ui.md, Dead page): a death outside a fight, before Let go.
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { expect, waitFor } from 'storybook/test';
import { Body } from '../book/Body.tsx';
import { DeadPage as Dead } from '../book/DeadPage.tsx';
import { LABEL } from '../book/labels.ts';
import { opacity } from '../book/tokens.ts';
import { pageStory } from './screen.tsx';
import RoomNpcsItemsView from './views/room-npcs-items.json';

const meta: Meta = {
  tags: ['!autodocs'],
  title: 'Pages/Dead',
  component: Dead,
  subcomponents: { Body },
};
export default meta;

// Breaks (book-ui.md, Dead page): the recovery room's prose, people or status row drawn under the
// kept title, any control but Let go, no fatal hold, or a vignette breathing under it.
// hp at danger: the low-health vignette must not breathe under the hold.
const { view } = RoomNpcsItemsView;
const low = view.resources.map((r) => (r.resource.key === 'hp' ? { ...r, tone: 'danger' } : r));
export const DeadPage: StoryObj = {
  ...pageStory(
    { ...RoomNpcsItemsView, view: { ...view, resources: low } },
    {
      dead: { title: 'The cellar', log: ['You light the lamp.'] },
      log: ['You bleed.', 'You die.', 'You wake at the shrine.'],
    },
  ),
  name: 'Dead page',
  play: async ({ canvas, canvasElement }) => {
    const letGo = await canvas.findByRole('button', { name: LABEL.letGo });
    await waitFor(() => expect(letGo).toBeVisible(), { timeout: 3000 }); // the foot fades in (useDry)
    await expect(canvas.getAllByRole('button')).toEqual([letGo]);
    await expect(canvas.getByRole('heading')).toHaveTextContent('The cellar');
    await expect(canvas.getByText('You wake at the shrine.')).toBeVisible();
    // Settled at the fatal hold, so axe reads the resting colours (loka-gj82.10).
    const layers = () => [...canvasElement.querySelectorAll('[aria-hidden="true"]')];
    const at = (e: Element) => Number(getComputedStyle(e).opacity);
    await waitFor(() => expect(layers().some((e) => at(e) === opacity.fatal)).toBe(true), {
      timeout: 3000,
    });
    await new Promise((r) => setTimeout(r, 1500)); // a breath of the vignette, were it drawn
    await expect(layers().filter((e) => at(e) > 0 && at(e) <= opacity.faint)).toEqual([]);
  },
};
