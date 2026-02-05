/**
 * Canvas2DInteraction - User interaction handler for the 2D World Builder Viewport
 *
 * Handles all user input: mouse events (click, drag, pan, zoom),
 * keyboard events (shift-snap), touch events, resize observation,
 * and tooltip management.
 * Extracted from Canvas2DViewport for separation of concerns.
 */

export class Canvas2DInteraction {
  /**
   * @param {HTMLCanvasElement} canvas - The canvas element
   * @param {Canvas2DViewport} viewport - The parent viewport orchestrator
   */
  constructor(canvas, viewport) {
    this.canvas = canvas
    this.viewport = viewport

    // Interaction state
    this.isDragging = false
    this.isDraggingRoom = false
    this.draggedRoom = null
    this.dragRoomStartPos = { x: 0, y: 0 }
    this.dragStart = { x: 0, y: 0 }
    this.lastMousePos = { x: 0, y: 0 }
    this.hoveredRoom = null
    this.isSnapping = false
    this.snapIndicator = null

    // Tooltip element
    this.tooltip = null

    // Bound handlers for cleanup
    this.boundMouseDown = this.handleMouseDown.bind(this)
    this.boundMouseMove = this.handleMouseMove.bind(this)
    this.boundMouseUp = this.handleMouseUp.bind(this)
    this.boundMouseLeave = this.handleMouseLeave.bind(this)
    this.boundWheel = this.handleWheel.bind(this)
    this.boundContextMenu = (e) => e.preventDefault()
    this.boundKeyDown = this.handleKeyDown.bind(this)
    this.boundKeyUp = this.handleKeyUp.bind(this)
  }

  // ============================================================================
  // Setup / Teardown
  // ============================================================================

  attach() {
    // Mouse events
    this.canvas.addEventListener('mousedown', this.boundMouseDown)
    this.canvas.addEventListener('mousemove', this.boundMouseMove)
    this.canvas.addEventListener('mouseup', this.boundMouseUp)
    this.canvas.addEventListener('mouseleave', this.boundMouseLeave)
    this.canvas.addEventListener('wheel', this.boundWheel, { passive: false })
    this.canvas.addEventListener('contextmenu', this.boundContextMenu)

    // Resize handling
    this.resizeObserver = new ResizeObserver(() => {
      this.viewport.setupCanvas()
      this.viewport.render()
    })
    this.resizeObserver.observe(this.canvas)

    // Keyboard events for shift-snap tracking
    document.addEventListener('keydown', this.boundKeyDown)
    document.addEventListener('keyup', this.boundKeyUp)

    // Create tooltip element
    this.createTooltip()
  }

  detach() {
    // Remove canvas event listeners
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this.boundMouseDown)
      this.canvas.removeEventListener('mousemove', this.boundMouseMove)
      this.canvas.removeEventListener('mouseup', this.boundMouseUp)
      this.canvas.removeEventListener('mouseleave', this.boundMouseLeave)
      this.canvas.removeEventListener('wheel', this.boundWheel)
      this.canvas.removeEventListener('contextmenu', this.boundContextMenu)
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
    }

    this.destroyTooltip()

    document.removeEventListener('keydown', this.boundKeyDown)
    document.removeEventListener('keyup', this.boundKeyUp)
  }

  // ============================================================================
  // Tooltip
  // ============================================================================

  createTooltip() {
    this.tooltip = document.createElement('div')
    this.tooltip.className = 'viewport-tooltip'
    this.tooltip.style.cssText = `
      position: absolute;
      background: var(--wb-panel);
      border: 1px solid var(--wb-border);
      border-radius: var(--wb-radius-lg);
      padding: 8px 12px;
      font-size: 12px;
      color: var(--wb-text);
      pointer-events: none;
      z-index: 1000;
      display: none;
      max-width: 250px;
      box-shadow: var(--wb-shadow-md);
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
      <div style="font-weight: bold; color: var(--wb-text-bright); margin-bottom: 4px;">${room.name || room.key}</div>
      <div style="font-size: 10px; color: var(--wb-text-muted); margin-bottom: 6px;">${room.key}</div>
      <div style="font-size: 11px; color: var(--wb-text);">
        <div>\u{1F4CD} (${room.x || 0}, ${room.y || 0}, Z:${room.z || 0})</div>
        ${exitCount > 0 ? `<div>\u{1F6AA} ${exitCount} exit${exitCount > 1 ? 's' : ''}</div>` : ''}
        ${npcs.length > 0 ? `<div>\u{1F464} ${npcs.length} NPC${npcs.length > 1 ? 's' : ''}: ${npcs.slice(0, 3).join(', ')}${npcs.length > 3 ? '...' : ''}</div>` : ''}
        ${items.length > 0 ? `<div>\u{1F4E6} ${items.length} item${items.length > 1 ? 's' : ''}</div>` : ''}
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

  destroyTooltip() {
    if (this.tooltip && this.tooltip.parentElement) {
      this.tooltip.parentElement.removeChild(this.tooltip)
      this.tooltip = null
    }
  }

  // ============================================================================
  // Keyboard Event Handlers
  // ============================================================================

  handleKeyDown(e) {
    if (e.key === 'Shift') {
      this.isSnapping = true
      if (this.isDraggingRoom) {
        this.viewport.render()
      }
    }
  }

  handleKeyUp(e) {
    if (e.key === 'Shift') {
      this.isSnapping = false
      this.snapIndicator = null
      if (this.isDraggingRoom) {
        this.viewport.render()
      }
    }
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
    const room = this.viewport.getRoomAtPoint(x, y)

    if (room) {
      // Room click - start dragging the room
      this.isDragging = true
      this.isDraggingRoom = true
      this.draggedRoom = room
      this.dragRoomStartPos = { x: room.x || 0, y: room.y || 0 }
      this.canvas.style.cursor = 'move'

      // Also select the room if not already selected
      if (!this.viewport.selectedKeys.has(room.key)) {
        this.viewport.selectedKeys.clear()
        this.viewport.onSelectRoom(room.key, false)
      }
      this.viewport.render()
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
        const worldPos = this.viewport.screenToWorld(x, y)
        let newX = worldPos.x
        let newY = worldPos.y

        // Apply grid snapping if shift is held
        if (this.isSnapping) {
          const snapWorld = this.viewport.snapSize / this.viewport.gridSize
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
        this.viewport.render()
      } else {
        // Pan the camera
        const dx = (x - this.lastMousePos.x) / this.viewport.camera.zoom
        const dy = (y - this.lastMousePos.y) / this.viewport.camera.zoom
        this.viewport.camera.x += dx
        this.viewport.camera.y += dy
        this.hideTooltip()
        this.viewport.render()
      }
    } else {
      // Update cursor and tooltip based on what's under mouse
      const room = this.viewport.getRoomAtPoint(x, y)
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
        this.viewport.onMoveRoom(this.draggedRoom.key, newX, newY)
      }
    }

    this.isDragging = false
    this.isDraggingRoom = false
    this.draggedRoom = null
    this.snapIndicator = null
    this.canvas.style.cursor = 'grab'
    this.viewport.render()
  }

  handleMouseLeave(e) {
    this.hideTooltip()
    this.hoveredRoom = null

    // Cancel in-progress room drag and restore original position
    if (this.isDraggingRoom && this.draggedRoom) {
      this.draggedRoom.x = this.dragRoomStartPos.x
      this.draggedRoom.y = this.dragRoomStartPos.y
      this.isDragging = false
      this.isDraggingRoom = false
      this.draggedRoom = null
      this.snapIndicator = null
      this.canvas.style.cursor = 'grab'
      this.viewport.render()
    } else if (this.isDragging) {
      // Cancel pan drag
      this.isDragging = false
      this.canvas.style.cursor = 'grab'
    }
  }

  handleWheel(e) {
    e.preventDefault()

    const rect = this.canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    // Get world position before zoom
    const worldBefore = this.viewport.screenToWorld(mouseX, mouseY)

    // Apply zoom
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
    const oldZoom = this.viewport.camera.zoom
    this.viewport.camera.zoom = Math.max(
      this.viewport.minZoom,
      Math.min(this.viewport.maxZoom, this.viewport.camera.zoom * zoomFactor)
    )

    // Clear truncation cache when zoom changes (fontSize depends on zoom)
    if (this.viewport.camera.zoom !== oldZoom) {
      this.viewport.renderer.clearTruncateCache()
    }

    // Get world position after zoom
    const worldAfter = this.viewport.screenToWorld(mouseX, mouseY)

    // Adjust camera to keep mouse position stable
    this.viewport.camera.x += (worldAfter.x - worldBefore.x) * this.viewport.gridSize
    this.viewport.camera.y += (worldAfter.y - worldBefore.y) * this.viewport.gridSize

    this.viewport.render()
  }
}
