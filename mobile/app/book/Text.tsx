import type { ComponentProps } from 'react';
import { Text } from 'react-native';
const Line = (p: ComponentProps<typeof Text>) => <Text allowFontScaling={false} {...p} />;
/**
 * Every Book line: its size is already the Reading size (reading.ts), so the system never scales
 * it again.
 * - Use: every text the Book draws.
 * - Story: Note.stories.tsx
 */
export { Line as Text };
