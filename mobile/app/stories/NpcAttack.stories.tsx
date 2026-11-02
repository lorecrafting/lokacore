// C row Pages, NPC: the Attack card by its refusal (book-ui.md, Unavailable actions).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { expect, userEvent, within } from 'storybook/test';
import { NpcPage } from '../book/Npc.tsx';
import { pageStory } from './screen.tsx';
import NpcChoiceView from './views/npc-choice.json';

const meta: Meta = { title: 'Pages/NPC Attack', component: NpcPage, tags: ['!autodocs'] };
export default meta;

const reeve = NpcChoiceView.view.entities[1]!;
const attack = (offer: object, band?: string) => {
  const actions = [{ action_key: 'attack', label: 'action.attack', ...offer }];
  const entities = NpcChoiceView.view.entities.map((e) =>
    e === reeve ? { ...e, band, actions } : e,
  );
  const view = { ...NpcChoiceView.view, choice: undefined, entities };
  return pageStory({ ...NpcChoiceView, view });
};
const refused = (code: string, cause: string, key?: string) => ({
  available: false,
  reason: { code, cause, ...(key && { message: { key } }) },
});
const panes = [
  attack(refused('invalid_target', 'cannot_be_hurt')),
  attack({ available: true }, 'ready'),
  attack(refused('invalid_state', 'sanctuary', 'combat.sanctuary')),
];
// Breaks: an Attack on an hp-less person, none on one with hp, or a sanctuary's Attack not grey
// with its sentence (loka-3751, loka-g5hh.2.9).
export const Refusals: StoryObj = {
  ...panes[0],
  args: { words: { 'action.attack': 'Attack', 'combat.sanctuary': 'Placeholder sentence.' } },
  render: (args, ctx) => (
    <>
      {panes.map((s, i) => (
        <View key={i} testID={`pane${i}`}>
          {s.render!(args, ctx)}
        </View>
      ))}
    </>
  ),
  name: 'Attack by refusal',
  play: async ({ canvas }) => {
    await within(canvas.getByTestId('pane1')).findByRole('button', { name: /^Attack/ });
    await expect(within(canvas.getByTestId('pane0')).queryByText('Attack')).toBeNull();
    const grey = within(canvas.getByTestId('pane2')).getByLabelText('Attack');
    await userEvent.click(grey);
    await expect(grey).toHaveTextContent('Placeholder sentence.');
  },
};
