import type { Preview } from '@storybook/react-native-web-vite';
import { View } from 'react-native';
import { PaletteContext, useFocusRing } from '../book/palette.ts';
import { color } from '../book/tokens.ts';

const device = (
  name: string,
  width: number,
  height: number,
  type: 'mobile' | 'tablet' = 'mobile',
) => ({
  name,
  styles: { width: `${width}px`, height: `${height}px` },
  type,
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
    options: {
      storySort: {
        order: [
          'Docs',
          'Book',
          'Pages',
          [
            'Room',
            'NPC',
            'Notices',
            'Item',
            'Combat',
            'Map',
            'Sections',
            'Chapter and scene',
            'Recovery',
          ],
          'Live',
        ],
      },
    },
    viewport: {
      options: {
        iphone11: device('iPhone 11', 414, 896),
        iphoneSE: device('iPhone SE', 375, 667),
        pixel7: device('Pixel 7', 412, 915),
        // one tablet check: the centred page width and the footer rules
        ipadMini: device('iPad mini', 744, 1133, 'tablet'),
      },
    },
    // Fail the smoke on any axe violation, colour contrast included.
    a11y: { test: 'error' },
  },
  // Label in name (book-ui.md): every button's accessible name starts with its shown text (a run of
  // whitespace as one space); a button that shows no text (the minimap at rest, whose stair words
  // are aria-hidden drawing) is skipped.
  afterEach: ({ canvasElement }) => {
    const words = (s: string) => s.replace(/\s+/g, ' ').trim();
    for (const b of canvasElement.querySelectorAll<HTMLElement>('[role="button"], button')) {
      const hidden = [...b.querySelectorAll<HTMLElement>('[aria-hidden="true"]')];
      hidden.forEach((n) => (n.style.display = 'none'));
      const shown = words(b.innerText); // innerText: laid-out lines, so blocks keep their break
      hidden.forEach((n) => (n.style.display = ''));
      const name = words(b.getAttribute('aria-label') ?? shown);
      if (shown && !name.startsWith(shown))
        throw new Error(`label in name: "${name}" does not start with "${shown}"`);
    }
  },
  decorators: [
    (Story, { globals, title }) => {
      const c = color[globals.palette as keyof typeof color] ?? color.light;
      // A Live Book and SaveError ring in their own palette.
      useFocusRing(title === 'Live' || title === 'Pages/Recovery' ? undefined : c);
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
