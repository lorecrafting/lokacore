/**
 * Loka "Living Ebook" Theme
 * Dynamic environmental theming based on time phase, weather, and biome
 */

import type { TimePhase, MoonPhase, Weather, Biome, LightSource } from './types/game';

// =============================================================================
// Phase-Based Color Palettes
// =============================================================================

export interface PhaseColors {
  background: string;
  backgroundAlt: string;
  text: string;
  textMuted: string;
  textFaint: string;
  border: string;
  accent: string;
}

export const phaseThemes: Record<TimePhase, PhaseColors> = {
  day: {
    background: '#F7F3EB',      // Warm cream parchment
    backgroundAlt: '#EDE8DC',   // Slightly darker
    text: '#2C2416',            // Warm near-black
    textMuted: '#6B5D4D',       // Warm gray-brown
    textFaint: '#9C8B78',       // Faded ink
    border: '#DDD5C5',          // Subtle warm border
    accent: '#D4A574',          // Warm gold sunlight
  },
  dawn: {
    // Pre-dawn: darker transitional phase between night and day
    background: '#4A4035',      // Dark warm brown (between night and day)
    backgroundAlt: '#3D352C',   // Slightly darker
    text: '#D4C8B8',            // Warm cream (readable on dark)
    textMuted: '#A89880',       // Warm muted
    textFaint: '#7A6E60',       // Faded
    border: '#5C5248',          // Warm border
    accent: '#C8906A',          // Rose gold sunrise hint
  },
  dusk: {
    // Twilight: darker transitional phase between day and night
    background: '#5A4A3D',      // Dusky brown-purple (between day and night)
    backgroundAlt: '#4D4035',   // Slightly darker
    text: '#E0D4C4',            // Warm cream (readable on dark)
    textMuted: '#B0A090',       // Warm muted
    textFaint: '#887868',       // Faded
    border: '#6A5A4D',          // Warm border
    accent: '#D08050',          // Copper sunset glow
  },
  night: {
    background: '#1A1915',      // Near-black (warm)
    backgroundAlt: '#232019',   // Slightly lighter
    text: '#C5B8A5',            // Cream/ivory
    textMuted: '#8B7D6B',       // Warm gray
    textFaint: '#5C5347',       // Faded
    border: '#3D362E',          // Dark border
    accent: '#4A5568',          // Cool moonlight blue-gray
  },
};

// =============================================================================
// Moonlight Intensity
// =============================================================================

export const moonlightIntensity: Record<MoonPhase, number> = {
  new: 0,
  waxing_crescent: 0.05,
  first_quarter: 0.1,
  waxing_gibbous: 0.15,
  full: 0.2,
  waning_gibbous: 0.15,
  last_quarter: 0.1,
  waning_crescent: 0.05,
};

// =============================================================================
// Light Source Visibility
// =============================================================================

export interface LightSourceEffect {
  textOpacity: number;
  blur: number;
  glowColor: string;
  glowOpacity: number;
}

export const lightSourceEffects: Record<Exclude<LightSource, null> | 'none', LightSourceEffect> = {
  none: {
    textOpacity: 0.15,
    blur: 0.5,
    glowColor: 'transparent',
    glowOpacity: 0,
  },
  candle: {
    textOpacity: 0.45,
    blur: 0,
    glowColor: 'rgba(255, 200, 100, 0.3)',
    glowOpacity: 0.3,
  },
  torch: {
    textOpacity: 0.7,
    blur: 0,
    glowColor: 'rgba(255, 180, 80, 0.25)',
    glowOpacity: 0.25,
  },
  lantern: {
    textOpacity: 1.0,
    blur: 0,
    glowColor: 'rgba(255, 220, 150, 0.2)',
    glowOpacity: 0.2,
  },
};

// =============================================================================
// Weather Visual Modifiers
// =============================================================================

export interface WeatherModifier {
  backgroundTint: string;
  backgroundOpacity: number;
  particleType: 'none' | 'rain' | 'snow' | 'fog';
}

export const weatherModifiers: Record<Weather, WeatherModifier> = {
  clear: {
    backgroundTint: 'transparent',
    backgroundOpacity: 0,
    particleType: 'none',
  },
  cloudy: {
    backgroundTint: 'rgba(100, 100, 100, 0.1)',
    backgroundOpacity: 0.1,
    particleType: 'none',
  },
  rain: {
    backgroundTint: 'rgba(80, 90, 100, 0.15)',
    backgroundOpacity: 0.15,
    particleType: 'rain',
  },
  storm: {
    backgroundTint: 'rgba(50, 50, 60, 0.25)',
    backgroundOpacity: 0.25,
    particleType: 'rain',
  },
  fog: {
    backgroundTint: 'rgba(200, 200, 200, 0.3)',
    backgroundOpacity: 0.3,
    particleType: 'fog',
  },
  snow: {
    backgroundTint: 'rgba(220, 225, 230, 0.2)',
    backgroundOpacity: 0.2,
    particleType: 'snow',
  },
};

// =============================================================================
// Static Theme Values (unchanged from original)
// =============================================================================

export const colors = {
  // Core palette - warm parchment tones (day defaults)
  background: '#F7F3EB',
  backgroundDark: '#EDE8DC',
  text: '#2C2416',
  textMuted: '#6B5D4D',
  textFaint: '#9C8B78',
  border: '#DDD5C5',

  // Semantic
  error: '#8B2500',
  success: '#3D5A2E',

  // Bardo (death) state
  bardoBackground: '#1A1612',
  bardoText: '#5C5347',
  bardoTextMuted: '#3D362E',
};

export const fonts = {
  serif: 'Georgia',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const typography = {
  title: {
    fontFamily: fonts.serif,
    fontSize: 24,
    fontWeight: '600' as const,
    color: colors.text,
    textAlign: 'center' as const,
    lineHeight: 32,
    letterSpacing: 1,
  },
  prose: {
    fontFamily: fonts.serif,
    fontSize: 17,
    lineHeight: 28,
    color: colors.text,
  },
  proseSmall: {
    fontFamily: fonts.serif,
    fontSize: 15,
    lineHeight: 24,
    color: colors.text,
  },
  link: {
    fontFamily: fonts.serif,
    fontSize: 17,
    color: colors.text,
    textDecorationLine: 'underline' as const,
  },
  muted: {
    fontFamily: fonts.serif,
    fontSize: 15,
    color: colors.textMuted,
  },
  atmosphere: {
    fontFamily: fonts.serif,
    fontSize: 15,
    fontStyle: 'italic' as const,
    color: colors.textMuted,
    textAlign: 'center' as const,
  },
};

export const layout = {
  maxWidth: 672,
  padding: 24,
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the appropriate color palette for the current time phase
 */
export function getPhaseColors(phase: TimePhase): PhaseColors {
  return phaseThemes[phase] || phaseThemes.day;
}

/**
 * Get text visibility based on light source at night
 */
export function getTextVisibility(
  phase: TimePhase,
  lightSource: LightSource,
  isIndoor: boolean
): LightSourceEffect {
  // During day/dawn/dusk, full visibility
  if (phase !== 'night') {
    return lightSourceEffects.lantern;
  }

  // Indoor rooms with existing light don't need player light
  if (isIndoor) {
    return lightSourceEffects.lantern;
  }

  // At night outdoors, visibility depends on light source
  return lightSourceEffects[lightSource || 'none'];
}

/**
 * Calculate moonbeam overlay opacity based on moon phase and weather
 */
export function getMoonbeamOpacity(
  moonPhase: MoonPhase,
  weather: Weather,
  isIndoor: boolean
): number {
  // No moonbeams indoors
  if (isIndoor) return 0;

  // Clouds/weather reduce moonlight
  const weatherReduction: Record<Weather, number> = {
    clear: 1.0,
    cloudy: 0.3,
    rain: 0.1,
    storm: 0,
    fog: 0.2,
    snow: 0.4,
  };

  return moonlightIntensity[moonPhase] * (weatherReduction[weather] || 1.0);
}

/**
 * Determine which particle effects should be active
 */
export function getActiveParticles(
  phase: TimePhase,
  weather: Weather,
  biome: Biome,
  isIndoor: boolean
): string[] {
  const particles: string[] = [];

  // No particles indoors
  if (isIndoor) return particles;

  // Weather particles (highest priority)
  const weatherMod = weatherModifiers[weather];
  if (weatherMod.particleType !== 'none') {
    particles.push(weatherMod.particleType);
    // Don't show other particles during heavy weather
    if (weather === 'storm' || weather === 'snow') {
      return particles;
    }
  }

  // Night-specific particles
  if (phase === 'night') {
    // Stars (only in clear/partly cloudy weather)
    if (weather === 'clear' || weather === 'cloudy') {
      particles.push('stars');
    }

    // Fireflies (summer nights, forest/wetland biomes)
    if (biome === 'forest' || biome === 'swamp' || biome === 'water') {
      particles.push('fireflies');
    }
  }

  // Dawn-specific
  if (phase === 'dawn') {
    particles.push('mist');
  }

  return particles;
}

/**
 * Get transition effect type when phase changes
 */
export function getTransitionEffect(
  fromPhase: TimePhase,
  toPhase: TimePhase
): 'sunrise' | 'sunset' | 'fade' | 'none' {
  if (fromPhase === 'night' && toPhase === 'dawn') {
    return 'sunrise';
  }
  if (fromPhase === 'day' && toPhase === 'dusk') {
    return 'sunset';
  }
  if (fromPhase !== toPhase) {
    return 'fade';
  }
  return 'none';
}
