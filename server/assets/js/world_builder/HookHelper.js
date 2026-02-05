/**
 * HookHelper - Auto-manages listener/observer/timer lifecycle for LiveView hooks.
 *
 * Prevents memory leaks by tracking all event listeners, observers, and timers
 * added during a hook's lifetime, then cleaning them up in a single destroy() call.
 *
 * Usage:
 *   import { HookHelper } from '../world_builder/HookHelper.js'
 *
 *   // In hook mounted():
 *   this.helper = new HookHelper(this)
 *   this.helper.on(window, 'resize', handler)
 *   this.helper.on(document, 'keydown', handler, { capture: true })
 *   this.helper.observe(resizeObserver, el)
 *   this.helper.interval(fn, 5000)
 *
 *   // In hook destroyed():
 *   this.helper.destroy()
 */
class HookHelper {
  constructor(hook) {
    this.hook = hook
    this._listeners = []
    this._observers = []
    this._intervals = []
  }

  /**
   * Add an event listener that will be auto-removed on destroy().
   * Accepts the same arguments as EventTarget.addEventListener.
   */
  on(target, event, handler, options) {
    target.addEventListener(event, handler, options)
    this._listeners.push({ target, event, handler, options })
  }

  /**
   * Start observing an element with an observer (ResizeObserver, MutationObserver, etc.).
   * The observer will be auto-disconnected on destroy().
   */
  observe(observer, el) {
    observer.observe(el)
    // Only track each observer once for disconnect
    if (!this._observers.includes(observer)) {
      this._observers.push(observer)
    }
  }

  /**
   * Create a setInterval that will be auto-cleared on destroy().
   * Returns the interval ID.
   */
  interval(fn, ms) {
    const id = setInterval(fn, ms)
    this._intervals.push(id)
    return id
  }

  /**
   * Remove all listeners, disconnect all observers, clear all intervals.
   */
  destroy() {
    for (const { target, event, handler, options } of this._listeners) {
      target.removeEventListener(event, handler, options)
    }
    this._listeners = []

    for (const observer of this._observers) {
      observer.disconnect()
    }
    this._observers = []

    for (const id of this._intervals) {
      clearInterval(id)
    }
    this._intervals = []
  }
}

export { HookHelper }
export default HookHelper
