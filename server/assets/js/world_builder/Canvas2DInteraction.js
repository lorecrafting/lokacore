/**
 * @file Canvas2DInteraction - User interaction handler for the 2D World Builder Viewport
 * @context
 *   - Handles all user input: mouse events (click, drag, pan, zoom),
 *     keyboard events (shift-snap), resize observation, and tooltip management
 *   - Extracted from Canvas2DViewport for separation of concerns
 *   - Delegates rendering to viewport, maintains interaction state locally
 * @related
 *   - assets/js/world_builder/Canvas2DViewport.js (orchestrator, owns state)
 *   - assets/js/world_builder/Canvas2DRenderer.js (drawing operations)
 */

/**
 * @typedef {import('./Canvas2DViewport.js').default} Canvas2DViewport
 * @typedef {import('./Canvas2DViewport.js').Room} Room
 * @typedef {import('./Canvas2DViewport.js').Point} Point
 */

/**
 * Interaction state for drag operations.
 * @typedef {Object} DragState
 * @property {boolean} isDragging - Whether any drag is in progress
 * @property {boolean} isDraggingRoom - Whether dragging a room (vs panning)
 * @property {Room|null} draggedRoom - The room being dragged, if any
 * @property {Point} dragRoomStartPos - Original position of dragged room
 * @property {Point} dragStart - Screen position where drag started
 * @property {Point} lastMousePos - Last known mouse position
 */

export class Canvas2DInteraction {
  /**
   * Creates a new Canvas2DInteraction instance.
   * @param {HTMLCanvasElement} canvas - The canvas element to attach handlers to
   * @param {Canvas2DViewport} viewport - The parent viewport orchestrator
   */
  constructor(canvas, viewport) {
    /** @type {HTMLCanvasElement} */
    this.canvas = canvas
    /** @type {Canvas2DViewport} */
    this.viewport = viewport

    // Interaction state
    /** @type {boolean} Whether any drag is in progress */
    this.isDragging = false
    /** @type {boolean} Whether dragging a room (vs panning camera) */
    this.isDraggingRoom = false
    /** @type {Room|null} The room currently being dragged */
    this.draggedRoom = null
    /** @type {Point} Original position of the dragged room */
    this.dragRoomStartPos = { x: 0, y: 0 }
    /** @type {Point} Screen position where drag started */
    this.dragStart = { x: 0, y: 0 }
    /** @type {Point} Last known mouse position */
    this.lastMousePos = { x: 0, y: 0 }
    /** @type {Room|null} Currently hovered room for tooltip */
    this.hoveredRoom = null
    /** @type {boolean} Whether shift key is held for grid snapping */
    this.isSnapping = false
    /** @type {Point|null} Current snap indicator position in world coords */
    this.snapIndicator = null

    /** @type {HTMLDivElement|null} Tooltip DOM element */
    this.tooltip = null
    /** @type {ResizeObserver|null} Canvas resize observer */
    this.resizeObserver = null

    // Bound handlers for cleanup
    /** @private @type {function(MouseEvent): void} */
    this.boundMouseDown = this.handleMouseDown.bind(this)
    /** @private @type {function(MouseEvent): void} */
    this.boundMouseMove = this.handleMouseMove.bind(this)
    /** @private @type {function(MouseEvent): void} */
    this.boundMouseUp = this.handleMouseUp.bind(this)
    /** @private @type {function(MouseEvent): void} */
    this.boundMouseLeave = this.handleMouseLeave.bind(this)
    /** @private @type {function(WheelEvent): void} */
    this.boundWheel = this.handleWheel.bind(this)
    /** @private @type {function(Event): void} */
    this.boundContextMenu = (e) => e.preventDefault()
    /** @private @type {function(KeyboardEvent): void} */
    this.boundKeyDown = this.handleKeyDown.bind(this)
    /** @private @type {function(KeyboardEvent): void} */
    this.boundKeyUp = this.handleKeyUp.bind(this)
  }

  // ============================================================================
  // Setup / Teardown
  // ============================================================================

  /**
   * Attach all event listeners and observers to the canvas.
   * Should be called once during viewport initialization.
   * @returns {void}
   */
  attach() {
    // Mouse events
    this.canvas.addEventListener('mousedown', this.boundMouseDown)
    this.canvas.addEventListener('mousemove', this.boundMouseMove)
    this.canvas.addEventListener('mouseup', this.boundMouseUp)
    this.canvas.addEventListener('mouseleave', this.boundMouseLeave)
    this.canvas.addEventListener('wheel', this.boundWheel, { passive: false })
    this.canvas.addEventListener('contextmenu', this.boundContextMenu)

    // Resize handling (debounced to avoid rapid-fire resets during window resize)
    this._resizeRAF = null
    this.resizeObserver = new ResizeObserver(() => {
      if (this._resizeRAF) cancelAnimationFrame(this._resizeRAF)
      this._resizeRAF = requestAnimationFrame(() => {
        this._resizeRAF = null
        this.viewport.setupCanvas()
        this.viewport.markDirty()
        this.viewport.render()
      })
    })
    this.resizeObserver.observe(this.canvas)

    // Keyboard events for shift-snap tracking
    document.addEventListener('keydown', this.boundKeyDown)
    document.addEventListener('keyup', this.boundKeyUp)

    // Create tooltip element
    this.createTooltip()
  }

  /**
   * Detach all event listeners and observers.
   * Should be called when the viewport is destroyed.
   * @returns {void}
   */
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

    if (this._resizeRAF) {
      cancelAnimationFrame(this._resizeRAF)
      this._resizeRAF = null
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

  /**
   * Create the tooltip DOM element and append to canvas parent.
   * @returns {void}
   */
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

  /**
   * Show the tooltip with room information at the given screen position.
   * Displays room name, key, coordinates, exits, NPCs, and items.
   * @param {Room} room - Room to show information for
   * @param {number} screenX - Screen X position in pixels
   * @param {number} screenY - Screen Y position in pixels
   * @returns {void}
   */
  showTooltip(room, screenX, screenY) {
    if (!this.tooltip || !room) return

    const spawns = room.spawns || {}
    const npcs = spawns.npcs || []
    const items = spawns.items || []
    const exits = room.exits || {}
    const exitCount = Object.keys(exits).length

    const html = `
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

  /**
   * Hide the tooltip element.
   * @returns {void}
   */
  hideTooltip() {
    if (this.tooltip) {
      this.tooltip.style.display = 'none'
    }
  }

  /**
   * Remove the tooltip element from the DOM.
   * @returns {void}
   */
  destroyTooltip() {
    if (this.tooltip && this.tooltip.parentElement) {
      this.tooltip.parentElement.removeChild(this.tooltip)
      this.tooltip = null
    }
  }

  // ============================================================================
  // Keyboard Event Handlers
  // ============================================================================

  /**
   * Handle keydown events for shift-snap tracking.
   * @param {KeyboardEvent} e - Keyboard event
   * @returns {void}
   */
  handleKeyDown(e) {
    if (e.key === 'Shift') {
      this.isSnapping = true
      if (this.isDraggingRoom) {
        this.viewport.markDirty()
        this.viewport.render()
      }
    }
  }

  /**
   * Handle keyup events for shift-snap tracking.
   * @param {KeyboardEvent} e - Keyboard event
   * @returns {void}
   */
  handleKeyUp(e) {
    if (e.key === 'Shift') {
      this.isSnapping = false
      this.snapIndicator = null
      if (this.isDraggingRoom) {
        this.viewport.markDirty()
        this.viewport.render()
      }
    }
  }

  // ============================================================================
  // Mouse Event Handlers
  // ============================================================================

  /**
   * Handle mousedown events - start room drag or camera pan.
   * Clicking on a room starts room drag and selects it.
   * Clicking on empty space starts camera pan.
   * @param {MouseEvent} e - Mouse event
   * @returns {void}
   */
  handleMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    this.lastMousePos = { x, y }
    this.dragStart = { x, y }

    // Check if clicking on a room
    const room = this.viewport.getRoomAtPoint(x, y)

    if (room) {
      const isMultiSelect = e.shiftKey || e.metaKey

      if (isMultiSelect) {
        // Shift/Cmd+click: toggle room in multi-selection
        if (this.viewport.selectedKeys.has(room.key)) {
          this.viewport.selectedKeys.delete(room.key)
        } else {
          this.viewport.selectedKeys.add(room.key)
        }
        this.viewport.onBatchSelect(Array.from(this.viewport.selectedKeys))
        this.viewport.markDirty()
        this.viewport.render()
        return
      }

      // Regular click - start dragging the room
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
      this.viewport.markDirty()
      this.viewport.render()
    } else {
      // Empty space click - start panning
      this.isDragging = true
      this.isDraggingRoom = false
      this.draggedRoom = null
      this.canvas.style.cursor = 'grabbing'
    }
  }

  /**
   * Handle mousemove events - update drag position or hover state.
   * During room drag: updates room position, applies grid snap if shift held.
   * During pan: updates camera position.
   * Otherwise: updates cursor and shows/hides tooltip on hover.
   * @param {MouseEvent} e - Mouse event
   * @returns {void}
   */
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
        this.viewport.markDirty()
        this.viewport.render()
      } else {
        // Pan the camera
        const dx = (x - this.lastMousePos.x) / this.viewport.camera.zoom
        const dy = (y - this.lastMousePos.y) / this.viewport.camera.zoom
        this.viewport.camera.x += dx
        this.viewport.camera.y += dy
        this.hideTooltip()
        this.viewport.markDirty()
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

  /**
   * Handle mouseup events - finalize room drag or pan.
   * Fires onMoveRoom callback if room position changed.
   * @param {MouseEvent} e - Mouse event
   * @returns {void}
   */
  handleMouseUp(_e) {
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
    this.viewport.markDirty()
    this.viewport.render()
  }

  /**
   * Handle mouseleave events - cancel drag and restore original position.
   * Room drags are cancelled and restored; pan drags are just stopped.
   * @param {MouseEvent} e - Mouse event
   * @returns {void}
   */
  handleMouseLeave(_e) {
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
      this.viewport.markDirty()
      this.viewport.render()
    } else if (this.isDragging) {
      // Cancel pan drag
      this.isDragging = false
      this.canvas.style.cursor = 'grab'
    }
  }

  /**
   * Handle wheel events - zoom in/out centered on mouse position.
   * Clears truncation cache when zoom changes.
   * @param {WheelEvent} e - Wheel event
   * @returns {void}
   */
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

    this.viewport.markDirty()
    this.viewport.render()
  }
}
