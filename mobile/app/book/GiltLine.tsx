// A line that arrives in gilt: warning ink, settling to its own.
import { InkText } from './fade.ts';
import { useGilt } from './press.ts';

/**
 * A line that arrives in gilt and settles to its ink (book-ui.md, Gilt).
 * - Use: a quest resolved, a skill learned or improved, a level; no failure is gilt.
 * - Rules: never the only sign; reduced motion: a plain fade in its own ink.
 * - States: drying; dry.
 * - Story: LogLines.stories.tsx
 */
export function GiltLine(p: { style: { color: string }; hold?: number; children: string }) {
  return <InkText style={[p.style, useGilt(p.style.color, p.hold)]}>{p.children}</InkText>;
}
