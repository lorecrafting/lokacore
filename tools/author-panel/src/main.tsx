import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { color, font, radius, type } from '../../../mobile/app/book/tokens.ts';
import EBGaramond from '../../../mobile/app/book/fonts/EBGaramond.ttf?url';
import IMFellEnglish from '../../../mobile/app/book/fonts/IMFellEnglish.ttf?url';
import IMFellEnglishSC from '../../../mobile/app/book/fonts/IMFellEnglishSC.ttf?url';
import './index.css';
import App from './App.tsx';

// The Book's tokens and fonts, read here rather than copied (index.css maps them onto shadcn's names).
// Light only: the Book's palette follows the game's sun, so the panel has no theme of its own.
const files = { [font.body]: EBGaramond, [font.head]: IMFellEnglish, [font.caps]: IMFellEnglishSC };
for (const [family, url] of Object.entries(files)) document.fonts.add(new FontFace(family, `url(${url})`));
const role = (r: { fontFamily: string; fontSize: number; lineHeight: number; letterSpacing?: number }) => ({
  family: `'${r.fontFamily}', serif`,
  size: `${r.fontSize}px`,
  leading: `${r.lineHeight}px`,
  tracking: `${r.letterSpacing ?? 0}px`,
});
const vars: Record<string, string> = {
  ...Object.fromEntries(Object.entries(color.light).map(([k, v]) => [`--book-${k}`, v])),
  '--book-radius': `${radius.card}px`,
};
for (const name of ['body', 'small', 'label', 'control', 'pageTitle'] as const)
  for (const [k, v] of Object.entries(role(type[name]))) vars[`--book-${name}-${k}`] = v;
for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
