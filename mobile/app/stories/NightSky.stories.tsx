// NightSky: the stars and shooting star over the night page (BOOK-UI-COMPONENTS.md, Night sky).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { NightSky } from '../book/NightSky.tsx';

const meta = {
  title: 'Book/NightSky',
  component: NightSky,
  globals: { palette: 'dark' },
  render: () => (
    <View style={{ height: '100vh' as never }}>
      <NightSky />
    </View>
  ),
} satisfies Meta<typeof NightSky>;
export default meta;

export const Night: StoryObj<typeof meta> = {};
