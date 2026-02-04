// You can include dependencies in two ways.
//
// The simplest option is to put them in assets/vendor and
// import them using relative paths:
//
//     import "../vendor/some-package.js"
//
// Alternatively, you can `npm install some-package --prefix assets` and import
// them using a path starting with the package name:
//
//     import "some-package"
//
// If you have dependencies that try to import CSS, esbuild will generate a separate `app.css` file.
// To load it, simply add a second `<link>` to your `root.html.heex` file.

// Include phoenix_html to handle method=PUT/DELETE in forms and buttons.
import "phoenix_html"
// Establish Phoenix Socket and LiveView configuration.
import {Socket} from "phoenix"
import {LiveSocket} from "phoenix_live_view"
import {hooks as colocatedHooks} from "phoenix-colocated/loka"
import topbar from "../vendor/topbar"

// World Builder
import Canvas2DViewport from "./world_builder/Canvas2DViewport.js"
import { undoManager } from "./world_builder/UndoManager.js"

// CodeMirror 6 for script editor
import { EditorView, basicSetup } from "codemirror"
import { StreamLanguage } from "@codemirror/language"
import { oneDark } from "@codemirror/theme-one-dark"

// Custom hooks for ebook-style game client
const Hooks = {
  // Auto-scroll to bottom on content updates (for chat panels)
  ScrollBottom: {
    mounted() {
      this.scrollToBottom()
    },
    updated() {
      this.scrollToBottom()
    },
    scrollToBottom() {
      this.el.scrollTop = this.el.scrollHeight
    }
  },

  // Room scroll behavior - scrolls room description away as events grow
  // Also handles room transition animations when navigating
  RoomScroll: {
    mounted() {
      this.eventThreshold = 3
      this.isManuallyExpanded = false
      this.currentRoomId = this.el.dataset.roomId
      this.setupCollapsedHeader()
      this.checkScrollState()
      this.scrollEventsToBottom()

      // Start with fade-in animation on initial mount
      this.el.classList.add('ebook-room-scroll--entering')
      requestAnimationFrame(() => {
        this.el.classList.remove('ebook-room-scroll--entering')
      })
    },
    updated() {
      const newRoomId = this.el.dataset.roomId

      // If room changed, trigger fade-in animation
      if (newRoomId !== this.currentRoomId) {
        this.currentRoomId = newRoomId
        this.isManuallyExpanded = false

        // Reset scroll state for new room
        this.el.classList.remove('ebook-room-scroll--scrolled')

        // Remove leaving class and add entering class (opacity 0)
        this.el.classList.remove('ebook-room-scroll--leaving')
        this.el.classList.add('ebook-room-scroll--entering')

        // Force reflow to ensure opacity:0 is painted
        void this.el.offsetHeight

        // Remove entering class to trigger fade-in transition
        // The transition will animate from 0 to 1
        requestAnimationFrame(() => {
          this.el.classList.remove('ebook-room-scroll--entering')
        })
      }

      this.checkScrollState()
      this.scrollEventsToBottom()
    },
    setupCollapsedHeader() {
      const collapsedHeader = this.el.querySelector('.ebook-room-collapsed-header')
      if (collapsedHeader && !collapsedHeader._clickHandlerAttached) {
        collapsedHeader._clickHandlerAttached = true
        collapsedHeader.addEventListener('click', () => {
          this.isManuallyExpanded = true
          this.el.classList.remove('ebook-room-scroll--scrolled')
        })
      }
    },
    checkScrollState() {
      const eventsContainer = this.el.querySelector('.ebook-events')
      const eventCount = eventsContainer ? eventsContainer.querySelectorAll('.ebook-event').length : 0

      // Reset manual expansion when events are cleared
      if (eventCount === 0) {
        this.isManuallyExpanded = false
        this.el.classList.remove('ebook-room-scroll--scrolled')
        return
      }

      if (this.isManuallyExpanded) return

      if (eventCount >= this.eventThreshold) {
        this.el.classList.add('ebook-room-scroll--scrolled')
      }
    },
    scrollEventsToBottom() {
      const eventsContainer = this.el.querySelector('.ebook-events')
      if (eventsContainer) {
        requestAnimationFrame(() => {
          eventsContainer.scrollTop = eventsContainer.scrollHeight
        })
      }
    },
    resetScroll() {
      this.isManuallyExpanded = false
      this.el.classList.remove('ebook-room-scroll--scrolled')
    }
  },

  // Auto-scroll events section to keep latest events visible
  // Note: RoomScroll hook also handles this, but keeping for standalone use
  EbookEvents: {
    mounted() {
      this.scrollToBottom()
    },
    updated() {
      this.scrollToBottom()
    },
    scrollToBottom() {
      this.el.scrollTop = this.el.scrollHeight
    }
  },
  // Auto-scroll dialogue log to keep conversation flowing
  DialogueScroll: {
    mounted() {
      this.scrollToBottom()
    },
    updated() {
      this.scrollToBottom()
    },
    scrollToBottom() {
      this.el.scrollTop = this.el.scrollHeight
    }
  },
  // Tap-based compass rose navigation with minimap
  // Note: Clicking on directions should NOT trigger toggle_menu on the parent
  CompassRose: {
    mounted() {
      this.setupClickHandlers()
    },

    updated() {
      this.setupClickHandlers()
    },

    setupClickHandlers() {
      const directions = this.el.querySelectorAll('.ebook-compass-dir')
      directions.forEach(dir => {
        dir.onclick = (e) => {
          // Stop propagation to prevent toggle_menu from firing
          e.stopPropagation()

          if (dir.dataset.navEnabled !== 'true') return

          const direction = dir.dataset.direction
          const roomScroll = document.querySelector('.ebook-room-scroll')

          if (roomScroll) {
            roomScroll.classList.add('ebook-room-scroll--leaving')
            setTimeout(() => {
              this.pushEvent('navigate', { direction: direction })
            }, 200)
          } else {
            this.pushEvent('navigate', { direction: direction })
          }
        }
      })
    }
  },

  // Large compass for Move tab in menu pane
  LargeCompass: {
    mounted() {
      this.setupClickHandlers()
    },

    updated() {
      this.setupClickHandlers()
    },

    setupClickHandlers() {
      const directions = this.el.querySelectorAll('.ebook-large-compass-dir')
      directions.forEach(dir => {
        dir.onclick = (e) => {
          if (dir.dataset.navEnabled !== 'true') return

          const direction = dir.dataset.direction
          const roomScroll = document.querySelector('.ebook-room-scroll')

          if (roomScroll) {
            roomScroll.classList.add('ebook-room-scroll--leaving')
            setTimeout(() => {
              this.pushEvent('navigate', { direction: direction })
              // Close menu after navigation
              this.pushEvent('close_menu', {})
            }, 200)
          } else {
            this.pushEvent('navigate', { direction: direction })
            this.pushEvent('close_menu', {})
          }
        }
      })
    }
  },

  // Autofocus hook for inputs that need immediate focus when appearing
  Autofocus: {
    mounted() {
      this.el.focus()
    }
  },

  // Bardo death sequence countdown timer
  BardoTimer: {
    mounted() {
      const duration = parseInt(this.el.dataset.duration)
      const started = parseInt(this.el.dataset.started)

      const updateTimer = () => {
        const now = Date.now()
        const elapsed = now - started
        const remaining = Math.max(0, duration - elapsed)
        const seconds = Math.ceil(remaining / 1000)

        if (seconds > 0) {
          this.el.textContent = `Awaiting rebirth... (${seconds}s)`
          requestAnimationFrame(updateTimer)
        }
      }

      updateTimer()
    }
  },

  // World Map pan/zoom hook for admin World Designer
  WorldMap: {
    mounted() {
      this.scale = 1
      this.panX = 0
      this.panY = 0
      this.isPanning = false
      this.startX = 0
      this.startY = 0

      // Get the SVG and container
      this.svg = this.el.querySelector('svg')
      this.container = this.el

      if (!this.svg) return

      // Apply initial transform
      this.updateTransform()
      this.updateZoomIndicator()

      // Mouse wheel zoom
      this.el.addEventListener('wheel', this.handleZoom.bind(this), { passive: false })

      // Pan with mouse drag
      this.el.addEventListener('mousedown', this.startPan.bind(this))
      document.addEventListener('mousemove', this.doPan.bind(this))
      document.addEventListener('mouseup', this.endPan.bind(this))

      // Touch support
      this.el.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false })
      this.el.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false })
      this.el.addEventListener('touchend', this.endPan.bind(this))

      // Reset button and zoom indicator
      this.setupResetButton()
      this.setupZoomIndicator()
    },

    destroyed() {
      document.removeEventListener('mousemove', this.doPan.bind(this))
      document.removeEventListener('mouseup', this.endPan.bind(this))
    },

    handleZoom(e) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const newScale = Math.max(0.25, Math.min(3, this.scale * delta))

      // Zoom toward mouse position
      const rect = this.el.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const scaleChange = newScale / this.scale
      this.panX = mouseX - (mouseX - this.panX) * scaleChange
      this.panY = mouseY - (mouseY - this.panY) * scaleChange
      this.scale = newScale

      this.updateTransform()
      this.updateZoomIndicator()
    },

    startPan(e) {
      if (e.target.closest('[phx-click]')) return // Don't pan when clicking rooms
      this.isPanning = true
      this.startX = e.clientX - this.panX
      this.startY = e.clientY - this.panY
      this.el.style.cursor = 'grabbing'
    },

    doPan(e) {
      if (!this.isPanning) return
      this.panX = e.clientX - this.startX
      this.panY = e.clientY - this.startY
      this.updateTransform()
    },

    endPan() {
      this.isPanning = false
      this.el.style.cursor = 'grab'
    },

    handleTouchStart(e) {
      if (e.touches.length === 1) {
        const touch = e.touches[0]
        this.isPanning = true
        this.startX = touch.clientX - this.panX
        this.startY = touch.clientY - this.panY
      }
    },

    handleTouchMove(e) {
      if (!this.isPanning || e.touches.length !== 1) return
      e.preventDefault()
      const touch = e.touches[0]
      this.panX = touch.clientX - this.startX
      this.panY = touch.clientY - this.startY
      this.updateTransform()
    },

    updateTransform() {
      // Find the inner container that holds both SVG and room nodes
      const innerContainer = this.el.querySelector('.relative')
      if (!innerContainer) return

      innerContainer.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`
      innerContainer.style.transformOrigin = '0 0'
    },

    setupResetButton() {
      const resetBtn = this.el.parentElement?.querySelector('[data-reset-view]')
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          this.scale = 1
          this.panX = 0
          this.panY = 0
          this.updateTransform()
          this.updateZoomIndicator()
        })
      }
    },

    setupZoomIndicator() {
      // Find or create zoom indicator element
      this.zoomIndicator = this.el.parentElement?.querySelector('[data-zoom-level]')
    },

    updateZoomIndicator() {
      if (this.zoomIndicator) {
        const percentage = Math.round(this.scale * 100)
        this.zoomIndicator.textContent = `${percentage}%`
      }
    }
  },

  // =============================================================================
  // World Builder - 2D Canvas viewport (replaced React Three Fiber 3D)
  // =============================================================================
  WorldBuilder: {
    mounted() {
      console.log('[WorldBuilder] Mounting 2D Canvas viewport')

      // Get the canvas element (should be created by LiveView template)
      this.canvas = this.el.querySelector('canvas')
      if (!this.canvas) {
        // Create canvas if not present
        this.canvas = document.createElement('canvas')
        this.canvas.style.width = '100%'
        this.canvas.style.height = '100%'
        this.el.appendChild(this.canvas)
      }

      // Initialize state
      this.rooms = []
      this.selectedRoom = null
      this.selectedEntity = null
      this.selectedKeys = []
      this.validation = {}

      // Create 2D viewport
      this.viewport = new Canvas2DViewport(this.canvas, {
        onSelectRoom: (key, shiftKey) => {
          this.selectedRoom = key
          this.pushEvent('select_room', { key })
        },
        onBatchSelect: (keys) => {
          this.selectedKeys = keys
          this.pushEvent('batch_select', { keys })
        }
      })

      // Listen for room selection events from LiveView
      this.handleEvent('select_room', ({ key }) => {
        this.selectedRoom = key
        this.selectedEntity = null  // Clear entity selection when room selected
        this.viewport.setSelectedRoom(key)
      })

      // Listen for entity selection events (NPC/Item)
      this.handleEvent('select_entity', ({ type, key }) => {
        this.selectedEntity = { type, key }
        this.selectedRoom = null  // Clear room selection when entity selected
        this.viewport.setSelectedRoom(null)
      })

      // Listen for Z-level changes
      this.handleEvent('set_z_level', ({ level }) => {
        this.viewport.setZLevel(level)
      })

      // Listen for init event with rooms and validation data
      this.handleEvent('init_world_builder', ({ rooms, validation, zone_colors, room_zone_map, show_zone_colors, npc_paths, show_npc_paths }) => {
        console.log('[WorldBuilder] init_world_builder received:', rooms?.length, 'rooms')
        this.rooms = rooms
        this.validation = validation || {}
        this.viewport.setRooms(rooms)
        this.viewport.setValidation(validation)
        // Set zone visualization data
        if (zone_colors) {
          this.viewport.setZoneColors(zone_colors)
        }
        if (room_zone_map) {
          this.viewport.setRoomZoneMap(room_zone_map)
        }
        this.viewport.setShowZoneColors(show_zone_colors !== false)
        // Set NPC paths visualization data
        if (npc_paths) {
          this.viewport.setNPCPaths(npc_paths)
        }
        this.viewport.setShowNPCPaths(show_npc_paths !== false)
        // Auto-fit to show all rooms on init
        this.viewport.fitToRooms()
        // Update Z-level tabs
        this.updateZLevelTabs()
      })

      // Listen for zone colors toggle
      this.handleEvent('zone_colors_changed', ({ enabled, zone_colors, room_zone_map }) => {
        this.viewport.setShowZoneColors(enabled)
        if (zone_colors) {
          this.viewport.setZoneColors(zone_colors)
        }
        if (room_zone_map) {
          this.viewport.setRoomZoneMap(room_zone_map)
        }
      })

      // Listen for NPC paths toggle
      this.handleEvent('npc_paths_changed', ({ enabled, npc_paths }) => {
        this.viewport.setShowNPCPaths(enabled)
        if (npc_paths) {
          this.viewport.setNPCPaths(npc_paths)
        }
      })

      // Listen for rooms updated event (includes validation)
      this.handleEvent('rooms_updated', ({ rooms, validation }) => {
        this.rooms = rooms
        this.validation = validation || {}
        this.viewport.setRooms(rooms)
        this.viewport.setValidation(validation)
        this.updateZLevelTabs()
      })

      // Listen for room created event
      this.handleEvent('room_created', ({ room }) => {
        this.rooms = [...this.rooms, room]
        this.selectedRoom = room.key
        this.viewport.setRooms(this.rooms)
        this.viewport.setSelectedRoom(room.key)
        this.viewport.centerOnRoom(room.key)
        this.updateZLevelTabs()
      })

      // Listen for room updated event (single room)
      this.handleEvent('room_updated', ({ room }) => {
        this.rooms = this.rooms.map(r =>
          (r.id === room.id || r.key === room.key) ? room : r
        )
        this.viewport.setRooms(this.rooms)
      })

      // Listen for room deleted event
      this.handleEvent('room_deleted', ({ id }) => {
        this.rooms = this.rooms.filter(r => r.id !== id && r.key !== id)
        this.selectedRoom = null
        this.viewport.setRooms(this.rooms)
        this.viewport.setSelectedRoom(null)
        this.updateZLevelTabs()
      })

      // Listen for panel collapsed events (for localStorage sync)
      this.handleEvent('panel_collapsed', ({ panels }) => {
        localStorage.setItem('world_builder_collapsed_panels', JSON.stringify(panels))
      })

      // Restore collapsed state from localStorage on mount
      const savedPanels = localStorage.getItem('world_builder_collapsed_panels')
      if (savedPanels) {
        try {
          const panels = JSON.parse(savedPanels)
          if (panels.hierarchy) this.pushEvent('toggle_panel', { panel: 'hierarchy' })
          if (panels.inspector) this.pushEvent('toggle_panel', { panel: 'inspector' })
          if (panels.console) this.pushEvent('toggle_panel', { panel: 'console' })
        } catch (e) {
          // Invalid saved state, ignore
        }
      }

      // Setup undo/redo manager
      undoManager.setPushEvent((event, payload) => this.pushEvent(event, payload))
      undoManager.setOnStateChange((state) => {
        this.pushEvent('undo_state_changed', state)
      })

      // Listen for operation recording events from LiveView
      this.handleEvent('record_operation', ({ type, beforeState, afterState, metadata }) => {
        undoManager.record(type, beforeState, afterState, metadata)
      })

      this.handleEvent('begin_composite', ({ label }) => {
        undoManager.beginComposite(label)
      })

      this.handleEvent('end_composite', () => {
        undoManager.endComposite()
      })

      this.handleEvent('trigger_undo', () => {
        undoManager.undo()
      })

      this.handleEvent('trigger_redo', () => {
        undoManager.redo()
      })

      // Send initial undo state
      this.pushEvent('undo_state_changed', undoManager.getState())

      // Setup keyboard shortcuts
      this.keydownHandler = this.handleKeydown.bind(this)
      document.addEventListener('keydown', this.keydownHandler)

      // Setup Z-level tab click handlers
      this.setupZLevelTabs()
    },

    setupZLevelTabs() {
      // Find Z-level tab container and setup click handlers
      const tabContainer = document.querySelector('.z-level-tabs')
      if (tabContainer) {
        tabContainer.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-z-level]')
          if (btn) {
            const level = parseInt(btn.dataset.zLevel)
            this.viewport.setZLevel(level)
            this.updateZLevelTabs()
          }
        })
      }
    },

    updateZLevelTabs() {
      const tabContainer = document.querySelector('.z-level-tabs')
      if (!tabContainer || !this.viewport) return

      const zLevels = this.viewport.getZLevels()
      const currentLevel = this.viewport.currentZLevel

      // Generate tab HTML
      let html = ''
      for (const level of zLevels) {
        const isActive = level === currentLevel
        html += `<button class="z-level-tab ${isActive ? 'active' : ''}" data-z-level="${level}">Z: ${level}</button>`
      }
      tabContainer.innerHTML = html
    },

    handleKeydown(e) {
      // Skip if typing in an input/textarea or select
      const target = e.target
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) {
        if (e.key === 'Escape') target.blur()
        return
      }

      // Skip most shortcuts if a modal is open (except Escape to close it)
      const modalOpen = document.querySelector('.modal-overlay')
      if (modalOpen && e.key !== 'Escape') {
        // Only allow Escape key when modal is open
        return
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const modKey = isMac ? e.metaKey : e.ctrlKey

      // Ctrl+Z / Cmd+Z: Undo
      if (modKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undoManager.undo()
        return
      }

      // Ctrl+Shift+Z / Cmd+Shift+Z or Ctrl+Y / Cmd+Y: Redo
      if ((modKey && e.shiftKey && e.key.toLowerCase() === 'z') ||
          (modKey && e.key.toLowerCase() === 'y')) {
        e.preventDefault()
        undoManager.redo()
        return
      }

      // Ctrl+S / Cmd+S: Save (trigger validation)
      if (modKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        this.pushEvent('validate_all', {})
        return
      }

      // Delete / Backspace: Delete selected
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.selectedRoom) {
          e.preventDefault()
          this.pushEvent('delete_room', { id: this.selectedRoom })
        } else if (this.selectedKeys && this.selectedKeys.length > 0) {
          e.preventDefault()
          this.pushEvent('batch_delete', {})
        }
        return
      }

      // Ctrl+D / Cmd+D: Duplicate selected
      if (modKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        // Check for selected entity (NPC/Item) first
        if (this.selectedEntity && this.selectedEntity.type && this.selectedEntity.key) {
          this.pushEvent('duplicate_entity', {
            type: this.selectedEntity.type,
            key: this.selectedEntity.key
          })
        }
        // Then check for single selected room
        else if (this.selectedRoom && (!this.selectedKeys || this.selectedKeys.length <= 1)) {
          this.pushEvent('duplicate_room', { key: this.selectedRoom })
        }
        // Finally check for batch selection
        else if (this.selectedKeys && this.selectedKeys.length > 0) {
          this.pushEvent('batch_clone', { dx: 5, dy: 5, dz: 0 })
        }
        return
      }

      // Ctrl+A / Cmd+A: Select all in viewport
      if (modKey && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        const allKeys = this.rooms.map(r => r.key)
        this.selectedKeys = allKeys
        this.viewport.setSelectedKeys(allKeys)
        this.pushEvent('batch_select', { keys: allKeys })
        return
      }

      // Escape: Deselect all
      if (e.key === 'Escape') {
        this.selectedRoom = null
        this.selectedEntity = null
        this.selectedKeys = []
        this.viewport.setSelectedRoom(null)
        this.viewport.setSelectedKeys([])
        this.pushEvent('batch_select', { keys: [] })
        this.pushEvent('select_room', { key: null })
        this.pushEvent('select_entity', { type: null, key: null })
        return
      }

      // Number keys 1-4: Toggle panels
      if (!modKey && !e.shiftKey && ['1', '2', '3', '4'].includes(e.key)) {
        const panels = ['hierarchy', 'inspector', 'console', 'chat']
        const panel = panels[parseInt(e.key) - 1]
        if (panel) this.pushEvent('toggle_panel', { panel })
        return
      }

      // ~ (backtick): Toggle console
      if (e.key === '`' || e.key === '~') {
        this.pushEvent('toggle_panel', { panel: 'console' })
        return
      }

      // N: Create new room
      if (e.key.toLowerCase() === 'n' && !modKey) {
        this.pushEvent('create_room', {})
        return
      }

      // /: Focus search
      if (e.key === '/') {
        e.preventDefault()
        const searchInput = document.querySelector('.hierarchy-search input')
        if (searchInput) searchInput.focus()
        return
      }

      // Ctrl+G / Cmd+G: Open git commit modal
      if (modKey && e.key.toLowerCase() === 'g') {
        e.preventDefault()
        this.pushEvent('show_commit_modal', {})
        return
      }

      // F: Fit viewport to rooms
      if (e.key.toLowerCase() === 'f' && !modKey) {
        this.viewport.fitToRooms()
        return
      }

      // R: Reset camera
      if (e.key.toLowerCase() === 'r' && !modKey) {
        this.viewport.resetCamera()
        return
      }

      // Arrow keys with Ctrl: Change Z-level
      if (modKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        const zLevels = this.viewport.getZLevels()
        const currentIdx = zLevels.indexOf(this.viewport.currentZLevel)
        if (e.key === 'ArrowUp' && currentIdx < zLevels.length - 1) {
          this.viewport.setZLevel(zLevels[currentIdx + 1])
          this.updateZLevelTabs()
        } else if (e.key === 'ArrowDown' && currentIdx > 0) {
          this.viewport.setZLevel(zLevels[currentIdx - 1])
          this.updateZLevelTabs()
        }
        return
      }

      // Z: Toggle zone colors
      if (e.key.toLowerCase() === 'z' && !modKey) {
        e.preventDefault()
        this.pushEvent('toggle_zone_colors', {})
        return
      }

      // P: Toggle NPC paths
      if (e.key.toLowerCase() === 'p' && !modKey) {
        e.preventDefault()
        this.pushEvent('toggle_npc_paths', {})
        return
      }

      // ?: Show keyboard shortcuts help
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        this.pushEvent('show_keyboard_help', {})
        return
      }
    },

    updated() {
      // With phx-update="ignore", this should rarely be called
    },

    destroyed() {
      // Cleanup viewport
      if (this.viewport) {
        this.viewport.destroy()
      }
      // Cleanup keyboard listener
      if (this.keydownHandler) {
        document.removeEventListener('keydown', this.keydownHandler)
      }
    }
  },

  // =============================================================================
  // Panel Resize - Handles draggable panel dividers
  // =============================================================================
  PanelResize: {
    mounted() {
      this.container = this.el
      this.handles = this.el.querySelectorAll('.panel-resize-handle, .console-resize-handle')
      this.isDragging = false
      this.currentHandle = null
      this.startX = 0
      this.startY = 0
      this.startSize = 0

      // Load saved sizes from localStorage
      this.loadSavedSizes()

      // Bind drag handlers
      this.handleMouseDown = this.handleMouseDown.bind(this)
      this.handleMouseMove = this.handleMouseMove.bind(this)
      this.handleMouseUp = this.handleMouseUp.bind(this)

      // Attach listeners to all resize handles
      this.handles.forEach(handle => {
        handle.addEventListener('mousedown', this.handleMouseDown)
      })

      // Global mouse events for dragging
      document.addEventListener('mousemove', this.handleMouseMove)
      document.addEventListener('mouseup', this.handleMouseUp)
    },

    loadSavedSizes() {
      try {
        const saved = localStorage.getItem('world-builder-panel-sizes')
        if (saved) {
          const sizes = JSON.parse(saved)
          // Apply saved sizes via LiveView event
          Object.entries(sizes).forEach(([panel, size]) => {
            this.pushEvent('resize_panel', { panel, size })
          })
        }
      } catch (e) {
        console.warn('Failed to load saved panel sizes:', e)
      }
    },

    saveSizes(panel, size) {
      try {
        const saved = localStorage.getItem('world-builder-panel-sizes')
        const sizes = saved ? JSON.parse(saved) : {}
        sizes[panel] = size
        localStorage.setItem('world-builder-panel-sizes', JSON.stringify(sizes))
      } catch (e) {
        console.warn('Failed to save panel sizes:', e)
      }
    },

    handleMouseDown(e) {
      e.preventDefault()
      this.isDragging = true
      this.currentHandle = e.target
      this.currentHandle.classList.add('dragging')
      this.startX = e.clientX
      this.startY = e.clientY

      const panel = this.currentHandle.dataset.resize

      if (panel === 'console') {
        // Get current console height
        const consoleEl = this.container.querySelector('.world-builder-console')
        this.startSize = consoleEl ? consoleEl.offsetHeight : 150
      } else if (panel === 'hierarchy') {
        const hierarchyEl = this.container.querySelector('.world-builder-hierarchy')
        this.startSize = hierarchyEl ? hierarchyEl.offsetWidth : 200
      } else if (panel === 'inspector') {
        const inspectorEl = this.container.querySelector('.world-builder-inspector')
        this.startSize = inspectorEl ? inspectorEl.offsetWidth : 260
      } else if (panel === 'terminal') {
        const terminalEl = this.container.querySelector('.world-builder-terminal')
        this.startSize = terminalEl ? terminalEl.offsetWidth : 320
      } else if (panel === 'chat') {
        const chatEl = this.container.querySelector('.world-builder-chat')
        this.startSize = chatEl ? chatEl.offsetWidth : 320
      }

      // Add no-select class to prevent text selection during drag
      document.body.style.userSelect = 'none'
      document.body.style.cursor = panel === 'console' ? 'row-resize' : 'col-resize'
    },

    handleMouseMove(e) {
      if (!this.isDragging || !this.currentHandle) return

      const panel = this.currentHandle.dataset.resize
      let newSize

      if (panel === 'console') {
        // Console resizes vertically (drag up = bigger)
        const delta = this.startY - e.clientY
        newSize = Math.max(80, Math.min(400, this.startSize + delta))
      } else if (panel === 'hierarchy') {
        // Hierarchy resizes from right edge
        const delta = e.clientX - this.startX
        newSize = Math.max(150, Math.min(400, this.startSize + delta))
      } else if (panel === 'inspector') {
        // Inspector resizes from left edge (drag left = bigger)
        const delta = this.startX - e.clientX
        newSize = Math.max(200, Math.min(500, this.startSize + delta))
      } else if (panel === 'terminal') {
        // Terminal resizes from left edge (drag left = bigger)
        const delta = this.startX - e.clientX
        newSize = Math.max(200, Math.min(500, this.startSize + delta))
      } else if (panel === 'chat') {
        // Chat resizes from left edge (drag left = bigger)
        const delta = this.startX - e.clientX
        newSize = Math.max(200, Math.min(500, this.startSize + delta))
      }

      // Update via LiveView
      this.pushEvent('resize_panel', { panel, size: Math.round(newSize) })
    },

    handleMouseUp() {
      if (this.isDragging && this.currentHandle) {
        this.currentHandle.classList.remove('dragging')
        const panel = this.currentHandle.dataset.resize

        // Get final size and save
        let finalSize
        if (panel === 'console') {
          const el = this.container.querySelector('.world-builder-console')
          finalSize = el ? el.offsetHeight : 150
        } else if (panel === 'hierarchy') {
          const el = this.container.querySelector('.world-builder-hierarchy')
          finalSize = el ? el.offsetWidth : 200
        } else if (panel === 'inspector') {
          const el = this.container.querySelector('.world-builder-inspector')
          finalSize = el ? el.offsetWidth : 260
        } else if (panel === 'terminal') {
          const el = this.container.querySelector('.world-builder-terminal')
          finalSize = el ? el.offsetWidth : 320
        } else if (panel === 'chat') {
          const el = this.container.querySelector('.world-builder-chat')
          finalSize = el ? el.offsetWidth : 320
        }

        this.saveSizes(panel, finalSize)
      }

      this.isDragging = false
      this.currentHandle = null
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    },

    destroyed() {
      this.handles.forEach(handle => {
        handle.removeEventListener('mousedown', this.handleMouseDown)
      })
      document.removeEventListener('mousemove', this.handleMouseMove)
      document.removeEventListener('mouseup', this.handleMouseUp)
    }
  },

  // Chat textarea with Ctrl+Enter submit support
  ChatTextarea: {
    mounted() {
      this.el.addEventListener('keydown', (e) => {
        // Ctrl+Enter or Cmd+Enter to submit
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault()
          const form = this.el.closest('form')
          if (form && this.el.value.trim()) {
            // Trigger LiveView form submit
            this.pushEvent('send_message', { message: this.el.value })
            this.el.value = ''
          }
        }
      })
    }
  },

  // =============================================================================
  // API Key Configuration - BYOK for Anthropic API
  // =============================================================================
  APIKeyConfig: {
    mounted() {
      const input = this.el.querySelector('#api-key-input')
      const saveBtn = this.el.querySelector('#api-key-save')

      // Load saved key status (key itself stays in localStorage, encrypted)
      const hasKey = localStorage.getItem('anthropic_api_key_encrypted') !== null
      if (hasKey) {
        // Check if key is still valid by testing it
        this.validateStoredKey()
      }

      // Handle save button click
      saveBtn?.addEventListener('click', () => {
        const key = input?.value?.trim()
        if (key) {
          this.saveAndValidateKey(key)
        }
      })

      // Handle enter key
      input?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const key = input?.value?.trim()
          if (key) {
            this.saveAndValidateKey(key)
          }
        }
      })
    },

    async saveAndValidateKey(key) {
      // Update UI to show validating
      this.pushEvent('api_key_validated', { status: 'validating' })

      try {
        // Validate with a simple API call
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }]
          })
        })

        if (response.ok) {
          // Key is valid - store encrypted in localStorage
          // Simple encryption using base64 and a fixed prefix (not cryptographically secure,
          // but prevents accidental exposure in plain text)
          const encrypted = btoa('loka_wb_' + key)
          localStorage.setItem('anthropic_api_key_encrypted', encrypted)
          this.pushEvent('api_key_validated', { status: 'valid' })

          // Clear input
          const input = this.el.querySelector('#api-key-input')
          if (input) input.value = ''
        } else {
          this.pushEvent('api_key_validated', { status: 'invalid' })
        }
      } catch (error) {
        console.error('API key validation failed:', error)
        this.pushEvent('api_key_validated', { status: 'invalid' })
      }
    },

    async validateStoredKey() {
      const encrypted = localStorage.getItem('anthropic_api_key_encrypted')
      if (!encrypted) return

      try {
        const key = atob(encrypted).replace('loka_wb_', '')
        this.pushEvent('api_key_validated', { status: 'validating' })

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }]
          })
        })

        if (response.ok) {
          this.pushEvent('api_key_validated', { status: 'valid' })
        } else {
          // Key is invalid - remove it
          localStorage.removeItem('anthropic_api_key_encrypted')
          this.pushEvent('api_key_validated', { status: 'invalid' })
        }
      } catch (error) {
        console.error('Stored key validation failed:', error)
        this.pushEvent('api_key_validated', { status: 'unconfigured' })
      }
    },

    destroyed() {
      // Cleanup if needed
    }
  },

  // =============================================================================
  // Multi-Provider API Key Configuration - BYOK for multiple AI providers
  // =============================================================================
  MultiAPIKeyConfig: {
    mounted() {
      console.log('MultiAPIKeyConfig mounted')
      const providers = ['anthropic', 'openai', 'deepseek', 'gemini', 'glm', 'minimax']

      // Check stored keys for all providers on mount
      providers.forEach(provider => {
        try {
          this.validateStoredKey(provider)
        } catch (e) {
          console.error('Error validating stored key for', provider, e)
        }
      })

      // Use event delegation to handle clicks on buttons,
      // which survives DOM updates from LiveView
      this.el.addEventListener('click', (e) => {
        const saveBtn = e.target.closest('.api-key-save')
        const clearBtn = e.target.closest('.api-key-clear')

        if (saveBtn) {
          const provider = saveBtn.dataset.provider
          console.log('Save clicked for', provider)
          const input = this.el.querySelector(`#api-key-input-${provider}`)
          const key = input?.value?.trim()
          
          if (key) {
            console.log('Key present, saving...')
            this.saveAndValidateKey(provider, key)
          } else {
            console.log('No key entered')
          }
        } else if (clearBtn) {
          const provider = clearBtn.dataset.provider
          console.log('Clear clicked for', provider)
          this.clearKey(provider)
        }
      })

      // Handle enter key in inputs
      this.el.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.target.classList.contains('api-key-input')) {
          const provider = e.target.dataset.provider
          const key = e.target.value.trim()
          if (key) {
            this.saveAndValidateKey(provider, key)
          }
        }
      })
    },

    async saveAndValidateKey(provider, key) {
      // Update UI to show validating
      this.pushEvent('api_key_validated', { provider, status: 'validating' })

      try {
        const isValid = await this.validateKey(provider, key)

        // Store encrypted in localStorage regardless of validation status
        // so the user can at least attempt to use it.
        // Store encrypted in localStorage regardless of validation status
        // so the user can at least attempt to use it.
        // Use unicode-safe encoding
        const encrypted = btoa(unescape(encodeURIComponent('loka_wb_' + key)))
        localStorage.setItem(`${provider}_api_key_encrypted`, encrypted)

        if (isValid) {
          this.pushEvent('api_key_validated', { provider, status: 'valid' })

          // Clear input only on success
          const input = this.el.querySelector(`#api-key-input-${provider}`)
          if (input) input.value = ''
        } else {
          // Still mark as configured but invalid status
          this.pushEvent('api_key_validated', { provider, status: 'invalid' })
          console.warn(`API key for ${provider} was saved but validation failed. Check your key.`)
        }
      } catch (error) {
        console.error(`API key validation failed for ${provider}:`, error)
        
        // Even on network error, try to save the key
        // Store encrypted in localStorage regardless of validation status
        // so the user can at least attempt to use it.
        // Use unicode-safe encoding
        const encrypted = btoa(unescape(encodeURIComponent('loka_wb_' + key)))
        localStorage.setItem(`${provider}_api_key_encrypted`, encrypted)
        
        this.pushEvent('api_key_validated', { provider, status: 'invalid' })
      }
    },

    async validateKey(provider, key) {
      // Provider-specific validation
      switch (provider) {
        case 'anthropic':
          return this.validateAnthropicKey(key)
        case 'openai':
          return this.validateOpenAIKey(key)
        case 'deepseek':
          return this.validateDeepSeekKey(key)
        case 'gemini':
          return this.validateGeminiKey(key)
        case 'glm':
          return this.validateGLMKey(key)
        case 'minimax':
          return this.validateMinimaxKey(key)
        default:
          return false
      }
    },

    async validateAnthropicKey(key) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      })
      return response.ok
    },

    async validateOpenAIKey(key) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      })
      return response.ok
    },

    async validateDeepSeekKey(key) {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      })
      return response.ok
    },

    async validateGeminiKey(key) {
      // Use gemini-1.5-pro for validation as requested/more stable
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${key}`
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Hi' }] }],
            generationConfig: { maxOutputTokens: 10 }
          })
        })
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error('Gemini validation failed:', response.status, errorText)
        }
        
        return response.ok
      } catch (error) {
        console.error('Gemini validation network error:', error)
        return false
      }
    },

    async validateGLMKey(key) {
      // GLM (Zhipu AI) uses OpenAI-compatible API
      const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: 'glm-4-flash',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      })
      return response.ok
    },

    async validateMinimaxKey(key) {
      // Minimax uses OpenAI-compatible API
      const response = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: 'MiniMax-Text-01',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      })
      return response.ok
    },

    async validateStoredKey(provider) {
      const encrypted = localStorage.getItem(`${provider}_api_key_encrypted`)
      if (!encrypted) {
        this.pushEvent('api_key_validated', { provider, status: 'unconfigured' })
        return
      }

      try {
        const key = atob(encrypted).replace('loka_wb_', '')
        this.pushEvent('api_key_validated', { provider, status: 'validating' })

        const isValid = await this.validateKey(provider, key)

        if (isValid) {
          this.pushEvent('api_key_validated', { provider, status: 'valid' })
        } else {
          // Key is invalid - remove it
          localStorage.removeItem(`${provider}_api_key_encrypted`)
          this.pushEvent('api_key_validated', { provider, status: 'invalid' })
        }
      } catch (error) {
        console.error(`Stored key validation failed for ${provider}:`, error)
        this.pushEvent('api_key_validated', { provider, status: 'unconfigured' })
      }
    },

    clearKey(provider) {
      localStorage.removeItem(`${provider}_api_key_encrypted`)
      this.pushEvent('api_key_validated', { provider, status: 'unconfigured' })
      // Clear the input field
      const input = this.el.querySelector(`#api-key-input-${provider}`)
      if (input) input.value = ''
    },

    destroyed() {
      // Cleanup if needed
    }
  },

  // =============================================================================
  // CodeMirror 6 - Elixir script editor (bundled, no CDN)
  // =============================================================================
  CodeMirrorEditor: {
    mounted() {
      // Define Elixir-like tokenizer via StreamLanguage
      const elixirLang = StreamLanguage.define({
        startState() { return { inString: false, stringChar: null } },
        token(stream, state) {
          if (stream.eatSpace()) return null

          // Comments
          if (stream.match('#')) { stream.skipToEnd(); return 'comment' }

          // Strings
          if (stream.match('"""') || stream.match("'''")) {
            stream.skipTo(stream.current()) || stream.skipToEnd()
            return 'string'
          }
          if (stream.match(/"[^"]*"/) || stream.match(/'[^']*'/)) return 'string'
          if (stream.match('"') || stream.match("'")) {
            const ch = stream.current()
            while (!stream.eol()) {
              const next = stream.next()
              if (next === ch) break
            }
            return 'string'
          }

          // Atoms
          if (stream.match(/:[a-zA-Z_][a-zA-Z0-9_]*/)) return 'atom'

          // Module attributes
          if (stream.match(/@[a-z_][a-z0-9_]*/)) return 'meta'

          // Numbers
          if (stream.match(/0x[0-9a-fA-F]+/) || stream.match(/0b[01]+/) || stream.match(/\d+(\.\d+)?/)) return 'number'

          // Keywords
          if (stream.match(/\b(def|defp|defmodule|defmacro|defstruct|defprotocol|defimpl|do|end|if|else|unless|case|cond|when|and|or|not|in|fn|with|for|raise|try|catch|rescue|after|receive|send|import|alias|require|use|true|false|nil)\b/)) return 'keyword'

          // Identifiers with ! or ?
          if (stream.match(/[a-z_][a-z0-9_]*[!?]?/)) return 'variableName'

          // Module names (capitalized)
          if (stream.match(/[A-Z][a-zA-Z0-9_]*/)) return 'typeName'

          // Operators
          if (stream.match(/->|<-|\|>|=>|::|&&|\|\||==|!=|<=|>=|=~|\+\+|--|\.\./)) return 'operator'

          stream.next()
          return null
        }
      })

      const initialValue = this.el.dataset.value || ''

      this.view = new EditorView({
        doc: initialValue,
        extensions: [
          basicSetup,
          elixirLang,
          oneDark,
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              this.pushEvent('script_source_changed', {
                source: update.state.doc.toString()
              })
            }
          }),
          EditorView.theme({
            '&': { height: '100%', fontSize: '13px' },
            '.cm-scroller': { overflow: 'auto' },
            '.cm-content': { fontFamily: 'ui-monospace, monospace' },
          }),
        ],
        parent: this.el,
      })
    },

    destroyed() {
      if (this.view) this.view.destroy()
    }
  },

  // MUD Terminal hook - connects to GameChannel for in-editor MUD testing
  MudTerminal: {
    mounted() {
      this.token = this.el.dataset.token
      this.commandHistory = []
      this.historyIndex = -1
      this.socket = null
      this.channel = null

      // DOM elements
      this.outputEl = this.el
      this.inputEl = document.getElementById('terminal-command-input')
      this.hpEl = document.getElementById('term-hp')
      this.maEl = document.getElementById('term-ma')
      this.mvEl = document.getElementById('term-mv')
      this.exitsEl = document.getElementById('term-exits')

      if (!this.token) {
        this.appendOutput('No auth token available.', 'error')
        return
      }

      this.connect()

      // Input handling
      if (this.inputEl) {
        this.inputHandler = (e) => {
          // Prevent World Builder keyboard shortcuts from firing when typing
          e.stopPropagation()

          if (e.key === 'Enter') {
            const input = this.inputEl.value.trim()
            if (input) {
              this.appendOutput(`> ${input}`, 'system')
              this.commandHistory.push(input)
              this.historyIndex = this.commandHistory.length
              this.channel.push('command', { input })
              this.inputEl.value = ''
            }
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            if (this.historyIndex > 0) {
              this.historyIndex--
              this.inputEl.value = this.commandHistory[this.historyIndex]
            }
          } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (this.historyIndex < this.commandHistory.length - 1) {
              this.historyIndex++
              this.inputEl.value = this.commandHistory[this.historyIndex]
            } else {
              this.historyIndex = this.commandHistory.length
              this.inputEl.value = ''
            }
          }
        }
        this.inputEl.addEventListener('keydown', this.inputHandler)
      }
    },

    connect() {
      // Use the Phoenix Socket from the same module
      this.socket = new Socket('/socket', { params: { token: this.token } })
      this.socket.connect()

      this.channel = this.socket.channel('game:lobby', {})

      this.channel.join()
        .receive('ok', () => {
          this.appendOutput('Connected to Loka.', 'system')
          this.appendOutput('Type "help" for available commands.', 'system')
          this.appendOutput('', 'system')
        })
        .receive('error', (resp) => {
          if (resp.reason === 'character_not_created') {
            this.appendOutput('You need to create a character first.', 'error')
            this.appendOutput('Visit /character/create to create your character.', 'system')
          } else {
            this.appendOutput(`Connection failed: ${resp.reason || 'unknown'}`, 'error')
          }
        })

      // Game state (on join)
      this.channel.on('game_state', (state) => {
        this.updateVitals(state)
        if (state.room) {
          this.updateExits(state.room.exits)
          this.appendRoomDescription(state.room, state.atmosphere)
        }
      })

      // Room updates (navigation, look)
      this.channel.on('room_update', (data) => {
        if (data.room) {
          this.updateExits(data.room.exits)
          this.appendRoomDescription(data.room, data.atmosphere)
        }
      })

      // Text output (command responses, builder output)
      this.channel.on('output', (data) => {
        if (data.text) {
          const cls = data.text.startsWith('[BUILDER]') ? 'builder' : ''
          this.appendOutput(data.text, cls)
        }
      })

      // Game events
      this.channel.on('event', (data) => {
        if (data.text) this.appendOutput(data.text, 'chat')
      })

      // Resource updates
      this.channel.on('resources_update', (data) => {
        this.updateResources(data.resources)
      })

      // Broadcast messages
      this.channel.on('broadcast', (data) => {
        const cls = data.type === 'emergency' ? 'error' :
                    data.type === 'event' ? 'chat' : 'system'
        if (data.text) this.appendOutput(data.text, cls)
      })

      // Combat events
      this.channel.on('combat_start', (data) => {
        this.appendOutput(`Combat started with ${data.enemy?.name || 'enemy'}!`, 'error')
      })

      this.channel.on('combat_update', (data) => {
        if (data.text) this.appendOutput(data.text, 'chat')
        if (data.health) {
          this.hpEl.textContent = `${data.health.current}/${data.health.max}`
        }
      })

      this.channel.on('combat_end', (data) => {
        this.appendOutput(data.text || 'Combat ended.', 'system')
      })

      // Dialogue events
      this.channel.on('dialogue_start', (data) => {
        this.renderDialogue(data)
      })

      this.channel.on('dialogue_update', (data) => {
        this.renderDialogue(data)
      })

      this.channel.on('dialogue_end', () => {
        this.appendOutput('(Conversation ended)', 'system')
      })

      // Inventory updates
      this.channel.on('inventory_update', (data) => {
        if (data.text) this.appendOutput(data.text, 'system')
      })
    },

    appendOutput(text, className = '') {
      const lines = text.split('\n')
      lines.forEach(line => {
        const div = document.createElement('div')
        div.className = 'terminal-line' + (className ? ` ${className}` : '')
        div.textContent = line
        this.outputEl.appendChild(div)
      })
      this.outputEl.scrollTop = this.outputEl.scrollHeight
    },

    appendRoomDescription(room, atmosphere) {
      this.appendOutput('')
      this.appendOutput(room.title || room.name, 'room-title')
      this.appendOutput('-'.repeat((room.title || room.name || '').length))
      if (atmosphere) {
        this.appendOutput(atmosphere, 'emote')
      }
      this.appendOutput('')
      this.appendOutput(room.description || '')
      this.appendOutput('')

      // Entities
      const entities = room.entities || []
      entities.forEach(e => {
        this.appendOutput(`${e.name} is here.`)
      })

      // Items
      const items = room.items || []
      items.forEach(i => {
        this.appendOutput(`${i.name} lies on the ground.`)
      })

      // Exits
      const exits = (room.exits || []).filter(e => e.destination_id).map(e => e.direction)
      this.appendOutput('')
      this.appendOutput(`Exits: ${exits.length ? exits.join(', ') : 'none'}`)
    },

    renderDialogue(data) {
      if (data.npc_name) {
        this.appendOutput(`${data.npc_name} says:`, 'chat')
      }
      if (data.text) {
        this.appendOutput(data.text, 'chat')
      }
      if (data.choices && data.choices.length > 0) {
        this.appendOutput('')
        data.choices.forEach((choice, i) => {
          this.appendOutput(`  [${i + 1}] ${choice.text || choice}`, 'system')
        })
        this.appendOutput('(Type a number to choose)', 'system')
      }
    },

    updateVitals(state) {
      const health = state.health || { current: 100, max: 100 }
      const resources = state.resources || {}
      const mana = resources.mana || { current: 100, max: 100 }
      const mv = resources.mv || { current: 150, max: 150 }

      if (this.hpEl) this.hpEl.textContent = `${health.current}/${health.max}`
      if (this.maEl) this.maEl.textContent = `${mana.current}/${mana.max}`
      if (this.mvEl) this.mvEl.textContent = `${mv.current}/${mv.max}`
    },

    updateResources(resources) {
      if (!resources) return
      const mana = resources.mana || { current: 100, max: 100 }
      const mv = resources.mv || { current: 150, max: 150 }
      if (this.maEl) this.maEl.textContent = `${mana.current}/${mana.max}`
      if (this.mvEl) this.mvEl.textContent = `${mv.current}/${mv.max}`
    },

    updateExits(exits) {
      const dirs = (exits || []).filter(e => e.destination_id).map(e => e.direction)
      if (this.exitsEl) this.exitsEl.textContent = `Exits: ${dirs.length ? dirs.join(', ') : 'none'}`
    },

    destroyed() {
      if (this.channel) {
        this.channel.leave()
        this.channel = null
      }
      if (this.socket) {
        this.socket.disconnect()
        this.socket = null
      }
      if (this.inputEl && this.inputHandler) {
        this.inputEl.removeEventListener('keydown', this.inputHandler)
      }
    }
  },

  // Console Output hook for export functionality
  ConsoleOutput: {
    mounted() {
      this.handleEvent("download_text", ({content, filename}) => {
        const blob = new Blob([content], {type: 'text/plain'})
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      })
    }
  },

  // Quest Flow Graph - draws edges between quest nodes with bezier curves
  QuestFlowGraph: {
    mounted() {
      this.drawEdges()
    },

    updated() {
      this.drawEdges()
    },

    drawEdges() {
      try {
        const nodes = JSON.parse(this.el.dataset.nodes || '[]')
        const edges = JSON.parse(this.el.dataset.edges || '[]')
        const svg = this.el.querySelector('.quest-graph-edges')
        if (!svg) return

        // Clear existing edges
        svg.innerHTML = ''

        // Create node position map with bounds for collision avoidance
        const nodePositions = {}
        const nodeBounds = {}
        const nodeWidth = 160
        const nodeHeight = 60

        nodes.forEach(node => {
          nodePositions[node.id] = {
            x: node.x + nodeWidth / 2,  // Center of node
            y: node.y + nodeHeight / 2   // Center of node
          }
          nodeBounds[node.id] = {
            left: node.x,
            right: node.x + nodeWidth,
            top: node.y,
            bottom: node.y + nodeHeight
          }
        })

        // Add arrowhead marker definition first
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
        defs.innerHTML = `
          <marker id="arrowhead" markerWidth="10" markerHeight="7"
                  refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
          </marker>
          <marker id="arrowhead-prereq" markerWidth="10" markerHeight="7"
                  refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#f59e0b" />
          </marker>
          <marker id="arrowhead-unlock" markerWidth="10" markerHeight="7"
                  refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#22c55e" />
          </marker>
        `
        svg.appendChild(defs)

        // Draw edges as bezier curves
        edges.forEach(edge => {
          const from = nodePositions[edge.from]
          const to = nodePositions[edge.to]
          if (!from || !to) return

          // Calculate connection points on node edges
          const { startPoint, endPoint } = this.getConnectionPoints(from, to, nodeBounds[edge.from], nodeBounds[edge.to])

          // Calculate control points for bezier curve
          const controlPoints = this.calculateControlPoints(startPoint, endPoint, nodes, nodeBounds, edge.from, edge.to)

          // Create bezier path
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
          const d = `M ${startPoint.x} ${startPoint.y} C ${controlPoints.cp1.x} ${controlPoints.cp1.y}, ${controlPoints.cp2.x} ${controlPoints.cp2.y}, ${endPoint.x} ${endPoint.y}`
          path.setAttribute('d', d)
          path.setAttribute('fill', 'none')

          // Color based on edge type
          const edgeColor = edge.type === 'prerequisite' ? '#f59e0b' :
                           edge.type === 'unlocks' ? '#22c55e' : '#666'
          const markerId = edge.type === 'prerequisite' ? 'arrowhead-prereq' :
                          edge.type === 'unlocks' ? 'arrowhead-unlock' : 'arrowhead'

          path.setAttribute('stroke', edgeColor)
          path.setAttribute('stroke-width', '2')
          path.setAttribute('marker-end', `url(#${markerId})`)

          // Add subtle animation on hover
          path.style.transition = 'stroke-width 0.2s ease'
          path.addEventListener('mouseenter', () => path.setAttribute('stroke-width', '3'))
          path.addEventListener('mouseleave', () => path.setAttribute('stroke-width', '2'))

          svg.appendChild(path)
        })

      } catch (e) {
        console.error('[QuestFlowGraph] Error drawing edges:', e)
      }
    },

    // Calculate where the edge should connect to the node boundaries
    getConnectionPoints(from, to, fromBounds, toBounds) {
      const dx = to.x - from.x
      const dy = to.y - from.y
      const angle = Math.atan2(dy, dx)

      // Determine which side of the node to connect from/to
      let startPoint, endPoint

      // Start point - exit from the appropriate side of the source node
      if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal dominant - exit from left or right
        if (dx > 0) {
          startPoint = { x: fromBounds.right, y: from.y }
          endPoint = { x: toBounds.left - 10, y: to.y } // -10 for arrow space
        } else {
          startPoint = { x: fromBounds.left, y: from.y }
          endPoint = { x: toBounds.right + 10, y: to.y }
        }
      } else {
        // Vertical dominant - exit from top or bottom
        if (dy > 0) {
          startPoint = { x: from.x, y: fromBounds.bottom }
          endPoint = { x: to.x, y: toBounds.top - 10 }
        } else {
          startPoint = { x: from.x, y: fromBounds.top }
          endPoint = { x: to.x, y: toBounds.bottom + 10 }
        }
      }

      return { startPoint, endPoint }
    },

    // Calculate bezier control points, avoiding other nodes where possible
    calculateControlPoints(start, end, nodes, nodeBounds, fromId, toId) {
      const dx = end.x - start.x
      const dy = end.y - start.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      // Base curve tension - how much the curve bends
      const tension = Math.min(distance * 0.4, 100)

      // Determine curve direction based on relative positions
      let cp1, cp2

      if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal flow - curve vertically to avoid nodes
        const curveDirection = this.findBestCurveDirection(start, end, nodes, nodeBounds, fromId, toId)

        cp1 = {
          x: start.x + dx * 0.3,
          y: start.y + curveDirection * tension * 0.5
        }
        cp2 = {
          x: end.x - dx * 0.3,
          y: end.y + curveDirection * tension * 0.5
        }
      } else {
        // Vertical flow - curve horizontally to avoid nodes
        const curveDirection = this.findBestCurveDirection(start, end, nodes, nodeBounds, fromId, toId, true)

        cp1 = {
          x: start.x + curveDirection * tension * 0.5,
          y: start.y + dy * 0.3
        }
        cp2 = {
          x: end.x + curveDirection * tension * 0.5,
          y: end.y - dy * 0.3
        }
      }

      return { cp1, cp2 }
    },

    // Find the best direction to curve to avoid overlapping nodes
    findBestCurveDirection(start, end, nodes, nodeBounds, fromId, toId, isVertical = false) {
      // Check if there are nodes in the path that we should avoid
      const midX = (start.x + end.x) / 2
      const midY = (start.y + end.y) / 2

      let positiveScore = 0  // Score for curving in positive direction
      let negativeScore = 0  // Score for curving in negative direction

      for (const node of nodes) {
        if (node.id === fromId || node.id === toId) continue

        const bounds = nodeBounds[node.id]
        if (!bounds) continue

        // Check if node is roughly in the path
        const nodeCenter = {
          x: (bounds.left + bounds.right) / 2,
          y: (bounds.top + bounds.bottom) / 2
        }

        // Simple proximity check
        const distToMid = Math.sqrt(
          Math.pow(nodeCenter.x - midX, 2) +
          Math.pow(nodeCenter.y - midY, 2)
        )

        if (distToMid < 150) {  // Node is nearby
          if (isVertical) {
            // For vertical flow, check horizontal position
            if (nodeCenter.x > midX) {
              negativeScore += 1  // Curve left to avoid
            } else {
              positiveScore += 1  // Curve right to avoid
            }
          } else {
            // For horizontal flow, check vertical position
            if (nodeCenter.y > midY) {
              negativeScore += 1  // Curve up to avoid
            } else {
              positiveScore += 1  // Curve down to avoid
            }
          }
        }
      }

      // Return direction based on scores (slight preference for positive to create consistent curves)
      if (negativeScore > positiveScore) {
        return -1
      } else if (positiveScore > negativeScore) {
        return 1
      }

      // Default: slight curve based on start/end relationship for visual consistency
      return isVertical ? (start.x < end.x ? 1 : -1) : (start.y < end.y ? 1 : -1)
    }
  }
}

// =============================================================================
// Connection Status (Event Log Style)
// =============================================================================
// Tracks WebSocket connection state and shows status messages in the event log
// like classic MUDs. Only shows messages when disconnected or reconnecting.
// =============================================================================

const ConnectionStatus = {
  mounted() {
    this.lastStatus = 'connected'
    this.wasDisconnected = false
    this.overlay = null

    // Create the overlay element
    this.createOverlay()

    // Listen for LiveSocket connection events
    window.addEventListener('phx:disconnect', () => this.handleDisconnect())
    window.addEventListener('phx:connected', () => this.handleReconnect())

    // Check for reconnecting state periodically
    this.checkInterval = setInterval(() => {
      if (window.liveSocket && !window.liveSocket.isConnected() && this.lastStatus !== 'disconnected') {
        this.handleDisconnect()
      }
    }, 3000)
  },

  destroyed() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay)
    }
  },

  createOverlay() {
    // Create overlay if it doesn't exist
    if (document.getElementById('connection-overlay')) {
      this.overlay = document.getElementById('connection-overlay')
      return
    }

    this.overlay = document.createElement('div')
    this.overlay.id = 'connection-overlay'
    this.overlay.className = 'connection-overlay'
    this.overlay.setAttribute('role', 'alert')
    this.overlay.setAttribute('aria-live', 'assertive')
    this.overlay.innerHTML = `
      <div class="connection-overlay-content">
        <div class="connection-overlay-spinner"></div>
        <div class="connection-overlay-title">Reconnecting</div>
        <div class="connection-overlay-message">
          Please wait<span class="connection-overlay-dots"></span>
        </div>
      </div>
    `
    document.body.appendChild(this.overlay)
  },

  showOverlay() {
    if (this.overlay) {
      this.overlay.classList.add('visible')
    }
  },

  hideOverlay() {
    if (this.overlay) {
      this.overlay.classList.remove('visible')
    }
  },

  handleDisconnect() {
    if (this.lastStatus === 'disconnected') return

    this.lastStatus = 'disconnected'
    this.wasDisconnected = true
    this.showOverlay()
    this.addEventLogMessage('[Connection lost... reconnecting]')
    this.announceToScreenReader('Connection lost. Attempting to reconnect.')
  },

  handleReconnect() {
    if (this.lastStatus === 'connected') return

    this.lastStatus = 'connected'
    this.hideOverlay()

    // Only show reconnected message if we were actually disconnected
    if (this.wasDisconnected) {
      this.addEventLogMessage('[Connection restored]')
      this.announceToScreenReader('Connection restored.')
      this.wasDisconnected = false
    }
  },

  addEventLogMessage(message) {
    // Find the event log container by ID or class
    let eventLog = document.getElementById('events-log') ||
                   document.querySelector('.ebook-events')

    // If no event log exists, create one in the room content area
    if (!eventLog) {
      const roomContent = document.querySelector('.ebook-room') ||
                          document.querySelector('.ebook-content') ||
                          document.querySelector('.ebook-page')
      if (roomContent) {
        eventLog = document.createElement('div')
        eventLog.id = 'events-log'
        eventLog.className = 'ebook-events'
        eventLog.setAttribute('role', 'log')
        eventLog.setAttribute('aria-live', 'polite')
        eventLog.setAttribute('aria-label', 'Game events')
        roomContent.appendChild(eventLog)
      }
    }

    if (eventLog) {
      const entry = document.createElement('p')
      entry.className = 'ebook-event ebook-event--system'
      entry.textContent = message
      entry.setAttribute('role', 'status')
      entry.setAttribute('aria-live', 'polite')
      eventLog.appendChild(entry)

      // Scroll to bottom
      eventLog.scrollTop = eventLog.scrollHeight
    }
  },

  announceToScreenReader(message) {
    const announcer = document.getElementById('sr-announcer')
    if (announcer) {
      announcer.textContent = message
    }
  }
}

// =============================================================================
// Multiple Tab Detection
// =============================================================================
// Warns users when they have the game open in multiple tabs to prevent
// state synchronization issues and conflicting actions.
// =============================================================================

const MultiTabDetector = {
  mounted() {
    this.tabId = `loka-tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    this.channelKey = 'loka-active-tabs'

    // Register this tab
    this.registerTab()

    // Listen for other tabs
    this.handleStorageChange = this.handleStorageChange.bind(this)
    window.addEventListener('storage', this.handleStorageChange)

    // Heartbeat to keep tab registered
    this.heartbeat = setInterval(() => this.registerTab(), 2000)

    // Cleanup on unload
    window.addEventListener('beforeunload', () => this.unregisterTab())

    // Check for existing tabs
    this.checkForMultipleTabs()
  },

  destroyed() {
    this.unregisterTab()
    if (this.heartbeat) clearInterval(this.heartbeat)
    window.removeEventListener('storage', this.handleStorageChange)
  },

  registerTab() {
    try {
      const tabs = this.getActiveTabs()
      tabs[this.tabId] = Date.now()
      localStorage.setItem(this.channelKey, JSON.stringify(tabs))
    } catch (e) {
      // localStorage might be unavailable in private browsing
    }
  },

  unregisterTab() {
    try {
      const tabs = this.getActiveTabs()
      delete tabs[this.tabId]
      localStorage.setItem(this.channelKey, JSON.stringify(tabs))
    } catch (e) {
      // Ignore errors on cleanup
    }
  },

  getActiveTabs() {
    try {
      const data = localStorage.getItem(this.channelKey)
      if (!data) return {}

      const tabs = JSON.parse(data)
      const now = Date.now()
      const staleThreshold = 5000 // 5 seconds

      // Filter out stale tabs
      const activeTabs = {}
      for (const [id, timestamp] of Object.entries(tabs)) {
        if (now - timestamp < staleThreshold) {
          activeTabs[id] = timestamp
        }
      }

      return activeTabs
    } catch (e) {
      return {}
    }
  },

  handleStorageChange(e) {
    if (e.key === this.channelKey) {
      this.checkForMultipleTabs()
    }
  },

  checkForMultipleTabs() {
    const tabs = this.getActiveTabs()
    const tabCount = Object.keys(tabs).length

    const warning = this.el.querySelector('[data-multi-tab-warning]')
    if (warning) {
      if (tabCount > 1) {
        warning.classList.remove('hidden')
        warning.setAttribute('aria-hidden', 'false')
      } else {
        warning.classList.add('hidden')
        warning.setAttribute('aria-hidden', 'true')
      }
    }
  }
}

// =============================================================================
// Browser Navigation Handling
// =============================================================================
// Intercepts browser back/forward navigation and handles it appropriately
// for a single-page LiveView app. Prevents accidental navigation away from
// the game and warns users about unsaved state.
// =============================================================================

const BrowserNavigation = {
  mounted() {
    this.hasUnsavedState = false

    // Listen for navigation events from LiveView
    this.handleEvent('set_unsaved_state', ({value}) => {
      this.hasUnsavedState = value
    })

    // Handle browser back/forward
    this.handlePopState = this.handlePopState.bind(this)
    window.addEventListener('popstate', this.handlePopState)

    // Warn before leaving if there's unsaved state
    this.handleBeforeUnload = this.handleBeforeUnload.bind(this)
    window.addEventListener('beforeunload', this.handleBeforeUnload)

    // Push initial state to enable back button detection
    if (window.history.state === null) {
      window.history.replaceState({loka: true, initial: true}, '')
    }
  },

  destroyed() {
    window.removeEventListener('popstate', this.handlePopState)
    window.removeEventListener('beforeunload', this.handleBeforeUnload)
  },

  handlePopState(e) {
    // If user navigated back, push them forward again and notify LiveView
    if (e.state && e.state.loka) {
      // User is navigating within the game - let LiveView handle it
      return
    }

    // User tried to navigate away - restore state and optionally warn
    window.history.pushState({loka: true}, '')

    // Notify LiveView about the back button press
    this.pushEvent('browser_back', {})
  },

  handleBeforeUnload(e) {
    // Only warn if there's potentially unsaved state (in combat, mid-dialogue, etc.)
    if (this.hasUnsavedState) {
      e.preventDefault()
      e.returnValue = 'You have an active game session. Are you sure you want to leave?'
      return e.returnValue
    }
  }
}

const csrfToken = document.querySelector("meta[name='csrf-token']").getAttribute("content")
const liveSocket = new LiveSocket("/live", Socket, {
  longPollFallbackMs: 2500,
  params: {_csrf_token: csrfToken},
  hooks: {...colocatedHooks, ...Hooks, ConnectionStatus, MultiTabDetector, BrowserNavigation},
})

// Show progress bar on live navigation and form submits (grayscale for ebook aesthetic)
topbar.config({barColors: {0: "#222"}, shadowColor: "rgba(0, 0, 0, .1)"})
window.addEventListener("phx:page-loading-start", _info => topbar.show(300))
window.addEventListener("phx:page-loading-stop", _info => topbar.hide())

// connect if there are any LiveViews on the page
liveSocket.connect()

// Handle focus_search event from LiveView (World Designer keyboard shortcut)
window.addEventListener("phx:focus_search", () => {
  const searchInput = document.getElementById("world-designer-search")
  if (searchInput) {
    searchInput.focus()
    searchInput.select()
  }
})

// expose liveSocket on window for web console debug logs and latency simulation:
// >> liveSocket.enableDebug()
// >> liveSocket.enableLatencySim(1000)  // enabled for duration of browser session
// >> liveSocket.disableLatencySim()
window.liveSocket = liveSocket

// =============================================================================
// LiveView Event Debug Logger
// =============================================================================
// Enable with: window.enableEventDebug() or in console: enableEventDebug()
// Disable with: window.disableEventDebug() or: disableEventDebug()
// Toggle with: window.toggleEventDebug() or: toggleEventDebug()
//
// This logs all LiveView events (phx-click, phx-submit, etc.) to the console
// with their event names and payload data for debugging.
// =============================================================================

window._eventDebugEnabled = false

window.enableEventDebug = function() {
  window._eventDebugEnabled = true
  console.log('%c[EventDebug] Enabled - All LiveView events will be logged', 'color: #22c55e; font-weight: bold')
  console.log('%c[EventDebug] Use disableEventDebug() to turn off', 'color: #6b7280')
}

window.disableEventDebug = function() {
  window._eventDebugEnabled = false
  console.log('%c[EventDebug] Disabled', 'color: #ef4444; font-weight: bold')
}

window.toggleEventDebug = function() {
  if (window._eventDebugEnabled) {
    window.disableEventDebug()
  } else {
    window.enableEventDebug()
  }
}

// Intercept all click events with phx-click
document.addEventListener('click', function(e) {
  if (!window._eventDebugEnabled) return

  const target = e.target.closest('[phx-click]')
  if (target) {
    const eventName = target.getAttribute('phx-click')
    const values = {}

    // Collect all phx-value-* attributes
    for (const attr of target.attributes) {
      if (attr.name.startsWith('phx-value-')) {
        const key = attr.name.replace('phx-value-', '')
        values[key] = attr.value
      }
    }

    console.group(`%c[Event] ${eventName}`, 'color: #3b82f6; font-weight: bold')
    console.log('Type:', 'click')
    console.log('Values:', Object.keys(values).length > 0 ? values : '(none)')
    console.log('Target:', target)
    console.groupEnd()
  }
}, true)

// Intercept form submissions with phx-submit
document.addEventListener('submit', function(e) {
  if (!window._eventDebugEnabled) return

  const form = e.target.closest('[phx-submit]')
  if (form) {
    const eventName = form.getAttribute('phx-submit')
    const formData = new FormData(form)
    const values = {}

    for (const [key, value] of formData.entries()) {
      values[key] = value
    }

    console.group(`%c[Event] ${eventName}`, 'color: #8b5cf6; font-weight: bold')
    console.log('Type:', 'submit')
    console.log('Form Data:', values)
    console.log('Target:', form)
    console.groupEnd()
  }
}, true)

// Intercept change events with phx-change
document.addEventListener('change', function(e) {
  if (!window._eventDebugEnabled) return

  const target = e.target.closest('[phx-change]')
  if (target) {
    const eventName = target.getAttribute('phx-change')

    console.group(`%c[Event] ${eventName}`, 'color: #f59e0b; font-weight: bold')
    console.log('Type:', 'change')
    console.log('Value:', e.target.value)
    console.log('Target:', e.target)
    console.groupEnd()
  }
}, true)

// The lines below enable quality of life phoenix_live_reload
// development features:
//
//     1. stream server logs to the browser console
//     2. click on elements to jump to their definitions in your code editor
//
if (process.env.NODE_ENV === "development") {
  window.addEventListener("phx:live_reload:attached", ({detail: reloader}) => {
    // Enable server log streaming to client.
    // Disable with reloader.disableServerLogs()
    reloader.enableServerLogs()

    // Open configured PLUG_EDITOR at file:line of the clicked element's HEEx component
    //
    //   * click with "c" key pressed to open at caller location
    //   * click with "d" key pressed to open at function component definition location
    let keyDown
    window.addEventListener("keydown", e => keyDown = e.key)
    window.addEventListener("keyup", _e => keyDown = null)
    window.addEventListener("click", e => {
      if(keyDown === "c"){
        e.preventDefault()
        e.stopImmediatePropagation()
        reloader.openEditorAtCaller(e.target)
      } else if(keyDown === "d"){
        e.preventDefault()
        e.stopImmediatePropagation()
        reloader.openEditorAtDef(e.target)
      }
    }, true)

    window.liveReloader = reloader
  })
}

