/**
 * @file constants.js - Centralized constants for World Builder
 *
 * LLM CONTEXT:
 * - Import constants instead of hardcoding magic values
 * - FALLBACK_COLORS (EXIT_COLORS, ROOM_COLORS, VIEWPORT_COLORS) are ONLY
 *   for Canvas2D when CSS vars unavailable
 * - PANEL_CONFIG defines min/max/default for each resizable panel
 * - TIMING constants ensure consistent animation/debounce values
 * - CANVAS_DEFAULTS defines viewport rendering parameters
 *
 * SYNC REQUIREMENT:
 * - Color values MUST match `assets/css/variables.css`
 * - When updating a design token in CSS, update the fallback here too
 * - Run canvas tests after changing: `cd server/assets && npm test`
 *
 * @related
 *   - assets/css/variables.css (source of truth for design tokens)
 *   - assets/js/world_builder/Canvas2DViewport.js (reads CSS vars, uses these as fallbacks)
 *   - assets/js/world_builder/Canvas2DRenderer.js (uses CANVAS_DEFAULTS for rendering)
 *   - assets/js/hooks/panel_resize.js (uses PANEL_CONFIG for resize constraints)
 */

// === PANEL CONFIGURATION ===
/**
 * Panel constraints for resizable World Builder panels.
 * Used by panel_resize.js for drag constraints.
 * Grid column indices refer to positions in --grid-columns CSS property:
 * Layout: hierarchy(0) h_resize(1) viewport(2) i_resize(3) inspector(4) t_resize(5) terminal(6) c_resize(7) chat(8)
 * @type {Record<string, {min: number, max: number, defaultSize: number, gridColumnIndex: number}>}
 */
export const PANEL_CONFIG = {
  hierarchy: { min: 150, max: 400, defaultSize: 200, gridColumnIndex: 0 },
  inspector: { min: 200, max: 500, defaultSize: 260, gridColumnIndex: 4 },
  terminal: { min: 200, max: 500, defaultSize: 320, gridColumnIndex: 6 },
  chat: { min: 200, max: 500, defaultSize: 320, gridColumnIndex: 8 },
}

// === GRID LAYOUT ===
/**
 * Grid layout constants for the World Builder container.
 * @type {Record<string, number>}
 */
export const GRID_CONFIG = {
  COLLAPSED_WIDTH: 40, // Width of collapsed panels in pixels
  RESIZE_HANDLE_WIDTH: 4, // Width of resize handles between panels
  MIN_VIEWPORT_WIDTH: 300, // Minimum viewport canvas width
}

// === TIMING CONSTANTS ===
/**
 * Timing constants for consistent animation and debounce behavior.
 * Use these instead of hardcoding millisecond values.
 * @type {Record<string, number>}
 */
export const TIMING = {
  DEBOUNCE_MS: 150, // Standard debounce delay
  ANIMATION_FAST: 150, // Fast transitions (hover states)
  ANIMATION_NORMAL: 200, // Normal transitions
  POLL_INTERVAL_MS: 5000, // Default polling interval
  AUTOSAVE_DELAY_MS: 2000, // Delay before autosave triggers
}

// === CANVAS DEFAULTS ===
/**
 * Canvas viewport defaults for the 2D World Builder.
 * Used by Canvas2DViewport during initialization.
 *
 * Properties:
 * - GRID_SIZE/gridSize: Size of one grid cell in pixels (world units * gridSize = screen pixels)
 * - ROOM_SIZE/roomSize: Visual size of room rectangles in pixels
 * - MIN_ZOOM/MAX_ZOOM: Zoom level bounds (1.0 = 100%)
 * - ZOOM_STEP: Zoom increment per scroll wheel tick
 * - snapSize: Grid snap size in pixels (for Shift+drag snapping)
 *
 * @type {Record<string, number>}
 * @see assets/js/world_builder/Canvas2DViewport.js
 */
export const CANVAS_DEFAULTS = {
  // SCREAMING_CASE for new code
  GRID_SIZE: 60, // Pixels per grid cell
  ROOM_SIZE: 50, // Room square size in pixels
  MIN_ZOOM: 0.25, // Minimum zoom level
  MAX_ZOOM: 2.0, // Maximum zoom level
  ZOOM_STEP: 0.1, // Zoom increment per scroll
  // camelCase aliases for backward compatibility
  gridSize: 60,
  roomSize: 48,
  minZoom: 0.2,
  maxZoom: 3,
  snapSize: 60,
}

// === FALLBACK COLORS ===
// The following color constants are fallbacks for Canvas2D rendering
// when CSS variables are unavailable (e.g., before DOM ready, in tests)

/**
 * Color value as a CSS hex string (e.g., '#4a9eff').
 * @typedef {string} HexColor
 */

/**
 * Exit direction colors for the canvas viewport.
 * Used by Canvas2DViewport when CSS variables (--wb-viewport-exit-*) are unavailable.
 *
 * Each cardinal and ordinal direction has a distinct color for visual differentiation.
 * The 'default' key is used for custom/unknown exit directions.
 *
 * @type {Record<string, HexColor>}
 * @see assets/css/variables.css (--wb-viewport-exit-*)
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
 * Used by Canvas2DViewport when CSS variables (--wb-viewport-room-*) are unavailable.
 *
 * States:
 * - default: Normal room, not selected
 * - selected: Single-selected room (primary selection)
 * - multiSelected: Part of multi-selection (Shift+click or Cmd+click)
 * - error: Room has validation errors
 * - warning: Room has validation warnings
 *
 * @type {Record<string, HexColor>}
 * @see assets/css/variables.css (--wb-viewport-room-*)
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
 * Used by Canvas2DViewport when CSS variables (--wb-viewport-*) are unavailable.
 *
 * Includes colors for:
 * - bg: Canvas background color
 * - grid/gridMajor: Grid line colors (minor and major/origin)
 * - snap/snapDim: Snap indicator colors (bright and dim)
 * - roomBorder*: Room border colors for various states
 * - roomText/roomKeyText: Text colors inside rooms
 *
 * @type {Record<string, HexColor>}
 * @see assets/css/variables.css (--wb-viewport-*)
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
 * Use these for consistent spacing in canvas rendering and tests.
 *
 * Scale: xs (4px) < sm (8px) < md (12px) < lg (16px)
 *
 * @type {Record<'xs' | 'sm' | 'md' | 'lg', number>}
 * @see assets/css/variables.css (--wb-space-*)
 */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
}

/**
 * Font sizes matching CSS tokens (--wb-font-size-*).
 * Scale: xs (smallest) -> sm -> base (normal) -> lg -> xl (largest)
 *
 * Values are in rem units for accessibility (respect user font size preferences).
 *
 * @type {Record<'xs' | 'sm' | 'base' | 'lg' | 'xl', string>}
 * @see assets/css/variables.css (--wb-font-size-*)
 */
export const FONT_SIZES = {
  xs: '0.7rem',
  sm: '0.78rem',
  base: '0.85rem',
  lg: '0.95rem',
  xl: '1.05rem',
}

/**
 * Border radius values matching CSS tokens (in pixels).
 * Scale: sm (3px) < md (5px) < lg (8px)
 *
 * @type {Record<'sm' | 'md' | 'lg', number>}
 * @see assets/css/variables.css (--wb-radius-*)
 */
export const BORDER_RADIUS = {
  sm: 3,
  md: 5,
  lg: 8,
}

/**
 * Z-index hierarchy matching CSS tokens.
 * Higher values appear above lower values in the stacking context.
 *
 * Hierarchy: toolbar (10) < panel (20) < dropdown (50) < modal (100) < overlay (1000)
 *
 * @type {Record<'toolbar' | 'panel' | 'dropdown' | 'modal' | 'overlay', number>}
 * @see assets/css/variables.css (--wb-z-*)
 */
export const Z_INDEX = {
  toolbar: 10,
  panel: 20,
  dropdown: 50,
  modal: 100,
  overlay: 1000,
}
