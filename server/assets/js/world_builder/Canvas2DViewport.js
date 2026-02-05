/**
 * Canvas2DViewport - 2D World Builder Viewport (Orchestrator)
 *
 * Public API for the viewport. Manages state, coordinate transforms,
 * camera controls, and delegates rendering and interaction to
 * Canvas2DRenderer and Canvas2DInteraction respectively.
 *
 * Reads colors from CSS variables at construction time with hardcoded fallbacks.
 * Uses `this.exitColors`, `this.roomColors`, `this.viewportColors` instance properties.
 *
 * @example
 * ```js
 * const viewport = new Canvas2DViewport(canvasElement, {
 *   onSelectRoom: (key) => console.log('Selected:', key),
 *   onMoveRoom: (key, x, y) => pushEvent('move_room', { key, x, y }),
 *   onBatchSelect: (keys) => console.log('Batch selected:', keys)
 * })
 *
 * // Update data
 * viewport.setRooms(roomsArray)
 * viewport.setSelectedRoom('room_key')
 *
 * // Camera controls
 * viewport.centerOnRoom('room_key')
 * viewport.fitToRooms()
 *
 * // Cleanup
 * viewport.destroy()
 * ```
 */

/**
 * Camera state for viewport positioning and zoom.
 * @typedef {Object} CameraState
 * @property {number} x - Camera X offset in world units
 * @property {number} y - Camera Y offset in world units
 * @property {number} zoom - Zoom level (1.0 = 100%)
 */

/**
 * A room object with position and metadata.
 * @typedef {Object} Room
 * @property {string} key - Unique room identifier
 * @property {string} [id] - Optional alternative identifier
 * @property {number} [x=0] - X position in world grid units
 * @property {number} [y=0] - Y position in world grid units
 * @property {number} [z=0] - Z level (floor/layer)
 * @property {string} [name] - Display name
 * @property {Object} [exits] - Exit connections to other rooms
 */

/**
 * Screen/world coordinate pair.
 * @typedef {Object} Point
 * @property {number} x - X coordinate
 * @property {number} y - Y coordinate
 */

/**
 * Color configuration for exit directions.
 * @typedef {Object} ExitColors
 * @property {string} north - North exit color
 * @property {string} south - South exit color
 * @property {string} east - East exit color
 * @property {string} west - West exit color
 * @property {string} up - Up exit color
 * @property {string} down - Down exit color
 * @property {string} northeast - Northeast exit color
 * @property {string} northwest - Northwest exit color
 * @property {string} southeast - Southeast exit color
 * @property {string} southwest - Southwest exit color
 * @property {string} default - Default exit color for unknown directions
 */

/**
 * Color configuration for room states.
 * @typedef {Object} RoomColors
 * @property {string} default - Default room fill color
 * @property {string} selected - Selected room fill color
 * @property {string} multiSelected - Multi-selected room fill color
 * @property {string} error - Room with error fill color
 * @property {string} warning - Room with warning fill color
 */

/**
 * Color configuration for viewport elements.
 * @typedef {Object} ViewportColors
 * @property {string} bg - Background color
 * @property {string} grid - Grid line color
 * @property {string} gridMajor - Major grid line color
 * @property {string} snap - Snap indicator color
 * @property {string} snapDim - Dimmed snap indicator color
 * @property {string} roomBorder - Default room border color
 * @property {string} roomBorderMulti - Multi-selected room border color
 * @property {string} roomBorderError - Error room border color
 * @property {string} roomBorderWarning - Warning room border color
 * @property {string} roomText - Room label text color
 * @property {string} roomKeyText - Room key text color
 */

/**
 * Viewport constructor options.
 * @typedef {Object} ViewportOptions
 * @property {function(string): void} [onSelectRoom] - Called when a room is selected
 * @property {function(Set<string>): void} [onBatchSelect] - Called when multiple rooms are selected
 * @property {function(string, number, number): void} [onMoveRoom] - Called when a room is moved (key, x, y)
 */

import { Canvas2DRenderer } from './Canvas2DRenderer.js'
import { Canvas2DInteraction } from './Canvas2DInteraction.js'

export default class Canvas2DViewport {
  /**
   * Creates a new Canvas2DViewport instance.
   * @param {HTMLCanvasElement} canvas - The canvas element to render to
   * @param {ViewportOptions} [options={}] - Viewport configuration options
   */
  constructor(canvas, options = {}) {
    /** @type {HTMLCanvasElement} */
    this.canvas = canvas
    /** @type {CanvasRenderingContext2D} */
    this.ctx = canvas.getContext('2d')

    // Read colors from CSS variables (with hardcoded fallbacks for canvas rendering)
    const styles = getComputedStyle(document.documentElement)
    /**
     * Helper to read CSS variable with fallback.
     * @param {string} name - CSS variable name
     * @param {string} fallback - Fallback value if not defined
     * @returns {string} The CSS variable value or fallback
     */
    const v = (name, fallback) => styles.getPropertyValue(name).trim() || fallback

    /** @type {ExitColors} */
    this.exitColors = {
      north: v('--wb-viewport-exit-north', '#4a9eff'),
      south: v('--wb-viewport-exit-south', '#ff4a9e'),
      east: v('--wb-viewport-exit-east', '#4aff9e'),
      west: v('--wb-viewport-exit-west', '#ff9e4a'),
      up: v('--wb-viewport-exit-up', '#9e4aff'),
      down: v('--wb-viewport-exit-down', '#ffff4a'),
      northeast: v('--wb-viewport-exit-ne', '#4affff'),
      northwest: v('--wb-viewport-exit-nw', '#ff4aff'),
      southeast: v('--wb-viewport-exit-se', '#4affaa'),
      southwest: v('--wb-viewport-exit-sw', '#ffaa4a'),
      default: v('--wb-viewport-exit-default', '#888888'),
    }

    /** @type {RoomColors} */
    this.roomColors = {
      default: v('--wb-viewport-room-default', '#7eb3ff'),
      selected: v('--wb-viewport-room-selected', '#4a9eff'),
      multiSelected: v('--wb-viewport-room-multi', '#ffaa00'),
      error: v('--wb-viewport-room-error', '#ff6b6b'),
      warning: v('--wb-viewport-room-warning', '#ffd93d'),
    }

    /** @type {ViewportColors} */
    this.viewportColors = {
      bg: v('--wb-viewport-bg', '#1a1a2e'),
      grid: v('--wb-viewport-grid', '#333344'),
      gridMajor: v('--wb-viewport-grid-major', '#555566'),
      snap: v('--wb-viewport-snap', '#00ff88'),
      snapDim: v('--wb-viewport-snap-dim', '#00ff8844'),
      roomBorder: v('--wb-viewport-room-border', '#ffffff'),
      roomBorderMulti: v('--wb-viewport-room-border-multi', '#ff8800'),
      roomBorderError: v('--wb-viewport-room-border-error', '#ff0000'),
      roomBorderWarning: v('--wb-viewport-room-border-warning', '#ffaa00'),
      roomText: v('--wb-viewport-room-text', '#ffffff'),
      roomKeyText: v('--wb-viewport-room-key-text', '#888888'),
    }

    // Camera state
    /** @type {CameraState} */
    this.camera = {
      x: 0,
      y: 0,
      zoom: 1
    }

    // Grid settings
    /** @type {number} Grid cell size in pixels */
    this.gridSize = 60
    /** @type {number} Room visual size in pixels */
    this.roomSize = 48
    /** @type {number} Minimum zoom level */
    this.minZoom = 0.2
    /** @type {number} Maximum zoom level */
    this.maxZoom = 3
    /** @type {boolean} Whether to show the grid */
    this.showGrid = true
    /** @type {number} Snap grid size for room placement */
    this.snapSize = 60

    // Data
    /** @type {Room[]} */
    this.rooms = []
    /** @type {Map<string, Room>} Room lookup by key or id */
    this.roomsByKey = new Map()
    /** @type {Object<string, {errors?: string[], warnings?: string[]}>} Validation results by room key */
    this.validation = {}
    /** @type {string|null} Currently selected room key */
    this.selectedRoom = null
    /** @type {Set<string>} Set of multi-selected room keys */
    this.selectedKeys = new Set()
    /** @type {number} Current Z level being viewed */
    this.currentZLevel = 0
    /** @type {boolean} Whether to show ghost layers (adjacent Z levels) */
    this.showGhostLayers = true

    // Zone visualization
    /** @type {Object<string, string>} Zone colors by zone key */
    this.zoneColors = {}
    /** @type {Object<string, string>} Room to zone mapping */
    this.roomZoneMap = {}
    /** @type {boolean} Whether to show zone colors on rooms */
    this.showZoneColors = true

    // NPC path visualization
    /** @type {Object<string, {rooms: string[], color: string}>} NPC paths by NPC key */
    this.npcPaths = {}
    /** @type {boolean} Whether to show NPC paths */
    this.showNPCPaths = true

    // Callbacks
    /** @type {function(string): void} */
    this.onSelectRoom = options.onSelectRoom || (() => {})
    /** @type {function(Set<string>): void} */
    this.onBatchSelect = options.onBatchSelect || (() => {})
    /** @type {function(string, number, number): void} */
    this.onMoveRoom = options.onMoveRoom || (() => {})

    // Create renderer with a state accessor
    /** @type {Canvas2DRenderer} */
    this.renderer = new Canvas2DRenderer(this.ctx, () => this._getRendererState())

    // Create interaction handler
    /** @type {Canvas2DInteraction} */
    this.interaction = new Canvas2DInteraction(canvas, this)

    // Internal state
    /** @type {boolean} */
    this._renderPending = false
    /** @type {number|null} */
    this._renderRAF = null
    /** @type {number} Canvas width in CSS pixels */
    this.width = 0
    /** @type {number} Canvas height in CSS pixels */
    this.height = 0
    /** @type {number[]} Available Z levels */
    this.zLevels = [0]

    // Setup
    this.setupCanvas()
    this.interaction.attach()
    this.startRenderLoop()
  }

  // ============================================================================
  // State accessor for renderer
  // ============================================================================

  /**
   * Creates a state snapshot for the renderer.
   * @private
   * @returns {Object} State object containing all data needed for rendering
   */
  _getRendererState() {
    return {
      camera: this.camera,
      rooms: this.rooms,
      roomsByKey: this.roomsByKey,
      selectedRoom: this.selectedRoom,
      selectedKeys: this.selectedKeys,
      validation: this.validation,
      zoneColors: this.zoneColors,
      roomZoneMap: this.roomZoneMap,
      showZoneColors: this.showZoneColors,
      npcPaths: this.npcPaths,
      showNPCPaths: this.showNPCPaths,
      snapIndicator: this.interaction.snapIndicator,
      isDraggingRoom: this.interaction.isDraggingRoom,
      showGrid: this.showGrid,
      showGhostLayers: this.showGhostLayers,
      currentZLevel: this.currentZLevel,
      gridSize: this.gridSize,
      roomSize: this.roomSize,
      width: this.width,
      height: this.height,
      minZoom: this.minZoom,
      maxZoom: this.maxZoom,
      exitColors: this.exitColors,
      roomColors: this.roomColors,
      viewportColors: this.viewportColors,
      worldToScreen: this.worldToScreen.bind(this),
      screenToWorld: this.screenToWorld.bind(this),
    }
  }

  // ============================================================================
  // Setup
  // ============================================================================

  /**
   * Initialize canvas dimensions accounting for device pixel ratio.
   * Should be called on mount and when canvas is resized.
   * @returns {void}
   */
  setupCanvas() {
    const dpr = window.devicePixelRatio || 1
    const rect = this.canvas.getBoundingClientRect()

    this.canvas.width = rect.width * dpr
    this.canvas.height = rect.height * dpr
    this.ctx.scale(dpr, dpr)

    this.width = rect.width
    this.height = rect.height
  }

  /**
   * Batch multiple data updates into a single render frame.
   * Uses requestAnimationFrame to coalesce rapid updates.
   * @returns {void}
   */
  scheduleRender() {
    if (!this._renderPending) {
      this._renderPending = true
      this._renderRAF = requestAnimationFrame(() => {
        this._renderPending = false
        this._renderRAF = null
        this.render()
      })
    }
  }

  /**
   * Start the initial render.
   * @returns {void}
   */
  startRenderLoop() {
    this.render()
  }

  /**
   * Render the viewport immediately.
   * @returns {void}
   */
  render() {
    this.renderer.render()
  }

  /**
   * Clean up resources and detach event handlers.
   * Should be called when the viewport is being destroyed.
   * @returns {void}
   */
  destroy() {
    // Cancel pending render
    if (this._renderRAF) {
      cancelAnimationFrame(this._renderRAF)
      this._renderRAF = null
    }

    // Detach interaction handlers
    this.interaction.detach()
  }

  // ============================================================================
  // Data Updates
  // ============================================================================

  /**
   * Update the rooms data and rebuild lookup maps.
   * Auto-detects Z-levels from room data.
   * @param {Room[]} rooms - Array of room objects
   * @returns {void}
   */
  setRooms(rooms) {
    this.rooms = rooms || []
    this.roomsByKey.clear()
    this.rooms.forEach(room => {
      this.roomsByKey.set(room.key, room)
      if (room.id) {
        this.roomsByKey.set(room.id, room)
      }
    })

    // Auto-detect Z-levels
    this.zLevels = [...new Set(this.rooms.map(r => r.z || 0))].sort((a, b) => a - b)
    if (this.zLevels.length > 0 && !this.zLevels.includes(this.currentZLevel)) {
      this.currentZLevel = this.zLevels[0]
    }

    this.scheduleRender()
  }

  /**
   * Update validation results for rooms.
   * @param {Object<string, {errors?: string[], warnings?: string[]}>} validation - Validation results by room key
   * @returns {void}
   */
  setValidation(validation) {
    this.validation = validation || {}
    this.scheduleRender()
  }

  /**
   * Set the currently selected room.
   * @param {string|null} key - Room key to select, or null to deselect
   * @returns {void}
   */
  setSelectedRoom(key) {
    this.selectedRoom = key
    this.scheduleRender()
  }

  /**
   * Set the multi-selected room keys.
   * @param {string[]|null} keys - Array of room keys, or null/empty to clear
   * @returns {void}
   */
  setSelectedKeys(keys) {
    this.selectedKeys = new Set(keys || [])
    this.scheduleRender()
  }

  /**
   * Set the current Z level (floor/layer) to display.
   * @param {number} level - Z level to display
   * @returns {void}
   */
  setZLevel(level) {
    this.currentZLevel = level
    this.scheduleRender()
  }

  /**
   * Set zone colors for zone visualization.
   * @param {Object<string, string>} colors - Zone colors by zone key
   * @returns {void}
   */
  setZoneColors(colors) {
    this.zoneColors = colors || {}
    this.scheduleRender()
  }

  /**
   * Set the room-to-zone mapping.
   * @param {Object<string, string>} map - Room key to zone key mapping
   * @returns {void}
   */
  setRoomZoneMap(map) {
    this.roomZoneMap = map || {}
    this.scheduleRender()
  }

  /**
   * Toggle zone color visualization.
   * @param {boolean} show - Whether to show zone colors
   * @returns {void}
   */
  setShowZoneColors(show) {
    this.showZoneColors = show
    this.scheduleRender()
  }

  /**
   * Set NPC paths for visualization.
   * @param {Object<string, {rooms: string[], color: string}>} paths - NPC paths by NPC key
   * @returns {void}
   */
  setNPCPaths(paths) {
    this.npcPaths = paths || {}
    this.scheduleRender()
  }

  /**
   * Toggle NPC path visualization.
   * @param {boolean} show - Whether to show NPC paths
   * @returns {void}
   */
  setShowNPCPaths(show) {
    this.showNPCPaths = show
    this.scheduleRender()
  }

  /**
   * Set grid visibility.
   * @param {boolean} show - Whether to show the grid
   * @returns {void}
   */
  setShowGrid(show) {
    this.showGrid = show
    this.scheduleRender()
  }

  /**
   * Toggle grid visibility and immediately render.
   * @returns {void}
   */
  toggleGrid() {
    this.showGrid = !this.showGrid
    this.render()
  }

  // ============================================================================
  // Coordinate Transforms
  // ============================================================================

  /**
   * Convert world grid coordinates to screen pixel coordinates.
   * @param {number} worldX - X position in world grid units
   * @param {number} worldY - Y position in world grid units
   * @returns {Point} Screen coordinates in pixels
   */
  worldToScreen(worldX, worldY) {
    const screenX = (worldX * this.gridSize + this.camera.x) * this.camera.zoom + this.width / 2
    const screenY = (worldY * this.gridSize + this.camera.y) * this.camera.zoom + this.height / 2
    return { x: screenX, y: screenY }
  }

  /**
   * Convert screen pixel coordinates to world grid coordinates.
   * @param {number} screenX - X position in screen pixels
   * @param {number} screenY - Y position in screen pixels
   * @returns {Point} World coordinates in grid units
   */
  screenToWorld(screenX, screenY) {
    const worldX = ((screenX - this.width / 2) / this.camera.zoom - this.camera.x) / this.gridSize
    const worldY = ((screenY - this.height / 2) / this.camera.zoom - this.camera.y) / this.gridSize
    return { x: worldX, y: worldY }
  }

  // ============================================================================
  // Hit Testing
  // ============================================================================

  /**
   * Find the room at the given screen coordinates.
   * Checks current Z level first, then adjacent levels if ghost layers are enabled.
   * @param {number} screenX - X position in screen pixels
   * @param {number} screenY - Y position in screen pixels
   * @returns {Room|null} The room at the point, or null if none found
   */
  getRoomAtPoint(screenX, screenY) {
    const world = this.screenToWorld(screenX, screenY)
    const halfSize = (this.roomSize / 2) / this.gridSize

    // Check rooms at current Z level first, then adjacent levels
    const levelsToCheck = [this.currentZLevel]
    if (this.showGhostLayers) {
      if (this.zLevels && this.zLevels.includes(this.currentZLevel - 1)) levelsToCheck.push(this.currentZLevel - 1)
      if (this.zLevels && this.zLevels.includes(this.currentZLevel + 1)) levelsToCheck.push(this.currentZLevel + 1)
    }

    for (const zLevel of levelsToCheck) {
      for (const room of this.rooms) {
        if ((room.z || 0) !== zLevel) continue

        const rx = room.x || 0
        const ry = room.y || 0

        if (world.x >= rx - halfSize && world.x <= rx + halfSize &&
            world.y >= ry - halfSize && world.y <= ry + halfSize) {
          return room
        }
      }
    }

    return null
  }

  // ============================================================================
  // Camera Controls
  // ============================================================================

  /**
   * Center the camera on a specific room.
   * Also switches to the room's Z level.
   * @param {string} roomKey - The key of the room to center on
   * @returns {void}
   */
  centerOnRoom(roomKey) {
    const room = this.roomsByKey.get(roomKey)
    if (!room) return

    this.camera.x = -(room.x || 0) * this.gridSize
    this.camera.y = -(room.y || 0) * this.gridSize
    this.currentZLevel = room.z || 0
    this.render()
  }

  /**
   * Fit the camera to show all rooms at the current Z level.
   * Calculates bounding box and adjusts zoom to fit.
   * @returns {void}
   */
  fitToRooms() {
    if (this.rooms.length === 0) return

    const currentRooms = this.rooms.filter(r => (r.z || 0) === this.currentZLevel)
    if (currentRooms.length === 0) return

    // Find bounding box
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity

    for (const room of currentRooms) {
      const x = room.x || 0
      const y = room.y || 0
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }

    // Calculate center and required zoom
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const rangeX = (maxX - minX + 2) * this.gridSize
    const rangeY = (maxY - minY + 2) * this.gridSize

    this.camera.x = -centerX * this.gridSize
    this.camera.y = -centerY * this.gridSize
    this.camera.zoom = Math.min(
      this.width / rangeX,
      this.height / rangeY,
      1.5
    )
    this.camera.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.camera.zoom))
    this.renderer.clearTruncateCache()

    this.render()
  }

  /**
   * Reset camera to origin with default zoom.
   * @returns {void}
   */
  resetCamera() {
    this.camera = { x: 0, y: 0, zoom: 1 }
    this.renderer.clearTruncateCache()
    this.render()
  }

  /**
   * Get all available Z levels from the room data.
   * @returns {number[]} Sorted array of Z levels
   */
  getZLevels() {
    return this.zLevels || [0]
  }

  // ============================================================================
  // Backward compatibility - expose internal state for tests
  // ============================================================================

  /**
   * Access renderer's truncate cache (for testing).
   * @type {Map<string, string>}
   */
  get _truncateCache() {
    return this.renderer._truncateCache
  }

  /**
   * Access interaction handler's resize observer (for testing).
   * @type {ResizeObserver}
   */
  get resizeObserver() {
    return this.interaction.resizeObserver
  }
}
