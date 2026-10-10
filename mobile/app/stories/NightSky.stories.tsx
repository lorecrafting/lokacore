// NightSky: the stars and shooting star over the night page (BOOK-UI-COMPONENTS.md, Night sky),
// on the night paper whatever the toolbar's palette (the Book mounts it at night only).
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { NightSky } from '../book/NightSky.tsx';
import { PaletteContext } from '../book/palette.ts';
import { color } from '../book/tokens.ts';

const meta = {
  title: 'Book/NightSky',
  component: NightSky,
  render: () => (
    <PaletteContext value={color.dark}>
      <View style={{ height: '100vh' as never, backgroundColor: color.dark.bg }}>
        <NightSky />
      </View>
    </PaletteContext>
  ),
} satisfies Meta<typeof NightSky>;
export default meta;

export const Night: StoryObj<typeof meta> = {};
