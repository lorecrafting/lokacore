import type { ComponentProps } from 'react';
import { Text } from 'react-native';
type Props = ComponentProps<typeof Text>;
/**
 * The one author seam into the Book (docs/rnd/in-game-builder-mode-2026-11-19.md §6.2, owner ruling 2):
 * the builder (author/build/seam.ts) sets `line`, only in the author preview, to see each line and add
 * props to its own Text, never a wrapper. A release never sets it: one property read per line. Lint
 * mobile-book-author-seam keeps every other Book file off it.
 */
export const authorSeam: { line?: (p: Props) => Props } = {};
const Line = (p: Props) => (
  <Text allowFontScaling={false} {...(authorSeam.line ? authorSeam.line(p) : p)} />
);
/**
 * Every Book line: its size is already the Reading size (reading.ts), so the system never scales
 * it again.
 * - Use: every text the Book draws.
 * - Story: Note.stories.tsx
 */
export { Line as Text };
