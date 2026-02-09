/**
 * HookHelper - Auto-manages listener/observer/timer lifecycle for LiveView hooks.
 *
 * Prevents memory leaks by tracking all event listeners, observers, and timers
 * added during a hook's lifetime, then cleaning them up in a single destroy() call.
 *
 * @example
 * ```js
 * import { HookHelper } from './HookHelper.js'
 *
 * // In hook mounted():
 * this.helper = new HookHelper(this)
 * this.helper.on(window, 'resize', handler)
 * this.helper.on(document, 'keydown', handler, { capture: true })
 * this.helper.observe(resizeObserver, el)
 * this.helper.interval(fn, 5000)
 *
 * // In hook destroyed():
 * this.helper.destroy()
 * ```
 */

/**
 * @typedef {Object} ListenerEntry
 * @property {EventTarget} target - The event target
 * @property {string} event - The event name
 * @property {EventListener} handler - The event handler function
 * @property {AddEventListenerOptions} [options] - Optional event listener options
 */

/**
 * @typedef {Object} LiveViewHook
 * @property {HTMLElement} el - The hook's root element
 * @property {function(string, Object=, function=): void} pushEvent - Push event to LiveView
 * @property {function(string, function): void} handleEvent - Handle event from LiveView
 */

class HookHelper {
  /**
   * Creates a new HookHelper instance for managing lifecycle of listeners, observers, and timers.
   * @param {LiveViewHook} hook - The LiveView hook instance that owns this helper
   */
  constructor(hook) {
    /** @type {LiveViewHook} */
    this.hook = hook
    /** @type {ListenerEntry[]} */
    this._listeners = []
    /** @type {(ResizeObserver | MutationObserver | IntersectionObserver)[]} */
    this._observers = []
    /** @type {number[]} */
    this._intervals = []
  }

  /**
   * Add an event listener that will be auto-removed on destroy().
   * Accepts the same arguments as EventTarget.addEventListener.
   * @param {EventTarget} target - The target to add the listener to (window, document, element)
   * @param {string} event - The event name to listen for
   * @param {EventListener} handler - The event handler function
   * @param {AddEventListenerOptions} [options] - Optional event listener options (capture, passive, once)
   * @returns {void}
   */
  on(target, event, handler, options) {
    target.addEventListener(event, handler, options)
    this._listeners.push({ target, event, handler, options })
  }

  /**
   * Start observing an element with an observer (ResizeObserver, MutationObserver, etc.).
   * The observer will be auto-disconnected on destroy().
   * Each observer is only tracked once, even if observe() is called multiple times with the same observer.
   * @param {ResizeObserver | MutationObserver | IntersectionObserver} observer - The observer instance
   * @param {Element} el - The element to observe
   * @returns {void}
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
   * @param {Function} fn - The function to call at each interval
   * @param {number} ms - The interval duration in milliseconds
   * @returns {number} The interval ID (can be used with clearInterval if needed before destroy)
   */
  interval(fn, ms) {
    const id = setInterval(fn, ms)
    this._intervals.push(id)
    return id
  }

  /**
   * Remove all listeners, disconnect all observers, clear all intervals.
   * Should be called in the hook's destroyed() callback.
   * @returns {void}
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
