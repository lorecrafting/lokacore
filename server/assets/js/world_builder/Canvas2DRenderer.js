/**
 * @file Canvas2DRenderer - Rendering engine for the 2D World Builder Viewport
 * @context
 *   - Handles all drawing/rendering: grid, rooms, exits, NPC paths, ghost layers,
 *     snap indicators, entity indicators, and text truncation
 *   - Extracted from Canvas2DViewport for separation of concerns
 *   - Receives state via getState() callback to avoid circular dependencies
 *   - Uses memoized text truncation to optimize measureText calls
 * @related
 *   - assets/js/world_builder/Canvas2DViewport.js (orchestrator, owns state)
 *   - assets/js/world_builder/Canvas2DInteraction.js (mouse/keyboard handling)
 *   - assets/css/variables.css (CSS variable definitions for colors)
 */

/**
 * @typedef {import('./Canvas2DViewport.js').Room} Room
 * @typedef {import('./Canvas2DViewport.js').Point} Point
 * @typedef {import('./Canvas2DViewport.js').CameraState} CameraState
 * @typedef {import('./Canvas2DViewport.js').ExitColors} ExitColors
 * @typedef {import('./Canvas2DViewport.js').RoomColors} RoomColors
 * @typedef {import('./Canvas2DViewport.js').ViewportColors} ViewportColors
 */

/**
 * State object provided by the viewport via getState() callback.
 * @typedef {Object} RendererState
 * @property {CameraState} camera - Current camera position and zoom
 * @property {Room[]} rooms - All rooms in the world
 * @property {Map<string, Room>} roomsByKey - Room lookup by key or id
 * @property {string|null} selectedRoom - Currently selected room key
 * @property {Set<string>} selectedKeys - Multi-selected room keys
 * @property {Object<string, {status?: string, errors?: string[], warnings?: string[]}>} validation - Validation results by room key
 * @property {Object<string, string>} zoneColors - Zone colors by zone key
 * @property {Object<string, string>} roomZoneMap - Room to zone mapping
 * @property {boolean} showZoneColors - Whether to show zone colors
 * @property {Object<string, {patrol?: {route: string[], loop?: boolean}}>} npcPaths - NPC paths by NPC key
 * @property {boolean} showNPCPaths - Whether to show NPC paths
 * @property {Point|null} snapIndicator - Current snap indicator position
 * @property {boolean} isDraggingRoom - Whether a room is being dragged
 * @property {boolean} showGrid - Whether to show the grid
 * @property {boolean} showGhostLayers - Whether to show ghost layers
 * @property {number} currentZLevel - Current Z level being viewed
 * @property {number} gridSize - Grid cell size in pixels
 * @property {number} roomSize - Room visual size in pixels
 * @property {number} width - Canvas width in CSS pixels
 * @property {number} height - Canvas height in CSS pixels
 * @property {number} minZoom - Minimum zoom level
 * @property {number} maxZoom - Maximum zoom level
 * @property {ExitColors} exitColors - Exit direction colors
 * @property {RoomColors} roomColors - Room state colors
 * @property {ViewportColors} viewportColors - Viewport element colors
 * @property {function(number, number): Point} worldToScreen - Convert world to screen coords
 * @property {function(number, number): Point} screenToWorld - Convert screen to world coords
 */

// Direction offsets for exit arrow positioning
const _DIRECTION_OFFSETS = {
  north: { dx: 0, dy: -1 },
  south: { dx: 0, dy: 1 },
  east: { dx: 1, dy: 0 },
  west: { dx: -1, dy: 0 },
  northeast: { dx: 1, dy: -1 },
  northwest: { dx: -1, dy: -1 },
  southeast: { dx: 1, dy: 1 },
  southwest: { dx: -1, dy: 1 },
  up: { dx: 0, dy: 0 },
  down: { dx: 0, dy: 0 },
}

// Rendering constants
const RENDERING = {
  // Font sizes (in px, scaled by zoom)
  FONT_SIZE_ROOM_NAME: 11,
  FONT_SIZE_ROOM_KEY: 9,
  FONT_SIZE_INDICATOR: 10,

  // Zoom thresholds for label visibility
  ZOOM_SHOW_LABELS: 0.5,
  ZOOM_SHOW_DETAILED: 0.8,

  // Origin crosshair size (in world units)
  ORIGIN_CROSSHAIR_SIZE: 10,

  // Truncation cache limit
  TRUNCATE_CACHE_MAX: 500,

  // Room label offsets (in px, scaled by zoom)
  LABEL_TOP_OFFSET: 5,
  LABEL_KEY_OFFSET: 18,
  VERTICAL_INDICATOR_OFFSET: 8,
  VERTICAL_ARROW_SPACING: 6,

  // Entity indicator offset
  ENTITY_INDICATOR_TOP: 5,
  ENTITY_INDICATOR_SPACING: 2,
}

// Colors used in rendering (not from CSS theme - internal to canvas)
const RENDER_COLORS = {
  EXIT_ARROW: '#666677',
  NPC_INDICATOR: '#8B5CF6',
  ITEM_INDICATOR: '#EAB308',
  // NPC path palette (distinct colors for different paths)
  PATH_PALETTE: [
    '#ff6b6b',
    '#4ecdc4',
    '#45b7d1',
    '#96ceb4',
    '#ffeaa7',
    '#dfe6e9',
    '#fd79a8',
    '#a29bfe',
  ],
}

export class Canvas2DRenderer {
  /**
   * Creates a new Canvas2DRenderer instance.
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D rendering context
   * @param {function(): RendererState} getState - Callback that returns current viewport state
   */
  constructor(ctx, getState) {
    /** @type {CanvasRenderingContext2D} */
    this.ctx = ctx
    /** @type {function(): RendererState} */
    this.getState = getState

    /**
     * Text truncation memoization cache (cleared on zoom changes).
     * @type {Map<string, string>}
     * @private
     */
    this._truncateCache = new Map()
  }

  /**
   * Clear the text truncation cache.
   * Should be called when zoom changes to recalculate truncated text.
   * @returns {void}
   */
  clearTruncateCache() {
    this._truncateCache.clear()
  }

  /**
   * Get the current size of the truncation cache (for testing/debugging).
   * @type {number}
   */
  get truncateCacheSize() {
    return this._truncateCache.size
  }

  // ============================================================================
  // Main Render
  // ============================================================================

  /**
   * Render the complete viewport.
   * Draws background, grid, ghost layers, NPC paths, exits, rooms, and snap indicator.
   * @returns {void}
   */
  render() {
    const ctx = this.ctx
    const state = this.getState()

    // Clear canvas
    ctx.fillStyle = state.viewportColors.bg
    ctx.fillRect(0, 0, state.width, state.height)

    // Save context for camera transform
    ctx.save()

    // Apply camera transform
    ctx.translate(state.width / 2, state.height / 2)
    ctx.scale(state.camera.zoom, state.camera.zoom)
    ctx.translate(state.camera.x, state.camera.y)

    // Draw grid (if visible)
    if (state.showGrid) {
      this.drawGrid(ctx, state)
    }

    // Draw ghost rooms (adjacent Z-levels)
    if (state.showGhostLayers) {
      this.drawRoomsAtZLevel(ctx, state, state.currentZLevel - 1, 0.2)
      this.drawRoomsAtZLevel(ctx, state, state.currentZLevel + 1, 0.2)
    }

    // Draw NPC patrol paths (before rooms so they're under)
    if (state.showNPCPaths) {
      this.drawNPCPaths(ctx, state)
    }

    // Draw exits for current Z-level
    this.drawExits(ctx, state)

    // Draw rooms at current Z-level
    this.drawRoomsAtZLevel(ctx, state, state.currentZLevel, 1.0)

    // Draw snap indicator if snapping
    if (state.snapIndicator && state.isDraggingRoom) {
      this.drawSnapIndicator(ctx, state)
    }

    // Restore context
    ctx.restore()
  }

  // ============================================================================
  // Grid
  // ============================================================================

  /**
   * Draw the background grid with origin crosshair.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {RendererState} state - Current viewport state
   * @returns {void}
   */
  drawGrid(ctx, state) {
    ctx.strokeStyle = state.viewportColors.grid
    ctx.lineWidth = 1 / state.camera.zoom

    // Calculate visible area in world coordinates
    const topLeft = state.screenToWorld(0, 0)
    const bottomRight = state.screenToWorld(state.width, state.height)

    const startX = Math.floor(topLeft.x) - 1
    const endX = Math.ceil(bottomRight.x) + 1
    const startY = Math.floor(topLeft.y) - 1
    const endY = Math.ceil(bottomRight.y) + 1

    ctx.beginPath()

    // Vertical lines
    for (let x = startX; x <= endX; x++) {
      const screenX = x * state.gridSize
      ctx.moveTo(screenX, startY * state.gridSize)
      ctx.lineTo(screenX, endY * state.gridSize)
    }

    // Horizontal lines
    for (let y = startY; y <= endY; y++) {
      const screenY = y * state.gridSize
      ctx.moveTo(startX * state.gridSize, screenY)
      ctx.lineTo(endX * state.gridSize, screenY)
    }

    ctx.stroke()

    // Draw origin marker
    ctx.strokeStyle = state.viewportColors.gridMajor
    ctx.lineWidth = 2 / state.camera.zoom
    ctx.beginPath()
    ctx.moveTo(-RENDERING.ORIGIN_CROSSHAIR_SIZE, 0)
    ctx.lineTo(RENDERING.ORIGIN_CROSSHAIR_SIZE, 0)
    ctx.moveTo(0, -RENDERING.ORIGIN_CROSSHAIR_SIZE)
    ctx.lineTo(0, RENDERING.ORIGIN_CROSSHAIR_SIZE)
    ctx.stroke()
  }

  // ============================================================================
  // NPC Paths
  // ============================================================================

  /**
   * Draw NPC patrol paths as dashed lines between rooms.
   * Each NPC gets a distinct color from the palette.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {RendererState} state - Current viewport state
   * @returns {void}
   */
  drawNPCPaths(ctx, state) {
    let colorIndex = 0

    for (const [_npcKey, pathInfo] of Object.entries(state.npcPaths)) {
      if (!pathInfo.patrol || !pathInfo.patrol.route) continue

      const route = pathInfo.patrol.route
      if (route.length < 2) continue

      // Get color for this NPC's path
      const color = RENDER_COLORS.PATH_PALETTE[colorIndex % RENDER_COLORS.PATH_PALETTE.length]
      colorIndex++

      // Draw the patrol path as a curved line connecting rooms
      ctx.save()
      ctx.strokeStyle = color
      ctx.lineWidth = 3 / state.camera.zoom
      ctx.setLineDash([8 / state.camera.zoom, 4 / state.camera.zoom])
      ctx.globalAlpha = 0.7

      // Build path through rooms
      ctx.beginPath()
      let started = false

      for (let i = 0; i < route.length; i++) {
        const roomKey = route[i]
        const room = state.roomsByKey.get(roomKey)
        if (!room) continue

        // Only draw rooms at current Z-level
        if ((room.z || 0) !== state.currentZLevel) continue

        const x = (room.x || 0) * state.gridSize
        const y = (room.y || 0) * state.gridSize

        if (!started) {
          ctx.moveTo(x, y)
          started = true
        } else {
          ctx.lineTo(x, y)
        }
      }

      // If loop mode, connect back to start
      if (pathInfo.patrol.loop !== false && route.length >= 2) {
        const startRoom = state.roomsByKey.get(route[0])
        if (startRoom && (startRoom.z || 0) === state.currentZLevel) {
          const x = (startRoom.x || 0) * state.gridSize
          const y = (startRoom.y || 0) * state.gridSize
          ctx.lineTo(x, y)
        }
      }

      ctx.stroke()

      // Draw direction arrows
      this.drawPathArrows(ctx, state, route, color)

      ctx.restore()
    }
  }

  /**
   * Draw directional arrows along an NPC patrol path.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {RendererState} state - Current viewport state
   * @param {string[]} route - Array of room keys in patrol order
   * @param {string} color - Arrow fill color
   * @returns {void}
   */
  drawPathArrows(ctx, state, route, color) {
    ctx.fillStyle = color
    ctx.globalAlpha = 0.8

    for (let i = 0; i < route.length - 1; i++) {
      const fromRoom = state.roomsByKey.get(route[i])
      const toRoom = state.roomsByKey.get(route[i + 1])

      if (!fromRoom || !toRoom) continue
      if ((fromRoom.z || 0) !== state.currentZLevel) continue
      if ((toRoom.z || 0) !== state.currentZLevel) continue

      const fromX = (fromRoom.x || 0) * state.gridSize
      const fromY = (fromRoom.y || 0) * state.gridSize
      const toX = (toRoom.x || 0) * state.gridSize
      const toY = (toRoom.y || 0) * state.gridSize

      // Draw arrow at midpoint
      const midX = (fromX + toX) / 2
      const midY = (fromY + toY) / 2
      const angle = Math.atan2(toY - fromY, toX - fromX)
      const arrowSize = 8 / state.camera.zoom

      ctx.save()
      ctx.translate(midX, midY)
      ctx.rotate(angle)

      ctx.beginPath()
      ctx.moveTo(arrowSize, 0)
      ctx.lineTo(-arrowSize / 2, -arrowSize / 2)
      ctx.lineTo(-arrowSize / 2, arrowSize / 2)
      ctx.closePath()
      ctx.fill()

      ctx.restore()
    }
  }

  // ============================================================================
  // Exits
  // ============================================================================

  /**
   * Draw exit connections between rooms at the current Z level.
   * Skips up/down exits (shown as indicators instead).
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {RendererState} state - Current viewport state
   * @returns {void}
   */
  drawExits(ctx, state) {
    const currentRooms = state.rooms.filter((r) => (r.z || 0) === state.currentZLevel)

    for (const room of currentRooms) {
      const exits = room.exits || {}

      for (const [direction, destKey] of Object.entries(exits)) {
        // Skip up/down - shown as indicators instead
        if (direction === 'up' || direction === 'down') continue

        const destRoom = state.roomsByKey.get(destKey)
        if (!destRoom) continue

        // Only draw exits to rooms on same Z-level
        if ((destRoom.z || 0) !== state.currentZLevel) continue

        this.drawExitArrow(ctx, state, room, destRoom, direction)
      }
    }
  }

  /**
   * Draw a single exit connection line between two rooms.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {RendererState} state - Current viewport state
   * @param {Room} fromRoom - Source room
   * @param {Room} toRoom - Destination room
   * @param {string} direction - Exit direction (north, south, east, west, etc.)
   * @returns {void}
   */
  drawExitArrow(ctx, state, fromRoom, toRoom, _direction) {
    const fromX = (fromRoom.x || 0) * state.gridSize
    const fromY = (fromRoom.y || 0) * state.gridSize
    const toX = (toRoom.x || 0) * state.gridSize
    const toY = (toRoom.y || 0) * state.gridSize

    const color = RENDER_COLORS.EXIT_ARROW

    // Calculate start and end points (offset from room edges)
    const offset = state.roomSize / 2 + 2

    // Calculate direction to destination
    const dx = toX - fromX
    const dy = toY - fromY
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < 1) return // Rooms at same position

    // Normalize direction
    const ndx = dx / dist
    const ndy = dy / dist

    // Start from edge of source room, end at edge of dest room
    const startX = fromX + ndx * offset
    const startY = fromY + ndy * offset
    const endX = toX - ndx * offset
    const endY = toY - ndy * offset

    // Draw simple bar/line connecting rooms
    ctx.strokeStyle = color
    ctx.lineWidth = 3 / state.camera.zoom
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.lineTo(endX, endY)
    ctx.stroke()
  }

  // ============================================================================
  // Rooms
  // ============================================================================

  /**
   * Draw all rooms at a specific Z level with given opacity.
   * Used for both current level (opacity=1) and ghost layers (opacity=0.2).
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {RendererState} state - Current viewport state
   * @param {number} zLevel - Z level to draw
   * @param {number} opacity - Opacity value (0-1)
   * @returns {void}
   */
  drawRoomsAtZLevel(ctx, state, zLevel, opacity) {
    const roomsAtLevel = state.rooms.filter((r) => (r.z || 0) === zLevel)

    for (const room of roomsAtLevel) {
      this.drawRoom(ctx, state, room, opacity)
    }
  }

  /**
   * Draw a single room with name, key, entity indicators, and exit indicators.
   * Color is determined by selection state, validation status, or zone.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {RendererState} state - Current viewport state
   * @param {Room} room - Room to draw
   * @param {number} [opacity=1] - Opacity value (0-1)
   * @returns {void}
   */
  drawRoom(ctx, state, room, opacity = 1) {
    const x = (room.x || 0) * state.gridSize
    const y = (room.y || 0) * state.gridSize
    const size = state.roomSize
    const halfSize = size / 2

    // Determine room color
    let fillColor = state.roomColors.default
    let borderColor = state.viewportColors.roomBorder
    let borderWidth = 1

    const isSelected = state.selectedRoom === room.key
    const isMultiSelected = state.selectedKeys.has(room.key)
    const validationStatus = state.validation[room.key]?.status

    if (isSelected) {
      fillColor = state.roomColors.selected
      borderColor = state.viewportColors.roomBorder
      borderWidth = 3
    } else if (isMultiSelected) {
      fillColor = state.roomColors.multiSelected
      borderColor = state.viewportColors.roomBorderMulti
      borderWidth = 3
    } else if (validationStatus === 'error') {
      fillColor = state.roomColors.error
      borderColor = state.viewportColors.roomBorderError
      borderWidth = 2
    } else if (validationStatus === 'warning') {
      fillColor = state.roomColors.warning
      borderColor = state.viewportColors.roomBorderWarning
      borderWidth = 2
    } else if (state.showZoneColors) {
      // Use zone color if available
      const zoneKey = state.roomZoneMap[room.key]
      if (zoneKey && state.zoneColors[zoneKey]) {
        fillColor = state.zoneColors[zoneKey]
      }
    }

    ctx.globalAlpha = opacity

    // Draw room rectangle with rounded corners
    ctx.fillStyle = fillColor
    ctx.strokeStyle = borderColor
    ctx.lineWidth = borderWidth / state.camera.zoom

    this.roundRect(ctx, x - halfSize, y - halfSize, size, size, 6)
    ctx.fill()
    ctx.stroke()

    // Only show labels when zoomed in enough (avoid clutter when zoomed out)
    const showLabels = state.camera.zoom >= RENDERING.ZOOM_SHOW_LABELS
    const showDetailedLabels = state.camera.zoom >= RENDERING.ZOOM_SHOW_DETAILED

    if (showLabels) {
      // Draw room name inside the room (truncated to fit)
      const nameFontSize = RENDERING.FONT_SIZE_ROOM_NAME / state.camera.zoom
      const displayName = this.truncateText(room.name || room.key, size - 4, ctx, nameFontSize)
      ctx.fillStyle = state.viewportColors.roomText
      ctx.font = `bold ${nameFontSize}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(displayName, x, y - halfSize + RENDERING.LABEL_TOP_OFFSET)

      // Draw room key only when zoomed in more (smaller, below name)
      if (showDetailedLabels) {
        const keyFontSize = RENDERING.FONT_SIZE_ROOM_KEY / state.camera.zoom
        const displayKey = this.truncateText(room.key, size - 4, ctx, keyFontSize)
        ctx.fillStyle = state.viewportColors.roomKeyText
        ctx.font = `${keyFontSize}px monospace`
        ctx.fillText(displayKey, x, y - halfSize + RENDERING.LABEL_KEY_OFFSET)
      }

      // Draw entity indicators
      this.drawEntityIndicators(ctx, state, room, x, y, halfSize)

      // Draw up/down indicators
      this.drawVerticalExitIndicators(ctx, state, room, x, y, halfSize)
    }

    ctx.globalAlpha = 1
  }

  /**
   * Draw NPC and item indicators inside a room.
   * Shows emoji icons with count when more than 3.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {RendererState} state - Current viewport state
   * @param {Room} room - Room containing entities
   * @param {number} x - Room center X in world pixels
   * @param {number} y - Room center Y in world pixels
   * @param {number} halfSize - Half the room visual size
   * @returns {void}
   */
  drawEntityIndicators(ctx, state, room, x, y, _halfSize) {
    const spawns = room.spawns || {}
    const npcs = spawns.npcs || []
    const items = spawns.items || []

    if (npcs.length === 0 && items.length === 0) return

    const fontSize = RENDERING.FONT_SIZE_INDICATOR / state.camera.zoom
    ctx.font = `${fontSize}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    let offsetY = y + RENDERING.ENTITY_INDICATOR_TOP

    // NPC indicators
    if (npcs.length > 0) {
      ctx.fillStyle = RENDER_COLORS.NPC_INDICATOR
      const npcText =
        npcs.length <= 3 ? '\u{1F464}'.repeat(npcs.length) : `\u{1F464}\u00D7${npcs.length}`
      ctx.fillText(npcText, x, offsetY)
      offsetY += fontSize + RENDERING.ENTITY_INDICATOR_SPACING
    }

    // Item indicators
    if (items.length > 0) {
      ctx.fillStyle = RENDER_COLORS.ITEM_INDICATOR
      const itemText =
        items.length <= 3 ? '\u{1F4E6}'.repeat(items.length) : `\u{1F4E6}\u00D7${items.length}`
      ctx.fillText(itemText, x, offsetY)
    }
  }

  /**
   * Draw up/down exit indicators at the bottom of a room.
   * Shows arrows pointing up or down based on available exits.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {RendererState} state - Current viewport state
   * @param {Room} room - Room with potential vertical exits
   * @param {number} x - Room center X in world pixels
   * @param {number} y - Room center Y in world pixels
   * @param {number} halfSize - Half the room visual size
   * @returns {void}
   */
  drawVerticalExitIndicators(ctx, state, room, x, y, halfSize) {
    const exits = room.exits || {}
    const hasUp = 'up' in exits
    const hasDown = 'down' in exits

    if (!hasUp && !hasDown) return

    ctx.font = `bold ${RENDERING.FONT_SIZE_INDICATOR / state.camera.zoom}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Position at bottom of room
    const indicatorY = y + halfSize - RENDERING.VERTICAL_INDICATOR_OFFSET

    if (hasUp && hasDown) {
      ctx.fillStyle = state.exitColors.up
      ctx.fillText('\u2191', x - RENDERING.VERTICAL_ARROW_SPACING, indicatorY)
      ctx.fillStyle = state.exitColors.down
      ctx.fillText('\u2193', x + RENDERING.VERTICAL_ARROW_SPACING, indicatorY)
    } else if (hasUp) {
      ctx.fillStyle = state.exitColors.up
      ctx.fillText('\u2191', x, indicatorY)
    } else if (hasDown) {
      ctx.fillStyle = state.exitColors.down
      ctx.fillText('\u2193', x, indicatorY)
    }
  }

  // ============================================================================
  // Snap Indicator
  // ============================================================================

  /**
   * Draw the snap indicator showing where a dragged room will snap to.
   * Shows crosshairs and highlighted grid lines at the snap position.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {RendererState} state - Current viewport state
   * @returns {void}
   */
  drawSnapIndicator(ctx, state) {
    if (!state.snapIndicator) return

    const x = state.snapIndicator.x * state.gridSize
    const y = state.snapIndicator.y * state.gridSize

    // Draw crosshairs at snap position
    const crosshairLength = 20 / state.camera.zoom
    const lineWidth = 2 / state.camera.zoom

    ctx.save()
    ctx.strokeStyle = state.viewportColors.snap
    ctx.lineWidth = lineWidth
    ctx.globalAlpha = 0.8

    // Horizontal crosshair
    ctx.beginPath()
    ctx.moveTo(x - crosshairLength, y)
    ctx.lineTo(x + crosshairLength, y)
    ctx.stroke()

    // Vertical crosshair
    ctx.beginPath()
    ctx.moveTo(x, y - crosshairLength)
    ctx.lineTo(x, y + crosshairLength)
    ctx.stroke()

    // Draw snap point circle
    ctx.beginPath()
    ctx.arc(x, y, 6 / state.camera.zoom, 0, Math.PI * 2)
    ctx.stroke()

    // Highlight the grid lines near snap point
    ctx.strokeStyle = state.viewportColors.snapDim
    ctx.lineWidth = 3 / state.camera.zoom
    ctx.globalAlpha = 0.5

    // Vertical grid line at snap X
    const topLeft = state.screenToWorld(0, 0)
    const bottomRight = state.screenToWorld(state.width, state.height)
    ctx.beginPath()
    ctx.moveTo(x, topLeft.y * state.gridSize)
    ctx.lineTo(x, bottomRight.y * state.gridSize)
    ctx.stroke()

    // Horizontal grid line at snap Y
    ctx.beginPath()
    ctx.moveTo(topLeft.x * state.gridSize, y)
    ctx.lineTo(bottomRight.x * state.gridSize, y)
    ctx.stroke()

    ctx.restore()
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  /**
   * Draw a rounded rectangle path (does not fill or stroke).
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - Top-left X coordinate
   * @param {number} y - Top-left Y coordinate
   * @param {number} width - Rectangle width
   * @param {number} height - Rectangle height
   * @param {number} radius - Corner radius
   * @returns {void}
   */
  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + width - radius, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
    ctx.lineTo(x + width, y + height - radius)
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    ctx.lineTo(x + radius, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
    ctx.lineTo(x, y + radius)
    ctx.quadraticCurveTo(x, y, x + radius, y)
    ctx.closePath()
  }

  /**
   * Truncate text to fit within maxWidth, adding ellipsis if needed.
   * Results are memoized to avoid repeated measureText calls.
   * @param {string} text - Text to truncate
   * @param {number} maxWidth - Maximum width in pixels
   * @param {CanvasRenderingContext2D} ctx - Canvas context for measuring
   * @param {number} fontSize - Font size in pixels
   * @returns {string} Truncated text with ellipsis if needed
   */
  truncateText(text, maxWidth, ctx, fontSize) {
    if (!text) return ''

    const cacheKey = `${text}|${fontSize}|${maxWidth}`
    if (this._truncateCache.has(cacheKey)) return this._truncateCache.get(cacheKey)

    ctx.font = `${fontSize}px sans-serif`

    if (ctx.measureText(text).width <= maxWidth) {
      this._truncateCache.set(cacheKey, text)
      return text
    }

    let truncated = text
    while (truncated.length > 0 && ctx.measureText(`${truncated}\u2026`).width > maxWidth) {
      truncated = truncated.slice(0, -1)
    }
    const result = `${truncated}\u2026`

    // Evict cache if it grows too large
    if (this._truncateCache.size > RENDERING.TRUNCATE_CACHE_MAX) {
      this._truncateCache.clear()
    }
    this._truncateCache.set(cacheKey, result)
    return result
  }
}
