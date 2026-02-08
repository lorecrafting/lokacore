/**
 * @file panel_resize.js - Draggable panel dividers for World Builder layout
 *
 * LLM CONTEXT:
 * - This hook uses HYBRID listener management: HookHelper for document-level
 *   listeners, but MANUAL management for handle-level listeners because
 *   updated() must re-attach listeners to new DOM handles after LiveView patches
 * - Apply CSS changes locally during drag via requestAnimationFrame
 * - Only pushEvent on mouseup/touchend to sync final state to server
 * - Panel config (min/max/default) is in PANEL_CONFIG constant
 * - Grid layout uses --grid-columns CSS custom property with specific column indices
 *   (hierarchy=0, inspector=4, terminal=6, chat=8)
 * - Console panel uses --console-height instead of grid columns (vertical resize)
 * - localSizes tracks sizes during drag for accurate grid rebuilds
 *
 * DO NOT:
 * - Use HookHelper for handle-level listeners (they need updated() re-attachment)
 * - Call pushEvent in mousemove/touchmove handlers (causes lag)
 * - Hardcode panel sizes -- use PANEL_CONFIG
 * - Forget to cancel rafId in destroyed() or drag end
 *
 * EVENTS:
 * pushEvent (JS -> Server):
 *   - resize_panel { panel, size } -- on drag end
 *   - restore_panel_sizes { sizes } -- on mount from localStorage
 *
 * handleEvent (Server -> JS):
 *   - (none)
 *
 * @related
 *   - assets/css/world-builder/layout.css (.panel-resize-handle styles)
 *   - lib/loka_web/live/admin_live/world_builder_live.ex (handle_event handlers)
 * @used_by WorldBuilderLive
 */

import { HookHelper } from '../world_builder/HookHelper.js'
import { STORAGE_KEYS } from '../world_builder/storageKeys.js'

const PANEL_CONFIG = {
  console: {
    selector: '.world-builder-console',
    dimension: 'offsetHeight',
    defaultSize: 150,
    min: 80,
    max: 400,
    direction: 'vertical',
  },
  hierarchy: {
    selector: '.world-builder-hierarchy',
    dimension: 'offsetWidth',
    defaultSize: 200,
    min: 150,
    max: 400,
    direction: 'horizontal-right',
  },
  inspector: {
    selector: '.world-builder-inspector',
    dimension: 'offsetWidth',
    defaultSize: 260,
    min: 200,
    max: 500,
    direction: 'horizontal-left',
  },
  terminal: {
    selector: '.world-builder-terminal',
    dimension: 'offsetWidth',
    defaultSize: 320,
    min: 200,
    max: 500,
    direction: 'horizontal-left',
  },
  chat: {
    selector: '.world-builder-chat',
    dimension: 'offsetWidth',
    defaultSize: 320,
    min: 200,
    max: 500,
    direction: 'horizontal-left',
  },
}

// Grid column indices for each panel in --grid-columns
// Layout: hierarchy(0) h_resize(1) viewport(2) i_resize(3) inspector(4) t_resize(5) terminal(6) c_resize(7) chat(8)
const GRID_COLUMN_INDEX = {
  hierarchy: 0,
  inspector: 4,
  terminal: 6,
  chat: 8,
}

const PanelResize = {
  mounted() {
    try {
      // One-time migration from old key name
      const oldKey = 'world-builder-panel-sizes'
      const oldValue = localStorage.getItem(oldKey)
      if (oldValue && !localStorage.getItem(STORAGE_KEYS.PANEL_SIZES)) {
        localStorage.setItem(STORAGE_KEYS.PANEL_SIZES, oldValue)
        localStorage.removeItem(oldKey)
        console.log('[PanelResize] Migrated storage key from kebab-case to snake_case')
      }

      this.helper = new HookHelper(this)
      this.container = this.el
      if (!this.container) {
        console.warn('[PanelResize] Container element not found')
        return
      }

      this.handles = this.el.querySelectorAll('.panel-resize-handle, .console-resize-handle')
      if (!this.handles || this.handles.length === 0) {
        console.warn('[PanelResize] No resize handles found')
      }

      this.isDragging = false
      this.currentHandle = null
      this.startX = 0
      this.startY = 0
      this.startSize = 0
      this.rafId = null

      // Track current sizes locally for grid rebuilds during drag
      this.localSizes = this.parseCurrentSizes()

      // Load saved sizes from localStorage (batched single event)
      this.loadSavedSizes()

      // Bind drag handlers (handle-level listeners are managed manually for updated() re-attachment)
      this.handleMouseDown = this.handleMouseDown.bind(this)
      this.handleTouchStart = this.handleTouchStart.bind(this)

      // Attach listeners to all resize handles
      this.handles.forEach((handle) => {
        handle.addEventListener('mousedown', this.handleMouseDown)
        handle.addEventListener('touchstart', this.handleTouchStart)
        handle.style.touchAction = 'none'
      })

      // Global mouse/touch events for dragging (auto-cleaned by HookHelper)
      this.helper.on(document, 'mousemove', this.handleMouseMove.bind(this))
      this.helper.on(document, 'mouseup', this.handleMouseUp.bind(this))
      this.helper.on(document, 'touchmove', this.handleTouchMove.bind(this), { passive: false })
      this.helper.on(document, 'touchend', this.handleTouchEnd.bind(this))
    } catch (err) {
      console.error('[PanelResize] Failed to initialize:', err)
    }
  },

  getPointerPosition(e) {
    if (e.touches) return { x: e.touches[0].clientX, y: e.touches[0].clientY }
    return { x: e.clientX, y: e.clientY }
  },

  parseCurrentSizes() {
    const sizes = {}
    for (const [panel, config] of Object.entries(PANEL_CONFIG)) {
      const el = this.container.querySelector(config.selector)
      sizes[panel] = el ? el[config.dimension] : config.defaultSize
    }
    return sizes
  },

  getPanelSize(panel) {
    const config = PANEL_CONFIG[panel]
    if (!config) return 0
    const el = this.container.querySelector(config.selector)
    return el ? el[config.dimension] : config.defaultSize
  },

  loadSavedSizes() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PANEL_SIZES)
      if (saved) {
        const sizes = JSON.parse(saved)
        // Send all sizes in a single batched event
        this.pushEvent('restore_panel_sizes', { sizes })
      }
    } catch (e) {
      console.warn('[PanelResize] Failed to load saved sizes:', e)
    }
  },

  saveSizes(panel, size) {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PANEL_SIZES)
      const sizes = saved ? JSON.parse(saved) : {}
      sizes[panel] = size
      localStorage.setItem(STORAGE_KEYS.PANEL_SIZES, JSON.stringify(sizes))
    } catch (e) {
      console.warn('[PanelResize] Failed to save sizes:', e)
    }
  },

  // Apply --grid-columns directly to the DOM (no server roundtrip)
  applyLocalGridColumns(panel, size) {
    this.localSizes[panel] = size

    if (panel === 'console') {
      this.container.style.setProperty('--console-height', `${size}px`)
      return
    }

    // Read current grid-template-columns and update the relevant column
    const style = getComputedStyle(this.container)
    const currentColumns = style.getPropertyValue('--grid-columns').trim()
    if (!currentColumns) return

    const cols = currentColumns.split(/\s+/)
    const colIndex = GRID_COLUMN_INDEX[panel]
    if (colIndex !== undefined && colIndex < cols.length) {
      cols[colIndex] = `${size}px`
      this.container.style.setProperty('--grid-columns', cols.join(' '))
    }
  },

  startDrag(e, handle) {
    this.isDragging = true
    this.currentHandle = handle
    this.currentHandle.classList.add('dragging')

    const pos = this.getPointerPosition(e)
    this.startX = pos.x
    this.startY = pos.y

    const panel = this.currentHandle.dataset.resize
    this.startSize = this.getPanelSize(panel)

    // Snapshot current sizes at drag start for accurate grid rebuilds
    this.localSizes = this.parseCurrentSizes()

    const config = PANEL_CONFIG[panel]
    document.body.style.userSelect = 'none'
    document.body.style.cursor =
      config && config.direction === 'vertical' ? 'row-resize' : 'col-resize'
  },

  moveDrag(e) {
    if (!this.isDragging || !this.currentHandle) return

    const panel = this.currentHandle.dataset.resize
    const config = PANEL_CONFIG[panel]
    if (!config) return

    const pos = this.getPointerPosition(e)

    let newSize
    if (config.direction === 'vertical') {
      const delta = this.startY - pos.y
      newSize = Math.max(config.min, Math.min(config.max, this.startSize + delta))
    } else if (config.direction === 'horizontal-right') {
      const delta = pos.x - this.startX
      newSize = Math.max(config.min, Math.min(config.max, this.startSize + delta))
    } else {
      // horizontal-left (drag left = bigger)
      const delta = this.startX - pos.x
      newSize = Math.max(config.min, Math.min(config.max, this.startSize + delta))
    }

    // Apply CSS locally via requestAnimationFrame (no server roundtrip)
    const size = Math.round(newSize)
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.rafId = requestAnimationFrame(() => {
      this.applyLocalGridColumns(panel, size)
    })
  },

  endDrag() {
    if (this.isDragging && this.currentHandle) {
      this.currentHandle.classList.remove('dragging')
      const panel = this.currentHandle.dataset.resize
      if (this.rafId) cancelAnimationFrame(this.rafId)

      // Read the actual rendered size for accuracy
      const finalSize = this.getPanelSize(panel)
      this.saveSizes(panel, finalSize)

      // Sync final size to server (single event on drag end)
      this.pushEvent('resize_panel', { panel, size: finalSize })
    }

    this.isDragging = false
    this.currentHandle = null
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  },

  handleMouseDown(e) {
    e.preventDefault()
    this.startDrag(e, e.target)
  },

  handleMouseMove(e) {
    this.moveDrag(e)
  },

  handleMouseUp() {
    this.endDrag()
  },

  handleTouchStart(e) {
    e.preventDefault()
    this.startDrag(e, e.target)
  },

  handleTouchMove(e) {
    e.preventDefault()
    this.moveDrag(e)
  },

  handleTouchEnd(e) {
    e.preventDefault()
    this.endDrag()
  },

  updated() {
    // Re-attach listeners to handles that may have been replaced by LiveView patches
    if (!this.handles) return
    const newHandles = this.el.querySelectorAll('.panel-resize-handle, .console-resize-handle')
    // Remove old listeners
    this.handles.forEach((handle) => {
      handle.removeEventListener('mousedown', this.handleMouseDown)
      handle.removeEventListener('touchstart', this.handleTouchStart)
    })
    // Attach to new handles
    this.handles = newHandles
    this.handles.forEach((handle) => {
      handle.addEventListener('mousedown', this.handleMouseDown)
      handle.addEventListener('touchstart', this.handleTouchStart)
      handle.style.touchAction = 'none'
    })
  },

  destroyed() {
    if (this.handles) {
      this.handles.forEach((handle) => {
        handle.removeEventListener('mousedown', this.handleMouseDown)
        handle.removeEventListener('touchstart', this.handleTouchStart)
      })
    }
    // Document-level listeners cleaned by HookHelper
    if (this.helper) this.helper.destroy()
    if (this.rafId) cancelAnimationFrame(this.rafId)
  },
}

export default PanelResize
