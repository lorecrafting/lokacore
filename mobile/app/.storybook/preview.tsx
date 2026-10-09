import type { Preview } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { PaletteContext } from '../book/palette.ts';
import { color } from '../book/tokens.ts';

const phone = (name: string, width: number, height: number) => ({
  name,
  styles: { width: `${width}px`, height: `${height}px` },
  type: 'mobile' as const,
});

const preview: Preview = {
  globalTypes: {
    palette: {
      description: 'Book palette (tokens.ts color)',
      toolbar: {
        title: 'Palette',
        icon: 'paintbrush',
        items: Object.keys(color),
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { palette: 'light', viewport: { value: 'iphone11', isRotated: false } },
  parameters: {
    layout: 'fullscreen',
    viewport: {
      options: {
        iphone11: phone('iPhone 11', 414, 896),
        iphoneSE: phone('iPhone SE', 375, 667),
        pixel7: phone('Pixel 7', 412, 915),
      },
    },
    // Fail the smoke on any axe violation, colour contrast included.
    a11y: { test: 'error' },
  },
  decorators: [
    (Story, { globals }) => {
      const c = color[globals.palette as keyof typeof color] ?? color.light;
      return (
        <PaletteContext.Provider value={c}>
          {/* The page's paper, so axe measures contrast against the real background. */}
          <View style={{ backgroundColor: c.bg, minHeight: '100vh' as never, flex: 1 }}>
            <Story />
          </View>
        </PaletteContext.Provider>
      );
    },
  ],
};
export default preview;
