import { LucideProvider } from 'lucide-react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { chrome, font } from '../../../mobile/app/book/tokens.ts';
import EBGaramond from '../../../mobile/app/book/fonts/EBGaramond.ttf?url';
import './index.css';
import App from './App.tsx';
import { follow } from './shell.ts';

// The chrome's tokens, read here rather than copied (docs/design/editor-chrome-rulings.md): both
// schemes as inline variables, which index.css maps onto shadcn's names under :root and .dark.
document.fonts.add(new FontFace(font.body, `url(${EBGaramond})`)); // chrome.type.prose only
const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const root = document.documentElement;
for (const scheme of ['light', 'dark'] as const) {
  for (const [k, v] of Object.entries(chrome[scheme])) root.style.setProperty(`--chrome-${scheme}-${kebab(k)}`, v);
  chrome.area[scheme].forEach((v, i) => root.style.setProperty(`--chrome-${scheme}-area-${i + 1}`, v));
}
const px = ([size, leading]: number[]) => [`${size}px`, `${leading}px`];
for (const [role, sizes] of Object.entries(chrome.type)) {
  const [size, leading] = px(sizes);
  root.style.setProperty(`--chrome-${role}-size`, size);
  root.style.setProperty(`--chrome-${role}-leading`, leading);
}
root.style.setProperty('--chrome-sans', chrome.sans);
root.style.setProperty('--chrome-mono', chrome.mono);
root.style.setProperty('--chrome-prose', `'${font.body}', serif`);
root.style.setProperty('--chrome-radius', `${chrome.radius}px`);
follow(matchMedia('(prefers-color-scheme: dark)'), root);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LucideProvider size={16} strokeWidth={1.5} absoluteStrokeWidth>
      <App />
    </LucideProvider>
  </StrictMode>,
);
