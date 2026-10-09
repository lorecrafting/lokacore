// The manager chrome in the Book's light palette and type (tokens.ts), so stories read like the book.
import { addons } from 'storybook/manager-api';
import { create } from 'storybook/theming';
import { color, font } from '../book/tokens.ts';

const c = color.light;
addons.setConfig({
  theme: create({
    base: 'light',
    brandTitle: 'Loka Book UI',
    fontBase: `${font.body}, Georgia, serif`,
    colorPrimary: c.action,
    colorSecondary: c.action,
    appBg: c.card,
    appContentBg: c.bg,
    appPreviewBg: c.bg,
    appBorderColor: c.line,
    textColor: c.fg,
    textMutedColor: c.dim,
    barBg: c.bg,
    barTextColor: c.dim,
    barSelectedColor: c.action,
    inputBg: c.bg,
    inputBorder: c.line,
    inputTextColor: c.fg,
  }),
});
