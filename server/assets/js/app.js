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

// React and World Builder
import React from "react"
import { createRoot } from "react-dom/client"
import WorldBuilderApp from "./world_builder/App.jsx"
import QuestEditor from "./world_builder/editors/QuestEditor.jsx"
import CutsceneTimeline from "./world_builder/editors/CutsceneTimeline.jsx"

// Custom hooks for ebook-style game client
const Hooks = {
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
  // World Builder - React Three Fiber 3D editor
  // =============================================================================
  WorldBuilder: {
    mounted() {
      // Parse initial rooms data from data attribute
      const roomsData = JSON.parse(this.el.dataset.rooms || '[]')

      // Create React root and mount app
      this.root = createRoot(this.el)
      this.rooms = roomsData
      this.selectedRoom = null
      this.selectedKeys = []

      this.render()

      // Listen for room selection events from LiveView
      this.handleEvent('select_room', ({ key }) => {
        this.selectedRoom = key
        this.render()
      })

      // Listen for init event with rooms data
      this.handleEvent('init_world_builder', ({ rooms }) => {
        this.rooms = rooms
        this.render()
      })

      // Listen for room created event
      this.handleEvent('room_created', ({ room }) => {
        this.rooms = [...this.rooms, room]
        this.selectedRoom = room.key
        this.render()
      })

      // Listen for room updated event
      this.handleEvent('room_updated', ({ room }) => {
        this.rooms = this.rooms.map(r =>
          (r.id === room.id || r.key === room.key) ? room : r
        )
        this.render()
      })

      // Listen for room deleted event
      this.handleEvent('room_deleted', ({ id }) => {
        this.rooms = this.rooms.filter(r => r.id !== id && r.key !== id)
        this.selectedRoom = null
        this.render()
      })
    },

    updated() {
      // Re-parse rooms data when LiveView updates
      const roomsData = JSON.parse(this.el.dataset.rooms || '[]')
      this.rooms = roomsData
      this.render()
    },

    destroyed() {
      // Cleanup React root
      if (this.root) {
        this.root.unmount()
      }
    },

    render() {
      this.root.render(
        React.createElement(WorldBuilderApp, {
          rooms: this.rooms,
          selectedRoom: this.selectedRoom,
          onSelectRoom: (key) => {
            this.pushEvent('select_room', { key })
          },
          onBatchSelect: (keys) => {
            this.selectedKeys = keys
            this.pushEvent('batch_select', { keys })
          }
        })
      )
    }
  },

  // =============================================================================
  // Quest Editor - ReactFlow node-based quest builder
  // =============================================================================
  QuestEditor: {
    mounted() {
      // Create React root and mount QuestEditor component
      this.root = createRoot(this.el)

      const onSave = (questData) => {
        this.pushEvent('create_quest', questData)
      }

      const onCancel = () => {
        this.pushEvent('close_quest_editor', {})
      }

      this.root.render(
        React.createElement(QuestEditor, {
          onSave,
          onCancel,
          initialData: null
        })
      )
    },

    destroyed() {
      if (this.root) {
        this.root.unmount()
      }
    }
  },

  // =============================================================================
  // Cutscene Editor - Timeline-based cutscene builder
  // =============================================================================
  CutsceneEditor: {
    mounted() {
      // Create React root and mount CutsceneTimeline component
      this.root = createRoot(this.el)

      const onSave = (cutsceneData) => {
        this.pushEvent('create_cutscene', cutsceneData)
      }

      const onCancel = () => {
        this.pushEvent('close_cutscene_editor', {})
      }

      this.root.render(
        React.createElement(CutsceneTimeline, {
          onSave,
          onCancel,
          initialData: null
        })
      )
    },

    destroyed() {
      if (this.root) {
        this.root.unmount()
      }
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
  },

  handleDisconnect() {
    if (this.lastStatus === 'disconnected') return

    this.lastStatus = 'disconnected'
    this.wasDisconnected = true
    this.addEventLogMessage('[Connection lost... reconnecting]')
    this.announceToScreenReader('Connection lost. Attempting to reconnect.')
  },

  handleReconnect() {
    if (this.lastStatus === 'connected') return

    this.lastStatus = 'connected'

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

