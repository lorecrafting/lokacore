// A radial gradient on its own canvas; apart so a page without CanvasKit never loads Skia.
import { useState } from 'react';
import { View } from 'react-native';
import { Canvas, RadialGradient, Rect, vec } from '@shopify/react-native-skia';

const fill = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const; // mutate-skip: layout

type Box = { width: number; height: number };

/**
 * A radial gradient filling its parent, under the ink.
 * - Use: UnderInk only.
 * - Rules: no runtime effect; `shape` picks its centre and radius from the laid-out box.
 * - Story: UnderInk.stories.tsx
 */
export default function Gradient(p: {
  shape: (box: Box) => { x: number; y: number; r: number };
  colors: string[];
  stops?: number[];
}) {
  const [box, setBox] = useState<Box>({ width: 0, height: 0 });
  const { x, y, r } = p.shape(box);
  return (
    <View
      style={fill}
      onLayout={({ nativeEvent: { layout } }) =>
        setBox({ width: layout.width, height: layout.height })
      }
    >
      {box.width > 0 && (
        <Canvas style={fill}>
          <Rect x={0} y={0} width={box.width} height={box.height}>
            <RadialGradient c={vec(x, y)} r={r} colors={p.colors} positions={p.stops} />
          </Rect>
        </Canvas>
      )}
    </View>
  );
}
