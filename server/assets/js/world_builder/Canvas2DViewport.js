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
    this.roomSize = 48 // Room rectangle size in pixels (balanced for readability and connection visibility)
    this.minZoom = 0.2
    this.maxZoom = 3
    this.showGrid = true // Grid visibility toggle
    this.snapSize = 60 // Snap grid size in pixels (default = gridSize = 1 world unit)

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

    // Interaction state
    this.isDragging = false
    this.isDraggingRoom = false // Whether we're dragging a room vs panning
    this.draggedRoom = null // The room being dragged
    this.dragRoomStartPos = { x: 0, y: 0 } // Original room position when drag started
    this.dragStart = { x: 0, y: 0 }
    this.lastMousePos = { x: 0, y: 0 }
    this.hoveredRoom = null
    this.isSnapping = false // Whether shift is held for grid snapping
    this.snapIndicator = null // { x, y } position of snap indicator

    // Minimap state
    this.showMinimap = true
    this.minimapSize = 150
    this.minimapPadding = 10

    // Tooltip element
    this.tooltip = null

    // Callbacks
    this.onSelectRoom = options.onSelectRoom || (() => {})
    this.onBatchSelect = options.onBatchSelect || (() => {})
    this.onMoveRoom = options.onMoveRoom || (() => {}) // Called when room is moved via drag

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
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this))
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false })
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault())

    // Resize handling
    this.resizeObserver = new ResizeObserver(() => {
      this.setupCanvas()
      this.render()
    })
    this.resizeObserver.observe(this.canvas)

    // Keyboard events for grid toggle
    this.handleKeyDown = this.handleKeyDown.bind(this)
    this.handleKeyUp = this.handleKeyUp.bind(this)
    document.addEventListener('keydown', this.handleKeyDown)
    document.addEventListener('keyup', this.handleKeyUp)

    // Create tooltip element
    this.createTooltip()
  }

  createTooltip() {
    this.tooltip = document.createElement('div')
    this.tooltip.className = 'viewport-tooltip'
    this.tooltip.style.cssText = `
      position: absolute;
      background: rgba(26, 26, 46, 0.95);
      border: 1px solid #444;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 12px;
      color: #ccc;
      pointer-events: none;
      z-index: 1000;
      display: none;
      max-width: 250px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `
    this.canvas.parentElement.appendChild(this.tooltip)
  }

  showTooltip(room, screenX, screenY) {
    if (!this.tooltip || !room) return

    const spawns = room.spawns || {}
    const npcs = spawns.npcs || []
    const items = spawns.items || []
    const exits = room.exits || {}
    const exitCount = Object.keys(exits).length

    let html = `
      <div style="font-weight: bold; color: #fff; margin-bottom: 4px;">${room.name || room.key}</div>
      <div style="font-size: 10px; color: #888; margin-bottom: 6px;">${room.key}</div>
      <div style="font-size: 11px; color: #aaa;">
        <div>📍 (${room.x || 0}, ${room.y || 0}, Z:${room.z || 0})</div>
        ${exitCount > 0 ? `<div>🚪 ${exitCount} exit${exitCount > 1 ? 's' : ''}</div>` : ''}
        ${npcs.length > 0 ? `<div>👤 ${npcs.length} NPC${npcs.length > 1 ? 's' : ''}: ${npcs.slice(0, 3).join(', ')}${npcs.length > 3 ? '...' : ''}</div>` : ''}
        ${items.length > 0 ? `<div>📦 ${items.length} item${items.length > 1 ? 's' : ''}</div>` : ''}
      </div>
    `

    this.tooltip.innerHTML = html
    this.tooltip.style.display = 'block'

    // Position tooltip near mouse but within bounds
    const rect = this.canvas.getBoundingClientRect()
    let x = screenX + 15
    let y = screenY + 15

    // Keep tooltip within canvas bounds
    const tooltipRect = this.tooltip.getBoundingClientRect()
    if (x + tooltipRect.width > rect.width) {
      x = screenX - tooltipRect.width - 15
    }
    if (y + tooltipRect.height > rect.height) {
      y = screenY - tooltipRect.height - 15
    }

    this.tooltip.style.left = `${x}px`
    this.tooltip.style.top = `${y}px`
  }

  hideTooltip() {
    if (this.tooltip) {
      this.tooltip.style.display = 'none'
    }
  }

  handleMouseLeave(e) {
    this.hideTooltip()
    this.hoveredRoom = null
  }

  startRenderLoop() {
    // Initial render
    this.render()
  }

  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
    }
    document.removeEventListener('keydown', this.handleKeyDown)
    document.removeEventListener('keyup', this.handleKeyUp)
  }

  // ============================================================================
  // Keyboard Event Handlers
  // ============================================================================

  handleKeyDown(e) {
    // Toggle grid visibility with 'G' key
    if (e.key === 'g' || e.key === 'G') {
      // Don't toggle if user is typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      this.showGrid = !this.showGrid
      this.render()
    }

    // Track shift key for snapping
    if (e.key === 'Shift') {
      this.isSnapping = true
      if (this.isDraggingRoom) {
        this.render()
      }
    }
  }

  handleKeyUp(e) {
    // Track shift key release
    if (e.key === 'Shift') {
      this.isSnapping = false
      this.snapIndicator = null
      if (this.isDraggingRoom) {
        this.render()
      }
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

  setZoneColors(colors) {
    this.zoneColors = colors || {}
    this.render()
  }

  setRoomZoneMap(map) {
    this.roomZoneMap = map || {}
    this.render()
  }

  setShowZoneColors(show) {
    this.showZoneColors = show
    this.render()
  }

  setNPCPaths(paths) {
    this.npcPaths = paths || {}
    this.render()
  }

  setShowNPCPaths(show) {
    this.showNPCPaths = show
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
    this.dragStart = { x, y }

    // Check if clicking on a room
    const room = this.getRoomAtPoint(x, y)

    if (room) {
      // Room click - start dragging the room
      this.isDragging = true
      this.isDraggingRoom = true
      this.draggedRoom = room
      this.dragRoomStartPos = { x: room.x || 0, y: room.y || 0 }
      this.canvas.style.cursor = 'move'

      // Also select the room if not already selected
      if (!this.selectedKeys.has(room.key)) {
        this.selectedKeys.clear()
        this.onSelectRoom(room.key, false)
      }
      this.render()
    } else {
      // Empty space click - start panning
      this.isDragging = true
      this.isDraggingRoom = false
      this.draggedRoom = null
      this.canvas.style.cursor = 'grabbing'
    }
  }

  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Track snapping state from shift key
    this.isSnapping = e.shiftKey

    if (this.isDragging) {
      if (this.isDraggingRoom && this.draggedRoom) {
        // Drag the room
        const worldPos = this.screenToWorld(x, y)
        let newX = worldPos.x
        let newY = worldPos.y

        // Apply grid snapping if shift is held
        if (this.isSnapping) {
          const snapWorld = this.snapSize / this.gridSize // Snap size in world units
          newX = Math.round(newX / snapWorld) * snapWorld
          newY = Math.round(newY / snapWorld) * snapWorld
          this.snapIndicator = { x: newX, y: newY }
        } else {
          this.snapIndicator = null
        }

        // Update room position (temporary - will be saved on mouse up)
        this.draggedRoom.x = newX
        this.draggedRoom.y = newY

        this.hideTooltip()
        this.render()
      } else {
        // Pan the camera
        const dx = (x - this.lastMousePos.x) / this.camera.zoom
        const dy = (y - this.lastMousePos.y) / this.camera.zoom
        this.camera.x += dx
        this.camera.y += dy
        this.hideTooltip()
        this.render()
      }
    } else {
      // Update cursor and tooltip based on what's under mouse
      const room = this.getRoomAtPoint(x, y)
      this.canvas.style.cursor = room ? 'pointer' : 'grab'

      if (room && room !== this.hoveredRoom) {
        this.hoveredRoom = room
        this.showTooltip(room, x, y)
      } else if (!room && this.hoveredRoom) {
        this.hoveredRoom = null
        this.hideTooltip()
      } else if (room && this.tooltip) {
        // Update tooltip position
        this.showTooltip(room, x, y)
      }
    }

    this.lastMousePos = { x, y }
  }

  handleMouseUp(e) {
    // If we were dragging a room, notify the callback
    if (this.isDraggingRoom && this.draggedRoom) {
      const newX = this.draggedRoom.x
      const newY = this.draggedRoom.y

      // Only fire callback if position actually changed
      if (newX !== this.dragRoomStartPos.x || newY !== this.dragRoomStartPos.y) {
        this.onMoveRoom(this.draggedRoom.key, newX, newY)
      }
    }

    this.isDragging = false
    this.isDraggingRoom = false
    this.draggedRoom = null
    this.snapIndicator = null
    this.canvas.style.cursor = 'grab'
    this.render()
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

    // Draw grid (if visible)
    if (this.showGrid) {
      this.drawGrid(ctx)
    }

    // Draw ghost rooms (adjacent Z-levels)
    if (this.showGhostLayers) {
      this.drawRoomsAtZLevel(ctx, this.currentZLevel - 1, 0.2)
      this.drawRoomsAtZLevel(ctx, this.currentZLevel + 1, 0.2)
    }

    // Draw NPC patrol paths (before rooms so they're under)
    if (this.showNPCPaths) {
      this.drawNPCPaths(ctx)
    }

    // Draw exits for current Z-level
    this.drawExits(ctx)

    // Draw rooms at current Z-level
    this.drawRoomsAtZLevel(ctx, this.currentZLevel, 1.0)

    // Draw snap indicator if snapping
    if (this.snapIndicator && this.isDraggingRoom) {
      this.drawSnapIndicator(ctx)
    }

    // Restore context
    ctx.restore()

    // Draw minimap (after restoring context, uses screen coordinates)
    if (this.showMinimap && this.rooms.length > 0) {
      this.drawMinimap(ctx)
    }
  }

  drawMinimap(ctx) {
    const padding = this.minimapPadding
    const size = this.minimapSize
    const x = this.width - size - padding
    const y = this.height - size - padding - 160 // Account for console

    // Get bounding box of all rooms at current Z-level
    const currentRooms = this.rooms.filter(r => (r.z || 0) === this.currentZLevel)
    if (currentRooms.length === 0) return

    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity
    for (const room of currentRooms) {
      minX = Math.min(minX, room.x || 0)
      maxX = Math.max(maxX, room.x || 0)
      minY = Math.min(minY, room.y || 0)
      maxY = Math.max(maxY, room.y || 0)
    }

    const worldWidth = maxX - minX + 2
    const worldHeight = maxY - minY + 2
    const scale = Math.min(size / worldWidth, size / worldHeight) * 0.9

    // Draw minimap background
    ctx.fillStyle = 'rgba(26, 26, 46, 0.85)'
    ctx.strokeStyle = '#444'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(x - 4, y - 4, size + 8, size + 8, 6)
    ctx.fill()
    ctx.stroke()

    // Draw rooms as dots
    ctx.fillStyle = '#7eb3ff'
    for (const room of currentRooms) {
      const rx = x + ((room.x || 0) - minX + 1) * scale
      const ry = y + ((room.y || 0) - minY + 1) * scale

      // Highlight selected room
      if (room.key === this.selectedRoom) {
        ctx.fillStyle = '#4a9eff'
        ctx.beginPath()
        ctx.arc(rx, ry, 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#7eb3ff'
      } else {
        ctx.beginPath()
        ctx.arc(rx, ry, 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Draw viewport rectangle
    const topLeft = this.screenToWorld(0, 0)
    const bottomRight = this.screenToWorld(this.width, this.height)

    const viewX = x + (topLeft.x - minX + 1) * scale
    const viewY = y + (topLeft.y - minY + 1) * scale
    const viewW = (bottomRight.x - topLeft.x) * scale
    const viewH = (bottomRight.y - topLeft.y) * scale

    ctx.strokeStyle = '#ff6b6b'
    ctx.lineWidth = 1.5
    ctx.strokeRect(viewX, viewY, viewW, viewH)

    // Draw minimap label
    ctx.fillStyle = '#666'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText('Minimap', x + size, y - 8)
  }

  setShowMinimap(show) {
    this.showMinimap = show
    this.render()
  }

  setShowGrid(show) {
    this.showGrid = show
    this.render()
  }

  toggleGrid() {
    this.showGrid = !this.showGrid
    this.render()
    return this.showGrid
  }

  setSnapSize(size) {
    this.snapSize = size
  }

  drawNPCPaths(ctx) {
    const pathColors = [
      '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
      '#ffeaa7', '#dfe6e9', '#fd79a8', '#a29bfe'
    ]
    let colorIndex = 0

    for (const [npcKey, pathInfo] of Object.entries(this.npcPaths)) {
      if (!pathInfo.patrol || !pathInfo.patrol.route) continue

      const route = pathInfo.patrol.route
      if (route.length < 2) continue

      // Get color for this NPC's path
      const color = pathColors[colorIndex % pathColors.length]
      colorIndex++

      // Draw the patrol path as a curved line connecting rooms
      ctx.save()
      ctx.strokeStyle = color
      ctx.lineWidth = 3 / this.camera.zoom
      ctx.setLineDash([8 / this.camera.zoom, 4 / this.camera.zoom])
      ctx.globalAlpha = 0.7

      // Build path through rooms
      ctx.beginPath()
      let started = false

      for (let i = 0; i < route.length; i++) {
        const roomKey = route[i]
        const room = this.roomsByKey.get(roomKey)
        if (!room) continue

        // Only draw rooms at current Z-level
        if ((room.z || 0) !== this.currentZLevel) continue

        const x = (room.x || 0) * this.gridSize
        const y = (room.y || 0) * this.gridSize

        if (!started) {
          ctx.moveTo(x, y)
          started = true
        } else {
          ctx.lineTo(x, y)
        }
      }

      // If loop mode, connect back to start
      if (pathInfo.patrol.loop !== false && route.length >= 2) {
        const startRoom = this.roomsByKey.get(route[0])
        if (startRoom && (startRoom.z || 0) === this.currentZLevel) {
          const x = (startRoom.x || 0) * this.gridSize
          const y = (startRoom.y || 0) * this.gridSize
          ctx.lineTo(x, y)
        }
      }

      ctx.stroke()

      // Draw direction arrows
      this.drawPathArrows(ctx, route, color)

      ctx.restore()
    }
  }

  drawPathArrows(ctx, route, color) {
    ctx.fillStyle = color
    ctx.globalAlpha = 0.8

    for (let i = 0; i < route.length - 1; i++) {
      const fromRoom = this.roomsByKey.get(route[i])
      const toRoom = this.roomsByKey.get(route[i + 1])

      if (!fromRoom || !toRoom) continue
      if ((fromRoom.z || 0) !== this.currentZLevel) continue
      if ((toRoom.z || 0) !== this.currentZLevel) continue

      const fromX = (fromRoom.x || 0) * this.gridSize
      const fromY = (fromRoom.y || 0) * this.gridSize
      const toX = (toRoom.x || 0) * this.gridSize
      const toY = (toRoom.y || 0) * this.gridSize

      // Draw arrow at midpoint
      const midX = (fromX + toX) / 2
      const midY = (fromY + toY) / 2
      const angle = Math.atan2(toY - fromY, toX - fromX)
      const arrowSize = 8 / this.camera.zoom

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

  drawSnapIndicator(ctx) {
    if (!this.snapIndicator) return

    const x = this.snapIndicator.x * this.gridSize
    const y = this.snapIndicator.y * this.gridSize

    // Draw crosshairs at snap position
    const crosshairLength = 20 / this.camera.zoom
    const lineWidth = 2 / this.camera.zoom

    ctx.save()
    ctx.strokeStyle = '#00ff88'
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
    ctx.arc(x, y, 6 / this.camera.zoom, 0, Math.PI * 2)
    ctx.stroke()

    // Highlight the grid lines near snap point
    ctx.strokeStyle = '#00ff8844'
    ctx.lineWidth = 3 / this.camera.zoom
    ctx.globalAlpha = 0.5

    // Vertical grid line at snap X
    const topLeft = this.screenToWorld(0, 0)
    const bottomRight = this.screenToWorld(this.width, this.height)
    ctx.beginPath()
    ctx.moveTo(x, topLeft.y * this.gridSize)
    ctx.lineTo(x, bottomRight.y * this.gridSize)
    ctx.stroke()

    // Horizontal grid line at snap Y
    ctx.beginPath()
    ctx.moveTo(topLeft.x * this.gridSize, y)
    ctx.lineTo(bottomRight.x * this.gridSize, y)
    ctx.stroke()

    ctx.restore()
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
    } else if (this.showZoneColors) {
      // Use zone color if available
      const zoneKey = this.roomZoneMap[room.key]
      if (zoneKey && this.zoneColors[zoneKey]) {
        fillColor = this.zoneColors[zoneKey]
      }
    }

    ctx.globalAlpha = opacity

    // Draw room rectangle with rounded corners
    ctx.fillStyle = fillColor
    ctx.strokeStyle = borderColor
    ctx.lineWidth = borderWidth / this.camera.zoom

    this.roundRect(ctx, x - halfSize, y - halfSize, size, size, 6)
    ctx.fill()
    ctx.stroke()

    // Only show labels when zoomed in enough (avoid clutter when zoomed out)
    const showLabels = this.camera.zoom >= 0.5
    const showDetailedLabels = this.camera.zoom >= 0.8

    if (showLabels) {
      // Draw room name inside the room (truncated to fit)
      const displayName = this.truncateText(room.name || room.key, size - 4, ctx, 11 / this.camera.zoom)
      ctx.fillStyle = '#ffffff'
      ctx.font = `bold ${11 / this.camera.zoom}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(displayName, x, y - halfSize + 5)

      // Draw room key only when zoomed in more (smaller, below name)
      if (showDetailedLabels) {
        const displayKey = this.truncateText(room.key, size - 4, ctx, 9 / this.camera.zoom)
        ctx.fillStyle = '#888888'
        ctx.font = `${9 / this.camera.zoom}px monospace`
        ctx.fillText(displayKey, x, y - halfSize + 18)
      }

      // Draw entity indicators
      this.drawEntityIndicators(ctx, room, x, y, halfSize)

      // Draw up/down indicators
      this.drawVerticalExitIndicators(ctx, room, x, y, halfSize)
    }

    ctx.globalAlpha = 1
  }

  // Truncate text to fit within maxWidth
  truncateText(text, maxWidth, ctx, fontSize) {
    if (!text) return ''
    ctx.font = `${fontSize}px sans-serif`

    if (ctx.measureText(text).width <= maxWidth) {
      return text
    }

    let truncated = text
    while (truncated.length > 0 && ctx.measureText(truncated + '…').width > maxWidth) {
      truncated = truncated.slice(0, -1)
    }
    return truncated + '…'
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

    // Use a single consistent color for all connections
    const color = '#666677'

    // Calculate start and end points (offset from room edges)
    const offset = this.roomSize / 2 + 2

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
    ctx.lineWidth = 3 / this.camera.zoom
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.lineTo(endX, endY)
    ctx.stroke()
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
