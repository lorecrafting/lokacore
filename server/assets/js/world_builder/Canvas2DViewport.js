/**
 * Canvas2DViewport - 2D World Builder Viewport
 *
 * Renders rooms, exits, and grid on a 2D canvas.
 * Handles pan, zoom, and selection interactions.
 * Supports Z-level filtering for up/down room connections.
 */

// Exit direction colors (preserved from 3D version)
const EXIT_COLORS = {
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
  default: '#888888'
}

// Room colors
const ROOM_COLORS = {
  default: '#7eb3ff',
  selected: '#4a9eff',
  multiSelected: '#ffaa00',
  error: '#ff6b6b',
  warning: '#ffd93d'
}

// Direction offsets for exit arrow positioning
const DIRECTION_OFFSETS = {
  north: { dx: 0, dy: -1 },
  south: { dx: 0, dy: 1 },
  east: { dx: 1, dy: 0 },
  west: { dx: -1, dy: 0 },
  northeast: { dx: 1, dy: -1 },
  northwest: { dx: -1, dy: -1 },
  southeast: { dx: 1, dy: 1 },
  southwest: { dx: -1, dy: 1 },
  up: { dx: 0, dy: 0 },
  down: { dx: 0, dy: 0 }
}

export default class Canvas2DViewport {
  constructor(canvas, options = {}) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')

    // Camera state
    this.camera = {
      x: 0,
      y: 0,
      zoom: 1
    }

    // Grid settings
    this.gridSize = 60 // Pixels per world unit
    this.roomSize = 50 // Room rectangle size in pixels
    this.minZoom = 0.2
    this.maxZoom = 3

    // Data
    this.rooms = []
    this.roomsByKey = new Map()
    this.validation = {}
    this.selectedRoom = null
    this.selectedKeys = new Set()
    this.currentZLevel = 0
    this.showGhostLayers = true

    // Interaction state
    this.isDragging = false
    this.dragStart = { x: 0, y: 0 }
    this.lastMousePos = { x: 0, y: 0 }

    // Callbacks
    this.onSelectRoom = options.onSelectRoom || (() => {})
    this.onBatchSelect = options.onBatchSelect || (() => {})

    // Setup
    this.setupCanvas()
    this.setupEventListeners()
    this.startRenderLoop()
  }

  // ============================================================================
  // Setup
  // ============================================================================

  setupCanvas() {
    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1
    const rect = this.canvas.getBoundingClientRect()

    this.canvas.width = rect.width * dpr
    this.canvas.height = rect.height * dpr
    this.ctx.scale(dpr, dpr)

    // Store display dimensions
    this.width = rect.width
    this.height = rect.height
  }

  setupEventListeners() {
    // Mouse events
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this))
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this))
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this))
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false })
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault())

    // Resize handling
    this.resizeObserver = new ResizeObserver(() => {
      this.setupCanvas()
      this.render()
    })
    this.resizeObserver.observe(this.canvas)
  }

  startRenderLoop() {
    // Initial render
    this.render()
  }

  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
    }
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

    this.render()
  }

  setValidation(validation) {
    this.validation = validation || {}
    this.render()
  }

  setSelectedRoom(key) {
    this.selectedRoom = key
    this.render()
  }

  setSelectedKeys(keys) {
    this.selectedKeys = new Set(keys || [])
    this.render()
  }

  setZLevel(level) {
    this.currentZLevel = level
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
      if (this.zLevels.includes(this.currentZLevel - 1)) levelsToCheck.push(this.currentZLevel - 1)
      if (this.zLevels.includes(this.currentZLevel + 1)) levelsToCheck.push(this.currentZLevel + 1)
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
  // Mouse Event Handlers
  // ============================================================================

  handleMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    this.lastMousePos = { x, y }

    // Check if clicking on a room
    const room = this.getRoomAtPoint(x, y)

    if (room) {
      // Room click - handle selection
      if (e.shiftKey) {
        // Shift+click: toggle in selection
        if (this.selectedKeys.has(room.key)) {
          this.selectedKeys.delete(room.key)
        } else {
          this.selectedKeys.add(room.key)
        }
        this.onBatchSelect(Array.from(this.selectedKeys))
      } else {
        // Normal click: single select
        this.selectedKeys.clear()
        this.onSelectRoom(room.key, e.shiftKey)
      }
      this.render()
    } else {
      // Empty space click - start panning
      this.isDragging = true
      this.dragStart = { x, y }
      this.canvas.style.cursor = 'grabbing'
    }
  }

  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (this.isDragging) {
      // Pan the camera
      const dx = (x - this.lastMousePos.x) / this.camera.zoom
      const dy = (y - this.lastMousePos.y) / this.camera.zoom
      this.camera.x += dx
      this.camera.y += dy
      this.render()
    } else {
      // Update cursor based on what's under mouse
      const room = this.getRoomAtPoint(x, y)
      this.canvas.style.cursor = room ? 'pointer' : 'grab'
    }

    this.lastMousePos = { x, y }
  }

  handleMouseUp(e) {
    this.isDragging = false
    this.canvas.style.cursor = 'grab'
  }

  handleWheel(e) {
    e.preventDefault()

    const rect = this.canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    // Get world position before zoom
    const worldBefore = this.screenToWorld(mouseX, mouseY)

    // Apply zoom
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
    this.camera.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.camera.zoom * zoomFactor))

    // Get world position after zoom
    const worldAfter = this.screenToWorld(mouseX, mouseY)

    // Adjust camera to keep mouse position stable
    this.camera.x += (worldAfter.x - worldBefore.x) * this.gridSize
    this.camera.y += (worldAfter.y - worldBefore.y) * this.gridSize

    this.render()
  }

  // ============================================================================
  // Rendering
  // ============================================================================

  render() {
    const ctx = this.ctx

    // Clear canvas
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, this.width, this.height)

    // Save context for camera transform
    ctx.save()

    // Apply camera transform
    ctx.translate(this.width / 2, this.height / 2)
    ctx.scale(this.camera.zoom, this.camera.zoom)
    ctx.translate(this.camera.x, this.camera.y)

    // Draw grid
    this.drawGrid(ctx)

    // Draw ghost rooms (adjacent Z-levels)
    if (this.showGhostLayers) {
      this.drawRoomsAtZLevel(ctx, this.currentZLevel - 1, 0.2)
      this.drawRoomsAtZLevel(ctx, this.currentZLevel + 1, 0.2)
    }

    // Draw exits for current Z-level
    this.drawExits(ctx)

    // Draw rooms at current Z-level
    this.drawRoomsAtZLevel(ctx, this.currentZLevel, 1.0)

    // Restore context
    ctx.restore()
  }

  drawGrid(ctx) {
    ctx.strokeStyle = '#333344'
    ctx.lineWidth = 1 / this.camera.zoom

    // Calculate visible area in world coordinates
    const topLeft = this.screenToWorld(0, 0)
    const bottomRight = this.screenToWorld(this.width, this.height)

    const startX = Math.floor(topLeft.x) - 1
    const endX = Math.ceil(bottomRight.x) + 1
    const startY = Math.floor(topLeft.y) - 1
    const endY = Math.ceil(bottomRight.y) + 1

    ctx.beginPath()

    // Vertical lines
    for (let x = startX; x <= endX; x++) {
      const screenX = x * this.gridSize
      ctx.moveTo(screenX, startY * this.gridSize)
      ctx.lineTo(screenX, endY * this.gridSize)
    }

    // Horizontal lines
    for (let y = startY; y <= endY; y++) {
      const screenY = y * this.gridSize
      ctx.moveTo(startX * this.gridSize, screenY)
      ctx.lineTo(endX * this.gridSize, screenY)
    }

    ctx.stroke()

    // Draw origin marker
    ctx.strokeStyle = '#555566'
    ctx.lineWidth = 2 / this.camera.zoom
    ctx.beginPath()
    ctx.moveTo(-10, 0)
    ctx.lineTo(10, 0)
    ctx.moveTo(0, -10)
    ctx.lineTo(0, 10)
    ctx.stroke()
  }

  drawRoomsAtZLevel(ctx, zLevel, opacity) {
    const roomsAtLevel = this.rooms.filter(r => (r.z || 0) === zLevel)

    for (const room of roomsAtLevel) {
      this.drawRoom(ctx, room, opacity)
    }
  }

  drawRoom(ctx, room, opacity = 1) {
    const x = (room.x || 0) * this.gridSize
    const y = (room.y || 0) * this.gridSize
    const size = this.roomSize
    const halfSize = size / 2

    // Determine room color
    let fillColor = ROOM_COLORS.default
    let borderColor = '#ffffff'
    let borderWidth = 1

    const isSelected = this.selectedRoom === room.key
    const isMultiSelected = this.selectedKeys.has(room.key)
    const validationStatus = this.validation[room.key]?.status

    if (isSelected) {
      fillColor = ROOM_COLORS.selected
      borderColor = '#ffffff'
      borderWidth = 3
    } else if (isMultiSelected) {
      fillColor = ROOM_COLORS.multiSelected
      borderColor = '#ff8800'
      borderWidth = 3
    } else if (validationStatus === 'error') {
      fillColor = ROOM_COLORS.error
      borderColor = '#ff0000'
      borderWidth = 2
    } else if (validationStatus === 'warning') {
      fillColor = ROOM_COLORS.warning
      borderColor = '#ffaa00'
      borderWidth = 2
    }

    ctx.globalAlpha = opacity

    // Draw room rectangle with rounded corners
    ctx.fillStyle = fillColor
    ctx.strokeStyle = borderColor
    ctx.lineWidth = borderWidth / this.camera.zoom

    this.roundRect(ctx, x - halfSize, y - halfSize, size, size, 6)
    ctx.fill()
    ctx.stroke()

    // Draw room name (above room)
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${12 / this.camera.zoom}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(room.name || room.key, x, y - halfSize - 4)

    // Draw room key (inside room, smaller)
    ctx.fillStyle = '#aaaaaa'
    ctx.font = `${9 / this.camera.zoom}px monospace`
    ctx.textBaseline = 'top'
    ctx.fillText(room.key, x, y - halfSize + 4)

    // Draw entity indicators
    this.drawEntityIndicators(ctx, room, x, y, halfSize)

    // Draw up/down indicators
    this.drawVerticalExitIndicators(ctx, room, x, y, halfSize)

    ctx.globalAlpha = 1
  }

  drawEntityIndicators(ctx, room, x, y, halfSize) {
    const spawns = room.spawns || {}
    const npcs = spawns.npcs || []
    const items = spawns.items || []

    if (npcs.length === 0 && items.length === 0) return

    const fontSize = 10 / this.camera.zoom
    ctx.font = `${fontSize}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    let offsetY = y + 5

    // NPC indicators
    if (npcs.length > 0) {
      ctx.fillStyle = '#8B5CF6'
      const npcText = npcs.length <= 3 ? '👤'.repeat(npcs.length) : `👤×${npcs.length}`
      ctx.fillText(npcText, x, offsetY)
      offsetY += fontSize + 2
    }

    // Item indicators
    if (items.length > 0) {
      ctx.fillStyle = '#EAB308'
      const itemText = items.length <= 3 ? '📦'.repeat(items.length) : `📦×${items.length}`
      ctx.fillText(itemText, x, offsetY)
    }
  }

  drawVerticalExitIndicators(ctx, room, x, y, halfSize) {
    const exits = room.exits || {}
    const hasUp = 'up' in exits
    const hasDown = 'down' in exits

    if (!hasUp && !hasDown) return

    ctx.font = `bold ${10 / this.camera.zoom}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Position at bottom of room
    const indicatorY = y + halfSize - 8

    if (hasUp && hasDown) {
      ctx.fillStyle = EXIT_COLORS.up
      ctx.fillText('↑', x - 6, indicatorY)
      ctx.fillStyle = EXIT_COLORS.down
      ctx.fillText('↓', x + 6, indicatorY)
    } else if (hasUp) {
      ctx.fillStyle = EXIT_COLORS.up
      ctx.fillText('↑', x, indicatorY)
    } else if (hasDown) {
      ctx.fillStyle = EXIT_COLORS.down
      ctx.fillText('↓', x, indicatorY)
    }
  }

  drawExits(ctx) {
    const currentRooms = this.rooms.filter(r => (r.z || 0) === this.currentZLevel)

    for (const room of currentRooms) {
      const exits = room.exits || {}

      for (const [direction, destKey] of Object.entries(exits)) {
        // Skip up/down - shown as indicators instead
        if (direction === 'up' || direction === 'down') continue

        const destRoom = this.roomsByKey.get(destKey)
        if (!destRoom) continue

        // Only draw exits to rooms on same Z-level
        if ((destRoom.z || 0) !== this.currentZLevel) continue

        this.drawExitArrow(ctx, room, destRoom, direction)
      }
    }
  }

  drawExitArrow(ctx, fromRoom, toRoom, direction) {
    const fromX = (fromRoom.x || 0) * this.gridSize
    const fromY = (fromRoom.y || 0) * this.gridSize
    const toX = (toRoom.x || 0) * this.gridSize
    const toY = (toRoom.y || 0) * this.gridSize

    const color = EXIT_COLORS[direction] || EXIT_COLORS.default

    // Calculate start and end points (offset from room centers)
    const offset = this.roomSize / 2 + 5
    const dirOffset = DIRECTION_OFFSETS[direction] || { dx: 0, dy: 0 }

    const startX = fromX + dirOffset.dx * offset
    const startY = fromY + dirOffset.dy * offset

    // Calculate direction to destination
    const dx = toX - fromX
    const dy = toY - fromY
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < 1) return // Rooms at same position

    const endX = toX - (dx / dist) * offset
    const endY = toY - (dy / dist) * offset

    // Draw line
    ctx.strokeStyle = color
    ctx.lineWidth = 2 / this.camera.zoom
    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.lineTo(endX, endY)
    ctx.stroke()

    // Draw arrowhead
    const arrowSize = 8 / this.camera.zoom
    const angle = Math.atan2(toY - fromY, toX - fromX)

    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(endX, endY)
    ctx.lineTo(
      endX - arrowSize * Math.cos(angle - Math.PI / 6),
      endY - arrowSize * Math.sin(angle - Math.PI / 6)
    )
    ctx.lineTo(
      endX - arrowSize * Math.cos(angle + Math.PI / 6),
      endY - arrowSize * Math.sin(angle + Math.PI / 6)
    )
    ctx.closePath()
    ctx.fill()
  }

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

    this.render()
  }

  resetCamera() {
    this.camera = { x: 0, y: 0, zoom: 1 }
    this.render()
  }

  getZLevels() {
    return this.zLevels || [0]
  }
}
