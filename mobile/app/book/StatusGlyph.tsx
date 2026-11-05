// A status icon's drawing on its own canvas; apart so a page without CanvasKit never loads Skia.
import { Canvas, Group, Path } from '@shopify/react-native-skia';
import { size, space } from './tokens.ts';

const BOX = 24; // statusGlyphs.ts draws in a 24-unit box
const SIDE = size.statusIcon - space.md; // 14 px, no token of its own (status-line-rulings.md)

/**
 * One statusGlyphs.ts drawing: stroked, round caps and joins, no fill, in the look's ink.
 * - Use: StatusIcon's Disc only.
 * - Rules: aria-hidden; the icon's name carries the label.
 * - Story: StatusIcon.stories.tsx (Drawings)
 */
export default function StatusGlyph(p: { d: string; ink: string }) {
  return (
    <Canvas aria-hidden style={{ width: SIDE, height: SIDE }}>
      <Group transform={[{ scale: SIDE / BOX }]}>
        <Path
          path={p.d}
          style="stroke"
          strokeWidth={2.5}
          strokeCap="round"
          strokeJoin="round"
          color={p.ink}
        />
      </Group>
    </Canvas>
  );
}
