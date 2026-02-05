/**
 * @file WorldBuilder - Main hook for 2D canvas viewport and editor orchestration
 * @context
 *   - Manages Canvas2DViewport for 2D room map visualization
 *   - Handles room/entity selection, multi-select, and keyboard shortcuts
 *   - Coordinates with UndoManager for undo/redo operations
 *   - Registers keyboard shortcuts via KeyboardManager (mod+z, mod+s, Delete, etc.)
 *   - Listens for LiveView events: init_world_builder, rooms_updated, room_created, etc.
 *   - Pushes events to server: select_room, batch_select, delete_room, validate_all, etc.
 *   - Persists panel collapsed state to localStorage ('world_builder_collapsed_panels')
 *   - Z-level tabs for multi-floor navigation
 * @related
 *   - assets/js/world_builder/Canvas2DViewport.js (2D rendering)
 *   - assets/js/world_builder/KeyboardShortcuts.js (shortcut definitions)
 *   - assets/js/world_builder/UndoManager.js (undo/redo stack)
 *   - lib/loka_web/live/admin_live/world_builder_live.ex (server-side LiveView)
 */

import Canvas2DViewport from '../world_builder/Canvas2DViewport.js'
import { undoManager } from '../world_builder/UndoManager.js'
import { keyboardManager } from '../world_builder/KeyboardManager.js'
import { registerWorldBuilderShortcuts } from '../world_builder/KeyboardShortcuts.js'
import { HookHelper } from '../world_builder/HookHelper.js'
import { STORAGE_KEYS } from '../world_builder/storageKeys.js'

const WorldBuilder = {
  mounted() {
    try {
      this.helper = new HookHelper(this)
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
        },
      })

      // Listen for room selection events from LiveView
      this.handleEvent('select_room', ({ key }) => {
        this.selectedRoom = key
        this.selectedEntity = null // Clear entity selection when room selected
        this.viewport.setSelectedRoom(key)
      })

      // Listen for entity selection events (NPC/Item)
      this.handleEvent('select_entity', ({ type, key }) => {
        this.selectedEntity = { type, key }
        this.selectedRoom = null // Clear room selection when entity selected
        this.viewport.setSelectedRoom(null)
      })

      // Listen for Z-level changes
      this.handleEvent('set_z_level', ({ level }) => {
        this.viewport.setZLevel(level)
      })

      // Listen for init event with rooms and validation data
      this.handleEvent(
        'init_world_builder',
        ({
          rooms,
          validation,
          zone_colors,
          room_zone_map,
          show_zone_colors,
          npc_paths,
          show_npc_paths,
        }) => {
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
        }
      )

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
        this.rooms = this.rooms.map((r) => (r.id === room.id || r.key === room.key ? room : r))
        this.viewport.setRooms(this.rooms)
      })

      // Listen for room deleted event
      this.handleEvent('room_deleted', ({ id }) => {
        this.rooms = this.rooms.filter((r) => r.id !== id && r.key !== id)
        this.selectedRoom = null
        this.viewport.setRooms(this.rooms)
        this.viewport.setSelectedRoom(null)
        this.updateZLevelTabs()
      })

      // Listen for panel collapsed events (for localStorage sync)
      this.handleEvent('panel_collapsed', ({ panels }) => {
        try {
          localStorage.setItem(STORAGE_KEYS.COLLAPSED_PANELS, JSON.stringify(panels))
        } catch (err) {
          console.warn('[WorldBuilder] Failed to save panel state:', err)
        }
      })

      // Restore collapsed state from localStorage on mount
      try {
        const savedPanels = localStorage.getItem(STORAGE_KEYS.COLLAPSED_PANELS)
        if (savedPanels) {
          const panels = JSON.parse(savedPanels)
          if (panels.hierarchy) this.pushEvent('toggle_panel', { panel: 'hierarchy' })
          if (panels.inspector) this.pushEvent('toggle_panel', { panel: 'inspector' })
          if (panels.console) this.pushEvent('toggle_panel', { panel: 'console' })
        }
      } catch (err) {
        console.warn('[WorldBuilder] Failed to restore panel state:', err)
        localStorage.removeItem(STORAGE_KEYS.COLLAPSED_PANELS)
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

      // Setup Z-level tab click handlers
      const tabContainer = document.querySelector('.z-level-tabs')
      if (tabContainer) {
        this.helper.on(tabContainer, 'click', (e) => {
          const btn = e.target.closest('[data-z-level]')
          if (btn) {
            const level = parseInt(btn.dataset.zLevel)
            this.viewport.setZLevel(level)
            this.updateZLevelTabs()
          }
        })
      }
    } catch (err) {
      console.error('[WorldBuilder] Failed to initialize:', err)
    }
  },

  registerKeyboardShortcuts() {
    const actions = {
      undo: () => undoManager.undo(),
      redo: () => undoManager.redo(),
      save: () => this.pushEvent('validate_all', {}),
      deleteSelected: () => {
        if (this.selectedRoom) {
          this.pushEvent('delete_room', { id: this.selectedRoom })
        } else if (this.selectedKeys && this.selectedKeys.length > 0) {
          this.pushEvent('batch_delete', {})
        }
      },
      duplicate: () => {
        if (this.selectedEntity && this.selectedEntity.type && this.selectedEntity.key) {
          this.pushEvent('duplicate_entity', {
            type: this.selectedEntity.type,
            key: this.selectedEntity.key,
          })
        } else if (this.selectedRoom && (!this.selectedKeys || this.selectedKeys.length <= 1)) {
          this.pushEvent('duplicate_room', { key: this.selectedRoom })
        } else if (this.selectedKeys && this.selectedKeys.length > 0) {
          this.pushEvent('batch_clone', { dx: 5, dy: 5, dz: 0 })
        }
      },
      selectAll: () => {
        const allKeys = this.rooms.map((r) => r.key)
        this.selectedKeys = allKeys
        this.viewport.setSelectedKeys(allKeys)
        this.pushEvent('batch_select', { keys: allKeys })
      },
      escape: () => {
        this.selectedRoom = null
        this.selectedEntity = null
        this.selectedKeys = []
        this.viewport.setSelectedRoom(null)
        this.viewport.setSelectedKeys([])
        this.pushEvent('batch_select', { keys: [] })
        this.pushEvent('select_room', { key: null })
        this.pushEvent('select_entity', { type: null, key: null })
      },
      togglePanel_hierarchy: () => this.pushEvent('toggle_panel', { panel: 'hierarchy' }),
      togglePanel_inspector: () => this.pushEvent('toggle_panel', { panel: 'inspector' }),
      togglePanel_console: () => this.pushEvent('toggle_panel', { panel: 'console' }),
      togglePanel_chat: () => this.pushEvent('toggle_panel', { panel: 'chat' }),
      newRoom: () => this.pushEvent('create_room', {}),
      focusSearch: () => {
        const searchInput = document.querySelector('.hierarchy-search input')
        if (searchInput) searchInput.focus()
      },
      gitCommit: () => this.pushEvent('show_commit_modal', {}),
      toggleGrid: () => this.viewport.toggleGrid(),
      fitToRooms: () => this.viewport.fitToRooms(),
      resetCamera: () => this.viewport.resetCamera(),
      zLevelUp: () => {
        const zLevels = this.viewport.getZLevels()
        const currentIdx = zLevels.indexOf(this.viewport.currentZLevel)
        if (currentIdx < zLevels.length - 1) {
          this.viewport.setZLevel(zLevels[currentIdx + 1])
          this.updateZLevelTabs()
        }
      },
      zLevelDown: () => {
        const zLevels = this.viewport.getZLevels()
        const currentIdx = zLevels.indexOf(this.viewport.currentZLevel)
        if (currentIdx > 0) {
          this.viewport.setZLevel(zLevels[currentIdx - 1])
          this.updateZLevelTabs()
        }
      },
      toggleZoneColors: () => this.pushEvent('toggle_zone_colors', {}),
      toggleNPCPaths: () => this.pushEvent('toggle_npc_paths', {}),
      showHelp: () => this.pushEvent('show_keyboard_help', {}),
    }

    registerWorldBuilderShortcuts(keyboardManager, actions)
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
    // Cleanup listeners (z-level tabs, etc.)
    this.helper.destroy()
    // Cleanup undo manager
    undoManager.destroy()
  },
}

export default WorldBuilder
