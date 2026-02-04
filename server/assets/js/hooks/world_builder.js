import Canvas2DViewport from "../world_builder/Canvas2DViewport.js"
import { undoManager } from "../world_builder/UndoManager.js"
import { keyboardManager } from "../world_builder/KeyboardManager.js"

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

    // Register keyboard shortcuts via KeyboardManager (single document listener)
    this.registerKeyboardShortcuts()

    // Setup Z-level tab click handlers (stored for cleanup)
    this.zLevelClickHandler = (e) => {
      const btn = e.target.closest('[data-z-level]')
      if (btn) {
        const level = parseInt(btn.dataset.zLevel)
        this.viewport.setZLevel(level)
        this.updateZLevelTabs()
      }
    }
    const tabContainer = document.querySelector('.z-level-tabs')
    if (tabContainer) {
      tabContainer.addEventListener('click', this.zLevelClickHandler)
    }
  },

  registerKeyboardShortcuts() {
    // Undo/Redo
    keyboardManager.register('wb-undo', { key: 'z', mod: true, shift: false }, () => {
      undoManager.undo()
    })
    keyboardManager.register('wb-redo-z', { key: 'z', mod: true, shift: true }, () => {
      undoManager.redo()
    })
    keyboardManager.register('wb-redo-y', { key: 'y', mod: true }, () => {
      undoManager.redo()
    })

    // Save (validate)
    keyboardManager.register('wb-save', { key: 's', mod: true }, () => {
      this.pushEvent('validate_all', {})
    })

    // Delete selected
    keyboardManager.register('wb-delete', { key: 'delete', mod: false }, () => {
      if (this.selectedRoom) {
        this.pushEvent('delete_room', { id: this.selectedRoom })
      } else if (this.selectedKeys && this.selectedKeys.length > 0) {
        this.pushEvent('batch_delete', {})
      }
    }, { skipInputs: true })
    keyboardManager.register('wb-backspace', { key: 'backspace', mod: false }, () => {
      if (this.selectedRoom) {
        this.pushEvent('delete_room', { id: this.selectedRoom })
      } else if (this.selectedKeys && this.selectedKeys.length > 0) {
        this.pushEvent('batch_delete', {})
      }
    }, { skipInputs: true })

    // Duplicate
    keyboardManager.register('wb-duplicate', { key: 'd', mod: true }, () => {
      if (this.selectedEntity && this.selectedEntity.type && this.selectedEntity.key) {
        this.pushEvent('duplicate_entity', {
          type: this.selectedEntity.type,
          key: this.selectedEntity.key
        })
      } else if (this.selectedRoom && (!this.selectedKeys || this.selectedKeys.length <= 1)) {
        this.pushEvent('duplicate_room', { key: this.selectedRoom })
      } else if (this.selectedKeys && this.selectedKeys.length > 0) {
        this.pushEvent('batch_clone', { dx: 5, dy: 5, dz: 0 })
      }
    })

    // Select all
    keyboardManager.register('wb-select-all', { key: 'a', mod: true }, () => {
      const allKeys = this.rooms.map(r => r.key)
      this.selectedKeys = allKeys
      this.viewport.setSelectedKeys(allKeys)
      this.pushEvent('batch_select', { keys: allKeys })
    })

    // Escape: deselect (allowed in modals to close them)
    keyboardManager.register('wb-escape', { key: 'escape' }, () => {
      this.selectedRoom = null
      this.selectedEntity = null
      this.selectedKeys = []
      this.viewport.setSelectedRoom(null)
      this.viewport.setSelectedKeys([])
      this.pushEvent('batch_select', { keys: [] })
      this.pushEvent('select_room', { key: null })
      this.pushEvent('select_entity', { type: null, key: null })
    }, { skipInputs: false, skipModals: false })

    // Panel toggles (1-4)
    const panels = ['hierarchy', 'inspector', 'console', 'chat']
    panels.forEach((panel, i) => {
      keyboardManager.register(`wb-panel-${i + 1}`, { key: `${i + 1}` }, () => {
        this.pushEvent('toggle_panel', { panel })
      })
    })

    // Backtick: toggle console
    keyboardManager.register('wb-console', { key: '`' }, () => {
      this.pushEvent('toggle_panel', { panel: 'console' })
    })

    // N: new room
    keyboardManager.register('wb-new-room', { key: 'n' }, () => {
      this.pushEvent('create_room', {})
    })

    // /: focus search
    keyboardManager.register('wb-search', { key: '/' }, (e) => {
      const searchInput = document.querySelector('.hierarchy-search input')
      if (searchInput) searchInput.focus()
    })

    // Ctrl+G: git commit
    keyboardManager.register('wb-git', { key: 'g', mod: true }, () => {
      this.pushEvent('show_commit_modal', {})
    })

    // F: fit to rooms
    keyboardManager.register('wb-fit', { key: 'f' }, () => {
      this.viewport.fitToRooms()
    })

    // R: reset camera
    keyboardManager.register('wb-reset', { key: 'r' }, () => {
      this.viewport.resetCamera()
    })

    // Ctrl+Arrow: change Z-level
    keyboardManager.register('wb-zlevel-up', { key: 'arrowup', mod: true }, () => {
      const zLevels = this.viewport.getZLevels()
      const currentIdx = zLevels.indexOf(this.viewport.currentZLevel)
      if (currentIdx < zLevels.length - 1) {
        this.viewport.setZLevel(zLevels[currentIdx + 1])
        this.updateZLevelTabs()
      }
    })
    keyboardManager.register('wb-zlevel-down', { key: 'arrowdown', mod: true }, () => {
      const zLevels = this.viewport.getZLevels()
      const currentIdx = zLevels.indexOf(this.viewport.currentZLevel)
      if (currentIdx > 0) {
        this.viewport.setZLevel(zLevels[currentIdx - 1])
        this.updateZLevelTabs()
      }
    })

    // Z: toggle zone colors
    keyboardManager.register('wb-zones', { key: 'z' }, () => {
      this.pushEvent('toggle_zone_colors', {})
    })

    // P: toggle NPC paths
    keyboardManager.register('wb-paths', { key: 'p' }, () => {
      this.pushEvent('toggle_npc_paths', {})
    })

    // ?: keyboard help
    keyboardManager.register('wb-help', { key: '?' }, () => {
      this.pushEvent('show_keyboard_help', {})
    })
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

  updated() {
    // With phx-update="ignore", this should rarely be called
  },

  destroyed() {
    // Cleanup viewport
    if (this.viewport) {
      this.viewport.destroy()
    }
    // Unregister all keyboard shortcuts (prefix-based cleanup)
    keyboardManager.unregisterAll('wb-')
    // Cleanup z-level tab click handler
    if (this.zLevelClickHandler) {
      const tabContainer = document.querySelector('.z-level-tabs')
      if (tabContainer) tabContainer.removeEventListener('click', this.zLevelClickHandler)
    }
    // Cleanup undo manager
    undoManager.destroy()
  }
}

export default WorldBuilder
