// Include phoenix_html to handle method=PUT/DELETE in forms and buttons.
import "phoenix_html"
// Establish Phoenix Socket and LiveView configuration.
import {Socket} from "phoenix"
import {LiveSocket} from "phoenix_live_view"
import {hooks as colocatedHooks} from "phoenix-colocated/loka"
import topbar from "../vendor/topbar"

// Hooks (one file per hook in hooks/ directory)
import Hooks from "./hooks/index.js"

const csrfToken = document.querySelector("meta[name='csrf-token']").getAttribute("content")
const liveSocket = new LiveSocket("/live", Socket, {
  longPollFallbackMs: 2500,
  params: {_csrf_token: csrfToken},
  hooks: {...colocatedHooks, ...Hooks},
})

// Show progress bar on live navigation and form submits
topbar.config({barColors: {0: "#222"}, shadowColor: "rgba(0, 0, 0, .1)"})
window.addEventListener("phx:page-loading-start", _info => topbar.show(300))
window.addEventListener("phx:page-loading-stop", _info => topbar.hide())

// connect if there are any LiveViews on the page
liveSocket.connect()

// Handle focus_search event from LiveView (World Builder keyboard shortcut)
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

if (process.env.NODE_ENV !== 'production') {
  // ===========================================================================
  // LiveView Event Debug Logger
  // ===========================================================================
  // Enable with: window.enableEventDebug() or in console: enableEventDebug()
  // Disable with: window.disableEventDebug() or: disableEventDebug()
  // Toggle with: window.toggleEventDebug() or: toggleEventDebug()
  //
  // This logs all LiveView events (phx-click, phx-submit, etc.) to the console
  // with their event names and payload data for debugging.
  // ===========================================================================

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
}

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
