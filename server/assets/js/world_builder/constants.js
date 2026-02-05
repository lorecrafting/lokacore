/**
 * Shared constants for World Builder JavaScript utilities.
 *
 * These serve as fallback values when CSS variables aren't accessible
 * (e.g., during canvas rendering before DOM is ready, or in tests).
 *
 * IMPORTANT: These should match the values in assets/css/variables.css
 * If you update a design token there, update the fallback here too.
 */

/**
 * Exit direction colors for the canvas viewport.
 * Used by Canvas2DRenderer when CSS variables are unavailable.
 * @type {Record<string, string>}
 */
export const EXIT_COLORS = {
  north: '#4a9eff',
  south: '#ff4a9e',
  east: '#4aff9e',
  west: '#ff9e4a',
  up: '#9e4aff',
  down: '#ffff4a',
  northeast: '#4affff',
  northwest: '#ff4aff',
  southeast: '#4affaa',
  southwest: '#ffaa4a',
  default: '#888888',
}

/**
 * Room state colors for the canvas viewport.
 * @type {Record<string, string>}
 */
export const ROOM_COLORS = {
  default: '#7eb3ff',
  selected: '#4a9eff',
  multiSelected: '#ffaa00',
  error: '#ff6b6b',
  warning: '#ffd93d',
}

/**
 * Viewport background and grid colors.
 * @type {Record<string, string>}
 */
export const VIEWPORT_COLORS = {
  bg: '#1a1a2e',
  grid: '#333344',
  gridMajor: '#555566',
  snap: '#00ff88',
  snapDim: '#00ff8844',
  roomBorder: '#ffffff',
  roomBorderMulti: '#ff8800',
  roomBorderError: '#ff0000',
  roomBorderWarning: '#ffaa00',
  roomText: '#ffffff',
  roomKeyText: '#888888',
}

/**
 * Spacing values matching CSS tokens (in pixels).
 * Use these for consistent spacing in canvas rendering.
 * @type {Record<string, number>}
 */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
}

/**
 * Font sizes matching CSS tokens.
 * @type {Record<string, string>}
 */
export const FONT_SIZES = {
  xs: '0.7rem',
  sm: '0.78rem',
  md: '0.8rem',
  base: '0.85rem',
  lg: '0.95rem',
  xl: '1.05rem',
}

/**
 * Border radius values matching CSS tokens (in pixels).
 * @type {Record<string, number>}
 */
export const BORDER_RADIUS = {
  sm: 3,
  md: 5,
  lg: 8,
}

/**
 * Z-index hierarchy matching CSS tokens.
 * @type {Record<string, number>}
 */
export const Z_INDEX = {
  toolbar: 10,
  panel: 20,
  dropdown: 50,
  modal: 100,
  overlay: 1000,
}

/**
 * Canvas viewport defaults.
 * @type {Record<string, number>}
 */
export const CANVAS_DEFAULTS = {
  gridSize: 60,
  roomSize: 48,
  minZoom: 0.2,
  maxZoom: 3,
  snapSize: 60,
}
