/**
 * Canvas2DViewport - 2D World Builder Viewport (Orchestrator)
 *
 * Public API for the viewport. Manages state, coordinate transforms,
 * camera controls, and delegates rendering and interaction to
 * Canvas2DRenderer and Canvas2DInteraction respectively.
 */

import { Canvas2DRenderer } from './Canvas2DRenderer.js'
import { Canvas2DInteraction } from './Canvas2DInteraction.js'

export default class Canvas2DViewport {
  constructor(canvas, options = {}) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')

    // Read colors from CSS variables (with hardcoded fallbacks for canvas rendering)
    const styles = getComputedStyle(document.documentElement)
    const v = (name, fallback) => styles.getPropertyValue(name).trim() || fallback

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

    this.roomColors = {
      default: v('--wb-viewport-room-default', '#7eb3ff'),
      selected: v('--wb-viewport-room-selected', '#4a9eff'),
      multiSelected: v('--wb-viewport-room-multi', '#ffaa00'),
      error: v('--wb-viewport-room-error', '#ff6b6b'),
      warning: v('--wb-viewport-room-warning', '#ffd93d'),
    }

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
    this.camera = {
      x: 0,
      y: 0,
      zoom: 1
    }

    // Grid settings
    this.gridSize = 60
    this.roomSize = 48
    this.minZoom = 0.2
    this.maxZoom = 3
    this.showGrid = true
    this.snapSize = 60

    // Data
    this.rooms = []
    this.roomsByKey = new Map()
    this.validation = {}
    this.selectedRoom = null
    this.selectedKeys = new Set()
    this.currentZLevel = 0
    this.showGhostLayers = true

    // Zone visualization
    this.zoneColors = {}
    this.roomZoneMap = {}
    this.showZoneColors = true

    // NPC path visualization
    this.npcPaths = {}
    this.showNPCPaths = true

    // Callbacks
    this.onSelectRoom = options.onSelectRoom || (() => {})
    this.onBatchSelect = options.onBatchSelect || (() => {})
    this.onMoveRoom = options.onMoveRoom || (() => {})

    // Create renderer with a state accessor
    this.renderer = new Canvas2DRenderer(this.ctx, () => this._getRendererState())

    // Create interaction handler
    this.interaction = new Canvas2DInteraction(canvas, this)

    // Setup
    this.setupCanvas()
    this.interaction.attach()
    this.startRenderLoop()
  }

  // ============================================================================
  // State accessor for renderer
  // ============================================================================

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

  setupCanvas() {
    const dpr = window.devicePixelRatio || 1
    const rect = this.canvas.getBoundingClientRect()

    this.canvas.width = rect.width * dpr
    this.canvas.height = rect.height * dpr
    this.ctx.scale(dpr, dpr)

    this.width = rect.width
    this.height = rect.height
  }

  // Batch multiple data updates into a single render frame
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

  startRenderLoop() {
    this.render()
  }

  render() {
    this.renderer.render()
  }

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

  setValidation(validation) {
    this.validation = validation || {}
    this.scheduleRender()
  }

  setSelectedRoom(key) {
    this.selectedRoom = key
    this.scheduleRender()
  }

  setSelectedKeys(keys) {
    this.selectedKeys = new Set(keys || [])
    this.scheduleRender()
  }

  setZLevel(level) {
    this.currentZLevel = level
    this.scheduleRender()
  }

  setZoneColors(colors) {
    this.zoneColors = colors || {}
    this.scheduleRender()
  }

  setRoomZoneMap(map) {
    this.roomZoneMap = map || {}
    this.scheduleRender()
  }

  setShowZoneColors(show) {
    this.showZoneColors = show
    this.scheduleRender()
  }

  setNPCPaths(paths) {
    this.npcPaths = paths || {}
    this.scheduleRender()
  }

  setShowNPCPaths(show) {
    this.showNPCPaths = show
    this.scheduleRender()
  }

  setShowGrid(show) {
    this.showGrid = show
    this.scheduleRender()
  }

  toggleGrid() {
    this.showGrid = !this.showGrid
    this.render()
  }

  // ============================================================================
  // Coordinate Transforms
  // ============================================================================

  worldToScreen(worldX, worldY) {
    const screenX = (worldX * this.gridSize + this.camera.x) * this.camera.zoom + this.width / 2
    const screenY = (worldY * this.gridSize + this.camera.y) * this.camera.zoom + this.height / 2
    return { x: screenX, y: screenY }
  }

  screenToWorld(screenX, screenY) {
    const worldX = ((screenX - this.width / 2) / this.camera.zoom - this.camera.x) / this.gridSize
    const worldY = ((screenY - this.height / 2) / this.camera.zoom - this.camera.y) / this.gridSize
    return { x: worldX, y: worldY }
  }

  // ============================================================================
  // Hit Testing
  // ============================================================================

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

  centerOnRoom(roomKey) {
    const room = this.roomsByKey.get(roomKey)
    if (!room) return

    this.camera.x = -(room.x || 0) * this.gridSize
    this.camera.y = -(room.y || 0) * this.gridSize
    this.currentZLevel = room.z || 0
    this.render()
  }

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

  resetCamera() {
    this.camera = { x: 0, y: 0, zoom: 1 }
    this.renderer.clearTruncateCache()
    this.render()
  }

  getZLevels() {
    return this.zLevels || [0]
  }

  // ============================================================================
  // Backward compatibility - expose internal state for tests
  // ============================================================================

  get _truncateCache() {
    return this.renderer._truncateCache
  }

  get resizeObserver() {
    return this.interaction.resizeObserver
  }
}
