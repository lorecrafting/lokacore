import React, { useEffect, useState } from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import {
  Canvas,
  Fill,
  Shader,
  Skia,
  type SkRuntimeEffect,
} from '@shopify/react-native-skia';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * SkSL shader that composites paper grain, ink variation, and edge vignette.
 *
 * Outputs a semi-transparent DARK overlay (not multiply). Noise-driven alpha
 * creates irregular darkening — simulating paper fibers, aging spots, and
 * ink absorption. The color is a warm dark brown so it tints rather than grays.
 */
const PAPER_TEXTURE_SHADER = `
uniform float2 resolution;

float hash(float2 p) {
    float3 p3 = fract(float3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float noise(float2 p) {
    float2 i = floor(p);
    float2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + float2(1.0, 0.0));
    float c = hash(i + float2(0.0, 1.0));
    float d = hash(i + float2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(float2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 3; i++) {
        value += amplitude * noise(p);
        p *= 2.1;
        amplitude *= 0.5;
    }
    return value;
}

half4 main(float2 fragCoord) {
    float2 uv = fragCoord / resolution;

    // Warm dark brown — matches parchment shadow tone
    const float3 darkTint = float3(0.35, 0.28, 0.18);

    // ── Paper grain (noise-driven darkening) ──
    float grain1 = fbm(fragCoord * 0.008);          // large blotchy patches
    float grain2 = fbm(fragCoord * 0.025 + 42.0);   // medium fiber texture
    float grain3 = noise(fragCoord * 0.12 + 17.0);   // fine speckle

    // Combine into a darkening amount (0 = no effect, 1 = full dark)
    float grainDark = grain1 * 0.04 + grain2 * 0.03 + grain3 * 0.02;

    // ── Edge vignette ──
    float2 center = float2(0.55, 0.5);
    float2 diff = uv - center;
    diff.x *= 0.8;
    float vignette = dot(diff, diff) * 0.35;

    // Spine shadow (left edge)
    float spine = (1.0 - smoothstep(0.0, 0.06, uv.x)) * 0.08;

    // ── Final alpha = how much to darken ──
    float alpha = clamp(grainDark + vignette + spine, 0.0, 0.25);

    return half4(half3(darkTint * alpha), alpha);
}
`;

let _cachedEffect: SkRuntimeEffect | null = null;
let _cachedKey: string | null = null;

function getShaderEffect(): SkRuntimeEffect | null {
  if (_cachedKey !== PAPER_TEXTURE_SHADER) {
    _cachedEffect = null;
    _cachedKey = PAPER_TEXTURE_SHADER;
  }
  if (!_cachedEffect) {
    try {
      _cachedEffect = Skia.RuntimeEffect.Make(PAPER_TEXTURE_SHADER);
      if (!_cachedEffect) {
        console.warn('[ParchmentTexture] Shader compile returned null');
      }
    } catch (e) {
      console.warn('[ParchmentTexture] Shader compile failed:', e);
    }
  }
  return _cachedEffect;
}

/**
 * ParchmentTextureOverlay renders a full-screen Skia shader that adds:
 * - Paper grain/fiber texture (3 octaves of value noise)
 * - Warm color variation (simulates uneven aging)
 * - Edge vignette (darker at edges, especially spine/binding)
 * - Ink irregularity (fine noise that affects dark text via multiply)
 *
 * Uses blend mode "multiply" so it naturally darkens ink more than paper.
 * pointerEvents="none" — never intercepts touches.
 */
export function ParchmentTextureOverlay() {
  const [source, setSource] = useState<SkRuntimeEffect | null>(getShaderEffect);

  useEffect(() => {
    if (!source) {
      const effect = getShaderEffect();
      if (effect) setSource(effect);
    }
  }, [source]);

  if (!source) return null;

  return (
    <Canvas style={styles.overlay} pointerEvents="none">
      <Fill>
        <Shader
          source={source}
          uniforms={{ resolution: [SCREEN_WIDTH, SCREEN_HEIGHT] }}
        />
      </Fill>
    </Canvas>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 45, // below PageEffectsOverlay (50), above page content
  },
});
