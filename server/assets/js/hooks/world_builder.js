import Canvas2DViewport from "../world_builder/Canvas2DViewport.js"
import { undoManager } from "../world_builder/UndoManager.js"

// World Builder - 2D Canvas viewport (replaced React Three Fiber 3D)
const WorldBuilder = {
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
}

export default WorldBuilder
